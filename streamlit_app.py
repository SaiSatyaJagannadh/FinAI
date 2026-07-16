import json
import shutil
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


def run_analyses(stock_data, shareholding, sym):
    """Run the five Node scoring services (same code as POST /api/analysis/:symbol)."""
    node = shutil.which("node")
    if not node:
        return None
    out = subprocess.run(
        [node, str(ROOT / "server" / "services" / "analysisRunner.js")],
        input=json.dumps({"stockData": stock_data, "screenerShareholding": shareholding, "symbol": sym}),
        capture_output=True, text=True, timeout=60, cwd=ROOT,
    )
    try:
        result = json.loads(out.stdout)
        return None if "error" in result else result
    except json.JSONDecodeError:
        return None


def val(x, default=0):
    """Analysis fields are sometimes bare numbers, sometimes {value, score, ...}."""
    if isinstance(x, dict):
        return x.get("value", default)
    return x if x is not None else default


if st.button("Analyze", type="primary") and symbol:
    try:
        data = fetch("stockDataService.py", [symbol, "--exchange", exchange, "--period", "1y"])
    except Exception as e:
        st.error(f"Failed to fetch data: {e}")
        st.stop()

    price = data.get("priceData", {})
    cur = "₹" if exchange in ("NSE", "BSE") else "$"

    # --- Screener.in enrichment for Indian stocks: the same merge analysisRoutes.js
    # does (lines ~145-160). yfinance ratios can be stale/wrong; Screener wins when truthy.
    sc = {}
    if exchange in ("NSE", "BSE"):
        try:
            sc = fetch("screenerService.py", [symbol])
        except Exception:
            sc = {}
    fund = data.setdefault("fundamental", {})
    for k in ("peRatio", "pbRatio", "dividendYield", "eps", "bookValue"):
        if (sc.get("fundamental") or {}).get(k):
            fund[k] = sc["fundamental"][k]
    for k in ("roe", "roa", "roce", "profitMargin", "operatingMargin",
              "debtToEquity", "currentRatio", "revenue"):
        if sc.get(k):
            data[k] = sc[k]
    for k in ("revenueGrowth", "profitGrowth", "epsGrowth", "bookValueGrowth",
              "dividendGrowth", "operatingProfitGrowth", "pbtGrowth"):
        g = sc.get(k)
        if g and (g.get("yoy") or g.get("qoq")):
            data[k] = g
    for k in ("quarterly", "efficiency", "name", "sector"):
        if sc.get(k):
            data[k] = sc[k]
    shareholding = sc.get("shareholding")

    analysis = run_analyses(data, shareholding, symbol)

    if data.get("name"):
        st.subheader(f"{data['name']} · {data.get('sector', '')}")

    m = st.columns(5)
    m[0].metric("Price", f"{cur}{price.get('current', 0):,.2f}",
                f"{price.get('current', 0) - price.get('previousClose', 0):+.2f}")
    m[1].metric("Market Cap", f"{cur}{price.get('marketCap', 0) / 1e7:,.0f} Cr"
                if exchange in ("NSE", "BSE") else f"${price.get('marketCap', 0) / 1e9:,.1f} B")
    m[2].metric("P/E", f"{fund.get('peRatio', 0):.1f}")
    m[3].metric("P/B", f"{fund.get('pbRatio', 0):.2f}")
    m[4].metric("ROE", f"{data.get('roe', 0):.1f}%")

    # --- Recommendation banner + per-pillar scores ---
    if analysis:
        rec = analysis["overall"]["recommendation"]
        banner = {"BUY": st.success, "HOLD": st.warning, "SELL": st.error}.get(rec["action"], st.info)
        banner(
            f"**{rec['action']}** ({rec['confidence']} confidence) · Score **{rec['score']}/100** · "
            f"Target {cur}{rec['targetPrice']:,.2f} · Stop-loss {cur}{rec['stopLoss']:,.2f} · "
            f"{rec['investmentHorizon'].replace('-', ' ').title()}"
        )
        o = analysis["overall"]
        s = st.columns(5)
        s[0].metric("Fundamental (25%)", f"{o['fundamentalScore']}/100")
        s[1].metric("Technical (20%)", f"{o['technicalScore']}/100")
        s[2].metric("MF Conviction (15%)", f"{o['convictionScore']}/100")
        s[3].metric("Growth (25%)", f"{o['growthScore']}/100")
        s[4].metric("Risk (15%, higher=safer)", f"{o['riskScore']}/100")
    else:
        st.warning("Scoring engine unavailable (Node.js not found or analysis failed) — showing raw data only.")

    hist = data.get("priceHistory", [])
    if hist:
        df = pd.DataFrame(hist)
        # utc=True: US history spans a DST switch, giving mixed offsets that raise in pandas 2.x;
        # drop tz after so IST midnight bars don't label as the previous UTC day
        df["date"] = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
        st.subheader("1-Year Price History")
        st.line_chart(df.set_index("date")["close"])

    if analysis:
        f, t, g, mf, r = (analysis["fundamental"], analysis["technical"], analysis["growth"],
                          analysis["mutualFund"], analysis["risk"])
        tab_f, tab_t, tab_g, tab_mf, tab_r = st.tabs(
            ["Fundamental", "Technical", "Growth", "MF Conviction", "Risk"])

        with tab_f:
            c = st.columns(4)
            c[0].metric("P/E", f"{(f.get('peRatio') or {}).get('trailing', 0):.1f}")
            c[1].metric("PEG", f"{val(f.get('pegRatio')):.2f}")
            c[2].metric("P/B", f"{val(f.get('priceToBook')):.2f}")
            c[3].metric("Debt/Equity", f"{val(f.get('debtToEquity')):.2f}")
            c = st.columns(4)
            c[0].metric("ROE", f"{val(f.get('roe')):.1f}%")
            c[1].metric("ROA", f"{val(f.get('roa')):.1f}%")
            c[2].metric("Profit Margin", f"{val(f.get('profitMargin')):.1f}%")
            c[3].metric("Current Ratio", f"{val(f.get('currentRatio')):.2f}")
            if f.get("industryComparison"):
                st.caption(f"vs. industry ({data.get('sector', 'benchmark')}):")
                st.json(f["industryComparison"], expanded=False)
            with st.expander("All fundamental details"):
                st.json(f)

        with tab_t:
            ma = t.get("movingAverages", {})
            rsi = t.get("rsi", {})
            macd = t.get("macd", {})
            c = st.columns(4)
            c[0].metric("RSI(14)", f"{val(rsi, 50):.1f}", rsi.get("signal", ""), delta_color="off")
            c[1].metric("MACD hist", f"{macd.get('histogram', 0):.2f}")
            c[2].metric("Trend", ma.get("trend", "NEUTRAL").replace("_", " "))
            c[3].metric("Technical score", f"{t.get('overallScore', 0)}/100")
            c = st.columns(4)
            c[0].metric("SMA 50", f"{cur}{ma.get('sma50', 0):,.2f}")
            c[1].metric("SMA 200", f"{cur}{ma.get('sma200', 0):,.2f}")
            c[2].metric("EMA 20", f"{cur}{ma.get('ema20', 0):,.2f}")
            c[3].metric("EMA 50", f"{cur}{ma.get('ema50', 0):,.2f}")
            sr = t.get("supportResistance", {})
            if sr.get("support") or sr.get("resistance"):
                st.caption(
                    f"Support: {', '.join(f'{cur}{x:,.0f}' for x in sr.get('support', [])[:3])} · "
                    f"Resistance: {', '.join(f'{cur}{x:,.0f}' for x in sr.get('resistance', [])[:3])}"
                )
            with st.expander("All technical details"):
                st.json(t)

        with tab_g:
            rows = []
            for key, label in (("revenueGrowth", "Revenue"), ("profitGrowth", "Profit"),
                               ("epsGrowth", "EPS"), ("bookValueGrowth", "Book Value"),
                               ("dividendGrowth", "Dividend"),
                               ("operatingProfitGrowth", "Operating Profit"), ("pbtGrowth", "PBT")):
                gr = g.get(key) or {}
                rows.append({"Metric": label, "YoY %": gr.get("yoy", 0), "QoQ %": gr.get("qoq", 0),
                             "Trend": gr.get("trend", "—")})
            st.table(pd.DataFrame(rows))
            if g.get("projections"):
                with st.expander("Growth projections"):
                    st.json(g["projections"])
            if g.get("quarterly"):
                with st.expander("Quarterly trend"):
                    st.json(g["quarterly"])

        with tab_mf:
            c = st.columns(3)
            c[0].metric("Conviction score", f"{mf.get('score', 0)}/100")
            c[1].metric("Sentiment", mf.get("sentiment", "NEUTRAL"))
            c[2].metric("Holding percentile", f"{mf.get('holdingPercentile', 0)}")
            holders = mf.get("topHolders") or []
            if holders:
                st.table(pd.DataFrame([{
                    "Holder": h.get("fundName"),
                    "Holding %": h.get("holdingPercentage", 0),
                    "QoQ change": h.get("changeLastQuarter", 0),
                } for h in holders]))
            pct = (shareholding or {}).get("percentages") or {}
            pct = {k: v for k, v in pct.items() if v}
            if pct:
                st.bar_chart(pd.Series(pct, name="%"))
            with st.expander("All conviction details"):
                st.json(mf)

        with tab_r:
            mr = r.get("marketRisk", {})
            cr = r.get("creditRisk", {})
            c = st.columns(4)
            c[0].metric("Risk category", r.get("riskCategory", "MODERATE"))
            c[1].metric("Beta", f"{mr.get('beta', 1):.2f}")
            c[2].metric("Volatility", f"{mr.get('volatility', 0):.1f}%")
            c[3].metric("Risk score (higher=safer)", f"{r.get('overallScore', 0)}/100")
            c = st.columns(4)
            c[0].metric("Debt/Equity", f"{cr.get('debtToEquity', 0):.2f}")
            c[1].metric("Current Ratio", f"{cr.get('currentRatio', 0):.2f}")
            c[2].metric("Geopolitical", f"{(r.get('geopoliticalRisk') or {}).get('score', 0)}")
            c[3].metric("Disruption", f"{(r.get('disruptionRisk') or {}).get('score', 0)}")
            with st.expander("All risk details"):
                st.json(r)
    else:
        # Raw-data fallback (no Node) — the pre-parity view
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
            pct = (shareholding or {}).get("percentages") or {}
            pct = {k: v for k, v in pct.items() if v}
            if pct:
                st.bar_chart(pd.Series(pct, name="%"))
            else:
                st.info("Shareholding data unavailable.")

    src = "yfinance" + (" + Screener.in" if sc.get("success") else "")
    st.caption(f"Source: {src} ({data.get('symbol', symbol)}) · same scoring engine as the full FinAI app · cached 1h")
