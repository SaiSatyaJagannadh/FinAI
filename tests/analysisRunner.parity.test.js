/**
 * Parity test: server/services/analysisRunner.js (stdin/stdout runner used by
 * the Streamlit deployment) must produce the same results as the inline
 * fan-out in server/routes/analysisRoutes.js.
 *
 * Expected values are computed in-process with the exact calls the route
 * makes; actual values come from spawning the runner and piping JSON to stdin.
 * Both sides are JSON round-tripped so serialization is a level field.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const FundamentalAnalysisService = require('../server/services/fundamentalAnalysis');
const TechnicalAnalysisService = require('../server/services/technicalAnalysis');
const MutualFundAnalysisService = require('../server/services/mutualFundAnalysis');
const GrowthAnalysisService = require('../server/services/growthAnalysis');
const RiskAnalysisService = require('../server/services/riskAnalysis');
const calculateRecommendation = require('../server/services/recommendation');

const RUNNER = path.join(__dirname, '..', 'server', 'services', 'analysisRunner.js');

// Deterministic ~250-day price history (sine wave + trend), same shape yfinance emits.
function buildPriceHistory(days = 250, startPrice = 1400) {
  const history = [];
  let close = startPrice;
  const start = new Date('2025-07-01T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const drift = Math.sin(i / 9) * 12 + Math.cos(i / 23) * 8;
    const open = close;
    close = Math.max(100, startPrice + i * 0.8 + drift);
    history.push({
      date: new Date(start.getTime() + i * 86400000).toISOString(),
      open,
      high: Math.max(open, close) * 1.01,
      low: Math.min(open, close) * 0.99,
      close,
      volume: 4000000 + Math.round(Math.abs(Math.sin(i)) * 2000000)
    });
  }
  return history;
}

// Realistic fixture matching services/stockDataService.py fetch_stock_data():
// valuation under fundamental.*, ratios top-level, growth as {yoy,qoq},
// debtToEquity as a ratio (not a percentage).
function buildStockData() {
  return {
    symbol: 'TEST',
    sector: 'IT_Services',
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
    debtToEquity: 0.098,
    currentRatio: 2.3,
    quickRatio: 2.2,
    revenueGrowth: { yoy: 4.7, qoq: 1.1 },
    profitGrowth: { yoy: 7.1, qoq: 0.8 },
    epsGrowth: { yoy: 7.1, qoq: 0.8 },
    bookValueGrowth: { yoy: 3.2, qoq: 0 },
    dividendGrowth: { yoy: 5.0, qoq: 0 },
    beta: 0.62,
    volatility: 20,
    priceHistory: buildPriceHistory()
  };
}

const screenerShareholding = {
  percentages: { promoter: 14, fii: 28, dii: 43, mf: 0, others: 13 },
  qoqChanges: { promoter: -0.1, fii: -1.8, dii: 2.1, mf: 0, others: -0.2 }
};

function runRunner(payload) {
  const stdout = execFileSync('node', [RUNNER], {
    input: JSON.stringify(payload),
    encoding: 'utf8'
  });
  return JSON.parse(stdout);
}

// Route/runner results go through JSON; normalize expected the same way.
const jsonClone = (obj) => JSON.parse(JSON.stringify(obj));

// The exact fan-out analysisRoutes.js performs.
async function computeExpected(stockData, shareholding, symbol) {
  const [fundamental, technical, mutualFund, growth, risk] = await Promise.all([
    FundamentalAnalysisService.analyzeFundamentals(stockData),
    TechnicalAnalysisService.analyzeTechnicals(stockData.priceHistory || []),
    shareholding
      ? MutualFundAnalysisService.buildFromShareholding(shareholding)
      : MutualFundAnalysisService.analyzeConvictionStockSymbol(symbol, []),
    GrowthAnalysisService.analyzeGrowth(stockData),
    RiskAnalysisService.analyzeRisk(stockData)
  ]);
  const recommendation = calculateRecommendation(
    { fundamental, technical, mutualFund, growth, risk },
    stockData.priceData?.current || 0
  );
  return { fundamental, technical, mutualFund, growth, risk, recommendation };
}

describe('analysisRunner.js parity with analysisRoutes.js fan-out', () => {
  test('with screenerShareholding: all five analyses + recommendation match', async () => {
    const stockData = buildStockData();
    const expected = await computeExpected(stockData, screenerShareholding, 'TEST');

    const actual = runRunner({ stockData, screenerShareholding, symbol: 'TEST' });
    expect(actual.error).toBeUndefined();

    // Runner adds ema20/ema50 to technical.movingAverages (routes add them to the
    // response separately) — assert them against _calculateEMA, then strip.
    const ema20 = TechnicalAnalysisService._calculateEMA(stockData.priceHistory, 20) || 0;
    const ema50 = TechnicalAnalysisService._calculateEMA(stockData.priceHistory, 50) || 0;
    expect(actual.technical.movingAverages.ema20).toBe(jsonClone(ema20));
    expect(actual.technical.movingAverages.ema50).toBe(jsonClone(ema50));
    delete actual.technical.movingAverages.ema20;
    delete actual.technical.movingAverages.ema50;

    expect(actual.fundamental).toEqual(jsonClone(expected.fundamental));
    expect(actual.technical).toEqual(jsonClone(expected.technical));
    expect(actual.mutualFund).toEqual(jsonClone(expected.mutualFund));
    expect(actual.growth).toEqual(jsonClone(expected.growth));
    expect(actual.risk).toEqual(jsonClone(expected.risk));

    expect(actual.overall).toEqual(jsonClone({
      fundamentalScore: expected.fundamental.overallScore,
      technicalScore: expected.technical.overallScore,
      convictionScore: expected.mutualFund.score,
      growthScore: expected.growth.overallScore,
      riskScore: expected.risk.overallScore,
      weightedScore: expected.recommendation.score,
      recommendation: expected.recommendation
    }));
  });

  test('with screenerShareholding null: falls back to analyzeConvictionStockSymbol', async () => {
    const stockData = buildStockData();
    const expectedMF = MutualFundAnalysisService.analyzeConvictionStockSymbol('TEST', []);

    const actual = runRunner({ stockData, screenerShareholding: null, symbol: 'TEST' });
    expect(actual.error).toBeUndefined();
    expect(actual.mutualFund).toEqual(jsonClone(expectedMF));
    expect(actual.overall.convictionScore).toBe(jsonClone(expectedMF.score));
  });
});
