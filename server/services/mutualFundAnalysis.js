const MutualFundAnalysisService = {
  /**
   * Analyze mutual fund holdings and conviction for a stock
   * @param {string} stockSymbol - Stock symbol to analyze
   * @param {Array} mutualFundData - Array of mutual fund portfolio data
   * @returns {Object} Mutual fund conviction analysis
   */
  analyzeConvictionStockSymbol: function(stockSymbol, mutualFundData = []) {
    try {
      // If no data provided, return default analysis
      if (!mutualFundData || mutualFundData.length === 0) {
        return this._getDefaultConvictionAnalysis();
      }

      const stockSymbolUpper = stockSymbol.toUpperCase();

      // Analyze each mutual fund's holdings
      const fundAnalysis = mutualFundData.map(fund => {
        const holding = fund.holdings?.find(h =>
          h.symbol.toUpperCase() === stockSymbolUpper
        );

        if (!holding) {
          return {
            fundName: fund.name || 'Unknown Fund',
            holdingPercentage: 0,
            rank: null,
            change: 0,
            isHolding: false
          };
        }

        return {
          fundName: fund.name || 'Unknown Fund',
          holdingPercentage: holding.percentage || 0,
          rank: holding.rank || null,
          change: holding.changeFromPrevious || 0,
          isHolding: true
        };
      });

      // Filter only funds that actually hold the stock
      const actualHoldings = fundAnalysis.filter(f => f.isHolding);

      // Calculate overall conviction score
      const convictionScore = this._calculateConvictionScore(actualHoldings, mutualFundData);

      // Determine sentiment
      const sentiment = this._determineSentiment(actualHoldings);

      // Get top holders
      const topHolders = actualHoldings
        .sort((a, b) => b.holdingPercentage - a.holdingPercentage)
        .slice(0, 5)
        .map(h => ({
          fundName: h.fundName,
          holdingPercentage: h.holdingPercentage,
          rank: h.rank,
          changeLastQuarter: h.change
        }));

      // Calculate holding percentile (how this stock ranks among all holdings)
      const holdingPercentile = this._calculateHoldingPercentile(actualHoldings, mutualFundData);

      return {
        score: convictionScore,
        holdingPercentile,
        topHolders,
        sentiment,
        totalFundsHolding: actualHoldings.length,
        totalFundsAnalyzed: mutualFundData.length,
        averageHoldingPercentage: actualHoldings.length > 0
          ? this._calculateAverage(actualHoldings.map(h => h.holdingPercentage))
          : 0,
        maxHoldingPercentage: actualHoldings.length > 0
          ? Math.max(...actualHoldings.map(h => h.holdingPercentage))
          : 0
      };
    } catch (error) {
      console.error('Error in mutual fund conviction analysis:', error);
      return this._getDefaultConvictionAnalysis();
    }
  },

  /**
   * Calculate conviction score based on mutual fund holdings
   */
  _calculateConvictionScore: function(holdings, allFunds) {
    if (holdings.length === 0) return 25; // Low score for no institutional holding

    // Factors for conviction score:
    // 1. Number of funds holding the stock (diversification of ownership)
    // 2. Average holding percentage (size of positions)
    // 3. Quality/rank of funds holding it
    // 4. Trend in holdings (increasing/decreasing)

    const holdingCountScore = Math.min(30, holdings.length * 3); // Max 30 points for 10+ funds

    const avgHolding = this._calculateAverage(holdings.map(h => h.holdingPercentage));
    const holdingSizeScore = Math.min(25, avgHolding * 5); // Max 25 points for 5%+ avg holding

    // Quality score based on fund ranks (lower rank = better fund)
    const qualityScores = holdings
      .filter(h => h.rank)
      .map(h => Math.max(0, 25 - (h.rank - 1) * 0.5)); // Rank 1 = 25pts, Rank 50 = 0pts
    const qualityScore = qualityScores.length > 0
      ? Math.min(25, this._calculateAverage(qualityScores))
      : 15; // Default if no rank data

    // Trend score based on recent changes
    const positiveChanges = holdings.filter(h => h.change > 0).length;
    const trendScore = (positiveChanges / holdings.length) * 20; // Up to 20 points for positive trend

    const totalScore = holdingCountScore + holdingSizeScore + qualityScore + trendScore;
    return Math.min(100, Math.max(0, Math.round(totalScore)));
  },

  /**
   * Determine sentiment based on holding changes
   */
  _determineSentiment: function(holdings) {
    if (holdings.length === 0) return 'NEUTRAL';

    const positiveChanges = holdings.filter(h => h.change > 0).length;
    const negativeChanges = holdings.filter(h => h.change < 0).length;
    const totalChanges = holdings.length;

    if (totalChanges === 0) return 'NEUTRAL';

    const positiveRatio = positiveChanges / totalChanges;
    const negativeRatio = negativeChanges / totalChanges;

    if (positiveRatio >= 0.6) return 'BULLISH';
    if (negativeRatio >= 0.6) return 'BEARISH';
    return 'NEUTRAL';
  },

  /**
   * Calculate holding percentile compared to all stocks in funds
   */
  _calculateHoldingPercentile: function(holdings, allFunds) {
    // This would require comparing against all stocks in the universe
    // For simplicity, we'll estimate based on holding size
    if (holdings.length === 0) return 0;

    const maxHolding = Math.max(...holdings.map(h => h.holdingPercentage));

    // Rough percentile estimation:
    // 5%+ holding = ~90th percentile
    // 2%+ holding = ~70th percentile
    // 1%+ holding = ~50th percentile
    // <1% holding = <50th percentile

    if (maxHolding >= 5) return 90;
    if (maxHolding >= 3) return 80;
    if (maxHolding >= 2) return 70;
    if (maxHolding >= 1) return 60;
    if (maxHolding >= 0.5) return 50;
    if (maxHolding >= 0.2) return 40;
    if (maxHolding >= 0.1) return 30;
    return 20;
  },

  /**
   * Calculate average of array
   */
  _calculateAverage: function(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  },

  /**
   * Get default conviction analysis when no data available
   */
  _getDefaultConvictionAnalysis: function() {
    return {
      score: 50, // Neutral score
      holdingPercentile: 50,
      topHolders: [],
      sentiment: 'NEUTRAL',
      totalFundsHolding: 0,
      totalFundsAnalyzed: 0,
      averageHoldingPercentage: 0,
      maxHoldingPercentage: 0
    };
  }
};

module.exports = MutualFundAnalysisService;