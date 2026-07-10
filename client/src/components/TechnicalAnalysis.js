import React from 'react';

const TechnicalAnalysis = ({ data }) => {
  if (!data) return <div>No technical data available</div>;

  const {
    movingAverages = {},
    rsi = { value: 50, signal: 'NEUTRAL' },
    macd = { macd: 0, signal: 0, histogram: 0 },
    bollingerBands = { upper: 0, middle: 0, lower: 0, signal: 'NEUTRAL' },
    supportResistance = { support: [], resistance: [] },
    volumeAnalysis = { trend: 'NEUTRAL', averageVolume: 0 },
    momentum = { roc10: 0, roc20: 0, signal: 'NEUTRAL' },

    overallScore = 50
  } = data;

  return (
    <div className="analysis-panel">
      <h3>Technical Analysis</h3>
      <div className="metrics-grid">
        {/* Trend Indicators */}
        <div className="metric-group">
          <h4>Trend Indicators</h4>
          <div className="metric">
            <span>Price vs MA20:</span>
            <span className={(movingAverages.currentPrice ?? 0) > (movingAverages.sma20 ?? 0) ? 'positive' : 'negative'}>
              {((movingAverages.currentPrice ?? 0) && (movingAverages.sma20 ?? 0) ? ((movingAverages.currentPrice / movingAverages.sma20 - 1) * 100).toFixed(2) : 'N/A')}%
            </span>
          </div>
          <div className="metric">
            <span>Price vs MA50:</span>
            <span className={movingAverages.currentPrice > movingAverages.sma50 ? 'positive' : 'negative'}>
              {((movingAverages.currentPrice / movingAverages.sma50 - 1) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="metric">
            <span>Price vs MA200:</span>
            <span className={movingAverages.currentPrice > movingAverages.sma200 ? 'positive' : 'negative'}>
              {((movingAverages.currentPrice / movingAverages.sma200 - 1) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="metric">
            <span>Trend:</span>
            <span className={movingAverages.trend === 'UPTREND' || movingAverages.trend === 'STRONG_UPTREND' ? 'positive' :
                       movingAverages.trend === 'DOWNTREND' || movingAverages.trend === 'STRONG_DOWNTREND' ? 'negative' : 'neutral'}>
              {movingAverages.trend}
            </span>
          </div>
        </div>

        {/* Momentum Oscillators */}
        <div className="metric-group">
          <h4>Momentum Oscillators</h4>
          <div className="metric">
            <span>RSI (14):</span>
            <span className={rsi.value > 70 ? 'negative' : rsi.value < 30 ? 'positive' : 'neutral'}>
              {rsi.value} ({rsi.signal})
            </span>
          </div>
          <div className="metric">
            <span>MACD:</span>
            <span className={(macd.histogram ?? 0) > 0 ? 'positive' : (macd.histogram ?? 0) < 0 ? 'negative' : 'neutral'}>
              MACD: {(macd.macd ?? 0).toFixed(3)}, Signal: {(macd.signal ?? 0).toFixed(3)}
            </span>
          </div>
        </div>

        {/* Volatility Indicators */}
        <div className="metric-group">
          <h4>Volatility</h4>
          <div className="metric">
            <span>Bollinger Bands:</span>
            <span className={bollingerBands.signal === 'OVERBOUGHT' ? 'negative' :
                       bollingerBands.signal === 'OVERSOLD' ? 'positive' : 'neutral'}>
              {bollingerBands.signal}
            </span>
          </div>
          <div className="metric">
            <span>Position in Bands:</span>
            <span>
              {((bollingerBands.middle > 0) ?
                (((bollingerBands.middle - bollingerBands.lower) / (bollingerBands.upper - bollingerBands.lower)) * 100).toFixed(1) + '%' :
                'N/A')}
            </span>
          </div>
        </div>

        {/* Support & Resistance */}
        <div className="metric-group">
          <h4>Support & Resistance</h4>
          <div className="metric">
            <span>Resistance Levels:</span>
            <span>{supportResistance.resistance.length > 0 ?
              supportResistance.resistance.map((level, i) => (
                <span key={i}>₹{level.toFixed(2)}{i < supportResistance.resistance.length - 1 ? ', ' : ''}</span>
              )) : 'None identified'}
            </span>
          </div>
          <div className="metric">
            <span>Support Levels:</span>
            <span>{supportResistance.support.length > 0 ?
              supportResistance.support.map((level, i) => (
                <span key={i}>₹{level.toFixed(2)}{i < supportResistance.support.length - 1 ? ', ' : ''}</span>
              )) : 'None identified'}
            </span>
          </div>
        </div>

        {/* Volume Analysis */}
        <div className="metric-group">
          <h4>Volume Analysis</h4>
          <div className="metric">
            <span>Volume Trend:</span>
            <span className={volumeAnalysis.trend === 'INCREASING' ? 'positive' :
                       volumeAnalysis.trend === 'DECREASING' ? 'negative' : 'neutral'}>
              {volumeAnalysis.trend}
            </span>
          </div>
          <div className="metric">
            <span>Avg Volume:</span>
            <span>{volumeAnalysis.averageVolume.toLocaleString()}</span>
          </div>
        </div>

        {/* Momentum */}
        <div className="metric-group">
          <h4>Momentum</h4>
          <div className="metric">
            <span>ROC (10):</span>
            <span className={momentum.roc10 > 0 ? 'positive' : momentum.roc10 < 0 ? 'negative' : 'neutral'}>
              {momentum.roc10}% ({momentum.signal})
            </span>
          </div>
          <div className="metric">
            <span>ROC (20):</span>
            <span className={momentum.roc20 > 0 ? 'positive' : momentum.roc20 < 0 ? 'negative' : 'neutral'}>
              {momentum.roc20}% ({momentum.signal})
            </span>
          </div>
        </div>

        {/* Overall Score */}
        <div className="metric-group">
          <h4>Overall Technical Score</h4>
          <div className="metric">
            <span>Score:</span>
            <span className={overallScore >= 70 ? 'positive' : overallScore >= 40 ? 'neutral' : 'negative'}>
              {overallScore}/100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalAnalysis;