import React from 'react';

const td = { padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
const tdLeft = { ...td, textAlign: 'left', whiteSpace: 'normal' };

// Where each number can be double-checked, per exchange
export const sourceLinks = (symbol, exchange) => {
  const links = [
    ['Yahoo Finance', `https://finance.yahoo.com/quote/${symbol}${exchange === 'NSE' ? '.NS' : exchange === 'BSE' ? '.BO' : ''}`],
    ['Google Finance', `https://www.google.com/finance/quote/${symbol}:${{ NSE: 'NSE', BSE: 'BOM' }[exchange] || 'NASDAQ'}`],
  ];
  if (exchange === 'NSE' || exchange === 'BSE') {
    links.push(['Screener.in', `https://www.screener.in/company/${symbol}/consolidated/`]);
  } else {
    links.push(['FinViz', `https://finviz.com/quote.ashx?t=${symbol}`]);
  }
  return links;
};

const GrowthProjection = ({ projection, stock }) => {
  const symbol = stock?.symbol || '';
  const exchange = stock?.exchange || 'NSE';
  const cur = exchange === 'NSE' || exchange === 'BSE' ? '₹' : '$';

  return (
    <div className="analysis-panel">
      <h3>Growth Projection — year-wise price path</h3>
      {projection && projection.scenarios?.length ? (
        <>
          <p className="explainer">
            Projected price = current price ({cur}{projection.currentPrice.toLocaleString('en-IN')}) × (1 + growth)ʸᵉᵃʳˢ,
            assuming the P/E multiple holds — price tracks earnings. Negative growth rows show a <em>declining</em> price.
            These are mechanical extrapolations from the listed sources, not investment advice.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.9em', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tdLeft}>Scenario</th>
                  <th style={td}>Growth %/yr</th>
                  {projection.years.map((y) => <th key={y} style={td}>{y}Y</th>)}
                  <th style={tdLeft}>Why it grows (or shrinks)</th>
                  <th style={tdLeft}>Source</th>
                </tr>
              </thead>
              <tbody>
                {projection.scenarios.map((s) => (
                  <tr key={s.label} style={s.label.startsWith('★') ? { fontWeight: 600 } : undefined}>
                    <td style={tdLeft}>{s.label}</td>
                    <td style={td} className={s.growthPct > 0 ? 'positive' : s.growthPct < 0 ? 'negative' : 'neutral'}>
                      {s.growthPct > 0 ? '+' : ''}{s.growthPct}%
                    </td>
                    {s.prices.map((p, i) => (
                      <td key={i} style={td} className={s.growthPct < 0 ? 'negative' : undefined}>
                        {cur}{p.toLocaleString('en-IN')}
                      </td>
                    ))}
                    <td style={tdLeft}>{s.why}</td>
                    <td style={tdLeft}>
                      {/^https?:/.test(s.source)
                        ? <a href={s.source} target="_blank" rel="noopener noreferrer">FinViz ↗</a>
                        : s.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>Not enough growth data to project a price path for this stock.</p>
      )}
      <div className="metric-group">
        <h4>Verify these numbers yourself</h4>
        <ul>
          {sourceLinks(symbol, exchange).map(([name, url]) => (
            <li key={name}><a href={url} target="_blank" rel="noopener noreferrer">{name} ↗</a></li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GrowthProjection;
