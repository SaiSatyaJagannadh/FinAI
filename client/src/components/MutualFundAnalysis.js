import React from 'react';

const MutualFundAnalysis = ({ data }) => {
  if (!data) return <div>No mutual fund data available</div>;

  const { score, holdingPercentile, topHolders, sentiment, totalFundsHolding, totalFundsAnalyzed, averageHoldingPercentage, maxHoldingPercentage } = data;

  return (
    <div className="analysis-panel">
      <h3>Mutual Fund Conviction Analysis</h3>
      <div className="metrics-grid">
        {/* Conviction Score */}
        <div className="metric-group">
          <h4>Conviction Score</h4>
          <div className="metric">
            <span>Overall Score:</span>
            <span className={score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'negative'}>
              {score}/100
            </span>
          </div>
          <div className="metric">
            <span>Sentiment:</span>
            <span className={sentiment === 'BULLISH' ? 'positive' : sentiment === 'BEARISH' ? 'negative' : 'neutral'}>
              {sentiment}
            </span>
          </div>
        </div>

        {/* Holding Details */}
        <div className="metric-group">
          <h4>Holding Details</h4>
          <div className="metric">
            <span>Funds Holding Stock:</span>
            <span>{totalFundsHolding}/{totalFundsAnalyzed}</span>
          </div>
          <div className="metric">
            <span>Holding Percentile:</span>
            <span>{holdingPercentile}th percentile</span>
          </div>
          <div className="metric">
            <span>Average Holding:</span>
            <span>{averageHoldingPercentage?.toFixed(2)}%</span>
          </div>
          <div className="metric">
            <span>Maximum Holding:</span>
            <span>{maxHoldingPercentage?.toFixed(2)}%</span>
          </div>
        </div>

        {/* Top Holders */}
        <div className="metric-group">
          <h4>Top Holder Funds</h4>
          {topHolders.length > 0 ? (
            <ul className="holder-list">
              {topHolders.map((holder, index) => (
                <li key={index} className={`holder-item ${holder.change > 0 ? 'positive' : holder.change < 0 ? 'negative' : 'neutral'}`}>
                  <strong>{holder.fundName}</strong>: {holder.holdingPercentage}%
                  (Rank: #{holder.rank || 'N/A'})
                  {holder.change !== 0 ?
                    ` (${holder.change > 0 ? '+' : ''}${holder.change.toFixed(2)}% QoQ)` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>No major mutual funds currently holding this stock</p>
          )}
        </div>

        {/* Score Interpretation */}
        <div className="metric-group">
          <h4>Score Interpretation</h4>
          <p>
            {score >= 80 ? 'Strong conviction from institutional investors - significant smart money accumulation' :
             score >= 60 ? 'Moderate positive interest from institutional investors' :
             score >= 40 ? 'Neutral to low institutional interest' :
             'Limited or decreasing institutional interest - potential red flag'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MutualFundAnalysis;