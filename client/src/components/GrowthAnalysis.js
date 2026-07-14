import React from 'react';

const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
const fmt = (v, d = 2) => (isNum(v) ? Number(v).toFixed(d) : 'N/A');

const GrowthAnalysis = ({ data }) => {
  if (!data) return <div>No growth data available</div>;

  const {
    revenueGrowth = {},
    profitGrowth = {},
    epsGrowth = {},
    bookValueGrowth = {},
    dividendGrowth = {},
    overallScore,
    projections = {},
    operatingProfitGrowth,
    pbtGrowth,
    quarterly
  } = data;

  return (
    <div className="analysis-panel">
      <h3>Growth Analysis</h3>
      <p className="explainer">Each quarter is compared with the SAME quarter a year ago, to cancel out seasonal ups and downs.</p>
      <div className="metrics-grid">
        {/* Growth Metrics */}
        <div className="metric-group">
          <h4>Growth Rates (QoQ & YoY)</h4>
          <div className="metric">
            <span>Revenue Growth:</span>
            <div>
              <span>QoQ: {fmt(revenueGrowth.qoq)}%</span>
              <br />
              <span>YoY: {fmt(revenueGrowth.yoy)}%
                <span className={revenueGrowth.yoy > 0 ? 'positive' : revenueGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({revenueGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>Profit Growth:</span>
            <div>
              <span>QoQ: {fmt(profitGrowth.qoq)}%</span>
              <br />
              <span>YoY: {fmt(profitGrowth.yoy)}%
                <span className={profitGrowth.yoy > 0 ? 'positive' : profitGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({profitGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>EPS Growth:</span>
            <div>
              <span>QoQ: {fmt(epsGrowth.qoq)}%</span>
              <br />
              <span>YoY: {fmt(epsGrowth.yoy)}%
                <span className={epsGrowth.yoy > 0 ? 'positive' : epsGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({epsGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>Book Value Growth:</span>
            <div>
              <span>QoQ: {fmt(bookValueGrowth.qoq)}%</span>
              <br />
              <span>YoY: {fmt(bookValueGrowth.yoy)}%
                <span className={bookValueGrowth.yoy > 0 ? 'positive' : bookValueGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({bookValueGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          <div className="metric">
            <span>Dividend Growth:</span>
            <div>
              <span>QoQ: {fmt(dividendGrowth.qoq)}%</span>
              <br />
              <span>YoY: {fmt(dividendGrowth.yoy)}%
                <span className={dividendGrowth.yoy > 0 ? 'positive' : dividendGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                  ({dividendGrowth.trend})
                </span>
              </span>
            </div>
          </div>
          {operatingProfitGrowth && (
            <div className="metric">
              <span>Operating Profit Growth (YoY, excludes one-off gains):</span>
              <span className={operatingProfitGrowth.yoy > 0 ? 'positive' : operatingProfitGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                {fmt(operatingProfitGrowth.yoy)}% ({operatingProfitGrowth.trend})
              </span>
            </div>
          )}
          {pbtGrowth && (
            <div className="metric">
              <span>PBT Growth (YoY):</span>
              <span className={pbtGrowth.yoy > 0 ? 'positive' : pbtGrowth.yoy < 0 ? 'negative' : 'neutral'}>
                {fmt(pbtGrowth.yoy)}% ({pbtGrowth.trend})
              </span>
            </div>
          )}
        </div>

        {/* Quarterly Results Trend */}
        {quarterly && quarterly.sales && (
          <div className="metric-group">
            <h4>Quarterly Results Trend</h4>
            {(quarterly.warnings || []).map((w, i) => (
              <div key={i} className="metric">
                <span className="negative">⚠ {w}</span>
              </div>
            ))}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.85em', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px' }}></th>
                    {quarterly.labels.map((l, i) => (
                      <th key={i} style={{ textAlign: 'right', padding: '4px' }}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px' }}><strong>Sales (Cr)</strong></td>
                    {quarterly.sales.map((v, i) => (
                      <td key={i} style={{ textAlign: 'right', padding: '4px' }}>{v?.toLocaleString('en-IN') ?? '—'}</td>
                    ))}
                  </tr>
                  {quarterly.netProfit && quarterly.netProfit.length > 0 && (
                    <tr>
                      <td style={{ padding: '4px' }}><strong>Net Profit (Cr)</strong></td>
                      {quarterly.netProfit.map((v, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '4px' }}>{v?.toLocaleString('en-IN') ?? '—'}</td>
                      ))}
                    </tr>
                  )}
                  {quarterly.opm && quarterly.opm.length > 0 && (
                    <tr>
                      <td style={{ padding: '4px' }}><strong>OPM %</strong></td>
                      {quarterly.opm.map((v, i) => (
                        <td key={i} style={{ textAlign: 'right', padding: '4px' }}>{v ?? '—'}</td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="metric">
              <span>Sales QoQ:</span>
              <span className={quarterly.salesQoQ > 0 ? 'positive' : quarterly.salesQoQ < 0 ? 'negative' : 'neutral'}>
                {quarterly.salesQoQ != null ? `${quarterly.salesQoQ.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span>Sales vs same quarter last year (seasonality-adjusted):</span>
              <span className={quarterly.salesYoYQuarter > 0 ? 'positive' : quarterly.salesYoYQuarter < 0 ? 'negative' : 'neutral'}>
                {quarterly.salesYoYQuarter != null ? `${quarterly.salesYoYQuarter.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span>Profit vs same quarter last year:</span>
              <span className={quarterly.profitYoYQuarter > 0 ? 'positive' : quarterly.profitYoYQuarter < 0 ? 'negative' : 'neutral'}>
                {quarterly.profitYoYQuarter != null ? `${quarterly.profitYoYQuarter.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            {quarterly.grossNPA != null && (
              <div className="metric">
                <span>Gross NPA (banks):</span>
                <span className={quarterly.grossNPA < 2 ? 'positive' : quarterly.grossNPA < 5 ? 'neutral' : 'negative'}>
                  {quarterly.grossNPA}%
                </span>
              </div>
            )}
            {quarterly.netNPA != null && (
              <div className="metric">
                <span>Net NPA (banks):</span>
                <span className={quarterly.netNPA < 1 ? 'positive' : quarterly.netNPA < 3 ? 'neutral' : 'negative'}>
                  {quarterly.netNPA}%
                </span>
              </div>
            )}
          </div>
        )}

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
                <span>₹{fmt(projections.eps.current)}</span>
              </div>
              <div className="metric">
                <span>EPS (1Y Proj):</span>
                <span>₹{fmt(projections.eps.projected1Y)}</span>
              </div>
              <div className="metric">
                <span>EPS (2Y Proj):</span>
                <span>₹{fmt(projections.eps.projected2Y)}</span>
              </div>
              <div className="metric">
                <span>EPS CAGR:</span>
                <span>{fmt(projections.eps.cagr)}%</span>
              </div>
              <div className="metric">
                <span>Revenue (Current):</span>
                <span>₹{fmt(projections.revenue.current, 0)} Cr</span>
              </div>
              <div className="metric">
                <span>Revenue (1Y Proj):</span>
                <span>₹{fmt(projections.revenue.projected1Y, 0)} Cr</span>
              </div>
              <div className="metric">
                <span>Revenue (2Y Proj):</span>
                <span>₹{fmt(projections.revenue.projected2Y, 0)} Cr</span>
              </div>
              <div className="metric">
                <span>Revenue CAGR:</span>
                <span>{fmt(projections.revenue.cagr)}%</span>
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