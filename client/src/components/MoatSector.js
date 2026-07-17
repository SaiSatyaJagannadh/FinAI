import React from 'react';

const VERDICTS = {
  WIDE: ['positive', 'Wide moat — most quality markers present'],
  NARROW: ['neutral', 'Narrow moat — some durable advantages, not dominant'],
  NONE: ['negative', 'No clear moat — profits look competitive/cyclical'],
};

const docLinks = (symbol, exchange) =>
  exchange === 'NSE' || exchange === 'BSE'
    ? [
      ['Annual reports, concalls & credit ratings (Screener.in)', `https://www.screener.in/company/${symbol}/consolidated/#documents`],
      ['Exchange filings (NSE)', `https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`],
      ['Google Finance', `https://www.google.com/finance/quote/${symbol}:${exchange === 'NSE' ? 'NSE' : 'BOM'}`],
    ]
    : [
      ['SEC filings — 10-K annual reports (EDGAR)', `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=10-K&dateb=&owner=include&count=10`],
      ['FinViz snapshot & analyst ratings', `https://finviz.com/quote.ashx?t=${symbol}`],
      ['Financial statements (stockanalysis.com)', `https://stockanalysis.com/stocks/${symbol}/financials/`],
    ];

const MoatSector = ({ moat, sectorOutlook, stock }) => {
  const symbol = stock?.symbol || '';
  const exchange = stock?.exchange || 'NSE';
  const [verdictClass, verdictText] = VERDICTS[moat?.verdict] || VERDICTS.NONE;

  return (
    <div className="analysis-panel">
      <h3>Moat &amp; Sector</h3>

      <div className="metric-group">
        <h4>Economic moat check</h4>
        <p className="explainer">
          A moat = a durable edge that keeps competitors from eroding profits.
          These are the measurable fingerprints a moat leaves in the numbers:
        </p>
        {moat?.checks?.length ? (
          <>
            {moat.checks.map((c, i) => (
              <div key={i} className="metric">
                <span className={c.pass ? 'positive' : 'negative'}>{c.pass ? '✅' : '❌'} {c.text}</span>
              </div>
            ))}
            <div className="metric">
              <span className={verdictClass}>
                <strong>{verdictText}</strong> ({moat.passed}/{moat.total} checks passed)
              </span>
            </div>
            <p className="explainer">
              Numbers show the moat's <em>effect</em>; read the annual report (links below) for its <em>cause</em> —
              brand, network effects, switching costs, cost advantage or regulation.
            </p>
          </>
        ) : <p>Not enough data for a moat check.</p>}
      </div>

      {sectorOutlook && (
        <div className="metric-group">
          <h4>Sector outlook — coming years</h4>
          <p>
            <strong>{sectorOutlook.sector.replace(/_/g, ' ')}</strong>: expected to grow ~<strong>{sectorOutlook.cagr}/yr</strong> over
            the next few years, driven by {sectorOutlook.driver}.{' '}
            <a href={sectorOutlook.source} target="_blank" rel="noopener noreferrer">Industry research ↗</a>
          </p>
        </div>
      )}

      <div className="metric-group">
        <h4>How analysts actually analyze this stock</h4>
        <ul>
          <li><strong>Valuation</strong> — P/E and PEG vs. the sector range (Fundamental tab), plus discounted cash flow for a fair-value estimate.</li>
          <li><strong>Quality</strong> — ROE/ROCE and margins, sustained over years, not one good quarter.</li>
          <li><strong>Growth</strong> — revenue/EPS trajectory and management guidance (Growth &amp; Projection tabs).</li>
          <li><strong>Ownership flows</strong> — promoter/FII/DII/MF stake changes each quarter (Mutual Funds tab); rising institutional stakes = informed conviction.</li>
          <li><strong>Technicals</strong> — RSI, MACD, moving-average trend for entry timing (Technical tab).</li>
          <li><strong>Risk</strong> — beta, leverage, volatility sizing the downside (Risk tab).</li>
        </ul>
        <p className="explainer">
          FinAI's score weights these the same way: fundamental 25% · growth 25% · technical 20% · MF conviction 15% · risk 15%.
        </p>
      </div>

      <div className="metric-group">
        <h4>Primary documents &amp; deeper research</h4>
        <ul>
          {docLinks(symbol, exchange).map(([name, url]) => (
            <li key={name}><a href={url} target="_blank" rel="noopener noreferrer">{name} ↗</a></li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default MoatSector;
