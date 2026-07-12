# FinAI - Financial Stock Analysis Platform

A full-stack stock analysis application that fetches real stock data and provides AI-powered analysis including fundamental, technical, growth, risk, and mutual fund conviction metrics.

## Project Structure

```
FinAI/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalysisResults.js      # Main results container with tabs
│   │   │   ├── GoogleFinanceOverview.js # Google Finance-style stock overview (NEW)
│   │   │   ├── FundamentalAnalysis.js
│   │   │   ├── TechnicalAnalysis.js
│   │   │   ├── GrowthAnalysis.js
│   │   │   ├── RiskAnalysis.js
│   │   │   ├── MutualFundAnalysis.js
│   │   │   ├── RecommendationCard.js
│   │   │   └── StockSearchForm.js
│   │   └── pages/
│   │       ├── StockSearch.js         # Main search page
│   │       ├── Analysis.js            # Analysis history (placeholder)
│   │       ├── Portfolio.js           # Portfolio (placeholder)
│   │       └── Watchlist.js           # Watchlist (placeholder)
│   └── package.json
├── server/                   # Express.js backend
│   ├── routes/
│   │   ├── analysisRoutes.js         # Stock analysis endpoint
│   │   ├── stockRoutes.js            # Stock info endpoints
│   │   └── portfolioRoutes.js       # Portfolio endpoints
│   ├── services/
│   │   ├── fundamentalAnalysis.js    # P/E, ROE, debt ratios analysis
│   │   ├── technicalAnalysis.js      # RSI, MACD, moving averages
│   │   ├── growthAnalysis.js         # Revenue, profit growth metrics
│   │   ├── riskAnalysis.js           # Beta, volatility, drawdown
│   │   └── mutualFundAnalysis.js    # MF conviction data
│   ├── models/
│   │   ├── Stock.js                  # Stock schema
│   │   ├── Analysis.js               # Analysis results schema
│   │   └── Portfolio.js             # Portfolio schema
│   ├── server.js                     # Express app entry
│   └── .env                          # Environment config
├── services/
│   └── stockDataService.py           # Python yfinance data fetcher
├── .venv/                     # Python virtual environment
├── requirements.txt            # Python dependencies
└── package.json
```

## Tech Stack

- **Frontend**: React, React Router, Axios
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (via Mongoose)
- **Stock Data**: yfinance (Yahoo Finance API) + Python
- **Styling**: Custom CSS (Google Finance-inspired)

## Getting Started

### Prerequisites
```bash
# Node.js and npm
node --version  # v18+

# Python 3.11+ with virtual environment
python3 --version

# MongoDB (local or Atlas)
```

### Installation

```bash
# 1. Install Python dependencies
source .venv/bin/activate
pip install yfinance pandas numpy

# 2. Install Node dependencies
cd server && npm install
cd ../client && npm install
```

### Running the Application

```bash
# Terminal 1: Start MongoDB (if local)
mongod

# Terminal 2: Start server
cd server && npm start
# Server runs on http://localhost:5000

# Terminal 3: Start client (in separate terminal)
cd client && npm start
# Client runs on http://localhost:3000
```

### Environment Variables

Create `server/.env`:
```
MONGODB_URI=mongodb://localhost:27017/financialai
PORT=5000
NODE_ENV=development
# Optionally add API keys for premium data sources
# GEMINI_API_KEY=your_key
# OPENAI_API_KEY=your_key
```

## Architecture

### Stock Data Flow

1. **User searches stock** → React frontend calls `/api/analysis/:symbol`
2. **Node.js calls Python** → `stockDataService.py` using child_process
3. **Python fetches from Yahoo Finance** → yfinance returns real price data
4. **Analysis services process data** → Fundamental, Technical, Growth, Risk, MF
5. **Results saved to MongoDB** → Cached for 1 hour
6. **Response sent to frontend** → Rendered in GoogleFinanceOverview

### Key Files

- **`server/routes/analysisRoutes.js`** - Main analysis orchestration
- **`services/stockDataService.py`** - Real stock data from Yahoo Finance
- **`client/src/components/GoogleFinanceOverview.js`** - Google Finance-style UI

### Analysis Components

| Service | Purpose | Key Metrics |
|----------|---------|-------------|
| FundamentalAnalysis | Valuation & Health | P/E, P/B, ROE, ROA, Debt/Equity, Current Ratio |
| TechnicalAnalysis | Price Trends | RSI, MACD, Moving Averages, Bollinger Bands |
| GrowthAnalysis | Growth Rates | Revenue YoY, Profit YoY, EPS Growth |
| RiskAnalysis | Risk Assessment | Beta, Volatility, Drawdown |
| MutualFundAnalysis | MF Conviction | Top holders, holding changes |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analysis/:symbol` | Analyze a stock (fetches data + all metrics) |
| GET | `/api/stocks/:symbol` | Get stock info from DB |
| POST | `/api/stocks/batch` | Get multiple stocks |
| GET | `/api/analysis/:symbol/history` | Get analysis history |
| GET | `/api/health` | Health check |

### Example Request
```javascript
POST /api/analysis/RELIANCE
Body: { "exchange": "NSE", "forceRefresh": true }
```

### Example Response
```json
{
  "symbol": "RELIANCE",
  "priceData": { "current": 2792.50, "change": 15.20 },
  "analysis": {
    "fundamental": { "peRatio": {...}, "roe": {...} },
    "technical": { "rsi": {...}, "macd": {...} },
    "overall": {
      "weightedScore": 72,
      "recommendation": { "action": "BUY", "confidence": "MEDIUM" }
    },
    "dataSources": ["YAHOO_FINANCE"]
  }
}
```

## NSE Symbol Mapping

The Python service automatically maps NSE symbols to Yahoo Finance format:

```python
NSE_SYMBOL_MAP = {
    'RELIANCE': 'RELIANCE.NS',
    'TCS': 'TCS.NS',
    'INFY': 'INFY.NS',
    # ... etc
}
# Default: symbol.NS for unmapped symbols
```

**Important**: If a stock shows ₹0 or no data, check:
1. yfinance is installed: `.venv/bin/python3 -c "import yfinance"`
2. Symbol is correctly mapped in NSE_SYMBOL_MAP
3. Yahoo Finance returns data for that symbol

## Troubleshooting

### Stock data shows ₹0
```bash
# Test yfinance directly
.venv/bin/python3 -c "
import yfinance as yf
t = yf.Ticker('INFY.NS')
print('Price:', t.info.get('currentPrice') or t.info.get('regularMarketPrice'))
print('Hist:', t.history(period='5d').tail(1))
"

# Test service
.venv/bin/python3 services/stockDataService.py INFY --json
```

### MongoDB connection issues
```bash
# Check MongoDB is running
pgrep -l mongo
# Or use Atlas connection string in .env
```

### Python path issues (Error: getcwd)
```
shell-init: error retrieving current directory: getcwd: cannot access parent directories
```
Run the Node server from the FinAI root directory, not a subdirectory.

## Future Improvements

- [ ] Add TradingView lightweight-charts for real price charts
- [ ] Implement portfolio tracking with P&L calculations
- [ ] Add more stock symbol mappings for BSE/NSE
- [ ] Add historical chart with candlestick data
- [ ] Implement watchlist with alerts
- [ ] Add more data sources (Alpha Vantage, Twelvedata)
- [ ] Real-time price updates via WebSocket