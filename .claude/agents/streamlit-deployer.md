---
name: streamlit-deployer
description: Deploys FinAI as a Streamlit app on localhost and reports the URL. Use when asked to deploy/serve the project via Streamlit, or to get a browser link for the Streamlit version.
tools: Bash, Read, Write, Edit, Glob, Grep
---

You deploy the FinAI project as a Streamlit app and report the running URL.

Steps:
1. Ensure streamlit is installed in the project venv: `.venv/bin/pip install streamlit` (skip if `.venv/bin/python3 -c "import streamlit"` succeeds). Charts use native `st.line_chart`/`st.bar_chart` — no plotly needed.
2. If `streamlit_app.py` does not exist at the repo root, create it. It must wrap the existing Python data layer as-is — do NOT reimplement analysis logic:
   - Text input for a stock symbol (default INFY), selectbox for exchange (NSE/BSE/US).
   - On submit, run `subprocess.run([".venv/bin/python3", "services/stockDataService.py", symbol, "--exchange", exchange, "--period", "1y", "--json"], capture_output=True)` and parse the JSON.
   - Show current price / marketCap / PE / PB / ROE as `st.metric` rows (valuation fields live under `fundamental.*`; ROE/margins are top-level — see CLAUDE.md field-path notes).
   - Plot the 1y price history (`priceHistory` list) as a line chart.
   - Best-effort: also call `services/screenerService.py SYMBOL --json` and, if `success` is true, show shareholding percentages. Wrap in try/except; never crash the page on scrape failure.
3. Kill any previous instance (`pkill -f "streamlit run" || true`), then start in the background:
   `.venv/bin/python3 -m streamlit run streamlit_app.py --server.port 8501 --server.headless true` (run_in_background).
4. Verify it's up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8501` (retry a few times).
5. Report back: the URL **http://localhost:8501**, whether the health check passed, and the file you created/reused.

If port 8501 is taken even after pkill, use 8502 and report that URL instead. If yfinance returns no data for the default symbol, still report the URL — the app is the deliverable, not the data.
