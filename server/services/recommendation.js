/**
 * Combines the five analysis scores into the final BUY/HOLD/SELL.
 * Extracted from analysisRoutes.js so the standalone runner (analysisRunner.js,
 * used by the Streamlit deployment) applies identical weights and thresholds.
 */
function calculateRecommendation(analyses, currentPrice = 0) {
  const {
    fundamental,
    technical,
    mutualFund,
    growth,
    risk
  } = analyses;

  // Weighted scoring (higher is better; ?? so a legitimate 0 isn't replaced)
  const scores = {
    fundamental: fundamental.overallScore ?? 50,
    technical: technical.overallScore ?? 50,
    mutualFund: mutualFund.score ?? 50,
    growth: growth.overallScore ?? 50,
    risk: risk.overallScore ?? 50 // Already higher = safer, no inversion
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
  if (!currentPrice) currentPrice = 1000; // Fallback for mock data path
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

module.exports = calculateRecommendation;
