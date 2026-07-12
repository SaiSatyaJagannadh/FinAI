#!/usr/bin/env python3
import sys
sys.path.insert(0, '/Users/saijagannadh/Desktop/AI_Agents/FinAI/.venv/lib/python3.12/site-packages')

try:
    import yfinance as yf
    print("yfinance version:", yf.__version__)

    t = yf.Ticker('INFY.NS')
    info = t.info

    print("INFO KEYS:", list(info.keys())[:20])

    print("currentPrice:", info.get('currentPrice'))
    print("regularMarketPrice:", info.get('regularMarketPrice'))
    print("trailingPegRatio:", info.get('trailingPegRatio'))

    h = t.history(period='5d')
    print("HISTORY LENGTH:", len(h))

    if not h.empty:
        print("Last close:", h['Close'].iloc[-1])
        print("Last row:")
        print(h.tail(1))

except Exception as e:
    print("ERROR:", e)
    import traceback
    traceback.print_exc()