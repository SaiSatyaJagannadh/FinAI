const mongoose = require('mongoose');

// Analysis schema to store analysis results for stocks
const analysisSchema = new mongoose.Schema({
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  // Fundamental Analysis (Mixed: shape evolves with the analysis services,
  // and the 1-hour cache path serves this doc back to the frontend as-is)
  fundamental: { type: mongoose.Schema.Types.Mixed },
  // Technical Analysis
  technical: {
    rsi: Number,
    macd: {
      line: Number,
      signal: Number,
      histogram: Number
    },
    movingAverages: {
      sma50: Number,
      sma200: Number,
      ema20: Number,
      ema50: Number
    },
    bollingerBands: {
      upper: Number,
      middle: Number,
      lower: Number
    },
    supportResistance: {
      support: [Number],
      resistance: [Number]
    },
    score: Number // 0-100
  },
  // Mutual Fund Conviction
  mutualFundConviction: {
    score: Number, // 0-100
    holdingPercentile: Number, // Percentile among all stocks
    topHolders: [
      {
        fundName: String,
        holdingPercentage: Number,
        rank: Number,
        changeLastQuarter: Number
      }
    ],
    sentiment: String, // 'Bullish', 'Neutral', 'Bearish'
    totalFundsHolding: Number,
    totalFundsAnalyzed: Number,
    averageHoldingPercentage: Number,
    maxHoldingPercentage: Number
  },
  // Growth Analysis (Mixed: carries quarterly trend data alongside the scores)
  growth: { type: mongoose.Schema.Types.Mixed },
  // Risk Analysis
  risk: {
    beta: Number,
    volatility: Number,
    maxDrawdown: Number,
    sectorConcentrationRisk: Number,
    geopoliticalRisk: Number,
    disruptionRisk: Number,
    score: Number // 0-100 (lower is better risk)
  },
  // Overall Scores
  overall: {
    fundamentalScore: Number,
    technicalScore: Number,
    convictionScore: Number,
    growthScore: Number,
    riskScore: Number,
    weightedScore: Number,
  recommendation: {
  action: {
    type: String,
    enum: ['BUY', 'HOLD', 'SELL']
  },
  confidence: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH']
  },
  targetPrice: Number,
  stopLoss: Number,
  investmentHorizon: {
    type: String,
    enum: ['SHORT-TERM', 'MEDIUM-TERM', 'LONG-TERM']
  },
  score: Number
}
  },
  // Exact response-shaped analysis object (what the frontend consumes).
  // Served verbatim on cache hits — the typed fields above are a flattened
  // storage shape the frontend can't read (e.g. rsi as a bare Number).
  response: { type: mongoose.Schema.Types.Mixed },
  // Metadata
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  dataSources: [String], // Which APIs/data sources were used
  schemaVersion: Number, // Bumped when analysis output shape changes (cache invalidation)
  notes: String
}, {
  timestamps: true
});

// Indexes for querying
analysisSchema.index({ stock: 1, analyzedAt: -1 });
analysisSchema.index({ 'overall.recommendation.action': 1 });
analysisSchema.index({ 'overall.weightedScore': -1 });

module.exports = mongoose.model('Analysis', analysisSchema);