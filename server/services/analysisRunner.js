#!/usr/bin/env node
/**
 * Standalone analysis runner — no express, no mongoose, no npm deps.
 * Used by the Streamlit deployment (streamlit_app.py) to run the exact same
 * five scoring services + recommendation as POST /api/analysis/:symbol.
 *
 * stdin:  {"stockData": <merged yfinance+screener object>, "screenerShareholding": <or null>, "symbol": "INFY"}
 * stdout: {"fundamental", "technical", "mutualFund", "growth", "risk", "overall"}
 */
const FundamentalAnalysisService = require('./fundamentalAnalysis');
const TechnicalAnalysisService = require('./technicalAnalysis');
const MutualFundAnalysisService = require('./mutualFundAnalysis');
const GrowthAnalysisService = require('./growthAnalysis');
const RiskAnalysisService = require('./riskAnalysis');
const calculateRecommendation = require('./recommendation');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', async () => {
  try {
    const { stockData, screenerShareholding, symbol } = JSON.parse(input);

    // Same fan-out as analysisRoutes.js
    const [fundamental, technical, mutualFund, growth, risk] = await Promise.all([
      FundamentalAnalysisService.analyzeFundamentals(stockData),
      TechnicalAnalysisService.analyzeTechnicals(stockData.priceHistory || []),
      screenerShareholding
        ? MutualFundAnalysisService.buildFromShareholding(screenerShareholding)
        : MutualFundAnalysisService.analyzeConvictionStockSymbol(symbol || '', []),
      GrowthAnalysisService.analyzeGrowth(stockData),
      RiskAnalysisService.analyzeRisk(stockData)
    ]);

    const recommendation = calculateRecommendation(
      { fundamental, technical, mutualFund, growth, risk },
      stockData.priceData?.current || 0
    );

    technical.movingAverages.ema20 = TechnicalAnalysisService._calculateEMA(stockData.priceHistory || [], 20) || 0;
    technical.movingAverages.ema50 = TechnicalAnalysisService._calculateEMA(stockData.priceHistory || [], 50) || 0;

    process.stdout.write(JSON.stringify({
      fundamental,
      technical,
      mutualFund,
      growth,
      risk,
      overall: {
        fundamentalScore: fundamental.overallScore,
        technicalScore: technical.overallScore,
        convictionScore: mutualFund.score,
        growthScore: growth.overallScore,
        riskScore: risk.overallScore,
        weightedScore: recommendation.score,
        recommendation
      }
    }));
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
});
