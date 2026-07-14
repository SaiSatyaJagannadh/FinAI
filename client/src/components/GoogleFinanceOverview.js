import React, { useState } from 'react';

/* ---------- pure formatting helpers (guard everything) ---------- */
const isNum = (v) => v !== null && v !== undefined && !isNaN(v);
const fmt = (v, d = 2) => (isNum(v) ? Number(v).toFixed(d) : 'N/A');
const inr = (v, d = 2) =>
  isNum(v)
    ? '₹' +
      Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
    : 'N/A';
const intIN = (v) => (isNum(v) ? Number(v).toLocaleString('en-IN') : 'N/A');

// Market cap in rupees -> "X.XX Lakh Cr" (>=1e12) or "X,XXX Cr" (>=1e7)
const marketCapStr = (v) => {
  if (!isNum(v)) return 'N/A';
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)} Lakh Cr`;
  if (v >= 1e7) return `₹${Math.round(v / 1e7).toLocaleString('en-IN')} Cr`;
  return inr(v, 0);
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (dateStr) => {
  if (!dateStr || dateStr.length < 7) return '';
  const m = parseInt(dateStr.slice(5, 7), 10);
  return isNum(m) && m >= 1 && m <= 12 ? `${MONTHS[m - 1]} '${dateStr.slice(2, 4)}` : '';
};

const scoreColor = (s) => (isNum(s) ? (s >= 70 ? '#137333' : s >= 40 ? '#f59e0b' : '#a50e0e') : '#9aa0a6');
const scoreWord = (s) => (isNum(s) ? (s >= 70 ? 'Strong' : s >= 40 ? 'Okay' : 'Weak') : '—');

/* ---------- SVG price chart (no libraries) ---------- */
const RANGES = [
  { key: '1M', days: 22 },
  { key: '6M', days: 132 },
  { key: '1Y', days: Infinity },
];

const PriceChart = ({ history, prevClose }) => {
  const [range, setRange] = useState('1Y');

  const valid = (history || []).filter((d) => d && isNum(d.close));
  if (valid.length < 2) {
    return <div className="gf-chart-empty">Price chart unavailable</div>;
  }

  const days = (RANGES.find((r) => r.key === range) || {}).days || Infinity;
  const data = days === Infinity ? valid : valid.slice(-days);
  const n = data.length;

  const W = 1000, H = 260, padL = 10, padR = 66, padT = 16, padB = 26;
  const closes = data.map((d) => d.close);
  const showPrev = isNum(prevClose);
  const lo = Math.min(...closes, showPrev ? prevClose : Infinity);
  const hi = Math.max(...closes, showPrev ? prevClose : -Infinity);
  const span = hi - lo || 1;

  const px = (i) => padL + (i / (n - 1)) * (W - padL - padR);
  const py = (c) => padT + (1 - (c - lo) / span) * (H - padT - padB);

  const linePath = 'M' + data.map((d, i) => `${px(i).toFixed(1)},${py(d.close).toFixed(1)}`).join(' L');
  const baseY = H - padB;
  const areaPath = `${linePath} L${px(n - 1).toFixed(1)},${baseY} L${px(0).toFixed(1)},${baseY} Z`;

  const up = data[n - 1].close >= data[0].close;
  const color = up ? '#137333' : '#a50e0e';
  const gid = `grad-${up ? 'up' : 'down'}`;

  const ticks = [0, 1, 2, 3].map((k) => Math.round((k * (n - 1)) / 3));

  return (
    <div>
      <div className="gf-range-btns">
        {RANGES.map((r) => (
          <button
            key={r.key}
            className={`gf-range-btn ${range === r.key ? 'active' : ''}`}
            onClick={() => setRange(r.key)}
          >
            {r.key}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="gf-chart-svg" role="img" aria-label="Price history">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* previous close reference */}
        {showPrev && (
          <line
            x1={padL}
            y1={py(prevClose)}
            x2={W - padR}
            y2={py(prevClose)}
            stroke="#9aa0a6"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        <path d={areaPath} fill={`url(#${gid})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={px(n - 1)} cy={py(data[n - 1].close)} r="3.5" fill={color} />

        {/* y-axis min / max */}
        <text x={W - padR + 8} y={py(hi) + 4} className="gf-axis" textAnchor="start">
          {inr(hi, 0)}
        </text>
        <text x={W - padR + 8} y={py(lo) + 4} className="gf-axis" textAnchor="start">
          {inr(lo, 0)}
        </text>

        {/* x-axis month labels */}
        {ticks.map((idx, k) => (
          <text
            key={k}
            x={px(idx)}
            y={H - 6}
            className="gf-axis"
            textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}
          >
            {monthLabel(data[idx].date)}
          </text>
        ))}
      </svg>
    </div>
  );
};

// Google Finance quote URL for this symbol (fallback when our data is missing/simulated)
const googleFinanceUrl = (symbol, exchange) =>
  `https://www.google.com/finance/quote/${encodeURIComponent(symbol || '')}:${exchange === 'BSE' ? 'BOM' : 'NSE'}`;

/* ---------- beginner-friendly sentence builder ---------- */
const buildPlainEnglish = ({ name, sector, price, changePct, isUp, fundamental, mf, growth, overall, projectedPrice1Y, epsCagr }) => {
  const out = [];

  if (isNum(price) && isNum(changePct)) {
    out.push(`${name} trades at ${inr(price)}, ${isUp ? 'up' : 'down'} ${fmt(Math.abs(changePct))}% today.`);
  }

  const ic = fundamental && fundamental.industryComparison;
  const icPe = ic && ic.peRatio;
  if (icPe && isNum(icPe.value) && icPe.verdict && icPe.verdict !== 'NO_DATA') {
    const rangeTxt = Array.isArray(icPe.sectorRange) ? ` (${icPe.sectorRange[0]}–${icPe.sectorRange[1]}×)` : '';
    const sec = sector || 'similar';
    let tail;
    if (icPe.verdict === 'CHEAPER_THAN_SECTOR') tail = `cheaper than typical ${sec} companies${rangeTxt}, so it looks reasonably priced.`;
    else if (icPe.verdict === 'PRICIER_THAN_SECTOR') tail = `pricier than typical ${sec} companies${rangeTxt}, so the market expects strong growth.`;
    else tail = `in line with other ${sec} companies${rangeTxt}.`;
    out.push(`Its P/E is ${fmt(icPe.value, 1)} — ${tail}`);
  } else if (fundamental && isNum(fundamental.peRatio && fundamental.peRatio.trailing)) {
    out.push(`Its price is about ${fmt(fundamental.peRatio.trailing, 1)}× its yearly profit per share (P/E).`);
  }

  if (mf && mf.sentiment && isNum(mf.totalFundsHolding) && isNum(mf.totalFundsAnalyzed)) {
    const trimmed = Array.isArray(mf.topHolders) && mf.topHolders.some((h) => isNum(h && h.changeLastQuarter) && h.changeLastQuarter < 0);
    out.push(
      `Big mutual funds look ${String(mf.sentiment).toLowerCase()} — ${mf.totalFundsHolding} of ${mf.totalFundsAnalyzed} funds tracked hold this stock${trimmed ? ', though some trimmed their stake last quarter' : ''}.`
    );
  }

  const rev = growth && growth.revenueGrowth;
  if (rev && isNum(rev.yoy)) {
    const q = growth.quarterly;
    const warn = q && Array.isArray(q.warnings) && q.warnings.length > 0;
    out.push(
      `Sales ${rev.yoy >= 0 ? 'grew' : 'shrank'} ${fmt(Math.abs(rev.yoy))}% over the past year${warn ? ', but the latest quarter was softer than a year ago' : ''}.`
    );
  }

  if (isNum(projectedPrice1Y) && isNum(epsCagr) && isNum(price) && price > 0) {
    const worth = (10000 * projectedPrice1Y) / price;
    out.push(
      `If profits keep growing ~${fmt(epsCagr, 1)}% a year and the market pays the same P/E, ₹10,000 invested today could be worth about ${inr(worth, 0)} in a year. This is an estimate, not a guarantee.`
    );
  }

  const rec = overall && overall.recommendation;
  if (rec && rec.action) {
    out.push(`Overall the system rates this ${rec.action}${rec.confidence ? ` (${String(rec.confidence).toLowerCase()} confidence)` : ''}.`);
  }

  return out;
};

/* ---------- main overview ---------- */
const GoogleFinanceOverview = ({ stock, analysis }) => {
  if (!stock || !analysis) return null;

  const priceData = stock.priceData || {};
  const fundamental = analysis.fundamental || {};
  const overall = analysis.overall || {};
  const mf = analysis.mutualFundConviction || {};
  const growth = analysis.growth || {};

  const name = stock.name || stock.symbol || 'This stock';
  const exchange = stock.exchange || 'NSE';
  const isDemo = Array.isArray(analysis.dataSources) && analysis.dataSources.includes('SIMULATED_DATA');

  const price = priceData.current;
  const prevClose = priceData.previousClose;
  const change = isNum(price) && isNum(prevClose) ? price - prevClose : null;
  const changePct = isNum(change) && isNum(prevClose) && prevClose !== 0 ? (change / prevClose) * 100 : null;
  const isUp = isNum(change) ? change >= 0 : true;

  const week52 = stock.week52 || {};
  const gfUrl = googleFinanceUrl(stock.symbol, exchange);

  // 1-year price projection (doc method): EPS grows at guidance/historical CAGR,
  // market keeps paying the same P/E → price grows at the same rate.
  const proj = growth.projections || {};
  const epsCagr = proj.eps && isNum(proj.eps.cagr) ? proj.eps.cagr : null;
  const projectedPrice1Y = isNum(price) && isNum(epsCagr) ? price * (1 + epsCagr / 100) : null;
  const projectedPrice2Y = isNum(price) && isNum(epsCagr) ? price * Math.pow(1 + epsCagr / 100, 2) : null;
  const targetPrice = overall.recommendation && overall.recommendation.targetPrice;

  // Dividend yield / book value only appear on some responses
  const dividendYield = priceData.dividendYield ?? stock.dividendYield;
  const bookValue = priceData.bookValue ?? fundamental.bookValue;

  const keyStats = [
    { label: 'Open', value: inr(priceData.open) },
    { label: 'High', value: inr(priceData.dayHigh) },
    { label: 'Low', value: inr(priceData.dayLow) },
    { label: 'Prev Close', value: inr(prevClose) },
    { label: 'Volume', value: intIN(priceData.volume) },
    { label: 'Avg Volume', value: intIN(priceData.avgVolume) },
    { label: 'Market Cap', value: marketCapStr(priceData.marketCap) },
    { label: '52-wk High', value: inr(week52.high) },
    { label: '52-wk Low', value: inr(week52.low) },
    { label: 'P/E (TTM)', value: fmt(fundamental.peRatio && fundamental.peRatio.trailing) },
  ];
  if (isNum(dividendYield)) keyStats.push({ label: 'Dividend Yield', value: `${fmt(dividendYield)}%` });
  if (isNum(bookValue)) keyStats.push({ label: 'Book Value', value: inr(bookValue) });

  const sentences = buildPlainEnglish({
    name,
    sector: stock.sector,
    price,
    changePct,
    isUp,
    fundamental,
    mf,
    growth,
    overall,
    projectedPrice1Y,
    epsCagr,
  });

  const bars = [
    { label: 'Fundamental', score: overall.fundamentalScore },
    { label: 'Technical', score: overall.technicalScore },
    { label: 'Growth', score: overall.growthScore },
    { label: 'Fund Conviction', score: overall.convictionScore },
    { label: 'Risk (higher = safer)', score: overall.riskScore },
  ];

  return (
    <div className="gf-overview">
      {/* Header */}
      <div className="gf-head">
        <div className="gf-head-top">
          <h1 className="gf-name">{name}</h1>
          <span className="gf-chip">
            {stock.symbol} &middot; {exchange}
          </span>
          {isDemo && <span className="gf-demo">Demo data — not live</span>}
          <a className="gf-ext-link" href={gfUrl} target="_blank" rel="noopener noreferrer">
            View on Google Finance ↗
          </a>
        </div>
        <div className="gf-price-row">
          <span className="gf-price">{inr(price)}</span>
          {isNum(change) && (
            <span className={`gf-change ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : '−'}
              {inr(Math.abs(change))} ({isUp ? '+' : '−'}
              {fmt(Math.abs(changePct))}%)
            </span>
          )}
        </div>
        <div className="gf-caption">Data: Yahoo Finance + Screener.in</div>
      </div>

      {/* Live-data fallback: we couldn't fetch this stock, send the user to Google Finance */}
      {isDemo && (
        <div className="gf-card gf-fallback">
          <h3 className="gf-card-title">⚠ We couldn't fetch live data for this stock</h3>
          <p className="explainer">
            The numbers below are <strong>simulated placeholders</strong>, not real market data — don't make a
            buy/sell decision from them.
          </p>
          <a className="gf-fallback-btn" href={gfUrl} target="_blank" rel="noopener noreferrer">
            Check the real numbers on Google Finance ↗
          </a>
        </div>
      )}

      {/* Price chart */}
      <div className="gf-card gf-chart-card">
        <PriceChart history={stock.priceHistory} prevClose={prevClose} />
      </div>

      {/* Key stats */}
      <div className="gf-card">
        <h3 className="gf-card-title">Key stats</h3>
        <div className="gf-stats-grid">
          {keyStats.map((s) => (
            <div key={s.label} className="gf-stat">
              <span className="gf-stat-label">{s.label}</span>
              <span className="gf-stat-value">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* If you invest today — 1-year projection from EPS growth (guidance/history) */}
      {isNum(projectedPrice1Y) && price > 0 && !isDemo && (
        <div className="gf-card">
          <h3 className="gf-card-title">If you invest today</h3>
          <p className="explainer">
            Estimate assumes profits (EPS) grow at {fmt(epsCagr, 1)}% a year — from management guidance where
            available, else last year's growth — and the market keeps paying today's P/E. Not a guarantee.
          </p>
          <div className="gf-stats-grid">
            <div className="gf-stat">
              <span className="gf-stat-label">Price today</span>
              <span className="gf-stat-value">{inr(price)}</span>
            </div>
            <div className="gf-stat">
              <span className="gf-stat-label">Est. price in 1 year</span>
              <span className="gf-stat-value" style={{ color: projectedPrice1Y >= price ? '#137333' : '#a50e0e' }}>
                {inr(projectedPrice1Y)} ({epsCagr >= 0 ? '+' : ''}{fmt(epsCagr, 1)}%)
              </span>
            </div>
            <div className="gf-stat">
              <span className="gf-stat-label">Est. price in 2 years</span>
              <span className="gf-stat-value">{inr(projectedPrice2Y)}</span>
            </div>
            <div className="gf-stat">
              <span className="gf-stat-label">₹10,000 → in 1 year</span>
              <span className="gf-stat-value">{inr((10000 * projectedPrice1Y) / price, 0)}</span>
            </div>
            {isNum(targetPrice) && (
              <div className="gf-stat">
                <span className="gf-stat-label">System target price</span>
                <span className="gf-stat-value">{inr(targetPrice)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plain English */}
      {sentences.length > 0 && (
        <div className="gf-card gf-plain">
          <h3 className="gf-card-title">In plain English</h3>
          <ul className="gf-plain-list">
            {sentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Score bars */}
      <div className="gf-card">
        <h3 className="gf-card-title">How this stock scores</h3>
        <p className="explainer">Each bar is 0&ndash;100. Green is strong, amber is okay, red is weak.</p>
        <div className="gf-bars">
          {bars.map((b) => (
            <div key={b.label} className="gf-bar-row">
              <span className="gf-bar-label">{b.label}</span>
              <div className="gf-bar-track">
                <div
                  className="gf-bar-fill"
                  style={{
                    width: `${isNum(b.score) ? Math.max(0, Math.min(100, b.score)) : 0}%`,
                    backgroundColor: scoreColor(b.score),
                  }}
                />
              </div>
              <span className="gf-bar-num">{isNum(b.score) ? Math.round(b.score) : 'N/A'}</span>
              <span className="gf-bar-verdict" style={{ color: scoreColor(b.score) }}>
                {scoreWord(b.score)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GoogleFinanceOverview;
