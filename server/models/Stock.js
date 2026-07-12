const mongoose = require('mongoose');

// Stock schema for basic stock information
const stockSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  exchange: {
    type: String,
    enum: ['NSE', 'BSE', 'NYSE', 'NASDAQ'],
    default: 'NSE'
  },
  isin: String,
  sector: String,
  industry: String,
  marketCap: {
    type: String,
    enum: ['large_cap', 'mid_cap', 'small_cap'],
    default: 'large_cap'
  },
  marketCapValue: Number, // in crores or millions depending on exchange
  faceValue: Number,
  isin: String,
  listingDate: Date,
  // Basic info that doesn't change frequently
  basicInfo: {
    address: String,
    website: String,
    industry: String,
    sector: String
  },
  // Latest prices (updated frequently)
  priceData: {
    current: Number,
    change: Number,
    changePercent: Number,
    previousClose: Number,
    open: Number,
    dayHigh: Number,
    dayLow: Number,
    volume: Number,
    avgVolume: Number,
    peRatio: Number,
    pbRatio: Number,
    dividendYield: Number,
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  // 52 week range
  week52: {
    high: Number,
    low: Number
  },
  // Daily price history for charting (~most recent 250 trading days)
  priceHistory: [{
    date: String,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
  }],
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
stockSchema.index({ symbol: 1, exchange: 1 }, { unique: true });
stockSchema.index({ name: 'text' }); // For search
stockSchema.index({ sector: 1 });
stockSchema.index({ industry: 1 });
stockSchema.index({ marketCap: 1 });

// Method to calculate market cap category
stockSchema.methods.getMarketCapCategory = function() {
  if (!this.marketCapValue) return 'large_cap';

  // These thresholds are approximate and vary by market
  // For Indian markets (in INR crores)
  if (this.marketCapValue > 20000) return 'large_cap'; // > 20,000 Cr
  if (this.marketCapValue > 5000) return 'mid_cap';    // 5,000 - 20,000 Cr
  return 'small_cap';                                 // < 5,000 Cr
};

// Static method to find or create a stock
stockSchema.statics.findOrCreate = async function(symbol, exchange = 'NSE') {
  const stock = await this.findOne({ symbol: symbol.toUpperCase(), exchange });
  if (stock) return stock;

  // In a real app, we would fetch from an API here
  // For now, return a basic stock object
  return this.create({
    symbol: symbol.toUpperCase(),
    exchange,
    name: `${symbol} Limited` // Placeholder
  });
};

module.exports = mongoose.model('Stock', stockSchema);