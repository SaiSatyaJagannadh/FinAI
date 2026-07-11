const Stock = require('../models/Stock');
const Analysis = require('../models/Analysis');

/**
 * Fundamental Analysis Service
 * Analyzes financial ratios and fundamentals of a stock
 */
class FundamentalAnalysisService {
  constructor() {
    // Sector-specific benchmarks (simplified - in reality these would come from a config-driven by data)
    this.sectorBenchmarks = {
      'IT_Services': { peRange: [15, 30], pegTarget: [0.8, 1.5], debtToEquityMax: 0.5 },
      'Banking': { peRange: [8, 15], pegTarget: [0.7, 1.2], debtToEquityMax: 0.3 },
      'Pharma': { peRange: [15, 25], pegTarget: [0.8, 1.5], debtToEquityMax: 0.4 },
      'FMCG': { peRange: [20, 40], pegTarget: [0.8, 1.8], debtToEquityMax: 0.3 },
      'Auto': { peRange: [10, 20], pegTarget: [0.7, 1.3], debtToEquityMax: 0.5 },
      'Energy': { peRange: [8, 15], pegTarget: [0.6, 1.2], debtToEquityMax: 0.4 },
      'default': { peRange: [10, 25], pegTarget: [0.7, 1.5], debtToEquityMax: 0.5 }
    };
  }

  /**
   * Analyze fundamental metrics for a stock
   * @param {Object} stockData - Stock data including financial statements
   * @returns {Object} Fundamental analysis results
   */
  async analyzeFundamentals(stockData) {
    try {
      const fundamentals = {
        peRatio: this._analyzePERatio(stockData),
        pegRatio: this._analyzePEGRatio(stockData),
        priceToBook: this._analyzePriceToBook(stockData),
        debtToEquity: this._analyzeDebtToEquity(stockData),
        currentRatio: this._analyzeCurrentRatio(stockData),
        roe: this._analyzeROE(stockData),
        roa: this._analyzeROA(stockData),
        profitMargin: this._analyzeProfitMargin(stockData)
      };

      // Calculate category scores
      const scores = {
        valuation: this._calculateValuationScore(fundamentals.peRatio.score, fundamentals.pegRatio.score),
        profitability: this._calculateProfitabilityScore(fundamentals.roe.score, fundamentals.roa.score, fundamentals.profitMargin.score),
        financialHealth: this._calculateFinancialHealthScore(fundamentals.debtToEquity.score, fundamentals.currentRatio.score),
        growth: this._calculateGrowthScore(stockData) // This would come from growth analysis
      };

      // Overall fundamental score (weighted average)
      const overallScore = (scores.valuation * 0.3 +
                           scores.profitability * 0.25 +
                           scores.financialHealth * 0.25 +
                           scores.growth * 0.2);

      return {
        peRatio: fundamentals.peRatio,
        pegRatio: fundamentals.pegRatio,
        priceToBook: fundamentals.priceToBook,
        debtToEquity: fundamentals.debtToEquity,
        currentRatio: fundamentals.currentRatio,
        roe: fundamentals.roe,
        roa: fundamentals.roa,
        profitMargin: fundamentals.profitMargin,
        scores: {
          valuation: Math.round(scores.valuation),
          profitability: Math.round(scores.profitability),
          financialHealth: Math.round(scores.financialHealth),
          growth: Math.round(scores.growth)
        },
        overallScore: Math.round(overallScore)
      };
    } catch (error) {
      console.error('Error in fundamental analysis:', error);
      throw new Error(`Fundamental analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze P/E ratio (Trailing and Forward)
   */
  _analyzePERatio(stockData) {
    const trailingPE = stockData.priceData?.peRatio || 0;
    const forwardPE = stockData.forwardPE || trailingPE * 0.9; // Estimate if not provided

    const sector = stockData.sector || 'default';
    const benchmarks = this.sectorBenchmarks[sector] || this.sectorBenchmarks.default;
    const [minPE, maxPE] = benchmarks.peRange;

    let score = 50; // Default middle score
    let interpretation = 'Moderately valued';

    if (trailingPE > 0) {
      if (trailingPE < minPE) {
        score = 80; // Low PE could mean undervalued
        interpretation = 'Potentially undervalued (low P/E)';
      } else if (trailingPE > maxPE) {
        score = 30; // High PE could mean overvalued
        interpretation = 'Potentially overvalued (high P/E)';
      } else {
        // Within range - calculate how close to ideal
        const midPoint = (minPE + maxPE) / 2;
        const distanceFromMid = Math.abs(trailingPE - midPoint);
        const maxDistance = Math.max(midPoint - minPE, maxPE - midPoint);
        score = 50 + (50 * (1 - distanceFromMid / maxDistance));
        interpretation = 'Fairly valued relative to sector';
      }
    }

    return {
      trailing: trailingPE,
      forward: forwardPE,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze PEG ratio (P/E to Growth)
   */
  _analyzePEGRatio(stockData) {
    const peRatio = stockData.priceData?.peRatio || 0;
    const growthRate = stockData.growthRate ||
                     (stockData.earningsGrowth?.yoy || 0) ||
                     (stockData.revenueGrowth?.yoy || 0) ||
                     10; // Default growth assumption

    const pegRatio = growthRate > 0 ? peRatio / growthRate : 0;

    const sector = stockData.sector || 'default';
    const benchmarks = this.sectorBenchmarks[sector] || this.sectorBenchmarks.default;
    const [minPEG, maxPEG] = benchmarks.pegTarget;

    let score = 50;
    let interpretation = 'Moderate growth valuation';

    if (pegRatio > 0) {
      if (pegRatio < minPEG) {
        score = 85; // Excellent - low PEG means good growth relative to price
        interpretation = 'Attractive: Strong growth relative to price';
      } else if (pegRatio > maxPEG) {
        score = 30; // Expensive - high PEG means low growth relative to price
        interpretation = 'Expensive: Low growth relative to price';
      } else {
        // Within target range
        const midPoint = (minPEG + maxPEG) / 2;
        const distanceFromMid = Math.abs(pegRatio - midPoint);
        const maxDistance = Math.max(midPoint - minPEG, maxPEG - midPoint);
        score = 50 + (50 * (1 - distanceFromMid / maxDistance));
        interpretation = 'Reasonable growth valuation';
      }
    } else {
      // No growth data
      score = 40;
      interpretation = 'Insufficient growth data for PEG calculation';
    }

    return {
      value: pegRatio,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze Price to Book ratio
   */
  _analyzePriceToBook(stockData) {
    const pbRatio = stockData.priceData?.pbRatio || 0;

    let score = 50;
    let interpretation = 'Moderate P/B ratio';

    if (pbRatio > 0) {
      if (pbRatio < 1) {
        score = 75; // Potentially undervalued (trading below book value)
        interpretation = 'Trading below book value - potential value';
      } else if (pbRatio > 3) {
        score = 30; // Possibly overvalued
        interpretation = 'Trading significantly above book value';
      } else {
        // Reasonable range
        score = 50 + (25 * (1 - Math.abs(pbRatio - 1.5) / 1.5));
        interpretation = 'Reasonable P/B ratio';
      }
    }

    return {
      value: pbRatio,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze Debt to Equity ratio
   */
  _analyzeDebtToEquity(stockData) {
    const debtToEquity = stockData.debtToEquity || 0;

    const sector = stockData.sector || 'default';
    const benchmarks = this.sectorBenchmarks[sector] || this.sectorBenchmarks.default;
    const maxDebtToEquity = benchmarks.debtToEquityMax;

    let score = 50;
    let interpretation = 'Moderate debt levels';

    if (debtToEquity >= 0) {
      if (debtToEquity === 0) {
        score = 90; // Excellent - no debt
        interpretation = 'Debt-free balance sheet';
      } else if (debtToEquity < maxDebtToEquity * 0.5) {
        score = 80; // Good - low debt
        interpretation = 'Low debt levels';
      } else if (debtToEquity < maxDebtToEquity) {
        score = 60; // Moderate - acceptable debt
        interpretation = 'Moderate debt levels';
      } else if (debtToEquity < maxDebtToEquity * 1.5) {
        score = 40; // High - concerning debt
        interpretation = 'High debt levels - monitor closely';
      } else {
        score = 20; // Very high - risky
        interpretation = 'Very high debt - significant risk';
      }
    }

    return {
      value: debtToEquity,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze Current Ratio (liquidity)
   */
  _analyzeCurrentRatio(stockData) {
    const currentRatio = stockData.currentRatio || 0;

    let score = 50;
    let interpretation = 'Moderate liquidity';

    if (currentRatio > 0) {
      if (currentRatio >= 2) {
        score = 85; // Excellent liquidity
        interpretation = 'Strong liquidity position';
      } else if (currentRatio >= 1.5) {
        score = 70; // Good liquidity
        interpretation = 'Adequate liquidity';
      } else if (currentRatio >= 1) {
        score = 50; // Minimum acceptable
        interpretation = 'Minimum liquidity threshold';
      } else if (currentRatio >= 0.5) {
        score = 30; // Poor liquidity
        interpretation = 'Liquidity concerns';
      } else {
        score = 15; // Very poor liquidity
        interpretation = 'Severe liquidity issues';
      }
    }

    return {
      value: currentRatio,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze Return on Equity (ROE)
   */
  _analyzeROE(stockData) {
    const roe = stockData.roe || 0; // Percentage

    let score = 50;
    let interpretation = 'Moderate ROE';

    if (roe >= 0) {
      if (roe >= 20) {
        score = 90; // Excellent
        interpretation = 'Excellent return on equity';
      } else if (roe >= 15) {
        score = 80; // Very good
        interpretation = 'Very good return on equity';
      } else if (roe >= 10) {
        score = 60; // Good
        interpretation = 'Good return on equity';
      } else if (roe >= 5) {
        score = 40; // Adequate
        interpretation = 'Adequate return on equity';
      } else {
        score = 20; // Poor
        interpretation = 'Low return on equity - investigate causes';
      }
    }

    return {
      value: roe,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze Return on Assets (ROA)
   */
  _analyzeROA(stockData) {
    const roa = stockData.roa || 0; // Percentage

    let score = 50;
    let interpretation = 'Moderate ROA';

    if (roa >= 0) {
      if (roa >= 10) {
        score = 85; // Excellent
        interpretation = 'Excellent return on assets';
      } else if (roa >= 7) {
        score = 70; // Good
        interpretation = 'Good return on assets';
      } else if (roa >= 5) {
        score = 55; // Moderate
        interpretation = 'Moderate return on assets';
      } else if (roa >= 3) {
        score = 40; // Adequate
        interpretation = 'Adequate return on assets';
      } else {
        score = 20; // Poor
        interpretation = 'Low return on assets';
      }
    }

    return {
      value: roa,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Analyze Profit Margin
   */
  _analyzeProfitMargin(stockData) {
    const profitMargin = stockData.profitMargin || 0; // Percentage

    let score = 50;
    let interpretation = 'Moderate profit margin';

    if (profitMargin >= 0) {
      if (profitMargin >= 20) {
        score = 90; // Excellent
        interpretation = 'Excellent profit margin';
      } else if (profitMargin >= 15) {
        score = 80; // Very good
        interpretation = 'Very good profit margin';
      } else if (profitMargin >= 10) {
        score = 60; // Good
        interpretation = 'Good profit margin';
      } else if (profitMargin >= 5) {
        score = 40; // Adequate
        interpretation = 'Adequate profit margin';
      } else {
        score = 20; // Poor
        interpretation = 'Low profit margin';
      }
    }

    return {
      value: profitMargin,
      score: Math.max(0, Math.min(100, score)),
      interpretation
    };
  }

  /**
   * Calculate valuation score based on PE and PEG
   */
  _calculateValuationScore(peScore, pegScore) {
    return (peScore * 0.4) + (pegScore * 0.6);
  }

  /**
   * Calculate profitability score based on ROE, ROA, and profit margin
   */
  _calculateProfitabilityScore(roeScore, roaScore, marginScore) {
    return (roeScore * 0.4) + (roaScore * 0.3) + (marginScore * 0.3);
  }

  /**
   * Calculate financial health score based on debt and liquidity
   */
  _calculateFinancialHealthScore(debtScore, currentRatioScore) {
    return (debtScore * 0.6) + (currentRatioScore * 0.4);
  }

  /**
   * Calculate growth score (placeholder - would integrate with growth analysis)
   */
  _calculateGrowthScore(stockData) {
    // In a complete implementation, this would pull from growth analysis
    // For now, use available growth data or default
    const revenueGrowth = stockData.revenueGrowth?.yoy || 0;
    const profitGrowth = stockData.profitGrowth?.yoy || 0;

    let growthScore = 50; // Default

    if (revenueGrowth > 0 || profitGrowth > 0) {
      // Simple scoring based on growth rates
      const avgGrowth = (Math.max(revenueGrowth, 0) + Math.max(profitGrowth, 0)) / 2;
      if (avgGrowth >= 20) growthScore = 85;
      else if (avgGrowth >= 15) growthScore = 75;
      else if (avgGrowth >= 10) growthScore = 65;
      else if (avgGrowth >= 5) growthScore = 55;
      else growthScore = 45;
    }

    return growthScore;
  }
}

module.exports = new FundamentalAnalysisService();