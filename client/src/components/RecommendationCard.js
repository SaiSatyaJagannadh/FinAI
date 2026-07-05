import React from 'react';

const RecommendationCard = ({ recommendation }) => {
  const { action, confidence, targetPrice, stopLoss, investmentHorizon, score } = recommendation;

  const getRecommendationClass = () => {
    switch (action) {
      case 'BUY':
        return 'recommendation-buy';
      case 'SELL':
        return 'recommendation-sell';
      default:
        return 'recommendation-hold';
    }
  };

  const getConfidenceClass = () => {
    switch (confidence) {
      case 'HIGH':
        return 'confidence-high';
      case 'LOW':
        return 'confidence-low';
      default:
        return 'confidence-medium';
    }
  };

  return (
    <div className="recommendation-card">
      <h2>Investment Recommendation</h2>
      <div className="recommendation-header">
        <span className={`recommendation-badge ${getRecommendationClass()}`}>
          {action}
        </span>
        <span className={`confidence-badge ${getConfidenceClass()}`}>
          {confidence} Confidence
        </span>
      </div>

      <div className="recommendation-details">
        <div className="metric">
          <span className="label">Score:</span>
          <span className="value">{score}/100</span>
        </div>
        <div className="metric">
          <span className="label">Target Price:</span>
          <span className="value">₹{targetPrice}</span>
        </div>
        <div className="metric">
          <span className="label">Stop Loss:</span>
          <span className="value">₹{stopLoss}</span>
        </div>
        <div className="metric">
          <span className="label">Horizon:</span>
          <span className="value">{investmentHorizon}</span>
        </div>
      </div>
    </div>
  );
};

export default RecommendationCard;