import json
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).parent
PY = sys.executable  # run under the same venv streamlit runs in

st.set_page_config(page_title="FinAI", page_icon="📈", layout="wide")
st.title("📈 FinAI Stock Analysis")

col1, col2 = st.columns([3, 1])
symbol = col1.text_input("Stock symbol", "INFY").strip().upper()
exchange = col2.selectbox("Exchange", ["NSE", "BSE", "US"])


@st.cache_data(ttl=3600, show_spinner="Fetching data...")
def fetch(script, args):
    # Retry once (Yahoo intermittently 429s cloud IPs). Failures raise instead of
    # returning, so st.cache_data never caches a transient failure for the full TTL.
    data = None
    for attempt in (1, 2):
        out = subprocess.run(
            [PY, str(ROOT / "services" / script), *args, "--json"],
            capture_output=True, text=True, timeout=120, cwd=ROOT,
        )
        try:
            data = json.loads(out.stdout)
        except json.JSONDecodeError:
            data = None
        if data and data.get("success", True):
            return data
        if attempt == 1:
            time.sleep(2)
    raise RuntimeError(
        (data or {}).get("error") or out.stderr.strip()[-300:] or "empty response from data service"
    )


if st.button("Analyze", type="primary") and symbol:
    try:
        data = fetch("stockDataService.py", [symbol, "--exchange", exchange, "--period", "1y"])
    except Exception as e:
        st.error(f"Failed to fetch data: {e}")
        st.stop()

    price = data.get("priceData", {})
    fund = data.get("fundamental", {})
    cur = "₹" if exchange in ("NSE", "BSE") else "$"

    # Screener.in overlay for Indian stocks — same merge analysisRoutes.js does.
    # yfinance ratios can be stale/wrong (e.g. DIXON book value); Screener wins when truthy.
    sc = {}
    if exchange in ("NSE", "BSE"):
        try:
            sc = fetch("screenerService.py", [symbol])
        except Exception:
            sc = {}
    for k, v in (sc.get("fundamental") or {}).items():
        if v:
            fund[k] = v
    for k in ("roe", "debtToEquity", "profitMargin", "operatingMargin"):
        if sc.get(k):
            data[k] = sc[k]

    m = st.columns(5)
    m[0].metric("Price", f"{cur}{price.get('current', 0):,.2f}",
                f"{price.get('current', 0) - price.get('previousClose', 0):+.2f}")
    m[1].metric("Market Cap", f"{cur}{price.get('marketCap', 0) / 1e7:,.0f} Cr"
                if exchange in ("NSE", "BSE") else f"${price.get('marketCap', 0) / 1e9:,.1f} B")
    m[2].metric("P/E", f"{fund.get('peRatio', 0):.1f}")
    m[3].metric("P/B", f"{fund.get('pbRatio', 0):.2f}")
    m[4].metric("ROE", f"{data.get('roe', 0):.1f}%")

    hist = data.get("priceHistory", [])
    if hist:
        df = pd.DataFrame(hist)
        # utc=True: US history spans a DST switch, giving mixed offsets that raise in pandas 2.x;
        # drop tz after so IST midnight bars don't label as the previous UTC day
        df["date"] = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
        st.subheader("1-Year Price History")
        st.line_chart(df.set_index("date")["close"])

    left, right = st.columns(2)
    with left:
        st.subheader("Fundamentals")
        st.table(pd.DataFrame({
            "Metric": ["EPS", "Book Value", "Dividend Yield", "Debt/Equity",
                       "Profit Margin", "Operating Margin", "Beta", "52W High", "52W Low"],
            "Value": [f"{fund.get('eps', 0):.2f}", f"{fund.get('bookValue', 0):.2f}",
                      f"{fund.get('dividendYield', 0):.2f}%", f"{data.get('debtToEquity', 0):.2f}",
                      f"{data.get('profitMargin', 0):.1f}%", f"{data.get('operatingMargin', 0):.1f}%",
                      f"{data.get('beta', 1):.2f}", f"{cur}{data.get('fiftyTwoWeekHigh', 0):,.2f}",
                      f"{cur}{data.get('fiftyTwoWeekLow', 0):,.2f}"],
        }))

    with right:
        st.subheader("Shareholding (Screener.in)")
        if exchange in ("NSE", "BSE"):
            pct = (sc.get("shareholding") or {}).get("percentages") or {}
            pct = {k: v for k, v in pct.items() if v}
            if pct:
                st.bar_chart(pd.Series(pct, name="%"))
            else:
                st.info("Shareholding data unavailable (Screener.in scrape failed).")
        else:
            st.info("Shareholding data is only available for Indian stocks.")

    st.caption(f"Source: yfinance ({data.get('symbol', symbol)}) · cached 1h")
