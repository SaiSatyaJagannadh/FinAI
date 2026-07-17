#!/usr/bin/env python3
"""
FinViz scraper — US-stock analog of screenerService.py.
Pulls the snapshot table from finviz.com/quote.ashx?t=SYM (best-effort:
returns {"success": false} on any failure, callers fall back to yfinance).

Usage: python3 services/finvizService.py AAPL --json
"""
import argparse
import json
import sys

import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

# snapshot-table label -> our key (numbers parsed, % stripped)
FIELDS = {
    "Target Price": "analystTarget",
    "P/E": "peRatio",
    "Forward P/E": "forwardPE",
    "PEG": "pegRatio",
    "P/B": "pbRatio",
    "EPS (ttm)": "eps",
    "EPS this Y": "epsGrowthThisY",   # % growth estimates
    "EPS next Y": "epsGrowthNextY",
    "EPS next 5Y": "epsGrowthNext5Y",
    "Sales past 5Y": "salesGrowthPast5Y",
    "ROE": "roe",
    "Profit Margin": "profitMargin",
    "Debt/Eq": "debtToEquity",
    "Beta": "beta",
    "Recom": "analystRecom",  # 1=strong buy .. 5=sell
}


def _num(text):
    t = text.strip().replace("%", "").replace(",", "")
    if t in ("-", ""):
        return 0
    try:
        return float(t)
    except ValueError:
        return 0


def fetch_finviz(symbol):
    url = f"https://finviz.com/quote.ashx?t={symbol.upper()}&p=d"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
        # FinViz splits the snapshot across several snapshot-table2 tables — merge them all
        tables = soup.find_all("table", class_="snapshot-table2")
        if not tables:
            return {"success": False, "error": "snapshot table not found (layout change or unknown ticker)"}

        raw = {}
        for table in tables:
            cells = [td.get_text(strip=True) for td in table.find_all("td")]
            raw.update(zip(cells[::2], cells[1::2]))  # label,value,label,value...
        data = {out: _num(raw[label]) for label, out in FIELDS.items() if label in raw}
        if not data:
            return {"success": False, "error": "no known fields parsed"}
        data["success"] = True
        data["source"] = url
        return data
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("symbol")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()
    result = fetch_finviz(args.symbol)
    print(json.dumps(result) if args.json else result)
    sys.exit(0 if result.get("success") else 1)
