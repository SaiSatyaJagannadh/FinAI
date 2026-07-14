/**
 * Unit tests for the five scoring services in server/services/.
 * Fixture mirrors the exact shape services/stockDataService.py fetch_stock_data() emits:
 * - valuation under stockData.fundamental.*
 * - roe/roa/margins/debtToEquity/currentRatio/beta/volatility top-level
 * - growth fields as {yoy, qoq} objects, top-level
 * - debtToEquity as a ratio (yfinance % already divided by 100 in Python)
 */

const FundamentalAnalysisService = require('../server/services/fundamentalAnalysis');
const TechnicalAnalysisService = require('../server/services/technicalAnalysis');
const MutualFundAnalysisService = require('../server/services/mutualFundAnalysis');
const GrowthAnalysisService = require('../server/services/growthAnalysis');
const RiskAnalysisService = require('../server/services/riskAnalysis');

// Deterministic ~250-day price history (roughly what a 1y yfinance pull returns).
function buildPriceHistory(days = 250, startPrice = 1400) {
  const history = [];
  let close = startPrice;
  const start = new Date('2025-07-01T00:00:00Z');
  for (let i = 0; i < days; i++) {
    // deterministic pseudo-random walk
    const drift = Math.sin(i / 9) * 12 + Math.cos(i / 23) * 8;
    const open = close;
    close = Math.max(100, startPrice + i * 0.8 + drift);
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    history.push({
      date: new Date(start.getTime() + i * 86400000).toISOString(),
      open, high, low, close,
      volume: 4000000 + Math.round(Math.abs(Math.sin(i)) * 2000000)
    });
  }
  return history;
}

// Realistic INFY-like fixture matching fetch_stock_data() output exactly.
function buildStockData() {
  return {
    symbol: 'INFY',
    yahooSymbol: 'INFY.NS',
    exchange: 'NSE',
    success: true,
    fetchedAt: '2026-07-13T10:00:00',
    name: 'Infosys Limited',
    sector: 'IT_Services',
    industry: 'Information Technology Services',
    priceData: {
      current: 1580.5,
      previousClose: 1565.2,
      open: 1568.0,
      dayHigh: 1590.0,
      dayLow: 1560.0,
      volume: 5200000,
      avgVolume: 6100000,
      marketCap: 6560000000000
    },
    fundamental: {
      peRatio: 24.5,
      forwardPE: 22.1,
      pbRatio: 7.2,
      dividendYield: 2.6,
      eps: 64.5,
      bookValue: 219.4
    },
    roe: 31.8,
    roa: 21.3,
    profitMargin: 17.1,
    operatingMargin: 24.2,
    debtToEquity: 0.098, // ratio, NOT percentage (Python divides yfinance's 9.8 by 100)
    currentRatio: 2.3,
    quickRatio: 2.2,
    revenueGrowth: { yoy: 4.7, qoq: 0 },
    profitGrowth: { yoy: 7.1 },
    epsGrowth: { yoy: 7.1 },
    bookValueGrowth: { yoy: 0 },
    dividendGrowth: { yoy: 0 },
    beta: 0.62,
    volatility: 20,
    correlationToMarket: 0.7,
    totalDebt: 84000000000,
    totalCash: 250000000000,
    freeCashFlow: 310000000000,
    fiftyTwoWeekHigh: 2006.45,
    fiftyTwoWeekLow: 1307.0,
    fiftyDayAverage: 1552.3,
    twoHundredDayAverage: 1601.8,
    targetMeanPrice: 1720.0,
    recommendationKey: 'buy',
    priceHistory: buildPriceHistory()
  };
}

function expectScore0to100(score) {
  expect(typeof score).toBe('number');
  expect(Number.isNaN(score)).toBe(false);
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(100);
}

describe('fundamentalAnalysis', () => {
  test('realistic fixture -> overallScore in [0,100]', async () => {
    const result = await FundamentalAnalysisService.analyzeFundamentals(buildStockData());
    expectScore0to100(result.overallScore);
    // reads the real paths: PE from fundamental.*, ROE top-level
    expect(result.peRatio.trailing).toBe(24.5); // peRatio uses {trailing, forward}, not {value}
    expect(result.roe.value).toBe(31.8);
  });

  test('empty stockData does not throw', async () => {
    const result = await FundamentalAnalysisService.analyzeFundamentals({});
    expectScore0to100(result.overallScore);
  });
});

describe('technicalAnalysis', () => {
  test('realistic price history -> overallScore in [0,100]', () => {
    const result = TechnicalAnalysisService.analyzeTechnicals(buildStockData().priceHistory);
    expectScore0to100(result.overallScore);
  });

  test('empty price history does not throw', () => {
    const result = TechnicalAnalysisService.analyzeTechnicals([]);
    expectScore0to100(result.overallScore);
  });
});

describe('mutualFundAnalysis', () => {
  // The MF service exposes `score` (routes read mutualFundAnalysis.score), not overallScore.
  test('buildFromShareholding with real Screener-shaped input', () => {
    const result = MutualFundAnalysisService.buildFromShareholding({
      percentages: { promoter: 14.6, fii: 32.5, dii: 38.2, mf: 21.4, others: 14.7 },
      qoqChanges: { promoter: 0, fii: 0.5, dii: 1.2, mf: 0.9, others: -0.4 }
    });
    expectScore0to100(result.score);
    expect(result.sentiment).toBe('BULLISH'); // mf+fii QoQ = +1.4 > +0.1 threshold
    expect(result.topHolders[0].fundName).toBe('DIIs / Domestic Institutions'); // sorted by %
  });

  test('buildFromShareholding with empty/missing input does not throw', () => {
    expectScore0to100(MutualFundAnalysisService.buildFromShareholding(null).score);
    expectScore0to100(MutualFundAnalysisService.buildFromShareholding({}).score);
    expectScore0to100(
      MutualFundAnalysisService.buildFromShareholding({ percentages: {}, qoqChanges: {} }).score
    );
  });

  test('analyzeConvictionStockSymbol fallback (no fund data) does not throw', () => {
    const result = MutualFundAnalysisService.analyzeConvictionStockSymbol('INFY', []);
    expectScore0to100(result.score);
  });
});

describe('growthAnalysis', () => {
  test('realistic fixture -> overallScore in [0,100]', () => {
    const result = GrowthAnalysisService.analyzeGrowth(buildStockData());
    expectScore0to100(result.overallScore);
  });

  test('empty stockData does not throw', () => {
    const result = GrowthAnalysisService.analyzeGrowth({});
    expectScore0to100(result.overallScore);
  });
});

describe('riskAnalysis', () => {
  test('realistic fixture -> overallScore in [0,100]', () => {
    const result = RiskAnalysisService.analyzeRisk(buildStockData());
    expectScore0to100(result.overallScore);
  });

  test('empty stockData does not throw', () => {
    const result = RiskAnalysisService.analyzeRisk({});
    expectScore0to100(result.overallScore);
  });
});
