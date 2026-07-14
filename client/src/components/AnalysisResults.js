import React, { useState } from 'react';
import FundamentalAnalysis from './FundamentalAnalysis';
import TechnicalAnalysis from './TechnicalAnalysis';
import MutualFundAnalysis from './MutualFundAnalysis';
import GrowthAnalysis from './GrowthAnalysis';
import RiskAnalysis from './RiskAnalysis';
import RecommendationCard from './RecommendationCard';
import GoogleFinanceOverview from './GoogleFinanceOverview';

// Plain-English meanings for every technical term used across the tabs
const GLOSSARY = [
  ['P/E (trailing)', 'Price ÷ last 12 months profit per share. How many years of current profit you pay for the stock.'],
  ['Forward P/E', 'Same, but using next year’s expected profit. Lower than trailing P/E = profits expected to grow.'],
  ['PEG', 'P/E ÷ growth rate. Under 1 is usually attractive — you’re not overpaying for the growth.'],
  ['EPS', 'Earnings per share — total profit ÷ number of shares. The profit your one share earned.'],
  ['CAGR', 'Compound annual growth rate — steady yearly growth % that gets from the old number to the new one.'],
  ['Book value / P/B', 'What the company owns minus what it owes, per share. P/B = price ÷ book value.'],
  ['ROE / ROCE / ROA', 'Profit as a % of shareholder money / all capital / all assets. Higher = the business uses money better.'],
  ['Operating margin (OPM)', 'Profit from the core business per ₹100 of sales, before interest and tax. Falling OPM = rising costs.'],
  ['PAT / PBT / EBITDA', 'Profit after tax / before tax / before interest+tax+depreciation. Compare the same one across quarters.'],
  ['Debt/Equity', 'Borrowed money vs shareholder money. Under 0.5 is comfortable for most sectors (banks are different).'],
  ['QoQ / YoY', 'Change vs previous quarter / vs the same quarter last year. YoY cancels seasonal effects.'],
  ['Promoter / FII / DII holding', 'Founders / foreign funds / Indian funds owning the stock. Rising promoter & fund holding = confidence.'],
  ['Gross / Net NPA (banks)', 'Loans not being repaid, as a % of all loans. Lower is better.'],
  ['RSI', 'Momentum from 0–100. Above 70 = maybe overbought (expensive short-term), below 30 = maybe oversold.'],
  ['MACD', 'Trend-change signal from two moving averages. Line above signal = upward momentum.'],
  ['Moving average (SMA/EMA)', 'Average price of the last 50/200 days. Price above it = uptrend.'],
  ['Bollinger Bands', 'A band around the average price. Price near the top band = stretched, near the bottom = beaten down.'],
  ['Beta', 'How much the stock moves when the market moves 1%. Above 1 = swings harder than the market.'],
  ['Volatility', 'How wildly the price jumps around. Higher = riskier ride.'],
  ['Dividend yield', 'Yearly dividend as a % of the price — cash paid to you for holding.'],
  ['Cash conversion cycle', 'Days between paying suppliers and collecting from customers. Shorter = healthier cash flow.'],
];

const AnalysisResults = ({ analysis, stock }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!analysis) return <div>No analysis data available</div>;

  // Ordered by buying priority (valuation & growth first, then who else is
  // buying, then charts/risk) — mirrors the buy-checklist doc.
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'fundamental', label: 'Fundamental' },
    { id: 'growth', label: 'Growth' },
    { id: 'mutualfunds', label: 'Mutual Funds' },
    { id: 'technical', label: 'Technical' },
    { id: 'risk', label: 'Risk' },
  ];

  return (
    <div className="analysis-results">
      <div className="analysis-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <GoogleFinanceOverview stock={stock} analysis={analysis} />
      ) : (
        <>
          <RecommendationCard recommendation={analysis.overall?.recommendation} />

          <div className="analysis-sections">
            <div className="analysis-grid">
              {activeTab === 'fundamental' && <FundamentalAnalysis data={analysis.fundamental} />}
              {activeTab === 'technical' && <TechnicalAnalysis data={analysis.technical} />}
              {activeTab === 'mutualfunds' && <MutualFundAnalysis data={analysis.mutualFundConviction} />}
              {activeTab === 'growth' && <GrowthAnalysis data={analysis.growth} />}
              {activeTab === 'risk' && <RiskAnalysis data={analysis.risk} />}
            </div>
          </div>
        </>
      )}

      <details className="glossary">
        <summary>What do these terms mean? (plain English)</summary>
        <dl>
          {GLOSSARY.map(([term, meaning]) => (
            <React.Fragment key={term}>
              <dt>{term}</dt>
              <dd>{meaning}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>
    </div>
  );
};

export default AnalysisResults;