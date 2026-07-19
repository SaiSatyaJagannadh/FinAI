# Financial AI Agents

A comprehensive stock analysis platform that combines fundamental analysis, technical analysis, mutual fund conviction analysis, growth projections, and risk assessment to provide data-driven investment recommendations.

## Features

### Core Analysis Modules
- **Fundamental Analysis**: P/E ratios, PEG ratio, profitability metrics, financial health indicators
- **Technical Analysis**: Moving averages, RSI, MACD, Bollinger Bands, volume analysis
- **Mutual Fund Conviction**: Tracks institutional ownership and portfolio movements
- **Growth Analysis**: Revenue, profit, EPS growth trends and projections
- **Risk Assessment**: Market, credit, liquidity, operational, sector, geopolitical, and disruption risks

### User Interface
- Clean, responsive design
- Interactive dashboard with visualizations
- Stock search and analysis
- Portfolio management (planned)
- Watchlist functionality (planned)
- Historical analysis tracking (planned)

## Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** for data storage
- **RESTful API** architecture
- **AI Services**: Modular analysis engines for each component

### Frontend
- **React** with Hooks
- **React Router** for navigation
- **CSS3** for styling
- **Axios** for HTTP requests

### Data Sources
- Money Control (Indian market data)
- Trendlyne (mutual fund portfolio data)
- NSE/BSE (stock exchange data)
- Company filings and financial statements
- News and social media sentiment

## Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/financial-ai-agents.git
cd financial-ai-agents
```

2. Install backend dependencies
```bash
cd server
npm install
```

3. Install frontend dependencies
```bash
cd ../client
npm install
```

4. Set up environment variables
Create a `.env` file in the root directory based on the `.env.example` template

5. Start the development servers
```bash
# In root directory
npm run dev
```

This will start both the backend (port 5000) and frontend (port 3000) servers.

## Deployment (Render)

The app deploys as a single Docker service (Node + Python, Express serves the React build).

1. Push this repo to GitHub.
2. In [MongoDB Atlas](https://cloud.mongodb.com) → Network Access → add `0.0.0.0/0` (allow from anywhere) so Render can connect.
3. On [Render](https://render.com): **New → Blueprint**, pick this repo — it reads `render.yaml`.
4. When prompted, set the `MONGODB_URI` environment variable (same value as in `server/.env`).
5. Deploy. The app is live at `https://<service-name>.onrender.com`.

Test locally with Docker:
```bash
docker build -t finai .
docker run -p 5000:5000 -e MONGODB_URI="<your atlas uri>" finai
# open http://localhost:5000
```

Note: the free tier sleeps after 15 min idle; first request after sleep takes ~1 min.

## API Endpoints

### Stock Analysis
- `POST /api/analysis/:symbol` - Perform comprehensive stock analysis
- `GET /api/analysis/:symbol/history` - Get analysis history for a stock

### Stock Information
- `GET /api/stocks/:symbol` - Get stock information
- `GET /api/stocks?search=:query` - Search for stocks
- `POST /api/stocks/batch` - Get multiple stocks by symbols

### Portfolio Management
- `GET /api/portfolios` - Get user portfolios
- `GET /api/portfolios/:id` - Get specific portfolio
- `POST /api/portfolios` - Create new portfolio
- `POST /api/portfolios/:id/stocks` - Add stock to portfolio
- `DELETE /api/portfolios/:id/stocks/:stockId` - Remove stock from portfolio
- `PUT /api/portfolios/:id/allocate` - Update portfolio allocation

## Project Structure

```
financial-ai-agents/
├── client/                  # React frontend
│   ├── public/
│   └── src/
│       ├── components/      # Reusable components
│       ├── pages/           # Page components
│       ├── services/        # API service calls
│       └── App.js
├── server/                  # Server
│   ├── models/        # Database models
│   ├── routes/              # API routes
│   ├── services/            # Business logic (AI analysis engines)
│   ├── server.js            # Entry point
│   └── .env                 # Environment variables
└── package.json             # Root package.json
```

## Analysis Methodology

### Fundamental Analysis
- **Valuation**: P/E (trailing & forward), PEG, P/B ratios
- **Profitability**: ROE, ROA, profit margins
- **Financial Health**: Debt-to-equity, current ratio
- **Growth**: Revenue, profit, EPS growth trends

### Technical Analysis
- **Trend Indicators**: Moving averages (SMA/EMA)
- **Momentum Oscillators**: RSI, MACD
- **Volatility**: Bollinger Bands
- **Volume Analysis**: Volume trends, average volume
- **Support/Resistance**: Price level identification

### Mutual Fund Conviction
- **Institutional Holdings**: Tracking mutual fund portfolio changes
- **Sentiment Analysis**: Bullish/bearish/neutral based on flow
- **Holder Quality**: Ranking of funds by performance and AUM
- **Trend Analysis**: Accumulation vs. distribution patterns

### Growth Analysis
- **Historical Growth**: QoQ and YoY growth rates
- **Growth Quality**: Consistency and sustainability
- **Projections**: Forward estimates based on management guidance
- **Capital Allocation**: ROIC, reinvestment rates

### Risk Assessment
- **Market Risk**: Beta, volatility, correlation
- **Credit Risk**: Debt levels, interest coverage
- **Liquidity Risk**: Trading volume, bid-ask spread
- **Operational Risk**: ROE, ROA, margins
- **Sector Risk**: Industry-specific factors
- **Geopolitical Risk**: Foreign exposure, currency risk
- **Disruption Risk**: Innovation, obsolescence potential

## License

MIT License

## Acknowledgments

- Inspired by fundamental investing principles from Warren Buffett, Peter Lynch, and Ray Dalio
- Technical analysis methodologies from John Murphy and Alexander Elder
- Mutual fund research approaches from leading asset managers
- Data providers: Money Control, Trendlyne, NSE, BSE
- Open source community for various libraries and tools

## APP URL
https://finai-stock-analysis.streamlit.app/

## streamlit
https://share.streamlit.io/


## langsmith
https://smith.langchain.com/o/73c9fa3f-e984-4805-8859-b4ffa11e2f94/projects?timeModel=%7B%22duration%22%3A%221d%22%7D

## tavily websearch

https://app.tavily.com/home