import React from 'react';

const RiskAnalysis = ({ data }) => {
  if (!data) return <div>No risk data available</div>;

  const { marketRisk, creditRisk, liquidityRisk, operationalRisk, sectorRisk, geopoliticalRisk, disruptionRisk, overallScore, riskCategory } = data;

  return (
    <div className="analysis-panel">
      <h3>Risk Analysis</h3>
      <div className="metrics-grid">
        {/* Market Risk */}
        <div className="metric-group">
          <h4>Market Risk</h4>
          <div className="metric">
            <span>Beta:</span>
            <span className={marketRisk.beta < 0.8 ? 'positive' : marketRisk.beta < 1.2 ? 'neutral' : 'negative'}>
              {marketRisk.beta}
            </span>
          </div>
          <div className="metric">
            <span>Volatility:</span>
            <span className={marketRisk.volatility < 20 ? 'positive' : marketRisk.volatility < 35 ? 'neutral' : 'negative'}>
              {marketRisk.volatility}%
            </span>
          </div>
          <div className="metric">
            <span>Market Correlation:</span>
            <span>{marketRisk.correlationToMarket}</span>
          </div>
        </div>

        {/* Credit Risk */}
        <div className="metric-group">
          <h4>Credit Risk</h4>
          <div className="metric">
            <span>Debt/Equity:</span>
            <span className={creditRisk.debtToEquity < 0.3 ? 'positive' : creditRisk.debtToEquity < 0.6 ? 'neutral' : 'negative'}>
              {creditRisk.debtToEquity}
            </span>
          </div>
          <div className="metric">
            <span>Interest Coverage:</span>
            <span className={creditRisk.interestCoverage > 10 ? 'positive' : creditRisk.interestCoverage > 5 ? 'neutral' : 'negative'}>
              {creditRisk.interestCoverage}x
            </span>
          </div>
          <div className="metric">
            <span>Current Ratio:</span>
            <span className={creditRisk.currentRatio > 1.5 ? 'positive' : creditRisk.currentRatio > 1.0 ? 'neutral' : 'negative'}>
              {creditRisk.currentRatio}
            </span>
          </div>
        </div>

        {/* Liquidity Risk */}
        <div className="metric-group">
          <h4>Liquidity Risk</h4>
          <div className="metric">
            <span>Avg Daily Volume:</span>
            <span>{liquidityRisk.averageVolume.toLocaleString()}</span>
          </div>
          <div className="metric">
            <span>Bid-Ask Spread:</span>
            <span className={liquidityRisk.bidAskSpread < 0.2 ? 'positive' : liquidityRisk.bidAskSpread < 0.5 ? 'neutral' : 'negative'}>
              {liquidityRisk.bidAskSpread}%
            </span>
          </div>
        </div>

        {/* Operational Risk */}
        <div className="metric-group">
          <h4>Operational Risk</h4>
          <div className="metric">
            <span>ROE:</span>
            <span className={operationalRisk.roe > 15 ? 'positive' : operationalRisk.roe > 10 ? 'neutral' : 'negative'}>
              {operationalRisk.roe}%
            </span>
          </div>
          <div className="metric">
            <span>ROA:</span>
            <span className={operationalRisk.roa > 7 ? 'positive' : operationalRisk.roa > 4 ? 'neutral' : 'negative'}>
              {operationalRisk.roa}%
            </span>
          </div>
          <div className="metric">
            <span>Operating Margin:</span>
            <span className={operationalRisk.operatingMargin > 15 ? 'positive' : operationalRisk.operatingMargin > 10 ? 'neutral' : 'negative'}>
              {operationalRisk.operatingMargin}%
            </span>
          </div>
        </div>

        {/* Sector Risk */}
        <div className="metric-group">
          <h4>Sector Risk</h4>
          <div className="margin">
            <span>Sector:</span>
            <span>{sectorRisk.sector}</span>
          </div>
          <div className="metric">
            <span>Market Share:</span>
            <span>{(sectorRisk.marketShare * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Geopolitical Risk */}
        <div className="metric-group">
          <h4>Geopolitical Risk</h4>
          <div className="metric">
            <span>Foreign Revenue:</span>
            <span>{geopoliticalRisk.foreignRevenue}%</span>
          </div>
          <div className="metric">
            <span>Countries Operated In:</span>
            <span>{geopoliticalRisk.countryCount}</span>
          </div>
        </div>

        {/* Disruption Risk */}
        <div className="metric-group">
          <h4>Disruption Risk</h4>
          <div className="metric">
            <span>R&D Intensity:</span>
            <span className={disruptionRisk.rdIntensity > 5 ? 'positive' : disruptionRisk.rdIntensity > 2 ? 'neutral' : 'negative'}>
              {disruptionRisk.rdIntensity}%
            </span>
          </div>
          <div className="metric">
            <span>Patent Count:</span>
            <span>{disruptionRisk.patentCount}</span>
          </div>
          <div className="metric">
            <span>Avg Asset Age:</span>
            <span>{disruptionRisk.averageAgeOfAssets} years</span>
          </div>
        </div>

        {/* Overall Risk Score */}
        <div className="metric-group">
          <h4>Overall Risk Assessment</h4>
          <div className="metric">
            <span>Risk Score:</span>
            <span className={overallScore >= 70 ? 'positive' : overallScore >= 40 ? 'neutral' : 'negative'}>
              {overallScore}/100
              <span className="risk-label">({riskCategory})</span>
            </span>
          </div>
          <div className="metric">
            <span>Risk Level:</span>
            <span className={riskCategory === 'LOW' ? 'risk-low' : riskCategory === 'LOW_TO_MODERATE' ? 'risk-low-medium' : riskCategory === 'MODERATE' ? 'risk-medium' : riskCategory === 'MODERATE_TO_HIGH' ? 'risk-medium-high' : 'risk-high'}>
              {riskCategory}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysis;