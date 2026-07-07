const mongoose = require('mongoose');

// Analysis schema to store analysis results for stocks
const analysisSchema = new mongoose.Schema({
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true
  },
  // Fundamental Analysis
  fundamental: {
    peRatio: {
      trailing: Number,
      forward: Number,
      score: Number, // 0-100
      interpretation: String
    },
    pegRatio: {
      value: Number,
      score: Number, // 0-100
      interpretation: String
    },
    priceToBook: Number,
    debtToEquity: Number,
    currentRatio: Number,
    roe: Number, // Return on Equity
    roa: Number, // Return on Assets
    profitMargin: Number,
    scores: {
      valuation: Number, // 0-100
      profitability: Number, // 0-100
      financialHealth: Number, // 0-100
      growth: Number // 0-100
    }
  },
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
    sentiment: String // 'Bullish', 'Neutral', 'Bearish'
  },
  // Growth Analysis
  growth: {
    revenueGrowth: {
      qoq: Number,
      yoy: Number,
      score: Number
    },
    profitGrowth: {
      qoq: Number,
      yoy: Number,
      score: Number
    },
    epsGrowth: {
      qoq: Number,
      yoy: Number,
      score: Number
    },
    score: Number // 0-100
  },
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
  // Metadata
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  dataSources: [String], // Which APIs/data sources were used
  notes: String
}, {
  timestamps: true
});

// Indexes for querying
analysisSchema.index({ stock: 1, analyzedAt: -1 });
analysisSchema.index({ 'overall.recommendation.action': 1 });
analysisSchema.index({ 'overall.weightedScore': -1 });

module.exports = mongoose.model('Analysis', analysisSchema);