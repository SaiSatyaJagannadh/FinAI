import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import streamlit as st

ROOT = Path(__file__).parent
PY = sys.executable  # run under the same venv streamlit runs in

# Load root .env into os.environ for local dev (Streamlit Cloud uses st.secrets;
# stdlib parse — not worth a python-dotenv dependency for KEY=value lines).
_envf = ROOT / ".env"
if _envf.exists():
    for _line in _envf.read_text().splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            _k, _, _v = _line.partition("=")
            # .upper(): env lookups are case-sensitive and the user's .env mixes
            # cases (tavily_api_key, langsmith_Project) — canonicalize on load
            os.environ.setdefault(_k.strip().upper(), _v.strip().strip('"').strip("'"))

st.set_page_config(page_title="FinAI", page_icon="📈", layout="wide")

# Fresh fintech look: gradient hero + card metrics. Theme-neutral (works light/dark).
st.markdown("""<style>
[data-testid="stMetric"] {
    background: linear-gradient(160deg, rgba(99,102,241,.10), rgba(16,185,129,.06));
    border: 1px solid rgba(128,128,128,.25);
    border-radius: 12px;
    padding: 10px 14px;
}
.stTabs [data-baseweb="tab"] { font-weight: 600; }
.finai-hero {
    padding: 1.1rem 1.4rem; border-radius: 16px; margin-bottom: .8rem;
    background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #8b5cf6 100%);
    color: #fff;
}
.finai-hero h1 { margin: 0; font-size: 1.9rem; color: #fff; }
.finai-hero p { margin: .25rem 0 0; opacity: .92; font-size: .95rem; }
</style>""", unsafe_allow_html=True)

st.markdown(
    '<div class="finai-hero"><h1>📈 FinAI Stock Analysis</h1>'
    '<p>Multi-source AI scoring — yfinance · Screener.in · FinViz · Yahoo analyst targets — '
    'with year-wise price projections, moat check and sector outlook.</p></div>',
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Auth: bcrypt-hashed users in Mongo `users`. Gates the whole analysis UI below.
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner=False)
def _mongo_client(uri):
    """Cached live MongoClient for `uri`. RAISES (never returns) on failure so a
    transient connect error isn't frozen by @st.cache_resource until reboot —
    cache_resource caches return values, not exceptions, so a failed attempt is
    retried on the next run."""
    import pymongo
    # 15s (not 3s): Atlas cold-start from Streamlit Cloud — SRV lookup + TLS
    # handshake on the first connection routinely takes longer than a few seconds.
    kwargs = {"serverSelectionTimeoutMS": 15000}
    if uri.startswith("mongodb+srv") or "tls=true" in uri:
        import certifi  # macOS/py bundles often lack system CAs for Atlas TLS
        kwargs["tlsCAFile"] = certifi.where()
    client = pymongo.MongoClient(uri, **kwargs)
    client.admin.command("ping")  # force a real connection; raises if unreachable
    return client


def _secret(name):
    """Env var first, st.secrets fallback (Streamlit Cloud), else None.
    Tries the lowercase name too — pasted secrets often mirror a mixed-case .env."""
    v = os.environ.get(name)
    if v:
        return v
    try:
        for k in st.secrets:
            if k.lower() == name.lower():
                return st.secrets[k]
    except Exception:
        pass
    return None


def _resolve_uri():
    return _secret("MONGODB_URI")


def _mongo_db():
    """Returns (db, error). `db` is the `financialai` database or None.
    `error` is None on success, "no-uri" when nothing is configured, else the
    connection error text (bad password, Network Access block, timeout, ...) —
    so callers can tell "secret missing" apart from "secret set but rejected"."""
    uri = _resolve_uri()
    if not uri:
        return None, "no-uri"
    try:
        return _mongo_client(uri).get_database("financialai"), None
    except Exception as e:
        _mongo_client.clear()  # drop the failed client so the next run reconnects
        return None, str(e)


def _users_collection():
    """Returns (collection, error) — see _mongo_db for error semantics."""
    db, err = _mongo_db()
    if db is None:
        return None, err
    coll = db["users"]
    if not st.session_state.get("_users_index_ok"):
        try:
            coll.create_index("username", unique=True)
            st.session_state["_users_index_ok"] = True
        except Exception:
            pass  # index may already exist / read-only role — insert still enforces it
    return coll, None


_ID_RE = re.compile(r"^[A-Za-z0-9_.\-]{3,30}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# One valid bcrypt hash of a throwaway value: checkpw against it when a user is
# unknown so login timing doesn't reveal whether a username exists.
import bcrypt as _bcrypt
_DUMMY_HASH = _bcrypt.hashpw(b"unused", _bcrypt.gensalt())


def _valid_identifier(u):
    return bool(_ID_RE.match(u) or _EMAIL_RE.match(u))


def register_user(coll, username, password):
    """Returns None on success, else a user-facing error string."""
    username = (username or "").strip().lower()
    if not _valid_identifier(username):
        return "Username must be 3-30 chars (letters, numbers, _ . -) or a valid email."
    if len(password or "") < 8:
        return "Password must be at least 8 characters."
    pw_hash = _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt())
    try:
        coll.insert_one({
            "username": username,
            "passwordHash": pw_hash,
            "createdAt": datetime.now(timezone.utc),
        })
    except Exception as e:  # DuplicateKeyError (unique index) or connection issue
        if "duplicate" in str(e).lower() or "E11000" in str(e):
            return "That username is already taken."
        return "Could not create account — please try again."
    return None


def verify_user(coll, username, password):
    """True on valid credentials. Always runs bcrypt.checkpw (dummy hash when the
    user is unknown) so unknown-user and wrong-password cost the same time."""
    doc = coll.find_one({"username": (username or "").strip().lower()})
    stored = bytes(doc["passwordHash"]) if doc else _DUMMY_HASH
    ok = _bcrypt.checkpw((password or "").encode("utf-8"), stored)
    return bool(doc and ok)


def _auth_gate():
    if st.session_state.get("user"):
        with st.sidebar:
            st.markdown(f"Signed in as **{st.session_state.user}**")
            if st.button("Log out"):
                del st.session_state["user"]
                st.rerun()
        return
    coll, err = _users_collection()
    if coll is None:
        if err == "no-uri":
            st.error(
                "Login is unavailable: set the **MONGODB_URI** secret in the "
                "Streamlit Cloud app settings (Secrets) to enable accounts."
            )
        else:
            st.error(
                "Couldn't connect to the account database. The **MONGODB_URI** secret "
                "is set, but Atlas rejected the connection — check that the password in "
                "the URI is correct and that Atlas **Network Access** allows `0.0.0.0/0`."
            )
            st.caption(f"Details: {err}")
        st.stop()
    # Center the auth card so it reads like a product sign-in, not a raw form.
    _, mid, _ = st.columns([1, 1.6, 1])
    with mid:
        st.markdown(
            '<div style="text-align:center;margin:.4rem 0 1rem">'
            '<h3 style="margin:0">Welcome to FinAI 👋</h3>'
            '<p style="opacity:.75;margin:.3rem 0 0">Sign in to analyze stocks across '
            'yfinance, Screener.in, FinViz and Yahoo — free.</p></div>',
            unsafe_allow_html=True,
        )
        login_tab, signup_tab = st.tabs(["Log in", "Sign up"])
        with login_tab:
            with st.form("login_form"):
                lu = st.text_input("Username or email")
                lp = st.text_input("Password", type="password")
                if st.form_submit_button("Log in", type="primary"):
                    if verify_user(coll, lu, lp):
                        st.session_state.user = lu.strip().lower()
                        st.rerun()
                    else:
                        st.error("Invalid username or password")  # generic on purpose
        with signup_tab:
            with st.form("signup_form"):
                su = st.text_input("Choose a username or email")
                sp = st.text_input("Choose a password (min 8 characters)", type="password")
                if st.form_submit_button("Create account", type="primary"):
                    err = register_user(coll, su, sp)
                    if err:
                        st.error(err)
                    else:
                        st.success("Account created — switch to the Log in tab to sign in.")
        st.caption("🔒 Passwords are bcrypt-hashed. We never store them in plain text.")
    st.stop()


_auth_gate()


def _help_page():
    st.markdown("## Help & Details")
    st.markdown(
        "**FinAI** scores a stock across five pillars — fundamental, technical, growth, "
        "mutual-fund conviction and risk — and blends them into a single BUY / HOLD / SELL "
        "call, the same engine the full FinAI web app uses."
    )

    st.subheader("How to use it")
    st.markdown(
        "1. Go to the **Analyze** page (sidebar).\n"
        "2. Type a stock **symbol** (e.g. `INFY`, `AAPL`).\n"
        "3. Pick the **exchange** — NSE / BSE for India, US for American stocks.\n"
        "4. Click **Analyze** and read the tabs:\n"
        "   - **Fundamental** — P/E, PEG, P/B, ROE/ROA, margins vs. the sector norm.\n"
        "   - **Technical** — RSI, MACD, moving-average trend, support/resistance.\n"
        "   - **Growth** — YoY/QoQ revenue, profit, EPS, book-value growth + last 8 quarters.\n"
        "   - **MF Conviction** — promoter / FII / DII / mutual-fund shareholding and quarterly changes.\n"
        "   - **Risk** — beta, volatility, leverage, geopolitical & disruption risk.\n"
        "   - **Growth Projection** — year-wise price paths (1Y–10Y) under each growth scenario.\n"
        "   - **Moat & Sector** — economic-moat checklist plus a sector-growth outlook."
    )

    st.subheader("Where the data comes from")
    st.markdown(
        "- **yfinance** — price, valuation ratios, growth, 1-year history, analyst mean target.\n"
        "- **Screener.in** — Indian fundamentals & shareholding (promoter/FII/DII).\n"
        "- **FinViz** — US analyst targets and forward EPS estimates.\n"
        "- **Yahoo analyst targets** — Wall Street 12-month consensus price target."
    )
    st.info(
        "The projections are **mechanical extrapolations** — current price grown at a source's "
        "growth rate assuming a constant P/E. They are not forecasts and **not investment advice.** "
        "Always read the primary filings (linked inside the Moat & Sector tab)."
    )

    st.subheader("Symbol not found?")
    st.markdown(
        "If Analyze can't find a symbol, confirm the exact ticker first:\n"
        "- **US stocks** → [FinViz](https://finviz.com/) or "
        "[Yahoo Finance lookup](https://finance.yahoo.com/lookup/).\n"
        "- **India (NSE/BSE)** → [Google Finance](https://www.google.com/finance/) or "
        "[Screener.in](https://www.screener.in/)."
    )

    st.subheader("Contact / Support")
    st.markdown(
        "Questions, bugs or feedback? Email "
        "[saijagannadh0625@gmail.com](mailto:saijagannadh0625@gmail.com)."
    )


# ---------------------------------------------------------------------------
# Sidebar AI chat — GPT-4o-mini agent with Tavily web search, traced by
# LangSmith (env-var driven, zero code). Degrades to an info note if keys
# are missing, same style as the Mongo gate above.
# ---------------------------------------------------------------------------
for _k in ("OPENAI_API_KEY", "TAVILY_API_KEY", "LANGSMITH_TRACING",
           "LANGSMITH_API_KEY", "LANGSMITH_PROJECT"):
    _v = _secret(_k)
    if _v:
        os.environ[_k] = str(_v)


@st.cache_resource(show_spinner=False)
def _chat_agent():
    from langchain.agents import create_agent
    from langchain_openai import ChatOpenAI
    tools = []
    if os.environ.get("TAVILY_API_KEY"):  # web search is optional
        from langchain_tavily import TavilySearch
        tools.append(TavilySearch(max_results=3))
    return create_agent(ChatOpenAI(model="gpt-4o-mini", temperature=0.3), tools)


def _stock_context():
    last = st.session_state.get("last")
    if not last:
        return "No stock has been analyzed yet in this session."
    data, analysis = last["data"], last["analysis"]
    price = data.get("priceData", {})
    fund = data.get("fundamental", {})
    ctx = {
        "symbol": last["symbol"], "exchange": last["exchange"],
        "name": data.get("name"), "sector": data.get("sector"),
        "currentPrice": price.get("current"), "marketCap": price.get("marketCap"),
        "peRatio": fund.get("peRatio"), "pbRatio": fund.get("pbRatio"),
        "roe": data.get("roe"), "debtToEquity": data.get("debtToEquity"),
        "profitMargin": data.get("profitMargin"),
        "revenueGrowthYoY": (data.get("revenueGrowth") or {}).get("yoy"),
        "epsGrowthYoY": (data.get("epsGrowth") or {}).get("yoy"),
    }
    if analysis:
        o = analysis["overall"]
        ctx["finaiScores"] = {
            "recommendation": o["recommendation"]["action"],
            "overallScore": o["recommendation"]["score"],
            "targetPrice": o["recommendation"]["targetPrice"],
            "stopLoss": o["recommendation"]["stopLoss"],
            "fundamental": o["fundamentalScore"], "technical": o["technicalScore"],
            "mfConviction": o["convictionScore"], "growth": o["growthScore"],
            "risk": o["riskScore"],
        }
    return json.dumps(ctx, default=str)


def _ask_agent(question):
    system = (
        "You are FinAI's assistant inside a stock-analysis app. Answer questions about "
        "the analyzed stock using the context below, and use the web search tool for "
        "live prices, news or anything not in the context. Be concise. You are not a "
        "licensed financial advisor — frame answers as education, never as personalized "
        "investment advice.\n\nCurrent analysis context (JSON):\n" + _stock_context()
    )
    msgs = [("system", system)]
    for m in st.session_state.get("chat", [])[-10:]:
        msgs.append((m["role"], m["content"]))
    msgs.append(("user", question))
    try:
        out = _chat_agent().invoke({"messages": msgs})
        return out["messages"][-1].content
    except Exception as e:
        return f"Sorry, the AI call failed: {e}"


def _sidebar_chat():
    with st.sidebar:
        st.divider()
        st.subheader("💬 Ask FinAI")
        if not os.environ.get("OPENAI_API_KEY"):
            st.info("AI chat unavailable — add the **OPENAI_API_KEY** secret "
                    "in the Streamlit Cloud app settings.")
            return
        if not os.environ.get("TAVILY_API_KEY"):
            st.caption("⚠️ Web search off — add **TAVILY_API_KEY** to enable live news.")
        st.session_state.setdefault("chat", [])
        for m in st.session_state.chat:
            st.chat_message(m["role"]).write(m["content"])
        q = st.chat_input("Ask about the analyzed stock or finance…")
        if q:
            with st.spinner("Thinking…"):
                reply = _ask_agent(q)
            st.session_state.chat += [{"role": "user", "content": q},
                                      {"role": "assistant", "content": reply}]
            st.rerun()  # render the new turn above the input in order


page = st.sidebar.radio("Page", ["Analyze", "Help & Details"])
_sidebar_chat()
if page == "Help & Details":
    _help_page()
    st.stop()

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
    try:
        out = subprocess.run(
            [node, str(ROOT / "server" / "services" / "analysisRunner.js")],
            input=json.dumps({"stockData": stock_data, "screenerShareholding": shareholding, "symbol": sym}),
            capture_output=True, text=True, timeout=60, cwd=ROOT,
        )
        result = json.loads(out.stdout)
        return None if "error" in result else result
    except Exception:
        # any failure (timeout, bad JSON, node crash) degrades to the raw-data view
        return None


def val(x, default=0):
    """Analysis fields are sometimes bare numbers, sometimes {value, score, ...}."""
    if isinstance(x, dict):
        return x.get("value", default)
    return x if x is not None else default


def _projection_cache():
    """MongoDB collection `projectionCache` — one doc per symbol:exchange.
    Written on every analysis; read back as a fallback when live data is down.
    Returns None when no MongoDB is reachable (e.g. Streamlit Cloud without
    a MONGODB_URI secret) — everything still works, just without persistence.
    (The live client is cached in _mongo_client, so this isn't reconnecting.)"""
    db, _ = _mongo_db()
    return db["projectionCache"] if db is not None else None


sys.path.insert(0, str(ROOT / "services"))
try:
    from sector_map import normalize_sector
except Exception:
    def normalize_sector(_):
        return "default"

# ponytail: static sector-outlook table (CAGR ranges from public industry research);
# swap for a live data source if these ever need to be current-quarter fresh.
SECTOR_OUTLOOK = {
    "IT_Services": ("8–10%", "cloud migration, enterprise AI adoption and digital transformation spend",
                    "https://www.gartner.com/en/newsroom/press-releases"),
    "Banking": ("11–13%", "credit growth running ~1.3x nominal GDP, retail lending and digitisation",
                "https://www.ibef.org/industry/banking-india"),
    "Pharma": ("9–11%", "generics exports, CDMO outsourcing shift and domestic formulations",
               "https://www.ibef.org/industry/pharmaceutical-india"),
    "FMCG": ("9–10%", "rising rural incomes, premiumisation and distribution reach",
             "https://www.ibef.org/industry/fmcg"),
    "Auto": ("7–9%", "EV transition, premiumisation and export growth",
             "https://www.ibef.org/industry/india-automobiles"),
    "Energy": ("6–8%", "energy demand growth plus renewables capex cycle",
               "https://www.ibef.org/industry/oil-gas-india"),
    "Telecom": ("7–9%", "ARPU repair, 5G monetisation and data consumption growth",
                "https://www.ibef.org/industry/telecommunications"),
    "Construction": ("9–10%", "government infrastructure capex and housing demand",
                     "https://www.ibef.org/industry/infrastructure-sector-india"),
    "Metals": ("5–7%", "infrastructure demand, though cyclical with global commodity prices",
               "https://www.ibef.org/industry/metals-and-mining"),
    "Chemicals": ("8–9%", "China+1 supply-chain shift and specialty chemicals demand",
                  "https://www.ibef.org/industry/chemical-industry-india"),
    "Industrials": ("8–10%", "private capex revival and manufacturing (PLI) incentives",
                    "https://www.ibef.org/industry/manufacturing-sector-india"),
    "default": ("6–8%", "roughly tracks nominal GDP growth",
                "https://www.imf.org/en/Publications/WEO"),
}


def source_links(sym, exch):
    links = {
        "Yahoo Finance": f"https://finance.yahoo.com/quote/{sym}"
                         + (".NS" if exch == "NSE" else ".BO" if exch == "BSE" else ""),
        "Google Finance": f"https://www.google.com/finance/quote/{sym}:"
                          + {"NSE": "NSE", "BSE": "BOM"}.get(exch, "NASDAQ"),
    }
    if exch in ("NSE", "BSE"):
        links["Screener.in"] = f"https://www.screener.in/company/{sym}/consolidated/"
    else:
        links["FinViz"] = f"https://finviz.com/quote.ashx?t={sym}"
    return links


if st.button("Analyze", type="primary") and symbol:
    try:
        data = fetch("stockDataService.py", [symbol, "--exchange", exchange, "--period", "1y"])
    except Exception as e:
        st.error(f"Couldn't find data for **{symbol}** — {e}")
        st.markdown("**Double-check the symbol on:**")
        if exchange == "US":
            st.markdown(
                f"- [FinViz — {symbol}](https://finviz.com/quote.ashx?t={symbol})\n"
                f"- [Yahoo Finance symbol lookup](https://finance.yahoo.com/lookup/?s={symbol})"
            )
        else:
            gf_exch = "NSE" if exchange == "NSE" else "BOM"
            st.markdown(
                f"- [Google Finance — {symbol}](https://www.google.com/finance/quote/{symbol}:{gf_exch})\n"
                f"- [Screener.in — {symbol}](https://www.screener.in/company/{symbol}/consolidated/)\n"
                f"- [NSE quote lookup](https://www.nseindia.com/get-quotes/equity?symbol={symbol})"
            )
        st.stop()

    # --- Screener.in enrichment: the same merge analysisRoutes.js does (lines ~145-160).
    # Unconditional like the route (Screener 404s on non-Indian symbols -> sc stays {}).
    # yfinance ratios can be stale/wrong; Screener wins when truthy.
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

    # Persist so the analysis view survives reruns (sidebar chat, any widget).
    st.session_state["last"] = {
        "symbol": symbol, "exchange": exchange, "data": data, "sc": sc,
        "shareholding": shareholding,
        "analysis": run_analyses(data, shareholding, symbol),
    }

_last = st.session_state.get("last")
if _last:
    symbol, exchange = _last["symbol"], _last["exchange"]
    data, sc, shareholding = _last["data"], _last["sc"], _last["shareholding"]
    analysis = _last["analysis"]
    price = data.get("priceData", {})
    fund = data.get("fundamental", {})
    cur = "₹" if exchange in ("NSE", "BSE") else "$"

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
        bcur = cur.replace("$", "\\$")  # bare $..$ pairs trigger LaTeX in st.markdown widgets
        banner(
            f"**{rec['action']}** ({rec['confidence']} confidence) · Score **{rec['score']}/100** · "
            f"Target {bcur}{rec['targetPrice']:,.2f} · Stop-loss {bcur}{rec['stopLoss']:,.2f} · "
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
        tab_p, tab_m, tab_f, tab_t, tab_g, tab_mf, tab_r = st.tabs(
            ["📈 Growth Projection", "🏰 Moat & Sector", "Fundamental", "Technical",
             "Growth", "MF Conviction", "Risk"])

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
            ic = f.get("industryComparison") or {}
            if ic:
                pe_c = ic.get("peRatio") or {}
                peg_c = ic.get("pegRatio") or {}
                de_c = ic.get("debtToEquity") or {}
                st.caption(f"How it stacks up vs. the {ic.get('sector', 'sector')} sector:")
                st.table(pd.DataFrame([
                    {"Metric": "P/E", "This stock": f"{pe_c.get('value', 0):.1f}",
                     "Sector norm": "–".join(str(x) for x in pe_c.get("sectorRange", [])),
                     "Verdict": pe_c.get("verdict", "").replace("_", " ").title()},
                    {"Metric": "PEG", "This stock": f"{peg_c.get('value', 0):.2f}",
                     "Sector norm": f"≤ {peg_c.get('sectorTarget', '—')}", "Verdict": ""},
                    {"Metric": "Debt/Equity", "This stock": f"{de_c.get('value', 0):.2f}",
                     "Sector norm": f"≤ {de_c.get('sectorMax', '—')}",
                     "Verdict": de_c.get("verdict", "").replace("_", " ").title()},
                ]))
            sc_f = f.get("scores") or {}
            if sc_f:
                st.caption(
                    f"Sub-scores — Valuation {sc_f.get('valuation', 0)} · "
                    f"Profitability {sc_f.get('profitability', 0)} · "
                    f"Financial health {sc_f.get('financialHealth', 0)} · "
                    f"Growth {sc_f.get('growth', 0)} (each /100)"
                )

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
            q = g.get("quarterly") or {}
            if q.get("sales"):
                n = len(q["sales"])
                qcols = {"Quarter": (q.get("labels") or [""] * n)[-n:], "Sales": q["sales"]}
                for key, label in (("netProfit", "Net profit"), ("opm", "OPM %")):
                    if len(q.get(key) or []) == n:
                        qcols[label] = q[key]
                st.caption("Last 8 quarters (Screener.in):")
                st.table(pd.DataFrame(qcols))
                for w in q.get("warnings") or []:
                    st.warning(w)

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
            if mf.get("totalFundsHolding"):
                st.caption(f"{mf['totalFundsHolding']} of {mf.get('totalFundsAnalyzed', 0)} tracked "
                           f"holders own this stock · avg holding "
                           f"{mf.get('averageHoldingPercentage', 0):.1f}%")

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

        with tab_p:
            price_now = price.get("current", 0)

            # FinViz enrichment for US stocks (best-effort, cached 1h like the other fetches)
            fv = {}
            if exchange == "US":
                try:
                    fv = fetch("finvizService.py", [symbol])
                except Exception:
                    fv = {}

            # Each scenario: (label, growth %/yr, source, why). Price follows the
            # growth driver at a constant P/E — negative growth = declining price path.
            scenarios = []
            eps_g = (g.get("epsGrowth") or {}).get("yoy", 0)
            rev_g = (g.get("revenueGrowth") or {}).get("yoy", 0)
            if eps_g:
                scenarios.append(("Trailing EPS growth", eps_g,
                                  "Screener.in / yfinance (trailing YoY)",
                                  "Earnings keep compounding at last year's pace; "
                                  "price follows EPS if the P/E multiple holds"))
            if rev_g:
                scenarios.append(("Trailing revenue growth", rev_g,
                                  "Screener.in / yfinance (trailing YoY)",
                                  "Sales keep growing at last year's pace with steady margins"))
            yf_target = data.get("targetMeanPrice", 0)
            if yf_target and price_now:
                scenarios.append(("Analyst mean target (Yahoo)",
                                  (yf_target / price_now - 1) * 100, "yfinance targetMeanPrice",
                                  "Wall Street consensus 12-month price target, "
                                  "extended at the same annual pace"))
            if fv.get("analystTarget") and price_now:
                scenarios.append(("Analyst target (FinViz)",
                                  (fv["analystTarget"] / price_now - 1) * 100,
                                  fv.get("source", "FinViz"),
                                  "FinViz consensus 12-month price target, "
                                  "extended at the same annual pace"))
            if fv.get("epsGrowthNextY"):
                scenarios.append(("EPS estimate next year (FinViz)", fv["epsGrowthNextY"],
                                  fv.get("source", "FinViz"),
                                  "Analysts' forward EPS estimate for next fiscal year"))
            if fv.get("epsGrowthNext5Y"):
                scenarios.append(("EPS next-5Y CAGR (FinViz)", fv["epsGrowthNext5Y"],
                                  fv.get("source", "FinViz"),
                                  "Analysts' long-term (5-year) earnings growth estimate"))

            YEARS = (1, 2, 3, 4, 5, 10)
            if scenarios and price_now:
                med = statistics.median(gr for _, gr, _, _ in scenarios)
                all_rows = [("★ Base case (median of scenarios)", med,
                             "Blend of the rows below",
                             "Middle-of-the-road path when the sources disagree")] + scenarios
                rows = [{
                    "Scenario": label,
                    "Growth %/yr": round(gr, 1),
                    **{f"{y}Y price": f"{cur}{price_now * (1 + gr / 100) ** y:,.0f}"
                       for y in YEARS},
                    "Why it grows (or shrinks)": why,
                    "Source": src,
                } for label, gr, src, why in all_rows]
                st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")
                if any(gr < 0 for _, gr, _, _ in all_rows):
                    st.caption("⚠️ Rows with a negative Growth %/yr project a *declining* "
                               "price — the year columns show how far it falls.")

                proj = g.get("projections") or {}
                if (proj.get("eps") or {}).get("current"):
                    pe = proj["eps"]
                    st.caption(
                        f"EPS path: {pe['current']:.2f} now → {pe['projected1Y']:.2f} in 1Y → "
                        f"{pe['projected2Y']:.2f} in 2Y at {pe['cagr']:.1f}% CAGR "
                        f"(price follows EPS if the P/E multiple holds)."
                    )

                with st.expander("How these numbers are estimated"):
                    st.markdown(
                        f"- Projected price = current price x (1 + growth)^years, assuming the "
                        f"P/E multiple stays constant — price tracks earnings.\n"
                        f"- Example: {cur}{price_now:,.0f} doubling in 1 year requires "
                        f"{100:.0f}% growth; check which scenario above gets closest.\n"
                        f"- Required CAGR for any target = (target / current)^(1/years) − 1.\n"
                        f"- Growth drivers come from real filings-based data: Screener.in "
                        f"(Indian annual reports), FinViz (US analyst estimates), and "
                        f"Yahoo Finance analyst mean targets.\n\n"
                        f"*These are mechanical extrapolations, not investment advice.*"
                    )
            else:
                st.info("Not enough growth data to project a price path for this stock.")

            st.subheader("Sources for this stock")
            for name, url in source_links(symbol, exchange).items():
                st.markdown(f"- [{name}]({url})")

            # Persist to MongoDB (projectionCache) — cache + audit trail
            coll = _projection_cache()
            if coll is not None:
                try:
                    coll.update_one(
                        {"_id": f"{symbol}:{exchange}"},
                        {"$set": {
                            "description": "Growth projection cache — written by streamlit_app.py "
                                           "on each analysis; per-scenario year-wise price paths "
                                           "with sources. updatedAt gives freshness (>1h = stale).",
                            "symbol": symbol, "exchange": exchange,
                            "currentPrice": price_now,
                            "years": list(YEARS),
                            "scenarios": [{"label": l, "growthPct": gr, "source": s, "why": w}
                                          for l, gr, s, w in scenarios],
                            "sources": source_links(symbol, exchange),
                            "updatedAt": datetime.now(timezone.utc),
                        }},
                        upsert=True,
                    )
                    st.caption("Projection cached in MongoDB (`financialai.projectionCache`).")
                except Exception:
                    pass

        with tab_m:
            st.subheader("Economic moat check")
            st.caption("A moat = a durable edge that keeps competitors from eroding profits. "
                       "These are the measurable fingerprints a moat leaves in the numbers:")
            roe = data.get("roe") or 0
            roce = data.get("roce") or 0
            pm = data.get("profitMargin") or 0
            de = data.get("debtToEquity") or 0
            promoter = ((shareholding or {}).get("percentages") or {}).get("promoter") or 0
            checks = [
                (roe >= 15, f"Return on equity **{roe:.1f}%** — ≥15% means it earns well "
                            f"above its cost of capital (pricing power / brand)"),
                (pm >= 10, f"Net profit margin **{pm:.1f}%** — ≥10% suggests competitors "
                           f"can't undercut it easily"),
                (de <= 0.5, f"Debt/equity **{de:.2f}** — ≤0.5 means the moat is self-funded, "
                            f"not borrowed"),
            ]
            if roce:
                checks.insert(1, (roce >= 15, f"Return on capital employed **{roce:.1f}%** — "
                                              f"≥15% means reinvested profits compound efficiently"))
            if promoter:
                checks.append((promoter >= 40, f"Promoter holding **{promoter:.1f}%** — ≥40% "
                                               f"means insiders keep skin in the game"))
            passed = sum(ok for ok, _ in checks)
            for ok, text in checks:
                st.markdown(("✅ " if ok else "❌ ") + text)
            verdict = ("**Wide moat** — most quality markers present" if passed >= len(checks) - 1
                       else "**Narrow moat** — some durable advantages, not dominant" if passed >= 2
                       else "**No clear moat** — profits look competitive/cyclical")
            st.info(f"{verdict} ({passed}/{len(checks)} checks passed). Numbers show the moat's "
                    f"*effect*; read the annual report (links below) for its *cause* — brand, "
                    f"network effects, switching costs, cost advantage or regulation.")

            st.subheader("Sector outlook — coming years")
            canon = normalize_sector(data.get("sector"))
            cagr, driver, src_url = SECTOR_OUTLOOK.get(canon, SECTOR_OUTLOOK["default"])
            st.markdown(
                f"**{data.get('sector', 'Unknown sector')}** (benchmarked as *{canon}*): "
                f"expected to grow **~{cagr}/yr** over the next few years, driven by {driver}. "
                f"[Industry research →]({src_url})"
            )

            st.subheader("How analysts actually analyze this stock")
            st.markdown(
                "- **Valuation** — P/E and PEG vs. the sector range (see Fundamental tab), "
                "plus discounted cash flow for a fair-value estimate.\n"
                "- **Quality** — ROE/ROCE and margins, sustained over years, not one good quarter.\n"
                "- **Growth** — revenue/EPS trajectory and management guidance "
                "(Growth & Projection tabs).\n"
                "- **Ownership flows** — promoter/FII/DII/MF stake changes each quarter "
                "(MF Conviction tab); rising institutional stakes = informed conviction.\n"
                "- **Technicals** — RSI, MACD, moving-average trend for entry timing "
                "(Technical tab).\n"
                "- **Risk** — beta, leverage, volatility sizing the downside (Risk tab).\n\n"
                "FinAI's score weights these the same way: fundamental 25% · growth 25% · "
                "technical 20% · MF conviction 15% · risk 15%."
            )

            st.subheader("Primary documents & deeper research")
            if exchange in ("NSE", "BSE"):
                docs = {
                    "Annual reports, concalls & credit ratings (Screener.in)":
                        f"https://www.screener.in/company/{symbol}/consolidated/#documents",
                    "Exchange filings (NSE)":
                        f"https://www.nseindia.com/get-quotes/equity?symbol={symbol}",
                    "Google Finance": f"https://www.google.com/finance/quote/{symbol}:"
                                      + ("NSE" if exchange == "NSE" else "BOM"),
                }
            else:
                docs = {
                    "SEC filings — 10-K annual reports (EDGAR)":
                        f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany"
                        f"&CIK={symbol}&type=10-K&dateb=&owner=include&count=10",
                    "FinViz snapshot & analyst ratings": f"https://finviz.com/quote.ashx?t={symbol}",
                    "Financial statements (stockanalysis.com)":
                        f"https://stockanalysis.com/stocks/{symbol}/financials/",
                }
            for name, url in docs.items():
                st.markdown(f"- [{name}]({url})")
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
