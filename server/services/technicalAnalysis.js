const TechnicalAnalysisService = {
  /**
   * Analyze technical indicators for a stock
   * @param {Object} priceData - Historical price and volume data
   * @returns {Object} Technical analysis results
   */
  analyzeTechnicals: function(priceData) {
    try {
      if (!priceData || !priceData.length) {
        return this._getDefaultTechnicalAnalysis();
      }

      const analysis = {
        movingAverages: this._calculateMovingAverages(priceData),
        rsi: this._calculateRSI(priceData),
        macd: this._calculateMACD(priceData),
        bollingerBands: this._calculateBollingerBands(priceData),
        supportResistance: this._identifySupportResistance(priceData),
        volumeAnalysis: this._analyzeVolume(priceData),
        momentum: this._calculateMomentum(priceData),
        trends: this._identifyTrends(priceData),
        overallScore: 0 // Will be calculated below
      };

      // Calculate overall technical score
      analysis.overallScore = this._calculateTechnicalScore(analysis);

      return analysis;
    } catch (error) {
      console.error('Error in technical analysis:', error);
      return this._getDefaultTechnicalAnalysis();
    }
  },

  /**
   * Calculate moving averages (SMA, EMA)
   */
  _calculateMovingAverages: function(prices) {
    const sma20 = this._calculateSMA(prices, 20);
    const sma50 = this._calculateSMA(prices, 50);
    const sma200 = this._calculateSMA(prices, 200);
    const ema12 = this._calculateEMA(prices, 12);
    const ema26 = this._calculateEMA(prices, 26);

    const currentPrice = prices[prices.length - 1]?.close || 0;

    let trend = 'NEUTRAL';
    let score = 50;

    if (sma20 && sma50 && sma200 && currentPrice > sma20 && sma20 > sma50 && sma50 > sma200) {
      trend = 'STRONG_UPTREND';
      score = 80;
    } else if (sma20 && sma50 && currentPrice > sma20 && sma20 > sma50) {
      trend = 'UPTREND';
      score = 65;
    } else if (sma20 && sma50 && sma200 && currentPrice < sma20 && sma20 < sma50 && sma50 < sma200) {
      trend = 'STRONG_DOWNTREND';
      score = 20;
    } else if (sma20 && sma50 && currentPrice < sma20 && sma20 < sma50) {
      trend = 'DOWNTREND';
      score = 35;
    }

    return {
      sma20: sma20 || 0,
      sma50: sma50 || 0,
      sma200: sma200 || 0,
      ema12: ema12 || 0,
      ema26: ema26 || 0,
      currentPrice,
      trend,
      score: Math.max(0, Math.min(100, score))
    };
  },

  /**
   * Calculate Simple Moving Average
   */
  _calculateSMA: function(prices, period) {
    if (prices.length < period) return null;

    const sum = prices.slice(-period).reduce((sum, price) => sum + (price.close || 0), 0);
    return sum / period;
  },

  /**
   * Calculate Exponential Moving Average
   */
  _calculateEMA: function(prices, period) {
    if (prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = this._calculateSMA(prices.slice(0, period), period); // Start with SMA

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i].close * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  },

  /**
   * Calculate RSI (Relative Strength Index)
   */
  _calculateRSI: function(prices, period = 14) {
    if (prices.length < period + 1) return { value: 50, signal: 'NEUTRAL', score: 50 };

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i].close - prices[i - 1].close);
    }

    const gains = changes.map(change => Math.max(0, change));
    const losses = changes.map(change => Math.abs(Math.min(0, change)));

    let avgGain = this._calculateAverage(gains.slice(0, period));
    let avgLoss = this._calculateAverage(losses.slice(0, period));

    // Wilder's smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

    let signal = 'NEUTRAL';
    let score = 50;

    if (rsi >= 70) {
      signal = 'OVERBOUGHT';
      score = 30; // Overbought - potential sell signal
    } else if (rsi <= 30) {
      signal = 'OVERSOLD';
      score = 70; // Oversold - potential buy signal
    } else if (rsi > 50) {
      signal = 'BULLISH';
      score = 50 + ((rsi - 50) * 0.5); // Scale 50-70 to 50-75
    } else {
      signal = 'BEARISH';
      score = 50 - ((50 - rsi) * 0.5); // Scale 30-50 to 25-50
    }

    return {
      value: parseFloat(rsi.toFixed(2)),
      signal,
      score: Math.max(0, Math.min(100, score))
    };
  },

  /**
   * Calculate Average
   */
  _calculateAverage: function(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  },

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  _calculateMACD: function(prices) {
    if (prices.length < 26 + 9) {
      return { macd: 0, signalLine: 0, histogram: 0, signal: 'NEUTRAL', score: 50 };
    }

    const closes = prices.map(p => p.close || 0);
    // Full EMA series so the signal line is a real 9-period EMA of MACD,
    // not an approximation (which made bearish crossovers impossible).
    const emaSeries = (values, period) => {
      const k = 2 / (period + 1);
      let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const out = [e];
      for (let i = period; i < values.length; i++) {
        e = values[i] * k + e * (1 - k);
        out.push(e);
      }
      return out;
    };

    const e12 = emaSeries(closes, 12);
    const e26 = emaSeries(closes, 26);
    // e26[j] is the EMA at closes index 25+j; the matching e12 entry is e12[j+14]
    const macdSeries = e26.map((v, j) => e12[j + 14] - v);
    const signalSeries = emaSeries(macdSeries, 9);

    const macdLine = macdSeries[macdSeries.length - 1];
    const signalLine = signalSeries[signalSeries.length - 1];
    const histogram = macdLine - signalLine;

    let signal = 'NEUTRAL';
    let score = 50;

    // Score off histogram as % of price so a ₹100 and ₹3000 stock with the
    // same relative trend score the same
    const currentPrice = closes[closes.length - 1] || 1;
    const histPct = (histogram / currentPrice) * 100;

    if (histogram > 0) {
      signal = 'BULLISH';
      score = 50 + Math.min(30, Math.abs(histPct) * 40);
    } else if (histogram < 0) {
      signal = 'BEARISH';
      score = 50 - Math.min(30, Math.abs(histPct) * 40);
    }

    return {
      macd: parseFloat(macdLine.toFixed(4)),
      signalLine: parseFloat(signalLine.toFixed(4)),
      histogram: parseFloat(histogram.toFixed(4)),
      signal,
      score: Math.max(0, Math.min(100, score))
    };
  },

  /**
   * Calculate Bollinger Bands
   */
  _calculateBollingerBands: function(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0, signal: 'NEUTRAL', score: 50 };
    }

    const recentPrices = prices.slice(-period);
    const sma = this._calculateSMA(recentPrices, period);
    const variance = recentPrices.reduce((sum, price) => {
      const diff = (price.close || 0) - sma;
      return sum + (diff * diff);
    }, 0) / period;
    const std = Math.sqrt(variance);

    const upper = sma + (std * stdDev);
    const lower = sma - (std * stdDev);
    const currentPrice = prices[prices.length - 1].close || 0;

    let signal = 'NEUTRAL';
    let score = 50;

    if (currentPrice > upper) {
      signal = 'OVERBOUGHT';
      score = 30; // Price above upper band
    } else if (currentPrice < lower) {
      signal = 'OVERSOLD';
      score = 70; // Price below lower band
    } else {
      // Position within bands
      const position = (currentPrice - lower) / (upper - lower);
      if (position > 0.8) {
        score = 40; // Near upper band
        signal = 'NEAR_UPPER';
      } else if (position < 0.2) {
        score = 60; // Near lower band
        signal = 'NEAR_LOWER';
      } else {
        score = 50; // Middle of bands
        signal = 'NEUTRAL';
      }
    }

    return {
      upper: parseFloat(upper.toFixed(2)),
      middle: parseFloat(sma.toFixed(2)),
      lower: parseFloat(lower.toFixed(2)),
      signal,
      score: Math.max(0, Math.min(100, score))
    };
  },

  /**
   * Identify support and resistance levels
   */
  _identifySupportResistance: function(prices) {
    if (prices.length < 10) {
      return { support: [], resistance: [] };
    }

    const highs = prices.map(p => p.high || 0);
    const lows = prices.map(p => p.low || 0);

    // Simple peak/trough detection
    const resistanceLevels = [];
    const supportLevels = [];

    // Look for local maxima (resistance) and minima (support)
    for (let i = 2; i < highs.length - 2; i++) {
      // Check for resistance (local high)
      if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
          highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
        resistanceLevels.push(highs[i]);
      }

      // Check for support (local low)
      if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
          lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
        supportLevels.push(lows[i]);
      }
    }

    // Sort and get unique values (top 3)
    const uniqueResistance = [...new Set(resistanceLevels)].sort((a, b) => b - a).slice(0, 3);
    const uniqueSupport = [...new Set(supportLevels)].sort((a, b) => a - b).slice(0, 3);

    return {
      resistance: uniqueResistance,
      support: uniqueSupport
    };
  },

  /**
   * Analyze volume patterns
   */
  _analyzeVolume: function(prices) {
    if (prices.length < 10) {
      return { trend: 'INSUFFICIENT_DATA', score: 50 };
    }

    const volumes = prices.map(p => p.volume || 0);
    const recentVolumes = volumes.slice(-10);
    const olderVolumes = volumes.slice(-20, -10);

    const avgRecent = this._calculateAverage(recentVolumes);
    const avgOlder = this._calculateAverage(olderVolumes);

    let trend = 'NEUTRAL';
    let score = 50;

    if (avgOlder > 0) {
      const volumeRatio = avgRecent / avgOlder;

      if (volumeRatio > 1.5) {
        trend = 'INCREASING';
        score = 70; // Increasing volume - confirmation of move
      } else if (volumeRatio < 0.7) {
        trend = 'DECREASING';
        score = 30; // Decreasing volume - weakening move
      } else {
        trend = 'STABLE';
        score = 50; // Stable volume
      }
    }

    return {
      trend,
      averageVolume: parseInt(avgRecent),
      volumeRatio: avgOlder > 0 ? parseFloat((avgRecent / avgOlder).toFixed(2)) : 1,
      score: Math.max(0, Math.min(100, score))
    };
  },

  /**
   * Calculate momentum
   */
  _calculateMomentum: function(prices) {
    if (prices.length < 10) {
      return { signal: 'INSUFFICIENT_DATA', score: 50 };
    }

    // Calculate ROC (Rate of Change) over different periods
    const roc10 = this._calculateROC(prices, 10);
    const roc20 = this._calculateROC(prices, 20);

    let signal = 'NEUTRAL';
    let score = 50;

    if (roc10 > 0 && roc20 > 0) {
      // Positive momentum
      if (roc10 > 5 && roc20 > 10) {
        signal = 'STRONG_BULLISH';
        score = 80;
      } else {
        signal = 'BULLISH';
        score = 65;
      }
    } else if (roc10 < 0 && roc20 < 0) {
      // Negative momentum
      if (roc10 < -5 && roc20 < -10) {
        signal = 'STRONG_BEARISH';
        score = 20;
      } else {
        signal = 'BEARISH';
        score = 35;
      }
    }

    return {
      roc10: parseFloat(roc10.toFixed(2)),
      roc20: parseFloat(roc20.toFixed(2)),
      signal,
      score: Math.max(0, Math.min(100, score))
    };
  },

  /**
   * Calculate Rate of Change
   */
  _calculateROC: function(prices, period) {
    if (prices.length < period + 1) return 0;

    const currentPrice = prices[prices.length - 1].close || 0;
    const pastPrice = prices[prices.length - 1 - period].close || 0;

    if (pastPrice === 0) return 0;

    return ((currentPrice - pastPrice) / pastPrice) * 100;
  },

  /**
   * Identify trends
   */
  _identifyTrends: function(prices) {
    if (prices.length < 20) {
      return { shortTerm: 'INSUFFICIENT_DATA', mediumTerm: 'INSUFFICIENT_DATA' };
    }

    const closes = prices.map(p => p.close || 0);
    const recentClose = closes[closes.length - 1];
    const sma10 = this._calculateSMA(prices.slice(-10), 10);
    const sma20 = this._calculateSMA(prices.slice(-20), 20);

    let shortTerm = 'NEUTRAL';
    let mediumTerm = 'NEUTRAL';

    if (sma10 && recentClose > sma10 * 1.02) {
      shortTerm = 'UPTREND';
    } else if (sma10 && recentClose < sma10 * 0.98) {
      shortTerm = 'DOWNTREND';
    }

    if (sma20 && recentClose > sma20 * 1.03) {
      mediumTerm = 'UPTREND';
    } else if (sma20 && recentClose < sma20 * 0.97) {
      mediumTerm = 'DOWNTREND';
    }

    return { shortTerm, mediumTerm };
  },

  /**
   * Calculate overall technical score
   */
  _calculateTechnicalScore: function(analysis) {
    const weights = {
      movingAverages: 0.25,
      rsi: 0.20,
      macd: 0.15,
      bollingerBands: 0.15,
      volumeAnalysis: 0.10,
      momentum: 0.10,
      trends: 0.05
    };

    let score = 0;
    score += (analysis.movingAverages.score || 50) * weights.movingAverages;
    score += (analysis.rsi.score || 50) * weights.rsi;
    score += (analysis.macd.score || 50) * weights.macd;
    score += (analysis.bollingerBands.score || 50) * weights.bollingerBands;
    score += (analysis.volumeAnalysis.score || 50) * weights.volumeAnalysis;
    score += (analysis.momentum.score || 50) * weights.momentum;
    score += (analysis.trends.shortTerm === 'UPTREND' ? 75 :
              analysis.trends.shortTerm === 'DOWNTREND' ? 25 : 50) * weights.trends;

    return Math.max(0, Math.min(100, Math.round(score)));
  },

  /**
   * Return default technical analysis when data is insufficient
   */
  _getDefaultTechnicalAnalysis: function() {
    return {
      movingAverages: {
        sma20: 0, sma50: 0, sma200: 0, ema12: 0, ema26: 0,
        currentPrice: 0, trend: 'INSUFFICIENT_DATA', score: 50
      },
      rsi: { value: 50, signal: 'NEUTRAL', score: 50 },
      macd: { macd: 0, signalLine: 0, histogram: 0, signal: 'NEUTRAL', score: 50 },
      bollingerBands: { upper: 0, middle: 0, lower: 0, signal: 'NEUTRAL', score: 50 },
      supportResistance: { support: [], resistance: [] },
      volumeAnalysis: { trend: 'INSUFFICIENT_DATA', score: 50 },
      momentum: { signal: 'INSUFFICIENT_DATA', score: 50 },
      trends: { shortTerm: 'INSUFFICIENT_DATA', mediumTerm: 'INSUFFICIENT_DATA' },
      overallScore: 50
    };
  }
};

module.exports = TechnicalAnalysisService;