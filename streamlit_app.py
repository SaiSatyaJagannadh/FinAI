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
    # one retry: Yahoo intermittently 429s cloud IPs
    for attempt in (1, 2):
        out = subprocess.run(
            [PY, str(ROOT / "services" / script), *args, "--json"],
            capture_output=True, text=True, timeout=120, cwd=ROOT,
        )
        try:
            return json.loads(out.stdout)
        except json.JSONDecodeError:
            if attempt == 2:
                raise RuntimeError(out.stderr.strip()[-300:] or "empty response from data service")
            time.sleep(2)


if st.button("Analyze", type="primary") and symbol:
    try:
        data = fetch("stockDataService.py", [symbol, "--exchange", exchange, "--period", "1y"])
    except Exception as e:
        st.error(f"Failed to fetch data: {e}")
        st.stop()

    if not data.get("success", True):
        st.error(data.get("error", "No data returned for this symbol."))
        st.stop()

    price = data.get("priceData", {})
    fund = data.get("fundamental", {})
    cur = "₹" if exchange in ("NSE", "BSE") else "$"

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
        # utc=True: US history spans a DST switch, giving mixed offsets that raise in pandas 2.x
        df["date"] = pd.to_datetime(df["date"], utc=True)
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
            try:
                sc = fetch("screenerService.py", [symbol])
                pct = (sc.get("shareholding") or {}).get("percentages", {}) if sc.get("success") else {}
                pct = {k: v for k, v in pct.items() if v}
                if pct:
                    st.bar_chart(pd.Series(pct, name="%"))
                else:
                    st.info("No shareholding data available.")
            except Exception:
                st.info("Screener.in scrape unavailable.")
        else:
            st.info("Shareholding data is only available for Indian stocks.")

    st.caption(f"Source: yfinance ({data.get('symbol', symbol)}) · cached 1h")
