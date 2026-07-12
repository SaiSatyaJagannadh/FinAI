import React, { useState } from 'react';

const GoogleFinanceOverview = ({ stock, analysis }) => {
  const [timeRange, setTimeRange] = useState('1M');

  if (!stock || !analysis) return null;

  const priceData = stock.priceData || {};
  const fundamental = analysis.fundamental || {};
  const overall = analysis.overall || {};
  const recommendation = overall.recommendation || {};

  // Format currency
  const formatCurrency = (val) => {
    if (!val) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val);
  };

  // Format large numbers
  const formatLargeNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)} Lakh Cr`;
    if (num >= 1e5) return `₹${(num / 1e5).toFixed(2)} Lakh`;
    if (num >= 1e3) return `₹${(num / 1e3).toFixed(2)} K`;
    return num.toString();
  };

  // Format percentage
  const formatPercent = (val) => {
    if (!val && val !== 0) return 'N/A';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Get recommendation color
  const getRecColor = (action) => {
    switch (action?.toUpperCase()) {
      case 'BUY': return '#00c853';
      case 'SELL': return '#ff1744';
      default: return '#ff9800';
    }
  };

  // Price stats
  const price = priceData.current || 0;
  const change = priceData.change || 0;
  const changePercent = priceData.changePercent || 0;
  const isPositive = change >= 0;

  // 52 week range
  const week52High = stock.week52?.high || 0;
  const week52Low = stock.week52?.low || 0;

  // Key stats data
  const keyStats = [
    { label: 'Market Cap', value: formatLargeNumber(priceData.marketCap) },
    { label: 'P/E Ratio', value: fundamental.peRatio?.trailing ? fundamental.peRatio.trailing.toFixed(2) : 'N/A' },
    { label: 'P/B Ratio', value: fundamental.priceToBook?.value?.toFixed(2) || fundamental.priceToBook?.toFixed(2) || 'N/A' },
    { label: 'Book Value', value: formatCurrency(priceData.current / (fundamental.priceToBook?.value || 25)) },
    { label: 'Dividend Yield', value: (priceData.dividendYield * 100)?.toFixed(2) + '%' || 'N/A' },
    { label: 'EPS (TTM)', value: fundamental.roe ? (priceData.current / (fundamental.peRatio?.trailing || 25)).toFixed(2) : 'N/A' },
    { label: 'ROE', value: fundamental.roe?.value?.toFixed(1) + '%' || fundamental.roe?.toFixed(1) + '%' || 'N/A' },
    { label: 'ROA', value: fundamental.roa?.value?.toFixed(1) + '%' || fundamental.roa?.toFixed(1) + '%' || 'N/A' },
    { label: 'Debt/Equity', value: fundamental.debtToEquity?.value?.toFixed(2) || fundamental.debtToEquity?.toFixed(2) || 'N/A' },
    { label: 'Current Ratio', value: fundamental.currentRatio?.value?.toFixed(2) || fundamental.currentRatio?.toFixed(2) || 'N/A' },
    { label: "52 Week High", value: formatCurrency(week52High) },
    { label: "52 Week Low", value: formatCurrency(week52Low) },
  ];

  // Trading stats
  const tradingStats = [
    { label: 'Volume', value: priceData.volume?.toLocaleString('en-IN') || 'N/A' },
    { label: 'Avg. Volume', value: priceData.avgVolume?.toLocaleString('en-IN') || 'N/A' },
    { label: "Day's Range", value: `${formatCurrency(priceData.dayLow || 0)} - ${formatCurrency(priceData.dayHigh || 0)}` },
    { label: 'Open', value: formatCurrency(priceData.open || 0) },
    { label: 'Prev. Close', value: formatCurrency(priceData.previousClose || 0) },
  ];

  return (
    <div className="gf-overview">
      {/* Header Section */}
      <div className="gf-header">
        <div className="gf-header-left">
          <div className="gf-company-info">
            <h1 className="gf-company-name">{stock.name || stock.symbol}</h1>
            <span className="gf-exchange">{stock.exchange || 'NSE'}</span>
          </div>
          <div className="gf-price-section">
            <span className="gf-current-price">{formatCurrency(price)}</span>
            <span className={`gf-change ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '▲' : '▼'} {formatCurrency(Math.abs(change))} ({formatPercent(changePercent)})
            </span>
          </div>
        </div>

        {/* Recommendation Badge */}
        <div className="gf-recommendation" style={{ borderColor: getRecColor(recommendation.action) }}>
          <span className="gf-rec-label">Our Recommendation</span>
          <span className="gf-rec-action" style={{ color: getRecColor(recommendation.action) }}>
            {recommendation.action || 'HOLD'}
          </span>
          <span className="gf-rec-confidence">{recommendation.confidence || 'MEDIUM'} CONFIDENCE</span>
          <span className="gf-rec-horizon">{recommendation.investmentHorizon || 'SHORT-TERM'}</span>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="gf-time-selector">
        {['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'].map(range => (
          <button
            key={range}
            className={`gf-time-btn ${timeRange === range ? 'active' : ''}`}
            onClick={() => setTimeRange(range)}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Price Chart - SVG-based */}
      <div className="gf-chart-container">
        <PriceChart
          priceHistory={stock.priceHistory || []}
          timeRange={timeRange}
          isPositive={isPositive}
        />
      </div>

      {/* Main Content Grid */}
      <div className="gf-content-grid">
        {/* Key Statistics */}
        <div className="gf-card gf-stats-card">
          <h3 className="gf-card-title">Key Statistics</h3>
          <div className="gf-stats-grid">
            {keyStats.map(stat => (
              <div key={stat.label} className="gf-stat-item">
                <span className="gf-stat-label">{stat.label}</span>
                <span className="gf-stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* About / Fundamentals */}
        <div className="gf-card gf-about-card">
          <h3 className="gf-card-title">Fundamentals</h3>
          <div className="gf-fundamentals">
            <div className="gf-fund-item">
              <span className="gf-fund-label">Sector</span>
              <span className="gf-fund-value">{stock.sector || 'N/A'}</span>
            </div>
            <div className="gf-fund-item">
              <span className="gf-fund-label">Industry</span>
              <span className="gf-fund-value">{stock.industry || stock.basicInfo?.industry || 'N/A'}</span>
            </div>
            <div className="gf-fund-item">
              <span className="gf-fund-label">Profit Margin</span>
              <span className="gf-fund-value">{(fundamental.profitMargin?.value || fundamental.profitMargin || 0).toFixed(2)}%</span>
            </div>
            <div className="gf-fund-item">
              <span className="gf-fund-label">Debt/Equity</span>
              <span className="gf-fund-value">{fundamental.debtToEquity?.value || fundamental.debtToEquity || 'N/A'}</span>
            </div>
          </div>

          {/* Score Breakdown */}
          <h4 className="gf-sub-title">Analysis Scores</h4>
          <div className="gf-scores">
            <div className="gf-score-item">
              <span>Fundamental</span>
              <div className="gf-score-bar">
                <div className="gf-score-fill" style={{ width: `${overall.fundamentalScore || 50}%`, backgroundColor: '#2196f3' }}></div>
              </div>
              <span className="gf-score-num">{overall.fundamentalScore || 50}</span>
            </div>
            <div className="gf-score-item">
              <span>Technical</span>
              <div className="gf-score-bar">
                <div className="gf-score-fill" style={{ width: `${overall.technicalScore || 50}%`, backgroundColor: '#9c27b0' }}></div>
              </div>
              <span className="gf-score-num">{overall.technicalScore || 50}</span>
            </div>
            <div className="gf-score-item">
              <span>Growth</span>
              <div className="gf-score-bar">
                <div className="gf-score-fill" style={{ width: `${overall.growthScore || 50}%`, backgroundColor: '#4caf50' }}></div>
              </div>
              <span className="gf-score-num">{overall.growthScore || 50}</span>
            </div>
            <div className="gf-score-item">
              <span>Risk</span>
              <div className="gf-score-bar">
                <div className="gf-score-fill" style={{ width: `${100 - (overall.riskScore || 50)}%`, backgroundColor: '#ff9800' }}></div>
              </div>
              <span className="gf-score-num">{overall.riskScore || 50}</span>
            </div>
            <div className="gf-score-item gf-score-total">
              <span>Overall Score</span>
              <div className="gf-score-bar">
                <div className="gf-score-fill" style={{ width: `${overall.weightedScore || 50}%`, backgroundColor: getRecColor(recommendation.action) }}></div>
              </div>
              <span className="gf-score-num">{overall.weightedScore || 50}</span>
            </div>
          </div>
        </div>

        {/* Trading Information */}
        <div className="gf-card gf-trading-card">
          <h3 className="gf-card-title">Trading Information</h3>
          <div className="gf-trading-list">
            {tradingStats.map(stat => (
              <div key={stat.label} className="gf-trading-item">
                <span className="gf-trading-label">{stat.label}</span>
                <span className="gf-trading-value">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* 52 Week Range Visual */}
          <div className="gf-52week-range">
            <span className="gf-52week-label">52-Week Range</span>
            <div className="gf-52week-bar">
              <div className="gf-52week-fill" style={{
                left: `${((price - week52Low) / (week52High - week52Low || 1)) * 100}%`
              }}></div>
            </div>
            <div className="gf-52week-values">
              <span>{formatCurrency(week52Low)}</span>
              <span>{formatCurrency(week52High)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Source Badge */}
      <div className="gf-data-source">
        Data Source: {analysis.dataSources?.join(', ') || 'Unknown'}
        {stock.lastUpdated && <span> • Last Updated: {new Date(stock.lastUpdated).toLocaleString()}</span>}
      </div>
    </div>
  );
};

// Simple SVG Price Chart Component
const PriceChart = ({ priceHistory, timeRange, isPositive }) => {
  // If no price history, show placeholder
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="gf-chart-placeholder">
        <span className="gf-chart-label">No chart data available - showing mock data</span>
        <svg viewBox="0 0 100 30" className="gf-chart-svg">
          <path
            d="M0,25 Q25,15 50,20 T100,10"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  // Filter data based on time range
  const now = new Date();
  let filteredData = [...priceHistory];

  switch (timeRange) {
    case '1D':
      filteredData = filteredData.slice(-1); // Today only
      break;
    case '1W':
      filteredData = filteredData.slice(-7);
      break;
    case '1M':
      filteredData = filteredData.slice(-30);
      break;
    case '3M':
      filteredData = filteredData.slice(-90);
      break;
    case '6M':
      filteredData = filteredData.slice(-180);
      break;
    case '1Y':
    case 'ALL':
    default:
      // Use all data
      break;
  }

  // Extract close prices
  const closePrices = filteredData.map(d => d.close);
  const minPrice = Math.min(...closePrices);
  const maxPrice = Math.max(...closePrices);
  const priceRange = maxPrice - minPrice || 1;

  // Generate SVG path
  const width = 100;
  const height = 30;
  const padding = 2;

  const points = filteredData.map((d, i) => {
    const x = (i / (filteredData.length - 1 || 1)) * width;
    const y = height - padding - ((d.close - minPrice) / priceRange) * (height - padding * 2);
    return `${x},${y}`;
  });

  const linePath = points.join(' L ') || `M0,${height / 2} L${width},${height / 2}`;
  const areaPath = `M0,${height} L ${linePath.replace(/M\d+,\d+/, 'M0,')} L${width},${height} Z`;

  const chartColor = isPositive ? '#059669' : '#dc2626';
  const chartGradient = isPositive ? '#dcfce7' : '#fee2e2';

  return (
    <div className="gf-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="gf-chart-svg" preserveAspectRatio="none">
        {/* Gradient defs */}
        <defs>
          <linearGradient id={`gradient-${timeRange}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#gradient-${timeRange})`}
          className="gf-chart-area"
        />

        {/* Line */}
        <path
          d={'M' + linePath}
          fill="none"
          stroke={chartColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End point dot */}
        {filteredData.length > 0 && (
          <circle
            cx={width}
            cy={height - padding - ((closePrices[closePrices.length - 1] - minPrice) / priceRange) * (height - padding * 2)}
            r="1.5"
            fill={chartColor}
          />
        )}
      </svg>

      {/* Price range labels */}
      <div className="gf-chart-labels">
        <span className="gf-chart-max">{maxPrice.toFixed(2)}</span>
        <span className="gf-chart-min">{minPrice.toFixed(2)}</span>
      </div>

      {/* Range indicator */}
      <span className="gf-chart-range-info">
        {filteredData.length} data points shown
      </span>
    </div>
  );
};

export default GoogleFinanceOverview;