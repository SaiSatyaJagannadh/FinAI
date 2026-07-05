# Financial AI Agents Project Specification

## Project Overview
Financial AI Agents system that analyzes stocks based on user-defined financial parameters and provides comprehensive investment insights. The system helps users evaluate stocks by analyzing fundamental, technical, and qualitative factors based on proven investment strategies from mutual fund managers and experienced investors. When a user provides a stock name, the system checks all specified parameters and provides a comprehensive analysis with clear buy/hold/sell signals.

## Core Features
- [x] Fundamental Analysis Engine (PE ratios, PEG, sales, revenue, PBT, book value, bank-specific metrics)
- [x] Technical Analysis Engine (option chains, futures contracts, Nifty weightage)
- [x] Mutual Fund Conviction Analysis (tracks mutual fund portfolio movements)
- [x] Growth Analysis using PE ratios and management guidance
- [x] Sector Analysis and Diversification Advisor
- [x] Risk Assessment (recession, monopoly threats, global exposure)
- [x] Taxation Planning Assistance
- [x] Comprehensive UI Dashboard for stock analysis
- [ ] Real-time alerts for parameter changes
- [ ] Portfolio tracking and optimization

## Data Requirements
### Input Data Sources
- Money Control: Stock prices, financial statements, key ratios
- Trendlyne: Mutual fund portfolio data, shareholder patterns
- Mutual Fund Sites: Quant Mutual, PPFAS AMC for folio disclosures
- Google Search: News, management commentary, announcements
- Twitter/X: Management commentary, export/import data, investor sentiment
- Stock Exchanges: Option chain data, futures contracts, Nifty weightage
- Company Announcements: Results, mergers, bulk deals, management commentary

### Data Formats
- Financial Ratios: P/E (Trailing & Forward), PEG, P/B, Debt/Equity, Current Ratio
- Financial Statements: Quarterly/Annual Sales, Revenue, PBT, Net Profit, EPS
- Ownership Data: Promoter holding, FII/DII holding, Mutual fund holding
- Derivatives Data: Option chain (PCR, Max Pain), Futures open interest, Nifty weightage
- Mutual Fund Data: Portfolio holdings, sector allocation, fund manager changes
- News/Sentiment: Management concalls, annual reports, news articles, social sentiment

### Data Processing Requirements
- Financial ratio calculation and trend analysis (QoQ, YoY)
- Comparison with mutual fund portfolio movements for conviction scoring
- Growth projection using PEG ratio and management guidance (CAGR projections)
- Sector analysis and diversification recommendations (max 2 sectors, 4-5 stocks max)
- Risk assessment: Recession impact, geopolitical threats, competitive threats
- Technical analysis: Option chain bias, futures trend, stock vs Nifty correlation
- Tax optimization: Holding period analysis for LTCG/STCG benefits

## AI Agent Specifications
### Agent 1: Fundamental Analysis Agent
- Purpose: Analyze core financial health and valuation metrics
- Inputs: Stock symbol, financial statements (last 4-8 quarters), market data
- Outputs: 
  - P/E ratios (trailing & forward) analysis with valuation bands
  - PEG ratio calculation and interpretation (<1 = undervalued, 1-2 = reasonable, >2 = expensive)
  - Sales/Revenue/PBT growth trends (QoQ & YoY)
  - Book value analysis and price-to-book ratio
  - For Banks: GNPA, NNPA, CASA ratio, Net Interest Margin
  - Overall financial health score (0-100)
- Algorithms/Models: 
  - Trend analysis (linear regression for growth rates)
  ratio comparison with sector averages
  - PEG-based valuation model
  - Banking sector specific ratios analysis

### Agent 2: Technical & Derivatives Analysis Agent
- Purpose: Analyze technical indicators and derivative market signals
- Inputs: Stock symbol, option chain data, futures data, price volume data
- Outputs:
  - Option Chain Analysis: PCR (Put Call Ratio), Max Pain, OI buildup
  - Futures Analysis: Basis, rollover percentage, long/short buildup
  - Price-Volume Trends: Delivery percentage, volume trends
  - Nifty Weightage & Correlation Analysis
  - Technical score (0-100) based on derivatives and price action
- Algorithms/Models:
  - Options Greeks analysis (simplified)
  - Open Interest change analysis
  - Price-volume correlation modeling
  - Futures premium/discount analysis

### Agent 3: Mutual Fund Conviction Agent
- Purpose: Analyze mutual fund portfolio movements for conviction signals
- Inputs: Stock symbol, mutual fund portfolio data (Quant, PPFAS, etc.)
- Outputs:
  - Mutual fund holding changes (increase/decrease in holdings)
  - New entries/exits by reputable funds (PPFAS, Quant, etc.)
  - Sector allocation changes in mutual funds
  - Fund manager commentary alignment
  - Conviction score (0-100) based on smart money movements
- Algorithms/Models:
  - Portfolio change detection (MoM, QoQ)
  - Fund manager track record weighting
  - Sector rotation analysis
  - Smart money confidence scoring

### Agent 4: Growth & Valuation Agent
- Purpose: Project future growth and intrinsic value using PE and guidance
- Inputs: Current PE, historical PE, management guidance (CAGR), industry growth rates
- Outputs:
  - Future EPS projection based on management guidance
  - Future price projection using forward PE
  - PEG ratio analysis with growth justification
  - Comparison with historical valuation bands
  - Growth sustainability score
- Algorithms/Models:
  - Compound Annual Growth Rate (CAGR) projection
  - Future P/E multiple expansion/contraction analysis
  - Gordon Growth Model (for stable companies)
  - Relative valuation vs sector peers

### Agent 5: Risk & Macro Analysis Agent
- Purpose: Assess macro-economic, sector-specific, and company-specific risks
- Inputs: Stock symbol, sector data, macro indicators, news/sentiment data
- Outputs:
  - Recession impact assessment (global & domestic)
  - Sector-specific risks (policy changes, demand shifts)
  - Company-specific risks (management, competition, disruption)
  - Global exposure analysis (exports/imports, forex impact)
  - Monopoly/threat analysis (moat assessment)
  - Overall risk score (0-100, lower is better)
- Algorithms/Models:
  - Macro indicator correlation analysis
  - Sentiment analysis of news/social media
  - Peer comparison for competitive positioning
  - Geographic revenue exposure analysis

## API Endpoints (if applicable)
### Stock Analysis Endpoint
- Method: POST
- Path: /api/v1/analyze-stock
- Description: Analyze a stock symbol across all dimensions and return comprehensive report
- Request Parameters:
  - `symbol` (string, required): Stock symbol (e.g., "RELIANCE", "TCS")
  - `exchange` (string, optional): NSE/BSE (default: NSE)
  - `depth` (string, optional): "basic"/"standard"/"full" (default: "standard")
- Response Format:
```json
{
  "symbol": "RELIANCE",
  "analysis_date": "2024-01-15",
  "overall_score": 78,
  "recommendation": "BUY",
  "confidence": "HIGH",
  "fundamental_analysis": {
    "score": 82,
    "pe_analysis": {"trailing_pe": 22.5, "forward_pe": 18.3, "valuation": "FAIR"},
    "peg_ratio": 0.85,
    "growth_metrics": {"sales_yoy": 0.12, "profit_yoy": 0.15},
    "financial_health": "STRONG"
  },
  "technical_analysis": {
    "score": 75,
    "option_chain": {"pcr": 0.92, "max_pain": 2450, "signal": "BULLISH"},
    "futures": {"basis": 0.5, "rollover": 0.85, "signal": "NEUTRAL"},
    "price_volume": {"delivery": 0.65, "trend": "POSITIVE"}
  },
  "mutual_fund_conviction": {
    "score": 88,
    "smart_money": {"accumulating": true, "top_funds_adding": ["PPFAS Flexi Cap", "Quant Active"]},
    "sector_allocation_shift": "INCREASING"
  },
  "growth_analysis": {
    "score": 72,
    "future_eps_projection": {"current": 85, "1yr": 102, "2yr": 122},
    "price_projection": {"current": 2400, "target_1yr": 2900},
    "peg_justification": "GROWTH SUPPORTS VALUATION"
  },
  "risk_analysis": {
    "score": 25,
    "recession_risk": "LOW",
    "sector_risks": ["REGULATORY_CHANGES"],
    "company_risks": ["DEPENDENCY_ON_OIL_PRICES"],
    "global_exposure": "MODERATE (30% EXPORTS)"
  },
  "recommendation_summary": {
    "key_strengths": ["Strong sales growth", "Reasonable PEG ratio", "Smart money accumulation"],
    "key_risks": ["Oil price dependency", "Regulatory changes in telecom"],
    "action_points": ["Monitor quarterly results", "Watch for crude price movements"],
    "holding_suggestion": "LONG TERM (2-5 YEARS)"
  }
}
```

### Mutual Fund Insights Endpoint
- Method: GET
- Path: /api/v1/mutual-fund-insights/{fund_name}
- Description: Get insights about a specific mutual fund's portfolio and strategy
- Response includes: Top holdings, sector allocation, fund manager strategy, recent changes

## Configuration
### Environment Variables
- `MONEYCONTROL_API_KEY`: API key for Money Control data (default: demo_key)
- `TRENDLYNE_API_KEY`: API key for Trendlyne data (default: demo_key)
- `MUTUAL_FUND_API_KEY`: API for mutual fund data (default: demo_key)
- `TWITTER_API_BEARER_TOKEN`: Twitter/X API bearer token (optional)
- `NSE_API_KEY`: National Stock Exchange API key (optional)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/staging/production, default: development)
- `CACHE_TTL`: Cache time-to-live in seconds (default: 300)

### Configuration Files
- `config/financial_ratios.json`: Benchmark ratios by sector
- `config/mutual_funds.json`: List of tracked mutual funds and their criteria
- `config/risk_factors.json`: Macro and sector risk definitions
- `config/ui_config.json`: UI theme and visualization settings

## Dependencies
### Core Dependencies
- `express`: ^4.18.0 (Node.js web framework)
- `mongoose`: ^7.0.0 (MongoDB object modeling)
- `axios`: ^1.0.0 (HTTP client for API calls)
- `cheerio`: ^1.0.0 (Web scraping for Money Control/News)
- `socket.io`: ^4.0.0 (Real-time updates)
- `react`: ^18.0.0 (Frontend library)
- `redux`: ^4.2.0 (State management)
- `chart.js`: ^4.0.0 (Data visualization)
- `d3.js`: ^7.0.0 (Advanced visualizations)

### Data Processing Libraries
- `pandasjs`: ^0.5.0 (Data manipulation - JavaScript equivalent)
- `numpy-js`: ^0.1.0 (Numerical computations)
- `talib`: ^1.0.0 (Technical analysis library)
- `sentiment`: ^5.0.0 (Sentiment analysis for news/social)

### Development Dependencies
- `jest`: ^29.0.0 (Testing framework)
- `supertest`: ^6.0.0 (HTTP assertion library)
- `eslint`: ^8.0.0 (Code linting)
- `nodemon`: ^2.0.0 (Development server)

## Testing
### Unit Tests
- Framework: Jest with Supertest for API testing
- Coverage Target: 85%+ for all agents and utilities
- Test Categories:
  - Financial ratio calculations
  - PEG ratio and valuation models
  - Technical analysis indicators
  - Mutual fund portfolio analysis
  - Risk assessment models

### Integration Tests
- End-to-end stock analysis workflow
- Data pipeline from sources to analysis
- API endpoint validation
- Real-time data update mechanisms
- UI component integration tests

### Manual Testing Scenarios
- Test with large-cap stocks (RELIANCE, TCS, HDFCBANK)
- Test with mid-cap and small-cap stocks
- Test sector-specific analysis (banking, IT, pharma)
- Test during market volatile periods
- Test mutual fund signal detection accuracy

## Deployment
### Environment
- Development: Local machine with Docker Compose
- Staging: AWS EC2 or Docker Swarm
- Production: AWS ECS/EKS with load balancing

### Deployment Method
- Containerized using Docker
- CI/CD pipeline with GitHub Actions
- Blue-green deployment strategy for zero-downtime updates
- Database migration scripts for schema updates
- Health checks and auto-scaling policies

### Infrastructure
- Web Server: Nginx as reverse proxy
- Application: Node.js cluster with PM2 process manager
- Database: MongoDB Atlas (cloud) or local MongoDB
- Cache: Redis for session and API response caching
- Monitoring: PM2 monitoring + custom health endpoints
- Logging: Winston logging with rotation
- SSL: Let's Encrypt certificates for HTTPS

## Notes
### Core Investment Principles from Notes
1. **Parameter-Based Analysis**: System evaluates stocks based on user-defined parameters (PE ratios, PEG, sales growth, etc.)
2. **Mutual Fund Conviction**: Tracks smart money moves from reputable funds (PPFAS, Quant Mutual) for conviction signals
3. **Growth Analysis**: Uses PEG ratio (PE/Growth) - values <1 or <2 considered attractive for growth stocks
4. **Management Guidance**: Uses management CAGR guidance to project future prices
5. **Sector Diversification**: Recommends max 2 sectors, with 4-5 stocks total (50% large cap, 25% mid, 25% small)
6. **Technical Validation**: Uses option chain (PCR, Max Pain) and futures data for confirmation
7. **Tax Planning**: Considers holding period for optimal taxation (LTCG vs STCG)
8. **Global Exposure**: Checks international revenue/dealing for currency risk assessment
9. **Threat Analysis**: Monitors for disruptive threats (e.g., Reliance entering solar threatening existing players)
10. **Conviction Building**: Requires checking management commentary, annual reports, concalls

### Implementation Approach
1. **Phase 1**: Core fundamental analysis engine with basic UI
2. **Phase 2**: Technical analysis and mutual fund conviction modules
3. **Phase 3**: Growth projection and risk analysis systems
4. **Phase 4**: Advanced UI with visualizations and real-time updates
5. **Phase 5**: Portfolio management and alerting system

### UI Requirements (as specified by user)
- Clean, intuitive interface for stock input
- Dashboard showing all analysis components with scores
- Visual indicators (traffic light colors: Red/Yellow/Green)
- Charts showing trends (financials, price, volumes)
- Clear buy/hold/sell recommendations with confidence levels
- Detailed drill-down for each analysis module
- Mobile responsive design
- Dark/light theme support
- Export functionality (PDF/CSV reports)