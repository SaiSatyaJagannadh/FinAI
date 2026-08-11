"""AppTest smoke/regression checks for the revamped streamlit_app.py.

Run: .venv/bin/python3 tests/test_streamlit_app.py
Live network (yfinance / Screener / FinViz) — a Yahoo 429 is an env flake, not a bug.
"""
import re
import sys
from pathlib import Path

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parent.parent
APP = str(ROOT / "streamlit_app.py")

EXPECTED_TABS = ["📈 Growth Projection", "🏰 Moat & Sector", "Fundamental",
                 "Technical", "Growth", "MF Conviction", "Risk"]
# Guest mode renders a sidebar "Log in / Sign up" expander whose tabs land in the
# same at.tabs list — filter them out before asserting on the analysis tabs.
SIDEBAR_TABS = {"Log in", "Sign up"}
YEAR_COLS = [f"{y}Y" for y in (1, 2, 3, 5, 10)]

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL") + f"  {name}" + (f"  -- {detail}" if detail else ""))


def price_to_float(s):
    return float(re.sub(r"[^\d.\-]", "", str(s)))


def pct_to_float(s):
    """'Growth/yr' renders as a formatted string like '+12.3%'."""
    return float(re.sub(r"[^\d.\-]", "", str(s)))


def run_app(sym, exch):
    at = AppTest.from_file(APP, default_timeout=300)
    at.run()
    at.text_input[0].set_value(sym)
    at.selectbox[0].set_value(exch)
    at.button[0].click().run()
    return at


def is_flake(at):
    """Yahoo 429 on the happy path = environment flake, not a code bug."""
    txt = " ".join(e.value for e in at.error)
    return any(t in txt for t in ("429", "Too Many Requests", "Rate limit"))


def check_happy_path(sym, exch):
    at = run_app(sym, exch)
    tag = f"{sym}/{exch}"

    if at.exception:
        record(f"{tag}: no exception", False, repr(at.exception[0].value))
        return
    record(f"{tag}: no exception", True)

    if at.error and is_flake(at):
        record(f"{tag}: SKIPPED (Yahoo 429 flake)", True, at.error[0].value[:200])
        return
    if at.error:
        record(f"{tag}: unexpected st.error", False, at.error[0].value[:300])
        return

    # Item 1: no raw st.json dumps anywhere
    record(f"{tag}: no st.json elements", len(at.json) == 0,
           f"{len(at.json)} json elements found")

    # Scoring engine ran (tabs only render when analysis succeeds)
    warn = " ".join(w.value for w in at.warning)
    if "Scoring engine unavailable" in warn:
        record(f"{tag}: scoring engine ran", False, "degraded to raw-data view")
        return

    # Tab order/labels — Growth Projection first, Moat & Sector new
    labels = [t.label for t in at.tabs if t.label not in SIDEBAR_TABS]
    record(f"{tag}: tabs == expected (projection first, moat present)",
           labels == EXPECTED_TABS, f"got {labels}")

    # Item 2: projection dataframe shape
    if not at.dataframe:
        record(f"{tag}: projection dataframe exists", False, "no st.dataframe rendered")
    else:
        df = at.dataframe[0].value
        cols = list(df.columns)
        missing = [c for c in YEAR_COLS + ["Scenario", "Growth/yr", "Source"]
                   if c not in cols]
        record(f"{tag}: projection has 1Y-10Y/growth/source columns", not missing,
               f"missing {missing}; got {cols}")
        # The per-scenario "why" moved out of the table into an expander below it.
        md_all = "\n".join(m.value for m in at.markdown)
        record(f"{tag}: scenario rationale rendered", "Each scenario, year by year" in md_all)
        # Headline cards summarise the median scenario at 1/3/5/10Y.
        record(f"{tag}: median-growth headline cards", "If growth averages" in md_all)
        # price path direction must match growth sign for every row
        bad = []
        for _, row in df.iterrows():
            p1, p10 = price_to_float(row["1Y"]), price_to_float(row["10Y"])
            g = pct_to_float(row["Growth/yr"])
            if g > 0 and not p10 > p1:
                bad.append((row["Scenario"], g, p1, p10))
            if g < 0 and not p10 < p1:
                bad.append((row["Scenario"], g, p1, p10))
        record(f"{tag}: price paths follow growth sign (neg growth declines)",
               not bad, f"violations: {bad}")
        neg = [r for _, r in df.iterrows() if pct_to_float(r["Growth/yr"]) < 0]
        if neg:
            record(f"{tag}: negative-growth rows present and declining", True,
                   f"{len(neg)} declining scenario(s)")

    # Item 3: moat checklist + sector outlook + analyst section + doc links
    md = "\n".join(m.value for m in at.markdown)
    n_checks = len(re.findall(r"^(✅|❌) ", md, re.M))
    record(f"{tag}: moat checklist has >=3 pass/fail lines", n_checks >= 3,
           f"found {n_checks}")
    record(f"{tag}: moat verdict shown",
           bool(at.info) and any("moat" in i.value.lower() for i in at.info))
    record(f"{tag}: sector outlook rendered", "expected to grow" in md)
    subheads = [s.value for s in at.subheader]
    record(f"{tag}: 'how analysts analyze' section",
           any("How analysts actually analyze" in s for s in subheads), f"{subheads}")
    if exch in ("NSE", "BSE"):
        want = ["screener.in/company", "nseindia.com/get-quotes"]
    else:
        want = ["sec.gov", "finviz.com/quote", "stockanalysis.com"]
    missing = [w for w in want if w not in md]
    record(f"{tag}: primary-document links", not missing, f"missing {missing}")


def check_unknown_symbol(sym, exch):
    at = run_app(sym, exch)
    tag = f"{sym}/{exch} (unknown)"
    if at.exception:
        record(f"{tag}: no exception", False, repr(at.exception[0].value))
        return
    record(f"{tag}: no exception", True)
    record(f"{tag}: st.error shown", len(at.error) > 0)
    md = "\n".join(m.value for m in at.markdown)
    if exch == "US":
        want = ["finviz.com/quote", "finance.yahoo.com/lookup"]
    else:
        want = ["google.com/finance/quote", "screener.in/company",
                "nseindia.com/get-quotes"]
    missing = [w for w in want if w not in md]
    record(f"{tag}: redirect links", not missing, f"missing {missing}")
    # st.stop() means no analysis tabs / metrics render after the error
    # (the sidebar login expander's own tabs are not part of the analysis UI)
    analysis_tabs = [t.label for t in at.tabs if t.label not in SIDEBAR_TABS]
    record(f"{tag}: stopped before analysis UI",
           len(analysis_tabs) == 0 and len(at.metric) == 0,
           f"tabs={analysis_tabs} metrics={len(at.metric)}")


if __name__ == "__main__":
    check_happy_path("INFY", "NSE")
    check_happy_path("AAPL", "US")
    check_unknown_symbol("ZZZZQQ", "NSE")
    check_unknown_symbol("ZZZZQQ", "US")

    fails = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(fails)}/{len(results)} passed")
    sys.exit(1 if fails else 0)
