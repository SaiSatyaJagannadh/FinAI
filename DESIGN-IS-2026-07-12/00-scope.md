# Audit Scope — FinAI Client UI

**Date:** 2026-07-12
**Audited surface:** FinAI React web client — primary screen: StockSearch page (`client/src/pages/StockSearch.js`) comprising `StockSearchForm`, `GoogleFinanceOverview`, `AnalysisResults` (tabs: Fundamental, Technical, Growth, Risk, Mutual Fund, Recommendation). Secondary: nav shell in `App.js` with placeholder pages (Analysis, Portfolio, Watchlist).
**Input materials:** Source at `client/src/`, built bundle at `client/build/`, running instance at http://localhost:5000 (Express serving the production build).

**Primary user:** Retail investor researching Indian (NSE/BSE) stocks.
**Primary task:** Type a stock symbol, run analysis, and understand whether to buy/hold/sell and why.

**Constraints:** Solo-developer project; stack fixed (React 18, CRA, custom CSS, Recharts); about to deploy publicly on Render free tier. No formal brand.
**Reference designs:** Google Finance (explicitly imitated in `GoogleFinanceOverview.js` per CLAUDE.md).
