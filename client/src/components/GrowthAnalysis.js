import React from 'react';

const GrowthAnalysis = ({ data }) => {
  if (!data) return <div>No growth data available</div>;

  const { revenueGrowth, profitGrowth, epsGrowth, bookValueGrowth, dividendGrowth, overallScore, projections } = data;

  return (
    <div className="analysis-panel">
      <h3>Growth Analysis</h3>
      <div className="metrics-grid">
        {/* Growth Metrics */}
        <div className="metric-group">
          <h4>Growth Rates (QoQ & YoY)</h4>
          <div className="metric">
            <span>Revenue Growth:</span>
            <div>
              <span>QoQ: {revenueGrowth.qoq.toFixed(2)}%</span>
              <br />
              <span>YoY: {revenueGrowth.yoy.toFixed(2)}%
                <span className={revenueGrowth.yoy > 0 ? 'positive' : revenueGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({revenueGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>Profit Growth:</span>
            <div>
              <span>QoQ: {profitGrowth.qoq.toFixed(2)}%</span>
              <br />
              <span>YoY: {profitGrowth.yoy.toFixed(2)}%
                <span className={profitGrowth.yoy > 0 ? 'positive' : profitGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({profitGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>EPS Growth:</span>
            <div>
              <span>QoQ: {epsGrowth.qoq.toFixed(2)}%</span>
              <br />
              <span>YoY: {epsGrowth.yoy.toFixed(2)}%
                <span className={epsGrowth.yoy > 0 ? 'positive' : epsGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({epsGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>Book Value Growth:</span>
            <div>
              <span>QoQ: {bookValueGrowth.qoq.toFixed(2)}%</span>
              <br />
              <span>YoY: {bookValueGrowth.yoy.toFixed(2)}%
                <span className={bookValueGrowth.yoy > 0 ? 'positive' : bookValueGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({bookValueGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>Dividend Growth:</span>
            <div>
              <span>QoQ: {dividendGrowth.qoq.toFixed(2)}%</span>
              <br />
              <span>YoY: {dividendGrowth.yoy.toFixed(2)}%
                <span className={dividendGrowth.yoy > 0 ? 'positive' : dividendGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({dividendGrowth.trend})
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Growth Scores */}
        <div className="metric-group">
          <h4>Growth Category Scores</h4>
          <div className="metric">
            <span>Revenue Growth:</span>
            <span className={revenueGrowth.score >= 70 ? 'positive' : revenueGrowth.score >= 40 ? 'neutral' : 'negative'}>
              {revenueGrowth.score}/100
            </span>
          </div>
          <div className="metric">
            <span>Profit Growth:</span>
            <span className={profitGrowth.score >= 70 ? 'positive' : profitGrowth.score >= 40 ? 'neutral' : 'negative'}>
              {profitGrowth.score}/100
            </span>
          </div>
          <div className="metric">
            <span>EPS Growth:</span>
            <span className={epsGrowth.score >= 70 ? 'positive' : epsGrowth.score >= 40 ? 'neutral' : 'negative'}>
              {epsGrowth.score}/100
            </span>
          </div>
          <div className="metric">
            <span>Book Value Growth:</span>
            <span className={bookValueGrowth.score >= 70 ? 'positive' : bookValueGrowth.score >= 40 ? 'neutral' : 'negative'}>
              {bookValueGrowth.score}/100
            </span>
          </div>
          <div className="metric">
            <span>Dividend Growth:</span>
            <span className={dividendGrowth.score >= 70 ? 'positive' : dividendGrowth.score >= 40 ? 'neutral' : 'negative'}>
              {dividendGrowth.score}/100
            </span>
          </div>
        </div>

        {/* Projections */}
        <div className="metric-group">
          <h4>Growth Projections</h4>
          {projections.eps && projections.revenue ? (
            <>
              <div className="metric">
                <span>EPS (Current):</span>
                <span>₹{projections.eps.current.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span>EPS (1Y Proj):</span>
                <span>₹{projections.eps.projected1Y.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span>EPS (2Y Proj):</span>
                <span>₹{projections.eps.projected2Y.toFixed(2)}</span>
              </div>
              <div className="metric">
                <span>EPS CAGR:</span>
                <span>{projections.eps.cagr.toFixed(2)}%</span>
              </div>
              <div className="metric">
                <span>Revenue (Current):</span>
                <span>₹{projections.revenue.current.toFixed(0)} Cr</span>
              </div>
              <div className="metric">
                <span>Revenue (1Y Proj):</span>
                <span>₹{projections.revenue.projected1Y.toFixed(0)} Cr</span>
              </div>
              <div className="metric">
                <span>Revenue (2Y Proj):</span>
                <span>₹{projections.revenue.projected2Y.toFixed(0)} Cr</span>
              </div>
              <div className="metric">
                <span>Revenue CAGR:</span>
                <span>{projections.revenue.cagr.toFixed(2)}%</span>
              </div>
            </>
          ) : (
            <p>Projection data not available</p>
          )}
        </div>

        {/* Overall Growth Score */}
        <div className="metric-group">
          <h4>Overall Growth Score</h4>
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

export default GrowthAnalysis;