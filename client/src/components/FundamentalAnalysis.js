import React from 'react';

const FundamentalAnalysis = ({ data }) => {
  if (!data) return <div>No fundamental data available</div>;

  const { peRatio, pegRatio, priceToBook, debtToEquity, currentRatio, roe, roa, profitMargin, scores } = data;

  return (
    <div className="analysis-panel">
      <h3>Fundamental Analysis</h3>
      <div className="metrics-grid">
        {/* Valuation Metrics */}
        <div className="metric-group">
          <h4>Valuation</h4>
          <div className="metric">
            <span>P/E Ratio (TTM):</span>
            <span>{peRatio.trailing?.toFixed(2) || 'N/A'}</span>
          </div>
          <div className="metric">
            <span>P/E Ratio (Forward):</span>
            <span>{peRatio.forward?.toFixed(2) || 'N/A'}</span>
          </div>
          <div className="metric">
            <span>PEG Ratio:</span>
            <span className={pegRatio.value < 1 ? 'positive' : pegRatio.value < 2 ? 'neutral' : 'negative'}>
              {pegRatio.value?.toFixed(2) || 'N/A'}
            </span>
          </div>
          <div className="metric">
            <span>P/B Ratio:</span>
            <span>{priceToBook?.toFixed(2) || 'N/A'}</span>
          </div>
        </div>

        {/* Profitability Metrics */}
        <div className="metric-group">
          <h4>Profitability</h4>
          <div className="metric">
            <span>ROE:</span>
            <span className={roe > 15 ? 'positive' : roe > 10 ? 'neutral' : 'negative'}>
              {roe?.toFixed(2) || 'N/A'}%
            </span>
          </div>
          <div className="metric">
            <span>ROA:</span>
            <span className={roa > 10 ? 'positive' : roa > 5 ? 'neutral' : 'negative'}>
              {roa?.toFixed(2) || 'N/A'}%
            </span>
          </div>
          <div className="metric">
            <span>Profit Margin:</span>
            <span className={profitMargin > 15 ? 'positive' : profitMargin > 5 ? 'neutral' : 'negative'}>
              {profitMargin?.toFixed(2) || 'N/A'}%
            </span>
          </div>
        </div>

        {/* Financial Health Metrics */}
        <div className="metric-group">
          <h4>Financial Health</h4>
          <div className="metric">
            <span>Debt/Equity:</span>
            <span className={debtToEquity < 0.5 ? 'positive' : debtToEquity < 1.0 ? 'neutral' : 'negative'}>
              {debtToEquity?.toFixed(2) || 'N/A'}
            </span>
          </div>
          <div className="metric">
            <span>Current Ratio:</span>
            <span className={currentRatio > 1.5 ? 'positive' : currentRatio > 1.0 ? 'neutral' : 'negative'}>
              {currentRatio?.toFixed(2) || 'N/A'}
            </span>
          </div>
        </div>

        {/* Scores */}
        <div className="metric-group">
          <h4>Category Scores</h4>
          <div className="metric">
            <span>Valuation:</span>
            <span className={scores.valuation >= 70 ? 'positive' : scores.valuation >= 40 ? 'neutral' : 'negative'}>
              {scores.valuation}/100
            </span>
          </div>
          <div className="metric">
            <span>Profitability:</span>
            <span className={scores.profitability >= 70 ? 'positive' : scores.profitability >= 40 ? 'neutral' : 'negative'}>
              {scores.profitability}/100
            </span>
          </div>
          <div className="metric">
            <span>Financial Health:</span>
            <span className={scores.financialHealth >= 70 ? 'positive' : scores.financialHealth >= 40 ? 'neutral' : 'negative'}>
              {scores.financialHealth}/100
            </span>
          </div>
          <div className="metric">
            <span>Growth:</span>
            <span className={scores.growth >= 70 ? 'positive' : scores.growth >= 40 ? 'neutral' : 'negative'}>
              {scores.growth}/100
            </span>
          </div>
        </div>
      </div>

      <div className="summary">
        <h4>Overall Fundamental Score: <span>{scores.valuation && scores.profitability && scores.financialHealth && scores.growth ?
          Math.round((scores.valuation + scores.profitability + scores.financialHealth + scores.growth) / 4) : 'N/A'}</span>/100</h4>
      </div>
    </div>
  );
};

export default FundamentalAnalysis;