#!/usr/bin/env python3
"""
Stock Data Service - Fetches real stock data using yfinance
Run this as a standalone server: python services/stockDataService.py
"""

import json
import sys
import os
import argparse
from datetime import datetime, timedelta

# Canonical sector keys must match server/services/fundamentalAnalysis.js benchmarks.
from sector_map import normalize_sector

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False
    print("yfinance not installed. Run: pip install yfinance", file=sys.stderr)

# NSE symbol mapping for Indian stocks
NSE_SYMBOL_MAP = {
    'RELIANCE': 'RELIANCE.NS',
    'TCS': 'TCS.NS',
    'INFY': 'INFY.NS',
    'INFOSYS': 'INFY.NS',  # alias: Infosys trades as INFY on NSE
    'HDFCBANK': 'HDFCBANK.NS',
    'ICICIBANK': 'ICICIBANK.NS',
    'HINDUNILVR': 'HINDUNILVR.NS',
    'ITC': 'ITC.NS',
    'SBIN': 'SBIN.NS',
    'BHARTIARTL': 'BHARTIARTL.NS',
    'KOTAKBANK': 'KOTAKBANK.NS',
    'LT': 'LT.NS',
    'ASIANPAINT': 'ASIANPAINT.NS',
    'MARUTI': 'MARUTI.NS',
    'M&M': 'M&M.NS',
    'SUNPHARMA': 'SUNPHARMA.NS',
    'DRREDDY': 'DRREDDY.NS',
    'HCLTECH': 'HCLTECH.NS',
    'WIPRO': 'WIPRO.NS',
    'TECHM': 'TECHM.NS',
    'BAJFINANCE': 'BAJFINANCE.NS',
    'HDFC': 'HDFCBANK.NS',  # HDFC Ltd merged into HDFC Bank (Jul 2023) & delisted; redirect to live successor
    'AXISBANK': 'AXISBANK.NS',
    'TATAMOTORS': 'TATAMOTORS.NS',
    'ADANIPORTS': 'ADANIPORTS.NS',
    'NTPC': 'NTPC.NS',
    'POWERGRID': 'POWERGRID.NS',
    'COALINDIA': 'COALINDIA.NS',
    'TATASTEEL': 'TATASTEEL.NS',
    'ZOMATO': 'ETERNAL.NS',  # Zomato renamed to Eternal on NSE (2025); old ticker dead
    'ETERNAL': 'ETERNAL.NS',
}

def get_yahoo_symbol(symbol, exchange='NSE'):
    """Convert local symbol to Yahoo Finance format"""
    # Remove .NS suffix if already present
    clean_symbol = symbol.replace('.NS', '').replace('.BO', '')

    if exchange.upper() == 'NSE':
        # Check if we have a mapping
        if clean_symbol in NSE_SYMBOL_MAP:
            return NSE_SYMBOL_MAP[clean_symbol]
        # Default: add .NS for NSE stocks
        return f"{clean_symbol}.NS"
    elif exchange.upper() == 'BSE':
        return f"{clean_symbol}.BO"
    else:
        return clean_symbol

def _clean_nan(o):
    """Replace NaN/Inf with 0 recursively — json.dumps emits literal NaN,
    which Node's JSON.parse rejects, killing the whole real-data path."""
    if isinstance(o, float) and (o != o or o in (float('inf'), float('-inf'))):
        return 0
    if isinstance(o, dict):
        return {k: _clean_nan(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean_nan(v) for v in o]
    return o


def fetch_stock_data(symbol, exchange='NSE', period='1y'):
    """
    Fetch real stock data from Yahoo Finance

    Args:
        symbol: Stock symbol (e.g., 'RELIANCE', 'TCS')
        exchange: 'NSE' or 'BSE' (default: 'NSE')
        period: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)

    Returns:
        dict with stock data
    """
    info = {}
    hist = None
    used_symbol = symbol

    if YFINANCE_AVAILABLE:
        # Try the requested exchange first, then BSE — many small caps
        # (e.g. GRAVITY = Gravity (India) Ltd) are BSE-only.
        candidates = [get_yahoo_symbol(symbol, exchange)]
        if exchange.upper() == 'NSE':
            bse = get_yahoo_symbol(symbol, 'BSE')
            if bse not in candidates:
                candidates.append(bse)
        for yahoo_symbol in candidates:
            try:
                ticker = yf.Ticker(yahoo_symbol)
                info = ticker.info or {}
                hist = ticker.history(period=period)
            except Exception as e:
                print(f"DEBUG: yfinance error for {yahoo_symbol}: {e}", file=sys.stderr)
                info, hist = {}, None
                continue
            used_symbol = yahoo_symbol
            print(f"DEBUG: {symbol}->{yahoo_symbol}", file=sys.stderr)
            print(f"  info currentPrice: {info.get('currentPrice')}", file=sys.stderr)
            print(f"  hist rows: {len(hist) if hist is not None else 0}", file=sys.stderr)
            if info.get('currentPrice') or info.get('regularMarketPrice') or (hist is not None and not hist.empty):
                break  # got real data
            info, hist = {}, None  # nothing on this exchange, try next

    # Helper to safely get from historical data
    def get_hist_price(key, idx=-1, default=0):
        try:
            if hist is not None and not hist.empty and len(hist) >= abs(idx):
                return float(hist[key].iloc[idx])
        except:
            pass
        return default

    # Annualized volatility (%) from daily returns; yfinance has no volatility field.
    volatility = 20
    if hist is not None and len(hist) > 20:
        returns = hist['Close'].pct_change().dropna()
        if len(returns) > 1:
            volatility = round(float(returns.std() * (252 ** 0.5) * 100), 2)

    # yfinance reports some foreign-listed financials (e.g. INFY) in USD while
    # marketCap/prices are INR — zero out balance-sheet absolutes on mismatch
    # rather than emit numbers ~88x off.
    cross_currency = (info.get('financialCurrency') or info.get('currency')) != (info.get('currency') or 'INR')

    # Get current price with fallback from historical data
    # Try multiple fields from info dictionary
    current_price = 0
    for price_key in ['currentPrice', 'regularMarketPrice', 'navPrice', 'ask', 'bid']:
        val = info.get(price_key)
        if val and val > 0:
            current_price = val
            break

    # If still 0, try history
    if not current_price:
        h_close = get_hist_price('Close')
        if h_close > 0:
            current_price = h_close
            print(f"DEBUG: {symbol} using hist price: {current_price}", file=sys.stderr)

    prev_close = 0
    for close_key in ['previousClose', 'regularMarketPreviousClose']:
        val = info.get(close_key)
        if val and val > 0:
            prev_close = val
            break

    if not prev_close:
        prev_close = get_hist_price('Close', -2)
        if not prev_close:
            prev_close = current_price * 0.99  # fallback estimate

    # Build response
    result = {
        'symbol': symbol,
        'yahooSymbol': used_symbol,
        'exchange': 'BSE' if used_symbol.endswith('.BO') else exchange,
        # Honest flag: no price = nothing fetched. Node falls back to mock
        # data (dataSources: SIMULATED_DATA) instead of showing all zeros.
        'success': current_price > 0,
        'fetchedAt': datetime.now().isoformat(),

        # Basic info
        'name': info.get('longName') or info.get('shortName') or f"{symbol} Limited",
        'sector': normalize_sector(info.get('sector')),
        'industry': info.get('industry') or 'Unknown',

        # Price data - use historical as fallback
        'priceData': {
            'current': current_price,
            'previousClose': prev_close,
            'open': info.get('open') or info.get('regularMarketOpen') or get_hist_price('Open'),
            'dayHigh': info.get('dayHigh') or info.get('regularMarketDayHigh') or get_hist_price('High'),
            'dayLow': info.get('dayLow') or info.get('regularMarketDayLow') or get_hist_price('Low'),
            'volume': info.get('volume') or info.get('regularMarketVolume') or get_hist_price('Volume', -1, 0),
            'avgVolume': info.get('averageVolume') or info.get('averageVolume10day') or 0,
            'marketCap': info.get('marketCap') or 0,
        },

        # Financial metrics
        'fundamental': {
            'peRatio': info.get('trailingPE') or 0,
            'forwardPE': info.get('forwardPE') or 0,
            'pbRatio': info.get('priceToBook') or 0,
            'dividendYield': info.get('dividendYield') or 0,
            'eps': info.get('trailingEps') or 0,
            'bookValue': info.get('bookValue') or 0,
        },

        # Valuation & profitability
        'roe': info.get('returnOnEquity') * 100 if info.get('returnOnEquity') else 0,
        'roa': info.get('returnOnAssets') * 100 if info.get('returnOnAssets') else 0,
        'profitMargin': info.get('profitMargins') * 100 if info.get('profitMargins') else 0,
        'operatingMargin': info.get('operatingMargins') * 100 if info.get('operatingMargins') else 0,

        # Debt & liquidity
        # yfinance reports debtToEquity as a percentage (e.g. 9.8 == 0.098 ratio)
        'debtToEquity': (info.get('debtToEquity') or 0) / 100,
        'currentRatio': info.get('currentRatio') or 0,
        'quickRatio': info.get('quickRatio') or 0,

        # Growth metrics
        'revenueGrowth': {
            'yoy': (info.get('revenueGrowth') or 0) * 100,
            'qoq': 0  # yfinance doesn't directly provide QoQ
        },
        'profitGrowth': {
            'yoy': (info.get('earningsGrowth') or 0) * 100 if info.get('earningsGrowth') else 0,
        },
        'epsGrowth': {
            'yoy': (info.get('earningsGrowth') or 0) * 100 if info.get('earningsGrowth') else 0,
        },
        'bookValueGrowth': {'yoy': 0},
        'dividendGrowth': {'yoy': 0},

        # Risk metrics
        'beta': info.get('beta') or 1,
        'volatility': volatility,
        'correlationToMarket': 0.7,  # Default assumption

        # Balance sheet (0 when financialCurrency != listing currency)
        'totalDebt': 0 if cross_currency else (info.get('totalDebt') or 0),
        'totalCash': 0 if cross_currency else (info.get('totalCash') or 0),
        'freeCashFlow': 0 if cross_currency else (info.get('freeCashflow') or 0),

        # Other
        'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh') or 0,
        'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow') or 0,
        'fiftyDayAverage': info.get('fiftyDayAverage') or 0,
        'twoHundredDayAverage': info.get('twoHundredDayAverage') or 0,
        'targetMeanPrice': info.get('targetMeanPrice') or 0,
        'recommendationKey': info.get('recommendationKey') or 'none',

        # Price history for technical analysis
        'priceHistory': []
    }

    # Add price history (for technical analysis)
    if hist is not None and not hist.empty:
        result['priceHistory'] = [
            {
                'date': idx.isoformat(),
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': int(row['Volume'])
            }
            for idx, row in hist.iterrows()
        ]

    return _clean_nan(result)


def fetch_multiple_stocks(symbols, exchange='NSE', period='1y'):
    """Fetch data for multiple stocks"""
    results = {}
    for symbol in symbols:
        results[symbol] = fetch_stock_data(symbol, exchange, period)
    return results

# CLI for testing
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Fetch stock data using yfinance')
    parser.add_argument('symbol', help='Stock symbol (e.g., RELIANCE, TCS)')
    parser.add_argument('--exchange', '-e', default='NSE', help='Exchange (NSE/BSE, default: NSE)')
    parser.add_argument('--period', '-p', default='1y', help='Period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON (for parsing)')

    args = parser.parse_args()

    if not YFINANCE_AVAILABLE:
        print(json.dumps({'error': 'yfinance not installed'}))
        sys.exit(1)

    result = fetch_stock_data(args.symbol.upper(), args.exchange.upper(), args.period)

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        if result.get('success'):
            print(f"Stock: {result['symbol']} ({result['yahooSymbol']})")
            print(f"Name: {result['name']}")
            print(f"Sector: {result['sector']}")
            print(f"Current Price: ₹{result['priceData']['current']:.2f}")
            print(f"P/E Ratio: {result['fundamental']['peRatio']:.2f}")
            print(f"Market Cap: ₹{result['priceData']['marketCap'] / 1e7:.2f} Cr" if result['priceData']['marketCap'] else "N/A")
            print(f"Volume: {result['priceData']['volume']:,}")
            print(f"52-Week Range: ₹{result.get('fiftyTwoWeekLow', 0):.2f} - ₹{result.get('fiftyTwoWeekHigh', 0):.2f}")
            print(f"Historical data points: {len(result['priceHistory'])}")
        else:
            print(f"Error fetching {args.symbol}: {result.get('error', 'Unknown error')}")