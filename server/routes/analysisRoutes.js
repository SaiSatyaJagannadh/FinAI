const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const Stock = require('../models/Stock');
const Analysis = require('../models/Analysis');
const FundamentalAnalysisService = require('../services/fundamentalAnalysis');
const TechnicalAnalysisService = require('../services/technicalAnalysis');
const MutualFundAnalysisService = require('../services/mutualFundAnalysis');
const GrowthAnalysisService = require('../services/growthAnalysis');
const RiskAnalysisService = require('../services/riskAnalysis');

// Paths for Python stock data service — derived from repo layout, overridable for deployment
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');
const STOCK_DATA_SERVICE = path.join(PROJECT_ROOT, 'services/stockDataService.py');
const SCREENER_SERVICE = path.join(PROJECT_ROOT, 'services/screenerService.py');
const PYTHON_BIN = process.env.PYTHON_BIN || path.join(PROJECT_ROOT, '.venv/bin/python3');

/**
 * Fetch real stock data from yfinance service
 */
async function fetchRealStockData(symbol, exchange = 'NSE') {
  return new Promise((resolve, reject) => {
    // Use absolute paths to avoid working directory issues
    const cmd = `"${PYTHON_BIN}" "${STOCK_DATA_SERVICE}" "${symbol}" --exchange ${exchange} --period 1y --json`;

    exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
      // More detailed error logging
      if (error) {
        console.error('Stock data fetch error:', error.message);
        if (stderr) console.error('stderr:', stderr);
        resolve(null); // Return null on error, will fall back to mock
        return;
      }

      try {
        const data = JSON.parse(stdout);
        if (data.error) {
          console.error('Stock service error:', data.error);
          resolve(null);
          return;
        }
        resolve(data);
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        resolve(null);
      }
    });
  });
}

/**
 * Fetch Indian fundamentals + shareholding from the Screener.in scraper.
 * Returns null on any failure; callers fall back to yfinance `info.*`.
 */
async function fetchScreenerData(symbol) {
  return new Promise((resolve) => {
    const cmd = `"${PYTHON_BIN}" "${SCREENER_SERVICE}" "${symbol}" --json`;
    exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout) => {
      if (error) {
        console.error('Screener fetch error:', error.message.split('\n')[0]);
        return resolve(null);
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        console.error('Screener parse error:', e.message);
        resolve(null);
      }
    });
  });
}

// Comprehensive stock analysis endpoint
router.post('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'NSE', depth = 'standard' } = req.body;
    const forceRefresh = req.body.forceRefresh || false;

    // Find or create stock — do NOT gate analysis on prior DB presence.
    // Any symbol the user types should be analyzable (real data fetched below).
    const symbolUpper = symbol.toUpperCase();
    const stock = await Stock.findOrCreate(symbolUpper, exchange);
    if (!stock) {
      return res.status(500).json({
        message: 'Could not resolve stock',
        symbol: symbolUpper,
        exchange
      });
    }

    // Check if we have recent analysis (unless forcing refresh)
    if (!forceRefresh) {
      const recentAnalysis = await Analysis.findOne({
        stock: stock._id
      }).sort({ analyzedAt: -1 });

      // If analysis is less than 1 hour old, return cached result
      if (recentAnalysis &&
          (Date.now() - recentAnalysis.analyzedAt.getTime()) < 3600000) {
        return res.json({
          ...stock.toObject(),
          analysis: recentAnalysis.toObject(),
          cached: true
        });
      }
    }

    // Try to fetch REAL data from yfinance
    let stockData = await fetchRealStockData(symbolUpper, exchange);
    let isRealData = false;
    let usedSources = ['SIMULATED_DATA'];
    let screenerShareholding = null;

    if (!stockData || !stockData.success) {
      console.log(`Could not fetch real data for ${symbolUpper}, using mock data`);
      stockData = await _generateMockStockData(stock);
      stockData.isReal = false;
    } else {
      console.log(`Real data fetched for ${symbolUpper}: ₹${stockData.priceData?.current}`);
      stockData.isReal = true;
      isRealData = true;
      usedSources = ['YAHOO_FINANCE'];

      // --- Enrich with Screener.in (Indian fundamentals + MF/FII/DII shareholding).
      // Silent fallback to yfinance on any scrape failure. ---
      const screener = await fetchScreenerData(symbolUpper);
      if (screener && screener.success) {
        usedSources.push('SCREENER_IN');
        if (!stockData.fundamental) stockData.fundamental = {};
        for (const k of ['peRatio', 'pbRatio', 'dividendYield', 'eps', 'bookValue']) {
          if (screener.fundamental && screener.fundamental[k]) stockData.fundamental[k] = screener.fundamental[k];
        }
        for (const k of ['roe', 'roa', 'profitMargin', 'operatingMargin', 'debtToEquity', 'currentRatio']) {
          if (screener[k]) stockData[k] = screener[k];
        }
        for (const k of ['revenueGrowth', 'profitGrowth', 'epsGrowth', 'bookValueGrowth', 'dividendGrowth']) {
          if (screener[k] && (screener[k].yoy || screener[k].qoq)) stockData[k] = screener[k];
        }
        if (screener.name) stockData.name = screener.name;
        if (screener.sector) stockData.sector = screener.sector;
        screenerShareholding = screener.shareholding || null;
      }

      // Update stock record with real data
      await Stock.findByIdAndUpdate(stock._id, {
        name: stockData.name || stock.name,
        sector: stockData.sector || stock.sector,
        'basicInfo.sector': stockData.sector || stock.sector,
        'basicInfo.industry': stockData.industry || stock.basicInfo?.industry,
        'priceData.current': stockData.priceData?.current,
        'priceData.change': (stockData.priceData?.current || 0) - (stockData.priceData?.previousClose || 0),
        'priceData.changePercent': (stockData.priceData?.previousClose > 0)
          ? (((stockData.priceData?.current || 0) - stockData.priceData?.previousClose) / stockData.priceData?.previousClose) * 100
          : 0,
        'priceData.previousClose': stockData.priceData?.previousClose,
        'priceData.open': stockData.priceData?.open,
        'priceData.dayHigh': stockData.priceData?.dayHigh,
        'priceData.dayLow': stockData.priceData?.dayLow,
        'priceData.volume': stockData.priceData?.volume,
        'priceData.avgVolume': stockData.priceData?.avgVolume,
        'priceData.peRatio': stockData.fundamental?.peRatio,
        'priceData.pbRatio': stockData.fundamental?.pbRatio,
        'priceData.dividendYield': stockData.fundamental?.dividendYield,
        'priceData.updatedAt': new Date(),
        'week52.high': stockData.fiftyTwoWeekHigh,
        'week52.low': stockData.fiftyTwoWeekLow,
        marketCapValue: stockData.priceData?.marketCap ? stockData.priceData.marketCap / 1e7 : stock.marketCapValue,
        priceHistory: (stockData.priceHistory || []).slice(-260),
        lastUpdated: new Date()
      });
    }

    // Run all analyses
    const [
      fundamentalAnalysis,
      technicalAnalysis,
      mutualFundAnalysis,
      growthAnalysis,
      riskAnalysis
    ] = await Promise.all([
      FundamentalAnalysisService.analyzeFundamentals(stockData),
      TechnicalAnalysisService.analyzeTechnicals(stockData.priceHistory || []),
      screenerShareholding
        ? MutualFundAnalysisService.buildFromShareholding(screenerShareholding)
        : MutualFundAnalysisService.analyzeConvictionStockSymbol(stock.symbol, []),
      GrowthAnalysisService.analyzeGrowth(stockData),
      RiskAnalysisService.analyzeRisk(stockData)
    ]);

    // Calculate overall recommendation
    const recommendation = _calculateRecommendation({
      fundamental: fundamentalAnalysis,
      technical: technicalAnalysis,
      mutualFund: mutualFundAnalysis,
      growth: growthAnalysis,
      risk: riskAnalysis
    });

    // Calculate EMA20 and EMA50 for moving averages
    const priceData = stockData.priceHistory || [];
    const ema20 = TechnicalAnalysisService._calculateEMA(priceData, 20);
    const ema50 = TechnicalAnalysisService._calculateEMA(priceData, 50);

    // Prepare data for database storage (matching schema)
    const analysisData = {
      stock: stock._id,

      fundamental: {
        peRatio: fundamentalAnalysis.peRatio,
        pegRatio: fundamentalAnalysis.pegRatio,
        priceToBook: (fundamentalAnalysis.priceToBook.value !== undefined && fundamentalAnalysis.priceToBook.value !== null) ? fundamentalAnalysis.priceToBook.value : fundamentalAnalysis.priceToBook,
        debtToEquity: (fundamentalAnalysis.debtToEquity.value !== undefined && fundamentalAnalysis.debtToEquity.value !== null) ? fundamentalAnalysis.debtToEquity.value : fundamentalAnalysis.debtToEquity,
        currentRatio: (fundamentalAnalysis.currentRatio.value !== undefined && fundamentalAnalysis.currentRatio.value !== null) ? fundamentalAnalysis.currentRatio.value : fundamentalAnalysis.currentRatio,
        roe: (fundamentalAnalysis.roe.value !== undefined && fundamentalAnalysis.roe.value !== null) ? fundamentalAnalysis.roe.value : fundamentalAnalysis.roe,
        roa: (fundamentalAnalysis.roa.value !== undefined && fundamentalAnalysis.roa.value !== null) ? fundamentalAnalysis.roa.value : fundamentalAnalysis.roa,
        profitMargin: (fundamentalAnalysis.profitMargin.value !== undefined && fundamentalAnalysis.profitMargin.value !== null) ? fundamentalAnalysis.profitMargin.value : fundamentalAnalysis.profitMargin,
        scores: fundamentalAnalysis.scores
      },
      technical: {
        rsi: (technicalAnalysis.rsi.value !== undefined && technicalAnalysis.rsi.value !== null) ? technicalAnalysis.rsi.value : 50,
        macd: {
          line: technicalAnalysis.macd.macd || 0,
          signal: technicalAnalysis.macd.signalLine || 0,
          histogram: technicalAnalysis.macd.histogram || 0
        },
        movingAverages: {
          sma50: technicalAnalysis.movingAverages.sma50 || 0,
          sma200: technicalAnalysis.movingAverages.sma200 || 0,
          ema20: ema20 || 0,
          ema50: ema50 || 0,
          trend: technicalAnalysis.movingAverages.trend || 'NEUTRAL'
        },
        bollingerBands: {
          upper: technicalAnalysis.bollingerBands.upper || 0,
          middle: technicalAnalysis.bollingerBands.middle || 0,
          lower: technicalAnalysis.bollingerBands.lower || 0
        },
        supportResistance: {
          support: technicalAnalysis.supportResistance.support || [],
          resistance: technicalAnalysis.supportResistance.resistance || []
        },
        score: technicalAnalysis.overallScore
      },
      mutualFundConviction: mutualFundAnalysis,
      growth: growthAnalysis,
      risk: {
        beta: riskAnalysis.marketRisk.beta || 1,
        volatility: riskAnalysis.marketRisk.volatility || 25,
        maxDrawdown: 0, // Placeholder - would need historical data to calculate
        sectorConcentrationRisk: 0, // Placeholder
        geopoliticalRisk: riskAnalysis.geopoliticalRisk.score || 0,
        disruptionRisk: riskAnalysis.disruptionRisk.score || 0,
        score: riskAnalysis.overallScore
      },

      overall: {
        fundamentalScore: fundamentalAnalysis.overallScore,
        technicalScore: technicalAnalysis.overallScore,
        convictionScore: mutualFundAnalysis.score,
        growthScore: growthAnalysis.overallScore,
        riskScore: riskAnalysis.overallScore,
        weightedScore: recommendation.score,
        recommendation
      },

      dataSources: usedSources,
      analyzedAt: new Date()
    };

    // Create analysis record with database-compatible data
    const analysis = new Analysis(analysisData);

    // Prepare response object matching frontend expectations
    const responseAnalysis = {
      stock: stock._id,

      fundamental: {
        peRatio: fundamentalAnalysis.peRatio,
        pegRatio: fundamentalAnalysis.pegRatio,
        priceToBook: (fundamentalAnalysis.priceToBook.value !== undefined && fundamentalAnalysis.priceToBook.value !== null) ? fundamentalAnalysis.priceToBook.value : fundamentalAnalysis.priceToBook,
        debtToEquity: (fundamentalAnalysis.debtToEquity.value !== undefined && fundamentalAnalysis.debtToEquity.value !== null) ? fundamentalAnalysis.debtToEquity.value : fundamentalAnalysis.debtToEquity,
        currentRatio: (fundamentalAnalysis.currentRatio.value !== undefined && fundamentalAnalysis.currentRatio.value !== null) ? fundamentalAnalysis.currentRatio.value : fundamentalAnalysis.currentRatio,
        roe: (fundamentalAnalysis.roe.value !== undefined && fundamentalAnalysis.roe.value !== null) ? fundamentalAnalysis.roe.value : fundamentalAnalysis.roe,
        roa: (fundamentalAnalysis.roa.value !== undefined && fundamentalAnalysis.roa.value !== null) ? fundamentalAnalysis.roa.value : fundamentalAnalysis.roa,
        profitMargin: (fundamentalAnalysis.profitMargin.value !== undefined && fundamentalAnalysis.profitMargin.value !== null) ? fundamentalAnalysis.profitMargin.value : fundamentalAnalysis.profitMargin,
        scores: fundamentalAnalysis.scores
      },
      technical: {
        rsi: {
          value: (technicalAnalysis.rsi.value !== undefined && technicalAnalysis.rsi.value !== null) ? technicalAnalysis.rsi.value : 50,
          signal: technicalAnalysis.rsi.signal || 'NEUTRAL'
        },
        macd: {
          macd: technicalAnalysis.macd.macd || 0,
          signal: technicalAnalysis.macd.signalLine || 0,
          histogram: technicalAnalysis.macd.histogram || 0
        },
        movingAverages: {
          sma50: technicalAnalysis.movingAverages.sma50 || 0,
          sma200: technicalAnalysis.movingAverages.sma200 || 0,
          ema20: ema20 || 0,
          ema50: ema50 || 0,
          trend: technicalAnalysis.movingAverages.trend || 'NEUTRAL'
        },
        bollingerBands: {
          upper: technicalAnalysis.bollingerBands.upper || 0,
          middle: technicalAnalysis.bollingerBands.middle || 0,
          lower: technicalAnalysis.bollingerBands.lower || 0
        },
        supportResistance: {
          support: technicalAnalysis.supportResistance.support || [],
          resistance: technicalAnalysis.supportResistance.resistance || []
        },
        score: technicalAnalysis.overallScore
      },
      mutualFundConviction: mutualFundAnalysis,
      growth: growthAnalysis,
      risk: {
        marketRisk: {
          beta: riskAnalysis.marketRisk.beta || 1,
          volatility: riskAnalysis.marketRisk.volatility || 25,
          correlationToMarket: riskAnalysis.marketRisk.correlationToMarket || 0.7
        },
        creditRisk: {
          debtToEquity: riskAnalysis.creditRisk.debtToEquity || 0,
          interestCoverage: riskAnalysis.creditRisk.interestCoverage || 0,
          currentRatio: riskAnalysis.creditRisk.currentRatio || 0
        },
        liquidityRisk: {
          averageVolume: riskAnalysis.liquidityRisk?.averageVolume || 0,
          bidAskSpread: riskAnalysis.liquidityRisk?.bidAskSpread || 0.5
        },
        operationalRisk: {
          roe: riskAnalysis.operationalRisk.roe || 0,
          roa: riskAnalysis.operationalRisk.roa || 0,
          operatingMargin: riskAnalysis.operationalRisk.operatingMargin || 0
        },
geopoliticalRisk: {
  foreignRevenue: riskAnalysis.geopoliticalRisk.foreignRevenue || 0,
  exportDependence: riskAnalysis.geopoliticalRisk.exportDependence || 0,
  countriesOperatedIn: riskAnalysis.geopoliticalRisk.countriesOperatedIn || [],
  countryCount: riskAnalysis.geopoliticalRisk.countryCount || 0
},
disruptionRisk: {
  rdIntensity: riskAnalysis.disruptionRisk.rdIntensity || 0,
  patentCount: riskAnalysis.disruptionRisk.patentCount || 0,
  averageAgeOfAssets: riskAnalysis.disruptionRisk.averageAgeOfAssets || 0,
  businessModelAge: riskAnalysis.disruptionRisk.businessModelAge || 0
},
maxDrawdown: 0, // Placeholder - would need historical data to calculate
sectorConcentrationRisk: 0, // Placeholder
score: riskAnalysis.overallScore
},

overall: {
  fundamentalScore: fundamentalAnalysis.overallScore,
  technicalScore: technicalAnalysis.overallScore,
  convictionScore: mutualFundAnalysis.score,
  growthScore: growthAnalysis.overallScore,
  riskScore: riskAnalysis.overallScore,
  weightedScore: recommendation.score,
  recommendation
},

dataSources: usedSources,
analyzedAt: new Date()
};

await analysis.save();

res.json({
  ...stock.toObject(),
  priceHistory: stockData.priceHistory || [],
  analysis: responseAnalysis,
  cached: false
});
} catch (error) {
console.error('Error analyzing stock:', error);
res.status(500).json({
  message: 'Error analyzing stock',
  error: process.env.NODE_ENV === 'development' ? error.message : undefined
});
}
});

// Get analysis history for a stock
router.get('/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 10 } = req.query;

    const stock = await Stock.findOne({
      symbol: symbol.toUpperCase()
    });

    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }

    const analyses = await Analysis.find({ stock: stock._id })
      .sort({ analyzedAt: -1 })
      .limit(parseInt(limit));

    res.json(analyses);
  } catch (error) {
    console.error('Error fetching analysis history:', error);
    res.status(500).json({
      message: 'Error fetching analysis history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to generate mock stock data (in real app, this would come from APIs)
async function _generateMockStockData(stock) {
  // In a real application, this would fetch data from financial APIs
  // For demonstration, we'll generate realistic-looking mock data based on the symbol

  let seed = stock.symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pseudoRandom = (min, max) => {
    // Simple deterministic random based on seed
    const x = Math.sin(seed++) * 10000;
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
  };

  // Determine sector based on symbol (simplified mapping)
  const sectorMap = {
    'RELIANCE': 'Energy',
    'TCS': 'IT_Services',
    'INFY': 'IT_Services',
    'HDFCBANK': 'Banking',
    'ICICIBANK': 'Banking',
    'HINDUNILVR': 'FMCG',
    'ITC': 'FMCG',
    'SBIN': 'Banking',
    'BHARTIARTL': 'Telecom',
    'KOTAKBANK': 'Banking',
    'LT': 'Construction',
    'ASIANPAINT': 'Paints',
    'MARUTI': 'Auto',
    'M&M': 'Auto',
    'SUNPHARMA': 'Pharma',
    'DRREDDY': 'Pharma',
    'HCLTECH': 'IT_Services',
    'WIPRO': 'IT_Services',
    'TECHM': 'IT_Services',
    'BAJFINANCE': 'Finance',
    'HDFC': 'Finance',
    'AXISBANK': 'Banking'
  };

  const sector = sectorMap[stock.symbol] || 'default';

  // Base values that vary by sector
  const sectorBase = {
    Energy: { pe: 8, pb: 1.2, debt: 0.4, roe: 12, growth: 8 },
    IT_Services: { pe: 22, pb: 5, debt: 0.1, roe: 22, growth: 12 },
    Banking: { pe: 10, pb: 1.5, debt: 0.6, roe: 14, growth: 10 },
    FMCG: { pe: 35, pb: 8, debt: 0.2, roe: 25, growth: 10 },
    Telecom: { pe: 18, pb: 2, debt: 0.7, roe: 10, growth: 8 },
    Construction: { pe: 15, pb: 2, debt: 0.5, roe: 15, growth: 10 },
    Pharma: { pe: 20, pb: 3, debt: 0.3, roe: 18, growth: 12 },
    Auto: { pe: 18, pb: 2, debt: 0.4, roe: 16, growth: 8 },
    default: { pe: 20, pb: 3, debt: 0.3, roe: 15, growth: 10 }
  }[sector] || sectorBase.default;

  // Add some variance based on our seed
  const variance = (pseudoRandom(0, 100) - 50) / 100; // -0.5 to 0.5

  // Generate historical price data (last 200 days for technical analysis)
  const priceDataArray = [];
  let basePrice = 100 + pseudoRandom(0, 900);

  // Generate approximately 200 days of historical data
  for (let i = 0; i < 200; i++) {
    const dayOffset = 200 - i; // Most recent day is last in array
    const dailyVolatility = 0.02; // 2% daily volatility

    // Generate OHLCV data with some random walk
    const change = (pseudoRandom(0, 100) - 50) / 100 * dailyVolatility;
    basePrice *= (1 + change);

    const open = basePrice * (1 + ((pseudoRandom(0, 100) - 50) / 100) * 0.01);
    const high = Math.max(open, basePrice) * (1 + Math.abs(pseudoRandom(0, 100) - 50) / 100 * 0.02);
    const low = Math.min(open, basePrice) * (1 - Math.abs(pseudoRandom(0, 100) - 50) / 100 * 0.02);
    const close = basePrice;
    const volume = 100000 + pseudoRandom(0, 900000);

    priceDataArray.push({
      open,
      high,
      low,
      close,
      volume,
      // For simplicity, we'll use the same date format for all
      date: new Date(Date.now() - (dayOffset * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
    });

    // Update basePrice for next iteration (slight mean reversion)
    basePrice = close * (1 + (pseudoRandom(0, 100) - 50) / 100 * 0.005);
  }

  // Current day's data (most recent)
  const currentData = priceDataArray[priceDataArray.length - 1];
  const previousClose = priceDataArray[priceDataArray.length - 2]?.close || currentData.close;

  return {
    symbol: stock.symbol,
    name: stock.name,
    sector,
    marketCap: 'large_cap',
    marketCapValue: 50000 + (pseudoRandom(0, 50000)), // 50,000-100,000 Cr
    priceData: {
      current: currentData.close,
      change: ((currentData.close - previousClose) / previousClose) * 100,
      changePercent: ((currentData.close - previousClose) / previousClose) * 100,
      previousClose: previousClose,
      open: currentData.open,
      dayHigh: currentData.high,
      dayLow: currentData.low,
      volume: currentData.volume,
      avgVolume: 150000 + pseudoRandom(0, 850000),
      peRatio: sectorBase.pe + variance * 5,
      pbRatio: sectorBase.pb + variance * 2,
      dividendYield: Math.max(0, 1 + ((pseudoRandom(0, 10) - 5) / 100)),
  },

  // Price history array for technical analysis
  priceHistory: priceDataArray,
  debtToEquity: Math.max(0, sectorBase.debt + variance * 0.3),
  roe: Math.max(0, sectorBase.roe + variance * 5),
  roa: Math.max(0, (sectorBase.roe * 0.6) + variance * 3),
  profitMargin: Math.max(0, (sectorBase.roe * 0.5) + variance * 4),
  currentRatio: Math.max(0.5, 1.5 + variance),
  bookValue: (currentData.close) / (sectorBase.pb + variance * 2),
  revenue: 1000 + pseudoRandom(0, 9000),
  revenueGrowth: {
    qoq: ((pseudoRandom(0, 20) - 10) / 2),
    yoy: Math.max(-5, sectorBase.growth + variance * 3)
  },
  profitGrowth: {
    qoq: ((pseudoRandom(0, 20) - 10) / 3),
    yoy: Math.max(-5, (sectorBase.growth * 0.8) + variance * 2)
  },
  epsGrowth: {
    qoq: ((pseudoRandom(0, 20) - 10) / 2),
    yoy: Math.max(-5, (sectorBase.growth * 0.9) + variance * 2.5)
  },
  bookValueGrowth: {
    qoq: ((pseudoRandom(0, 15) - 7.5) / 2),
    yoy: Math.max(-3, (sectorBase.growth * 0.6) + variance * 2)
  },
  dividendGrowth: {
    qoq: ((pseudoRandom(0, 10) - 5) / 2),
    yoy: Math.max(-2, (sectorBase.growth * 0.3) + variance * 1.5)
  },
  eps: (currentData.close) / (sectorBase.pe + variance * 5),
  beta: 0.8 + (pseudoRandom(0, 40) / 100), // 0.8 to 1.2
  volatility: 15 + (pseudoRandom(0, 30)), // 15-45%
  correlationToMarket: 0.5 + (pseudoRandom(0, 50) / 100), // 0.5-1.0
  interestCoverage: 3 + (pseudoRandom(0, 15)), // 3-18x
  // For risk analysis
  rdIntensity: Math.max(0, 2 + (pseudoRandom(0, 10) / 10)), // 2-12% R&D intensity
  patentCount: Math.floor(pseudoRandom(0, 1000)), // 0-1000 patents
  averageAgeOfAssets: 5 + (pseudoRandom(0, 15)), // 5-20 years
  businessModelAge: 10 + (pseudoRandom(0, 20)), // 10-30 years
  foreignRevenue: Math.max(0, 20 + (pseudoRandom(0, 60))), // 20-80% foreign revenue
  // Management guidance (for growth projections)
  managementGuidance: {
    epsGrowthNextYear: Math.max(-5, (sectorBase.growth * 0.8) + (pseudoRandom(0, 20) - 10)),
    revenueGrowthNextYear: Math.max(-5, sectorBase.growth + (pseudoRandom(0, 20) - 10))
  }
};
}

/**
 * Calculate investment recommendation based on all analyses
 */
function _calculateRecommendation(analyses) {
  const {
    fundamental,
    technical,
    mutualFund,
    growth,
    risk
  } = analyses;

  // Weighted scoring (higher is better)
  const scores = {
    fundamental: fundamental.overallScore || 50,
    technical: technical.overallScore || 50,
    mutualFund: mutualFund.score || 50,
    growth: growth.overallScore || 50,
    risk: 100 - (risk.overallScore || 50) // Invert risk score (lower risk = higher score)
  };

  // Weights for final score
  const weights = {
    fundamental: 0.25,
    technical: 0.20,
    mutualFund: 0.15,
    growth: 0.25,
    risk: 0.15
  };

  let weightedScore = 0;
  weightedScore += scores.fundamental * weights.fundamental;
  weightedScore += scores.technical * weights.technical;
  weightedScore += scores.mutualFund * weights.mutualFund;
  weightedScore += scores.growth * weights.growth;
  weightedScore += scores.risk * weights.risk;

  weightedScore = Math.round(weightedScore);

  // Determine recommendation based on score
  let action = 'HOLD';
  let confidence = 'MEDIUM';

  if (weightedScore >= 80) {
    action = 'BUY';
    confidence = 'HIGH';
  } else if (weightedScore >= 65) {
    action = 'BUY';
    confidence = 'MEDIUM';
  } else if (weightedScore >= 50) {
    action = 'HOLD';
    confidence = 'MEDIUM';
  } else if (weightedScore >= 35) {
    action = 'SELL';
    confidence = 'MEDIUM';
  } else {
    action = 'SELL';
    confidence = 'HIGH';
  }

  // Calculate target price (simplified)
  const currentPrice = 1000; // Would come from actual data
  let targetPrice = currentPrice;
  let stopLoss = currentPrice * 0.9; // 10% stop loss as default

  if (action === 'BUY') {
    targetPrice = currentPrice * (1 + (weightedScore - 50) / 100); // Up to 50% upside for score 100
  } else if (action === 'SELL') {
    targetPrice = currentPrice * (1 - (50 - weightedScore) / 150); // Up to 33% downside for score 0
    stopLoss = currentPrice * 0.95; // Tighter stop for sell recommendations
  }

  // Determine investment horizon
  let investmentHorizon = 'MEDIUM-TERM';
  if (weightedScore >= 75 && scores.fundamental >= 70 && scores.growth >= 70) {
    investmentHorizon = 'LONG-TERM'; // Strong fundamentals + growth = long term
  } else if (weightedScore < 40 && scores.technical < 40) {
    investmentHorizon = 'SHORT-TERM'; // Weak technicals = short term/scalp
  }

  return {
    action,
    confidence: confidence,
    targetPrice: parseFloat(targetPrice.toFixed(2)),
    stopLoss: parseFloat(stopLoss.toFixed(2)),
    investmentHorizon,
    score: weightedScore
  };
}

module.exports = router;