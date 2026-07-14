const GrowthAnalysisService = {
  /**
   * Analyze growth metrics for a stock
   * @param {Object} stockData - Stock data including financials and guidance
   * @returns {Object} Growth analysis results
   */
  analyzeGrowth: function(stockData) {
    try {
      const growth = {
        revenueGrowth: this._analyzeRevenueGrowth(stockData),
        profitGrowth: this._analyzeProfitGrowth(stockData),
        epsGrowth: this._analyzeEPSGrowth(stockData),
        bookValueGrowth: this._analyzeBookValueGrowth(stockData),
        dividendGrowth: this._analyzeDividendGrowth(stockData),
        // Operating profit excludes Other Income → clean of one-off gains
        operatingProfitGrowth: this._analyzeSimpleYoY(stockData.operatingProfitGrowth),
        pbtGrowth: this._analyzeSimpleYoY(stockData.pbtGrowth)
      };

      // Calculate overall growth score
      const weights = {
        revenueGrowth: 0.3,
        profitGrowth: 0.25,
        epsGrowth: 0.25,
        bookValueGrowth: 0.1,
        dividendGrowth: 0.1
      };

      let totalScore = 0;
      totalScore += growth.revenueGrowth.score * weights.revenueGrowth;
      totalScore += growth.profitGrowth.score * weights.profitGrowth;
      totalScore += growth.epsGrowth.score * weights.epsGrowth;
      totalScore += growth.bookValueGrowth.score * weights.bookValueGrowth;
      totalScore += growth.dividendGrowth.score * weights.dividendGrowth;

      growth.overallScore = Math.round(Math.max(0, Math.min(100, totalScore)));

      // Add growth projections based on management guidance
      growth.projections = this._calculateGrowthProjections(stockData);

      // Quarterly results trend (from Screener) with warning flags
      growth.quarterly = this._analyzeQuarterly(stockData.quarterly);

      return growth;
    } catch (error) {
      console.error('Error in growth analysis:', error);
      return this._getDefaultGrowthAnalysis();
    }
  },

  /**
   * Analyze revenue growth (QoQ and YoY)
   */
  _analyzeRevenueGrowth: function(stockData) {
    const qoqGrowth = stockData.revenueGrowth?.qoq || 0;
    const yoyGrowth = stockData.revenueGrowth?.yoy || 0;

    return {
      qoq: parseFloat(qoqGrowth.toFixed(2)),
      yoy: parseFloat(yoyGrowth.toFixed(2)),
      score: this._calculateGrowthScore(qoqGrowth, yoyGrowth, 'revenue'),
      trend: this._determineGrowthTrend(qoqGrowth, yoyGrowth)
    };
  },

  /**
   * Analyze profit growth (QoQ and YoY)
   */
  _analyzeProfitGrowth: function(stockData) {
    const qoqGrowth = stockData.profitGrowth?.qoq || 0;
    const yoyGrowth = stockData.profitGrowth?.yoy || 0;

    return {
      qoq: parseFloat(qoqGrowth.toFixed(2)),
      yoy: parseFloat(yoyGrowth.toFixed(2)),
      score: this._calculateGrowthScore(qoqGrowth, yoyGrowth, 'profit'),
      trend: this._determineGrowthTrend(qoqGrowth, yoyGrowth)
    };
  },

  /**
   * Analyze EPS growth (QoQ and YoY)
   */
  _analyzeEPSGrowth: function(stockData) {
    const qoqGrowth = stockData.epsGrowth?.qoq || 0;
    const yoyGrowth = stockData.epsGrowth?.yoy || 0;

    return {
      qoq: parseFloat(qoqGrowth.toFixed(2)),
      yoy: parseFloat(yoyGrowth.toFixed(2)),
      score: this._calculateGrowthScore(qoqGrowth, yoyGrowth, 'eps'),
      trend: this._determineGrowthTrend(qoqGrowth, yoyGrowth)
    };
  },

  /**
   * Analyze book value growth
   */
  _analyzeBookValueGrowth: function(stockData) {
    const qoqGrowth = stockData.bookValueGrowth?.qoq || 0;
    const yoyGrowth = stockData.bookValueGrowth?.yoy || 0;

    return {
      qoq: parseFloat(qoqGrowth.toFixed(2)),
      yoy: parseFloat(yoyGrowth.toFixed(2)),
      score: this._calculateGrowthScore(qoqGrowth, yoyGrowth, 'book_value'),
      trend: this._determineGrowthTrend(qoqGrowth, yoyGrowth)
    };
  },

  /**
   * Analyze dividend growth (if applicable)
   */
  _analyzeDividendGrowth: function(stockData) {
    const qoqGrowth = stockData.dividendGrowth?.qoq || 0;
    const yoyGrowth = stockData.dividendGrowth?.yoy || 0;

    return {
      qoq: parseFloat(qoqGrowth.toFixed(2)),
      yoy: parseFloat(yoyGrowth.toFixed(2)),
      score: this._calculateGrowthScore(qoqGrowth, yoyGrowth, 'dividend'),
      trend: this._determineGrowthTrend(qoqGrowth, yoyGrowth)
    };
  },

  /**
   * Score a YoY-only growth series (operating profit, PBT)
   */
  _analyzeSimpleYoY: function(g) {
    const yoy = g?.yoy || 0;
    return {
      yoy: parseFloat(yoy.toFixed(2)),
      score: this._calculateGrowthScore(0, yoy, 'yoy_only'),
      trend: yoy > 0 ? 'GROWING' : yoy < 0 ? 'DECLINING' : 'FLAT'
    };
  },

  /**
   * Quarterly results trend: pass the series through for charting and add
   * warning flags (consecutive declining quarters, seasonality-aware YoY).
   */
  _analyzeQuarterly: function(q) {
    if (!q || !q.sales || !q.sales.length) return null;

    const warnings = [];
    if (q.decliningSalesQuarters >= 2) {
      warnings.push(`Sales declined ${q.decliningSalesQuarters} quarters in a row`);
    }
    if (q.decliningProfitQuarters >= 2) {
      warnings.push(`Net profit declined ${q.decliningProfitQuarters} quarters in a row`);
    }
    if (q.salesYoYQuarter !== null && q.salesYoYQuarter < 0) {
      warnings.push(`Latest quarter sales down ${Math.abs(q.salesYoYQuarter)}% vs same quarter last year`);
    }

    return { ...q, warnings };
  },

  /**
   * Calculate growth score based on QoQ and YoY growth
   */
  _calculateGrowthScore: function(qoqGrowth, yoyGrowth, growthType) {
    // We'll score based on growth rates
    // Positive growth gets higher scores

    let baseScore = 50; // Neutral starting point

    // Weight YoY more heavily than QoQ (more sustainable)
    const weightedGrowth = (yoyGrowth * 0.7) + (qoqGrowth * 0.3);

    // Scoring based on growth rate
    if (weightedGrowth >= 30) {
      baseScore = 95; // Exceptional growth
    } else if (weightedGrowth >= 20) {
      baseScore = 85; // Excellent growth
    } else if (weightedGrowth >= 15) {
      baseScore = 75; // Strong growth
    } else if (weightedGrowth >= 10) {
      baseScore = 65; // Good growth
    } else if (weightedGrowth >= 5) {
      baseScore = 55; // Moderate growth
    } else if (weightedGrowth >= 0) {
      baseScore = 50 + (weightedGrowth * 1); // 0-5% growth: 50-55 points
    } else if (weightedGrowth >= -5) {
      baseScore = 50 + (weightedGrowth * 2); // -5 to 0%: 40-50 points
    } else if (weightedGrowth >= -10) {
      baseScore = 40 + ((weightedGrowth + 5) * 2); // -10 to -5%: 30-40 points
    } else {
      baseScore = Math.max(20, 30 + (weightedGrowth + 10) * 1); // Below -10%: 20-30 points
    }

    // Ensure score is within bounds
    return Math.max(20, Math.min(95, Math.round(baseScore)));
  },

  /**
   * Determine growth trend (accelerating, decelerating, etc.)
   */
  _determineGrowthTrend: function(qoqGrowth, yoyGrowth) {
    if (qoqGrowth > yoyGrowth && qoqGrowth > 0) {
      return 'ACCELERATING';
    } else if (qoqGrowth < yoyGrowth && yoyGrowth > 0) {
      return 'DECELERATING_BUT_POSITIVE';
    } else if (qoqGrowth < 0 && yoyGrowth < 0) {
      return 'CONTRACTING';
    } else if (qoqGrowth > 0 && yoyGrowth < 0) {
      return 'RECOVERING';
    } else {
      return 'STABLE';
    }
  },

  /**
   * Calculate future growth projections based on management guidance
   */
  _calculateGrowthProjections: function(stockData) {
    const currentEPS = stockData.eps || stockData.fundamental?.eps || 0;
    const currentRevenue = stockData.revenue || 0;
    const guidance = stockData.managementGuidance || {};

    // If we have explicit guidance, use it
    if (guidance.epsGrowthNextYear || guidance.revenueGrowthNextYear) {
      return {
        eps: {
          current: currentEPS,
          projected1Y: currentEPS * (1 + (guidance.epsGrowthNextYear || 0) / 100),
          projected2Y: currentEPS * Math.pow(1 + (guidance.epsGrowthNextYear || 0) / 100, 2),
          cagr: guidance.epsGrowthNextYear || 0
        },
        revenue: {
          current: currentRevenue,
          projected1Y: currentRevenue * (1 + (guidance.revenueGrowthNextYear || 0) / 100),
          projected2Y: currentRevenue * Math.pow(1 + (guidance.revenueGrowthNextYear || 0) / 100, 2),
          cagr: guidance.revenueGrowthNextYear || 0
        }
      };
    }

    // Otherwise, use historical growth rates
    const histEPSGrowth = stockData.epsGrowth?.yoy || 0;
    const histRevenueGrowth = stockData.revenueGrowth?.yoy || 0;

    return {
      eps: {
        current: currentEPS,
        projected1Y: currentEPS * (1 + histEPSGrowth / 100),
        projected2Y: currentEPS * Math.pow(1 + histEPSGrowth / 100, 2),
        cagr: histEPSGrowth
      },
      revenue: {
        current: currentRevenue,
        projected1Y: currentRevenue * (1 + histRevenueGrowth / 100),
        projected2Y: currentRevenue * Math.pow(1 + histRevenueGrowth / 100, 2),
        cagr: histRevenueGrowth
      }
    };
  },

  /**
   * Get default growth analysis when data is insufficient
   */
  _getDefaultGrowthAnalysis: function() {
    return {
      revenueGrowth: {
        qoq: 0, yoy: 0, score: 50, trend: 'INSUFFICIENT_DATA'
      },
      profitGrowth: {
        qoq: 0, yoy: 0, score: 50, trend: 'INSUFFICIENT_DATA'
      },
      epsGrowth: {
        qoq: 0, yoy: 0, score: 50, trend: 'INSUFFICIENT_DATA'
      },
      bookValueGrowth: {
        qoq: 0, yoy: 0, score: 50, trend: 'INSUFFICIENT_DATA'
      },
      dividendGrowth: {
        qoq: 0, yoy: 0, score: 50, trend: 'INSUFFICIENT_DATA'
      },
      overallScore: 50,
      projections: {
        eps: { current: 0, projected1Y: 0, projected2Y: 0, cagr: 0 },
        revenue: { current: 0, projected1Y: 0, projected2Y: 0, cagr: 0 }
      }
    };
  }
};

module.exports = GrowthAnalysisService;