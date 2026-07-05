const RiskAnalysisService = {
  /**
   * Analyze risk factors for a stock
   * @param {Object} stockData - Stock data including financials, market data, and sector info
   * @returns {Object} Risk analysis results
   */
  analyzeRisk: function(stockData) {
    try {
      const risk = {
        marketRisk: this._analyzeMarketRisk(stockData),
        creditRisk: this._analyzeCreditRisk(stockData),
        liquidityRisk: this._analyzeLiquidityRisk(stockData),
        operationalRisk: this._analyzeOperationalRisk(stockData),
        sectorRisk: this._analyzeSectorRisk(stockData),
        geopoliticalRisk: this._analyzeGeopoliticalRisk(stockData),
        disruptionRisk: this._analyzeDisruptionRisk(stockData)
      };

      // Calculate overall risk score (lower is better)
      // Weights for different risk types
      const weights = {
        marketRisk: 0.25,
        creditRisk: 0.20,
        liquidityRisk: 0.15,
        operationalRisk: 0.15,
        sectorRisk: 0.10,
        geopoliticalRisk: 0.10,
        disruptionRisk: 0.05
      };

      let totalRiskScore = 0;
      totalRiskScore += risk.marketRisk.score * weights.marketRisk;
      totalRiskScore += risk.creditRisk.score * weights.creditRisk;
      totalRiskScore += risk.liquidityRisk.score * weights.liquidityRisk;
      totalRiskScore += risk.operationalRisk.score * weights.operationalRisk;
      totalRiskScore += risk.sectorRisk.score * weights.sectorRisk;
      totalRiskScore += risk.geopoliticalRisk.score * weights.geopoliticalRisk;
      totalRiskScore += risk.disruptionRisk.score * weights.disruptionRisk;

      // Convert to 0-100 scale where lower is better (less risky)
      // We'll invert it so higher score = less risk (better)
      risk.overallScore = Math.round(100 - Math.max(0, Math.min(100, totalRiskScore)));

      // Risk category
      risk.riskCategory = this._getRiskCategory(risk.overallScore);

      return risk;
    } catch (error) {
      console.error('Error in risk analysis:', error);
      return this._getDefaultRiskAnalysis();
    }
  },

  /**
   * Analyze market risk (beta, volatility, correlation)
   */
  _analyzeMarketRisk: function(stockData) {
    const beta = stockData.beta || 1;
    const volatility = stockData.volatility || 25; // Default 25% annualized volatility
    const correlationToMarket = stockData.correlationToMarket || 0.7;

    let score = 50; // Start with medium risk

    // Beta analysis
    if (beta <= 0.5) {
      score += 15; // Low beta = less market risk
    } else if (beta <= 0.8) {
      score += 10; // Moderately low beta
    } else if (beta <= 1.2) {
      score += 0; // Market average beta
    } else if (beta <= 1.5) {
      score -= 10; // High beta
    } else {
      score -= 15; // Very high beta
    }

    // Volatility analysis
    if (volatility <= 15) {
      score += 10; // Low volatility
    } else if (volatility <= 25) {
      score += 5; // Moderate volatility
    } else if (volatility <= 35) {
      score -= 5; // High volatility
    } else {
      score -= 10; // Very high volatility
    }

    // Correlation analysis
    if (correlationToMarket <= 0.5) {
      score += 5; // Low correlation = diversification benefit
    } else if (correlationToMarket >= 0.9) {
      score -= 5; // High correlation = moves with market
    }

    return {
      beta: parseFloat(beta.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      correlationToMarket: parseFloat(correlationToMarket.toFixed(2)),
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'market')
    };
  },

  /**
   * Analyze credit risk (debt levels, interest coverage)
   */
  _analyzeCreditRisk: function(stockData) {
    const debtToEquity = stockData.debtToEquity || 0;
    const interestCoverage = stockData.interestCoverage || 0;
    const currentRatio = stockData.currentRatio || 0;

    let score = 50; // Start with medium risk

    // Debt to equity analysis
    if (debtToEquity === 0) {
      score += 20; // No debt = low credit risk
    } else if (debtToEquity <= 0.3) {
      score += 15; // Very low debt
    } else if (debtToEquity <= 0.6) {
      score += 10; // Moderate debt
    } else if (debtToEquity <= 1.0) {
      score += 0; // Acceptable debt
    } else if (debtToEquity <= 2.0) {
      score -= 10; // High debt
    } else {
      score -= 20; // Very high debt
    }

    // Interest coverage analysis
    if (interestCoverage >= 10) {
      score += 15; // Strong ability to pay interest
    } else if (interestCoverage >= 5) {
      score += 10; // Adequate coverage
    } else if (interestCoverage >= 3) {
      score += 5; // Borderline coverage
    } else if (interestCoverage >= 1.5) {
      score -= 10; //Insufficientcoverage
    } else {
      score -= 20; //Verypooroverage
    }

    // Current ratio (liquidity) also affects credit risk
    if (currentRatio >= 2) {
      score += 5; // Good short-term liquidity
    } else if (currentRatio >= 1.5) {
      score += 3; // Adequate liquidity
    } else if (currentRatio >= 1) {
      score += 0; // Minimum acceptable
    } else {
      score -= 10; // Poor liquidity increases credit risk
    }

    return {
      debtToEquity: parseFloat(debtToEquity.toFixed(2)),
      interestCoverage: parseFloat(interestCoverage.toFixed(2)),
      currentRatio: parseFloat(currentRatio.toFixed(2)),
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'credit')
    };
  },

  /**
   * Analyze liquidity risk (trading volume, bid-ask spread, market depth)
   */
  _analyzeLiquidityRisk: function(stockData) {
    const avgVolume = stockData.averageVolume || 0;
    const marketCap = stockData.marketCapValue || 0;
    const bidAskSpread = stockData.bidAskSpread || 0.5; // Default 0.5%

    let score = 50; // Start with medium risk

    // Daily dollar volume (liquidity proxy)
    // Assuming average price ~ marketCap / sharesOutstanding, but we'll use a simpler approach
    const dollarVolume = avgVolume * (stockData.currentPrice || 100); // Rough estimate

    if (dollarVolume >= 1000000000) { // $1B+ daily volume
      score += 20;
    } else if (dollarVolume >= 500000000) { // $500M+ daily volume
      score += 15;
    } else if (dollarVolume >= 100000000) { // $100M+ daily volume
      score += 10;
    } else if (dollarVolume >= 50000000) { // $50M+ daily volume
      score += 5;
    } else if (dollarVolume >= 10000000) { // $10M+ daily volume
      score += 0;
    } else if (dollarVolume >= 5000000) { // $5M+ daily volume
      score -= 5;
    } else {
      score -= 15; // Very low liquidity
    }

    // Bid-ask spread (transaction cost)
    if (bidAskSpread <= 0.1) {
      score += 10; // Very tight spread
    } else if (bidAskSpread <= 0.25) {
      score += 5; // Reasonable spread
    } else if (bidAskSpread <= 0.5) {
      score += 0; // Average spread
    } else if (bidAskSpread <= 1.0) {
      score -= 5; // Wide spread
    } else {
      score -= 10; // Very wide spread
    }

    return {
      averageVolume: avgVolume,
      dollarVolumeEstimate: Math.round(dollarVolume),
      bidAskSpread: parseFloat(bidAskSpread.toFixed(2)),
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'liquidity')
    };
  },

  /**
   * Analyze operational risk (management quality, business model, execution)
   */
  _analyzeOperationalRisk: function(stockData) {
    const roe = stockData.roe || 0;
    const roa = stockData.roa || 0;
    const operatingMargin = stockData.operatingMargin || 0;
    const managementScore = stockData.managementScore || 50; // Would come from qualitative analysis

    let score = 50; // Start with medium risk

    // ROE analysis
    if (roe >= 20) {
      score += 15;
    } else if (roe >= 15) {
      score += 10;
    } else if (roe >= 10) {
      score += 5;
    } else if (roe >= 5) {
      score += 0;
    } else {
      score -= 10;
    }

    // ROA analysis
    if (roa >= 10) {
      score += 10;
    } else if (roa >= 7) {
      score += 5;
    } else if (roa >= 4) {
      score += 0;
    } else {
      score -= 5;
    }

    // Operating margin analysis
    if (operatingMargin >= 20) {
      score += 10;
    } else if (operatingMargin >= 15) {
      score += 5;
    } else if (operatingMargin >= 10) {
      score += 0;
    } else if (operatingMargin >= 5) {
      score -= 5;
    } else {
      score -= 10;
    }

    // Management quality (placeholder - would be qualitative)
    if (managementScore >= 80) {
      score += 10;
    } else if (managementScore >= 60) {
      score += 5;
    } else if (managementScore >= 40) {
      score += 0;
    } else {
      score -= 10;
    }

    return {
      roe: parseFloat(roe.toFixed(2)),
      roa: parseFloat(roa.toFixed(2)),
      operatingMargin: parseFloat(operatingMargin.toFixed(2)),
      managementScore,
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'operational')
    };
  },

  /**
   * Analyze sector-specific risks (regulation, competition, cycles)
   */
  _analyzeSectorRisk: function(stockData) {
    const sector = stockData.sector || 'Unknown';
    // In a real implementation, this would use sector risk data
    // For now, we'll use a simplified approach

    const riskScores = {
      'Banking': 60, // Regulatory risk, credit cycles
      'Insurance': 55, // Regulatory, interest rate sensitivity
      'Pharma': 50, // Regulatory (FDA), patent cliffs
      'IT': 45, // Competition, obsolescence risk
      'FMCG': 40, // Stable demand, brand risk
      'Auto': 55, // Cyclical, disruption risk (EV)
      'Energy': 65, // Commodity prices, regulatory, ESG
      'Utilities': 35, // Regulated but stable
      'Real Estate': 50, // Interest rate sensitivity, cyclical
      'default': 50
    };

    const baseRisk = riskScores[sector] || riskScores.default;
    // Convert to our scoring system (higher = less risky)
    let score = 100 - baseRisk;

    // Adjust for company-specific factors within sector
    // Market leadership reduces risk
    if (stockData.marketShare && stockData.marketShare > 0.2) { // >20% market share
      score += 10;
    } else if (stockData.marketShare && stockData.marketShare > 0.1) { // >10% market share
      score += 5;
    }

    return {
      sector,
      baseRiskScore: baseRisk,
      marketShare: stockData.marketShare || 0,
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'sector')
    };
  },

  /**
   * Analyze geopolitical risk (exposure to unstable regions, currency risk)
   */
  _analyzeGeopoliticalRisk: function(stockData) {
    const foreignRevenue = stockData.foreignRevenue || 0; // Percentage
    const exportDependence = stockData.exportDependence || 0; // Percentage
    const countriesOperatedIn = stockData.countriesOperatedIn || [];

    let score = 50; // Start with medium risk

    // Foreign revenue exposure
    if (foreignRevenue >= 50) {
      score -= 15; // High foreign exposure = higher geopolitical risk
    } else if (foreignRevenue >= 30) {
      score -= 10;
    } else if (foreignRevenue >= 15) {
      score -= 5;
    } // Less than 15% foreign revenue gets no penalty

    // Export dependence (for manufacturing companies)
    if (exportDependence >= 40) {
      score -= 10;
    } else if (exportDependence >= 20) {
      score -= 5;
    }

    // Number of countries (diversification can help or hurt)
    const countryCount = countriesOperatedIn.length;
    if (countryCount >= 10) {
      score += 5; // Diversification benefit
    } else if (countryCount >= 5) {
      score += 0;
    } else if (countryCount >= 2) {
      score -= 5; // Some foreign exposure but not diversified
    }
    // Domestic only (<2 countries) gets no adjustment

    return {
      foreignRevenue: parseFloat(foreignRevenue.toFixed(1)),
      exportDependence: parseFloat(exportDependence.toFixed(1)),
      countriesOperatedIn: countriesOperatedIn,
      countryCount: countriesOperatedIn.length,
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'geopolitical')
    };
  },

  /**
   * Analyze disruption risk (technological, business model obsolescence)
   */
  _analyzeDisruptionRisk: function(stockData) {
    const rdIntensity = stockData.rdIntensity || 0; // R&D as % of revenue
    const patentCount = stockData.patentCount || 0;
    const averageAgeOfAssets = stockData.averageAgeOfAssets || 0;
    const businessModelAge = stockData.businessModelAge || 0; // Years since major innovation

    let score = 50; // Start with medium risk

    // R&D intensity (higher = better positioned for innovation)
    if (rdIntensity >= 10) {
      score += 15; // Heavy investment in R&D
    } else if (rdIntensity >= 5) {
      score += 10; // Moderate R&D
    } else if (rdIntensity >= 2) {
      score += 5; // Some R&D
    } // Less than 2% R&D gets no bonus

    // Patent portfolio (innovation protection)
    if (patentCount >= 1000) {
      score += 10;
    } else if (patentCount >= 500) {
      score += 7;
    } else if (patentCount >= 100) {
      score += 5;
    } else if (patentCount >= 50) {
      score += 3;
    }

    // Asset age (newer assets = less obsolescence risk)
    if (averageAgeOfAssets <= 5) {
      score += 10;
    } else if (averageAgeOfAssets <= 10) {
      score += 5;
    } else if (averageAgeOfAssets <= 15) {
      score += 0;
    } else if (averageAgeOfAssets <= 20) {
      score -= 5;
    } else {
      score -= 10;
    }

    // Business model age (newer models = more adaptable)
    if (businessModelAge <= 5) {
      score += 10;
    } else if (businessModelAge <= 10) {
      score += 5;
    } else if (businessModelAge <= 20) {
      score += 0;
    } else if (businessModelAge <= 30) {
      score -= 5;
    } else {
      score -= 10;
    }

    return {
      rdIntensity: parseFloat(rdIntensity.toFixed(2)),
      patentCount,
      averageAgeOfAssets: parseFloat(averageAgeOfAssets.toFixed(1)),
      businessModelAge,
      score: Math.max(0, Math.min(100, Math.round(score))),
      interpretation: this._getRiskInterpretation(score, 'disruption')
    };
  },

  /**
   * Get risk interpretation based on score and risk type
   */
  _getRiskInterpretation: function(score, riskType) {
    let riskLevel = 'MODERATE';
    let description = 'Moderate level of risk';

    if (score >= 80) {
      riskLevel = 'LOW';
      description = 'Low level of risk';
    } else if (score >= 60) {
      riskLevel = 'LOW_TO_MODERATE';
      description = 'Lower than average risk';
    } else if (score >= 40) {
      riskLevel = 'MODERATE';
      description = 'Moderate level of risk';
    } else if (score >= 20) {
      riskLevel = 'MODERATE_TO_HIGH';
      description = 'Higher than average risk';
    } else {
      riskLevel = 'HIGH';
      description = 'High level of risk';
    }

    return {
      riskLevel,
      description,
      riskTypeSpecific: `${riskType} risk is ${riskLevel.toLowerCase()}`
    };
  },

  /**
   * Get risk category based on overall score
   */
  _getRiskCategory: function(score) {
    if (score >= 80) return 'LOW';
    if (score >= 60) return 'LOW_TO_MODERATE';
    if (score >= 40) return 'MODERATE';
    if (score >= 20) return 'MODERATE_TO_HIGH';
    return 'HIGH';
  },

  /**
   * Get default risk analysis when data is insufficient
   */
  _getDefaultRiskAnalysis: function() {
    return {
      marketRisk: {
        beta: 1, volatility: 25, correlationToMarket: 0.7,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      creditRisk: {
        debtToEquity: 0, interestCoverage: 0, currentRatio: 0,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      liquidityRisk: {
        averageVolume: 0, dollarVolumeEstimate: 0, bidAskSpread: 0.5,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      operationalRisk: {
        roe: 0, roa: 0, operatingMargin: 0, managementScore: 50,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      sectorRisk: {
        sector: 'Unknown', baseRiskScore: 50, marketShare: 0,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      geopoliticalRisk: {
        foreignRevenue: 0, exportDependence: 0, countriesOperatedIn: [], countryCount: 0,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      disruptionRisk: {
        rdIntensity: 0, patentCount: 0, averageAgeOfAssets: 0, businessModelAge: 0,
        score: 50, interpretation: { riskLevel: 'MODERATE', description: 'Default risk assessment' }
      },
      overallScore: 50,
      riskCategory: 'MODERATE'
    };
  }
};

module.exports = RiskAnalysisService;