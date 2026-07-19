# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install everything (from repo root)
npm install && npm install --prefix client
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Run both server (port 5000) and client (port 3000) together
npm run dev

# Run individually
npm run server        # nodemon server/server.js
npm run client        # react-scripts start (client/)
npm start             # node server/server.js (no reload — prod-style)

# Streamlit app (the second deployment surface — see below)
.venv/bin/streamlit run streamlit_app.py

# Tests
npm test                                        # jest — tests/*.test.js (scoring, runner parity, projection/moat)
npx jest tests/projectionMoat.test.js           # single suite
.venv/bin/python3 tests/test_streamlit_app.py   # Streamlit AppTest smoke — hits live yfinance/Screener/FinViz; a Yahoo 429 is an env flake, not a bug

# Build client for production (server serves the built files in prod)
npm run client:build

# Exercise the Python data layer directly, bypassing Node (fastest way to debug bad numbers)
.venv/bin/python3 services/stockDataService.py INFY --exchange NSE --period 1y --json
.venv/bin/python3 services/screenerService.py INFY --json
.venv/bin/python3 services/finvizService.py AAPL --json   # US stocks only
```

There is no lint script configured. `client/` uses CRA defaults (`react-scripts test`, `eslintConfig: react-app` in `client/package.json`) but nothing is wired at the root.

## Architecture

### Two-language pipeline, one request

A single `POST /api/analysis/:symbol` call fans out across Python and Node:

1. **`server/routes/analysisRoutes.js`** shells out via `child_process.exec` to `services/stockDataService.py` (yfinance) to get price data, valuation fields, growth, and 1y price history for the symbol (NSE symbols are mapped to `SYMBOL.NS` via `NSE_SYMBOL_MAP`, else auto-suffixed).
2. If that succeeds, it **also** shells out to `services/screenerService.py`, which scrapes Screener.in for Indian-specific fundamentals and shareholding (promoter/FII/DII/MF %). This is a best-effort enrichment step: `screenerService.py` scrapes live HTML (matched against Screener's current page structure — id-based `<section>` blocks like `#top-ratios`, `#profit-loss`, `#balance-sheet`, `#shareholding`, not the older HTML-comment markers), and returns `{success:false}` on any failure. The Node side only overwrites yfinance's values with the truthy Screener fields it gets back — it never hard-fails the request. `screenerShareholding` (promoter/FII/DII/MF percentages) is the *only* real source for the Mutual Fund Conviction tab; without a successful scrape, that tab falls back to a hardcoded default (`mutualFundAnalysis.analyzeConvictionStockSymbol(symbol, [])`). For US stocks, `services/finvizService.py` (FinViz snapshot scraper — analyst target, forward/5Y EPS growth) is a third best-effort enrichment that feeds projection scenarios.
3. If yfinance itself fails, `_generateMockStockData()` (bottom of `analysisRoutes.js`) fabricates a deterministic-per-symbol dataset (seeded PRNG from the symbol's char codes) so the UI never sees a hard error — check `dataSources` in the response to know if you're looking at `YAHOO_FINANCE`(+`SCREENER_IN`) or `SIMULATED_DATA`.
4. The merged `stockData` object is fanned out in parallel to five independent scoring services in `server/services/`: `fundamentalAnalysis.js`, `technicalAnalysis.js`, `mutualFundAnalysis.js`, `growthAnalysis.js`, `riskAnalysis.js`. Each returns its own 0–100 `overallScore` plus sub-metric detail; `server/services/recommendation.js` combines them with fixed weights (fundamental 25%, technical 20%, mutualFund 15%, growth 25%, risk 15%) into the final BUY/HOLD/SELL. All five scores, including risk, are higher = better (risk's sub-analyzers score higher = safer and `overallScore` is their weighted sum — no inversion anywhere). `server/services/projectionMoat.js` additionally attaches `projection` (year-wise 1Y–10Y price scenarios), `moat` (checklist), and `sectorOutlook` (static CAGR table keyed by canonical sector) to the response.
5. Result is cached in MongoDB (`Analysis` model) for 1 hour per stock unless `forceRefresh: true` is passed; `Stock.findOrCreate` means any typed symbol is analyzable without a DB seed step. Cache hits serve `Analysis.response` (Mixed — the exact response-shaped object), not the flattened typed fields alongside it; the two shapes differ (e.g. `technical.rsi` is a bare Number in storage but `{value, signal}` in the response), so never serve the typed doc to the frontend.

Note: `screenerService.py` scrapes the **consolidated** company page (`/company/SYM/consolidated/`) so PB/ROE/book-value match the group-level numbers Screener/Groww display; companies without consolidated financials get the standalone page at the same URL. The MF % in shareholding is always 0 — Screener's default table has no Mutual Funds row (it's a JS-loaded sub-row of DIIs) — and `buildFromShareholding` filters zero-percentage holders out, so the MF Conviction tab shows FII/DII/promoter data instead.

### Sector normalization

`server/services/fundamentalAnalysis.js` benchmarks are keyed by canonical sector names (`IT_Services`, `Banking`, `Pharma`, `FMCG`, `Auto`, `Energy`, `Telecom`, `Construction`, …). yfinance/Screener return free-form strings ("Technology Services") that never match, so **`services/sector_map.py`** maps them to the canonical keys — it's imported by both `stockDataService.py` and `streamlit_app.py`. Without it every stock silently falls through to the `default` benchmark. The static `SECTOR_OUTLOOK` table (sector CAGR/driver/source) is deliberately duplicated in `projectionMoat.js` and `streamlit_app.py` — change both.

### The Streamlit app is a second full frontend, not a demo

`streamlit_app.py` (repo root, ~800 lines) is a parallel deployment of the whole product, live at **https://finai-stock-analysis.streamlit.app/** (Streamlit Community Cloud, auto-redeploys on every push to GitHub main):

- It calls the Python services directly, then runs the **same five Node scoring services** via `server/services/analysisRunner.js` — a standalone stdin-JSON→stdout-JSON runner with zero npm deps (no express/mongoose), sharing `recommendation.js` with the route. `packages.txt` apt-installs `nodejs` on Streamlit Cloud to make this work. `tests/analysisRunner.parity.test.js` proves runner output == route fan-out; keep them in lockstep when changing either.
- Streamlit Cloud installs the root `requirements.txt` (NOT `requirements-deploy.txt`); ta-lib is commented out there because a missing wheel fails the whole deploy.
- Auth: bcrypt signup/login gate backed by the Mongo `users` collection (Atlas in the cloud; `MONGODB_URI` comes from Streamlit secrets, with certifi CA for TLS). `_mongo_client` is `@st.cache_resource` and deliberately raises on failure so a transient Atlas error isn't cached until reboot.
- The Growth Projection tab upserts per-symbol scenario docs into the Mongo `projectionCache` collection.
- Deliberate divergences from the Node route: **no** `_generateMockStockData` fallback (Streamlit shows an honest error on yfinance failure instead of SIMULATED_DATA), and no `managementGuidance` input.
- Known gotchas already handled — don't regress them: US price history spanning a DST switch needs `pd.to_datetime(..., utc=True)` (pandas 2.x raises on mixed tz offsets); `st.cache_data` must never cache a `success:false` fetch result or one Yahoo 429 poisons a symbol for the whole TTL; yfinance zeroes totalDebt/totalCash/FCF when `financialCurrency` differs from the listing currency (e.g. INFY.NS reports USD) — that's a deliberate cross-currency guard in `stockDataService.py`, not a bug.

### The stockData shape is the load-bearing contract

Because the pipeline crosses a Python→JSON→Node boundary and then a Screener-scrape merge on top of that, **field paths are easy to get wrong silently** — a wrong path just reads `undefined`/`0` and produces a plausible-looking but meaningless score instead of an error. When touching any analysis service, verify the exact key path against what `stockDataService.py`'s `fetch_stock_data()` actually emits:

- Valuation fields (PE, forward PE, PB, dividend yield, EPS, book value) live under `stockData.fundamental.*` — **not** `stockData.priceData.*` (priceData only has current/open/high/low/volume/marketCap).
- ROE, ROA, profit/operating margin, debt-to-equity, current/quick ratio, beta, volatility are **top-level** on `stockData` (not nested).
- `debtToEquity` from yfinance is emitted as a ratio (Python divides `info['debtToEquity']` by 100 before returning, since yfinance's raw value is a percentage-like number, e.g. raw `9.8` → `0.098`). If a sector benchmark check on debt starts looking absurd, check this unit conversion first.
- Growth fields (`revenueGrowth`, `profitGrowth`, `epsGrowth`, `bookValueGrowth`, `dividendGrowth`) are `{yoy, qoq}` objects, top-level.
- `mutualFundAnalysis.buildFromShareholding()` expects `{percentages, qoqChanges}` each keyed `promoter/fii/dii/mf/others` — this is Screener-only data, yfinance has no equivalent. Screener's Government/Others rows are accumulated into the `others` bucket so percentages sum to ~100.
- Frontend components (e.g. `MutualFundAnalysis.js`) read `holder.changeLastQuarter`, not `holder.change` — the two mutual-fund code paths (`analyzeConvictionStockSymbol` for mock data vs `buildFromShareholding` for real data) don't share a holder shape 1:1, so check both when the MF tab looks wrong.

If a whole analysis tab (Fundamental/Technical/MF/etc.) looks uniformly wrong or default-ish rather than just off-by-some-amount, suspect a field-path mismatch like the above before suspecting the scoring logic itself.

### Deployment

Two independent deployments:

1. **Render** (`render.yaml` + `Dockerfile`): single Docker service — Node installs `server/` and `client/` deps, builds the React app, and `server.js` serves the static build in production; there's no separate frontend host. Python deps for this image come from the trimmed `requirements-deploy.txt` (yfinance + requests + bs4 + lxml only), not the full dev `requirements.txt`. `PROJECT_ROOT` and `PYTHON_BIN` env vars let `analysisRoutes.js` find the Python scripts/interpreter when the working directory differs from repo root (see the path resolution at the top of `analysisRoutes.js`).
2. **Streamlit Community Cloud**: `streamlit_app.py` from GitHub main, root `requirements.txt` + `packages.txt` (nodejs), secrets via Streamlit dashboard.

MongoDB is Atlas in production for both (`MONGODB_URI`; Atlas Network Access must allow `0.0.0.0/0`); locally it defaults to `mongodb://localhost:27017/financialai`.

### Other things worth knowing

- Project agents in `.claude/agents/` (e.g. `finance-researcher`, `data-verifier`, `db-status`, `streamlit-deployer`) exist for auditing tab data quality against real sites, checking Mongo state, and local Streamlit deploys — use them when the user asks for those jobs.
- `PROJECT_SPEC.md` is the original product-vision doc (which analysis factors matter and why); useful context for *why* a metric is scored the way it is, but it describes aspirational scope (option chains, Twitter sentiment, taxation planning) well beyond what's implemented.
- `GEMINI_API_KEY` / `OPENAI_API_KEY` are present in `server/.env` but not read anywhere in the codebase — no LLM calls are wired up despite the "AI" branding.
- Stray root-level files not part of the real app: `server_test.js`, `debug_infy.py`, `my_notes`, `runcode`, `run_all.sh`, `run.sh` — leftover scratch/setup files, not part of `npm run dev`/Docker/Streamlit paths.
