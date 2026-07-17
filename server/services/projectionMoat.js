/**
 * Year-wise price projection scenarios, moat checklist and sector outlook.
 * Attached to the analysis response as `projection` / `moat` / `sectorOutlook`
 * (mirrors what streamlit_app.py computes in Python for its own tabs).
 */

const YEARS = [1, 2, 3, 4, 5, 10];

// ponytail: static sector-outlook table (CAGR ranges from public industry
// research), duplicated from streamlit_app.py SECTOR_OUTLOOK — swap both for a
// live source if they ever need to be current-quarter fresh. Keys are the
// canonical sector names from services/sector_map.py.
const SECTOR_OUTLOOK = {
  IT_Services: { cagr: '8–10%', driver: 'cloud migration, enterprise AI adoption and digital transformation spend', source: 'https://www.gartner.com/en/newsroom/press-releases' },
  Banking: { cagr: '11–13%', driver: 'credit growth running ~1.3x nominal GDP, retail lending and digitisation', source: 'https://www.ibef.org/industry/banking-india' },
  Pharma: { cagr: '9–11%', driver: 'generics exports, CDMO outsourcing shift and domestic formulations', source: 'https://www.ibef.org/industry/pharmaceutical-india' },
  FMCG: { cagr: '9–10%', driver: 'rising rural incomes, premiumisation and distribution reach', source: 'https://www.ibef.org/industry/fmcg' },
  Auto: { cagr: '7–9%', driver: 'EV transition, premiumisation and export growth', source: 'https://www.ibef.org/industry/india-automobiles' },
  Energy: { cagr: '6–8%', driver: 'energy demand growth plus renewables capex cycle', source: 'https://www.ibef.org/industry/oil-gas-india' },
  Telecom: { cagr: '7–9%', driver: 'ARPU repair, 5G monetisation and data consumption growth', source: 'https://www.ibef.org/industry/telecommunications' },
  Construction: { cagr: '9–10%', driver: 'government infrastructure capex and housing demand', source: 'https://www.ibef.org/industry/infrastructure-sector-india' },
  Metals: { cagr: '5–7%', driver: 'infrastructure demand, though cyclical with global commodity prices', source: 'https://www.ibef.org/industry/metals-and-mining' },
  Chemicals: { cagr: '8–9%', driver: 'China+1 supply-chain shift and specialty chemicals demand', source: 'https://www.ibef.org/industry/chemical-industry-india' },
  Industrials: { cagr: '8–10%', driver: 'private capex revival and manufacturing (PLI) incentives', source: 'https://www.ibef.org/industry/manufacturing-sector-india' },
  default: { cagr: '6–8%', driver: 'roughly tracks nominal GDP growth', source: 'https://www.imf.org/en/Publications/WEO' },
};

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Build price-path scenarios: price follows the growth driver at a constant
 * P/E. Negative growth = declining price path. `finviz` is the parsed output
 * of services/finvizService.py (or null for Indian stocks / failed fetch).
 */
function buildProjection(stockData, finviz) {
  const price = stockData.priceData?.current || 0;
  const scenarios = [];
  const epsG = stockData.epsGrowth?.yoy || 0;
  const revG = stockData.revenueGrowth?.yoy || 0;
  if (epsG) {
    scenarios.push({
      label: 'Trailing EPS growth', growthPct: epsG,
      source: 'Screener.in / yfinance (trailing YoY)',
      why: "Earnings keep compounding at last year's pace; price follows EPS if the P/E multiple holds",
    });
  }
  if (revG) {
    scenarios.push({
      label: 'Trailing revenue growth', growthPct: revG,
      source: 'Screener.in / yfinance (trailing YoY)',
      why: "Sales keep growing at last year's pace with steady margins",
    });
  }
  if (stockData.targetMeanPrice && price) {
    scenarios.push({
      label: 'Analyst mean target (Yahoo)',
      growthPct: (stockData.targetMeanPrice / price - 1) * 100,
      source: 'yfinance targetMeanPrice',
      why: 'Wall Street consensus 12-month price target, extended at the same annual pace',
    });
  }
  if (finviz && finviz.success) {
    if (finviz.analystTarget && price) {
      scenarios.push({
        label: 'Analyst target (FinViz)',
        growthPct: (finviz.analystTarget / price - 1) * 100,
        source: finviz.source || 'FinViz',
        why: 'FinViz consensus 12-month price target, extended at the same annual pace',
      });
    }
    if (finviz.epsGrowthNextY) {
      scenarios.push({
        label: 'EPS estimate next year (FinViz)', growthPct: finviz.epsGrowthNextY,
        source: finviz.source || 'FinViz',
        why: "Analysts' forward EPS estimate for next fiscal year",
      });
    }
    if (finviz.epsGrowthNext5Y) {
      scenarios.push({
        label: 'EPS next-5Y CAGR (FinViz)', growthPct: finviz.epsGrowthNext5Y,
        source: finviz.source || 'FinViz',
        why: "Analysts' long-term (5-year) earnings growth estimate",
      });
    }
  }
  if (!scenarios.length || !price) return null;

  scenarios.unshift({
    label: '★ Base case (median of scenarios)',
    growthPct: median(scenarios.map((s) => s.growthPct)),
    source: 'Blend of the rows below',
    why: 'Middle-of-the-road path when the sources disagree',
  });
  return {
    currentPrice: price,
    years: YEARS,
    scenarios: scenarios.map((s) => ({
      ...s,
      growthPct: Math.round(s.growthPct * 10) / 10,
      prices: YEARS.map((y) => Math.round(price * Math.pow(1 + s.growthPct / 100, y))),
    })),
  };
}

/** Moat checklist scored from the measurable fingerprints a moat leaves. */
function buildMoat(stockData, shareholding) {
  const roe = stockData.roe || 0;
  const roce = stockData.roce || 0;
  const pm = stockData.profitMargin || 0;
  const de = stockData.debtToEquity || 0;
  const promoter = shareholding?.percentages?.promoter || 0;

  const checks = [
    { pass: roe >= 15, text: `Return on equity ${roe.toFixed(1)}% — ≥15% means it earns well above its cost of capital (pricing power / brand)` },
    { pass: pm >= 10, text: `Net profit margin ${pm.toFixed(1)}% — ≥10% suggests competitors can't undercut it easily` },
    { pass: de <= 0.5, text: `Debt/equity ${de.toFixed(2)} — ≤0.5 means the moat is self-funded, not borrowed` },
  ];
  if (roce) {
    checks.splice(1, 0, { pass: roce >= 15, text: `Return on capital employed ${roce.toFixed(1)}% — ≥15% means reinvested profits compound efficiently` });
  }
  if (promoter) {
    checks.push({ pass: promoter >= 40, text: `Promoter holding ${promoter.toFixed(1)}% — ≥40% means insiders keep skin in the game` });
  }
  const passed = checks.filter((c) => c.pass).length;
  const verdict = passed >= checks.length - 1 ? 'WIDE'
    : passed >= 2 ? 'NARROW'
      : 'NONE';
  return { checks, passed, total: checks.length, verdict };
}

function sectorOutlook(canonicalSector) {
  return SECTOR_OUTLOOK[canonicalSector] || SECTOR_OUTLOOK.default;
}

module.exports = { buildProjection, buildMoat, sectorOutlook, YEARS };
