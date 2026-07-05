const mongoose = require('mongoose');

// Portfolio schema for user watchlists and portfolios
const portfolioSchema = new mongoose.Schema({
  userId: {
    type: String, // In a real app, this would be a proper user ID from auth system
    required: true,
    default: 'default-user'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  stocks: [
    {
      stock: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
        required: true
      },
      allocatedPercentage: {
        type: Number,
        min: 0,
        max: 100
      },
      targetWeight: Number,
      currentWeight: Number,
      addedAt: {
        type: Date,
        default: Date.now
      },
      notes: String
    }
  ],
  // Allocation strategy
  allocationStrategy: {
    type: String,
    enum: ['equal_weight', 'market_cap', 'custom', 'sector_based'],
    default: 'equal_weight'
  },
  // Sector diversification targets
  sectorTargets: [
    {
      sector: String,
      targetPercentage: Number
    }
  ],
  // Performance tracking
  performance: {
    totalReturn: Number,
    dailyChange: Number,
    weeklyChange: Number,
    monthlyChange: Number,
    ytdChange: Number,
    lastUpdated: Date
  },
  // Settings
  settings: {
    autoRebalance: Boolean,
    rebalanceThreshold: Number, // percentage drift to trigger rebalance
    notifications: {
      priceAlerts: Boolean,
      newsAlerts: Boolean,
      analysisUpdates: Boolean
    }
  }
}, {
  timestamps: true
});

// Indexes
portfolioSchema.index({ userId: 1, name: 1 });
portfolioSchema.index({ 'stocks.stock': 1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);