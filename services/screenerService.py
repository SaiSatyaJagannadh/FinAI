#!/usr/bin/env python3
"""
Screener.in fundamentals + shareholding scraper.

Mirrors the CLI pattern of stockDataService.py so the Node server can shell
out to it the same way:

    python services/screenerService.py RELIANCE --json

What it returns (JSON) — keys are intentionally aligned to the yfinance
stockData shape so the Node side can merge (Object.assign) this *over* the
yfinance result:

    {
      "success": true,
      "source": "SCREENER_IN",
      "name": "Reliance Industries Ltd.",
      "sector": "Energy",
      "fundamental": { "peRatio", "pbRatio", "dividendYield", "eps", "bookValue" },
      "roe", "roa", "profitMargin", "operatingMargin",
      "debtToEquity", "currentRatio",
      "revenueGrowth": {"yoy","qoq"},
      "profitGrowth":  {"yoy","qoq"},
      "epsGrowth":     {"yoy"},
      "bookValueGrowth": {"yoy"},
      "dividendGrowth":  {"yoy"},
      "shareholding": {
        "percentages": {"promoter","fii","dii","mf","others"},
        "qoqChanges":  {"promoter","fii","dii","mf","others"}
      }
    }

On any failure (network, CAPTCHA, login wall, markup change) it returns
{"success": false} and the Node caller falls back to yfinance `info.*`.

NOTES
-----
* Screener.in is a third-party site. Scraping is read-only, best-effort, and
  brittle by nature — a single fetch per analysis, with a realistic browser
  User-Agent. If the site changes markup or blocks, every metric degrades to
  `None`/0 and `success` becomes false; the analysis pipeline keeps working
  on yfinance data.
* This is the standalone (non-consolidated) company page. Good enough for
  YoY ratios and the MF/FII/DII shareholding trend.
"""

import json
import re
import sys
import argparse

try:
    import requests
    from bs4 import BeautifulSoup
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# services/ is on sys.path when this script is run (the dir of the script),
# and also when imported. Import the canonical sector normalizer.
try:
    from sector_map import normalize_sector
except Exception:
    # Fall back to identity if the helper isn't importable for some reason.
    def normalize_sector(text):
        return "default"


BASE_URL = "https://www.screener.in/company/{sym}/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.screener.in/",
}


def _parse_num(s):
    """Parse a Screener numeric cell into a float, tolerant of Indian
    grouping (1,23,456), ₹, %, '—', and parenthesised negatives."""
    if s is None:
        return None
    t = str(s).strip()
    if not t or t in ("-", "—", "–", "N.A.", "NA", "N/A"):
        return None
    neg = False
    if t.startswith("(") and t.endswith(")"):
        neg = True
        t = t[1:-1]
    # Strip currency / grouping / percent and any stray text; keep one dot.
    t = t.replace(",", "").replace("₹", "").replace("%", "").strip()
    m = re.search(r"-?\d+(?:\.\d+)?", t)
    if not m:
        return None
    try:
        v = float(m.group())
    except ValueError:
        return None
    return -v if neg else v


def _section_table(soup, section_id):
    """Return the first data <table> inside `<section id="...">`."""
    sec = soup.find("section", id=section_id)
    return sec.find("table") if sec else None


def _table_rows(tbl):
    """Return list of (label, [values]) for a Screener data-table whose first
    column is the metric name and whose remaining columns are time series."""
    if tbl is None:
        return []
    out = []
    for tr in tbl.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        label = cells[0].get_text(" ", strip=True)
        vals = [_parse_num(c.get_text(" ", strip=True)) for c in cells[1:]]
        out.append((label, vals))
    return out


def _yoy_last_two(values):
    """YoY % change between the last and second-to-last numeric values.
    Missing/zero handled → returns 0."""
    nums = [v for v in values if v is not None]
    if len(nums) < 2 or nums[-2] in (0, None):
        return 0.0
    return round((nums[-1] - nums[-2]) / abs(nums[-2]) * 100.0, 2)


def _row_label_contains(rows, needle):
    """Return the value list for the first row whose label contains *needle*."""
    needle = needle.lower()
    for label, vals in rows:
        if needle in label.lower():
            return vals
    return None


def fetch_company(symbol):
    """Fetch + parse one Screener.in company page. Returns the dict above."""
    if not REQUESTS_AVAILABLE:
        return {"success": False, "error": "requests/beautifulsoup4 not installed"}
    sym = (symbol or "").strip().upper()

    try:
        resp = requests.get(BASE_URL.format(sym=sym), headers=HEADERS, timeout=12)
    except Exception as e:
        return {"success": False, "error": f"network: {e}"}

    if resp.status_code != 200:
        return {"success": False, "error": f"http {resp.status_code}", "symbol": sym}
    html = resp.text or ""
    # Detect login/CAPTCHA walls
    if "/login/" in resp.url or "Please verify you are a human" in html or "aptcha" in html:
        return {"success": False, "error": "blocked_or_login", "symbol": sym}

    soup = BeautifulSoup(html, "lxml")

    # --- Name ---
    name = None
    h1 = soup.find("h1")
    if h1:
        name = h1.get_text(strip=True)

    # --- Top scalar metrics (`#top-ratios` list of .name/.value pairs) ---
    top = {}
    top_ul = soup.find(id="top-ratios")
    if top_ul:
        for li in top_ul.find_all("li"):
            label = li.find(class_="name")
            value = li.find(class_="value") or li.find(class_="number")
            if label and value:
                top[label.get_text(" ", strip=True)] = _parse_num(value.get_text(" ", strip=True))
    pe = top.get("Stock P/E")
    book_value = top.get("Book Value")
    div_yield = top.get("Dividend Yield")
    roe = top.get("ROE")
    current_price = top.get("Current Price")
    pb = (current_price / book_value) if current_price and book_value else None

    # --- Annual P&L table (Sales / Net Profit / EPS series) ---
    fin_rows = _table_rows(_section_table(soup, "profit-loss"))
    sales = _row_label_contains(fin_rows, "sales")
    profit = _row_label_contains(fin_rows, "net profit")
    eps = _row_label_contains(fin_rows, "eps")
    opm_series = _row_label_contains(fin_rows, "opm")

    revenue_yoy = _yoy_last_two(sales) if sales else 0.0
    profit_yoy = _yoy_last_two(profit) if profit else 0.0
    eps_yoy = _yoy_last_two(eps) if eps else 0.0
    opm = opm_series[-1] if opm_series else None
    net_margin = None
    if sales and profit and sales[-1]:
        net_margin = round(profit[-1] / sales[-1] * 100.0, 2)

    # --- Debt/Equity from the balance sheet (Borrowings / (Equity+Reserves)) ---
    bs_rows = _table_rows(_section_table(soup, "balance-sheet"))
    borrowings = _row_label_contains(bs_rows, "borrowings")
    equity_cap = _row_label_contains(bs_rows, "equity capital")
    reserves = _row_label_contains(bs_rows, "reserves")
    debt_to_equity = None
    if borrowings and equity_cap and reserves:
        eq = (equity_cap[-1] or 0) + (reserves[-1] or 0)
        if eq > 0:
            debt_to_equity = round((borrowings[-1] or 0) / eq, 3)

    # Not published on the Screener company page; 0 keeps yfinance's values
    # (the Node merge only overwrites truthy fields).
    roa = None
    current_ratio = None

    # --- Shareholding pattern table (quarterly) ---
    sh_rows = _table_rows(_section_table(soup, "shareholding"))
    shareholding = _build_shareholding(sh_rows)

    result = {
        "success": True,
        "source": "SCREENER_IN",
        "name": name,
        "sector": None,  # Screener sector optional; Node merge keeps yfinance's if None
        "fundamental": {
            "peRatio": _nz(pe),
            "pbRatio": round(pb, 2) if pb else 0,
            # Percent form (5.15 == 5.15%), matching yfinance's dividendYield
            "dividendYield": _nz(div_yield),
            "eps": _nz(eps[-1]) if eps else 0,
            "bookValue": _nz(book_value),
        },
        "roe": _nz(roe),
        "roa": _nz(roa),
        "operatingMargin": _nz(opm),
        "profitMargin": _nz(net_margin),
        "debtToEquity": _nz(debt_to_equity),
        "currentRatio": _nz(current_ratio),
        "revenueGrowth": {"yoy": revenue_yoy, "qoq": 0},
        "profitGrowth": {"yoy": profit_yoy, "qoq": 0},
        "epsGrowth": {"yoy": eps_yoy},
        "bookValueGrowth": {"yoy": 0},
        "dividendGrowth": {"yoy": 0},
        "shareholding": shareholding,
    }
    return result


def _nz(v):
    return v if v is not None else 0


def _build_shareholding(sh_rows):
    """From the quarterly shareholding table, extract latest quarter percentages
    and QoQ deltas for promoter / FII / DII / MF / others."""
    # Row labels on the page look like "Promoters +", "FIIs +", "DIIs +",
    # "Public +". Mutual funds have no separate row (they sit inside DIIs).
    cats = {
        "promoter": ["promoter"],
        "fii": ["fii", "foreign institutions"],
        "dii": ["dii", "domestic institutions"],
        "mf": ["mutual funds", "mutual fund"],
        "others": ["public", "others", "other"],
    }
    percentages = {}
    qoq = {}
    for key, labels in cats.items():
        for label in labels:
            vals = _row_label_contains(sh_rows, label)
            if vals:
                nums = [v for v in vals if v is not None]
                if nums:
                    percentages[key] = nums[-1]
                    if len(nums) >= 2:
                        qoq[key] = round(nums[-1] - nums[-2], 3)
                    else:
                        qoq[key] = 0
                else:
                    percentages[key] = 0
                    qoq[key] = 0
                break
        else:
            percentages.setdefault(key, 0)
            qoq.setdefault(key, 0)
    # Normalise percentages to 0-100 (Screener reports them as 0-100 already).
    return {"percentages": percentages, "qoqChanges": qoq}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Screener.in fundamentals")
    parser.add_argument("symbol", help="NSE symbol (e.g. RELIANCE)")
    parser.add_argument("--json", "-j", action="store_true", help="Output JSON")
    args = parser.parse_args()

    if not REQUESTS_AVAILABLE:
        print(json.dumps({"success": False, "error": "requests/beautifulsoup4 not installed. pip install requests beautifulsoup4 lxml"}))
        sys.exit(1)

    result = fetch_company(args.symbol.upper())
    print(json.dumps(result, indent=2, default=str))
