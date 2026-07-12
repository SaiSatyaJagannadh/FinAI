import React, { useState } from 'react';
import FundamentalAnalysis from './FundamentalAnalysis';
import TechnicalAnalysis from './TechnicalAnalysis';
import MutualFundAnalysis from './MutualFundAnalysis';
import GrowthAnalysis from './GrowthAnalysis';
import RiskAnalysis from './RiskAnalysis';
import RecommendationCard from './RecommendationCard';
import GoogleFinanceOverview from './GoogleFinanceOverview';

const AnalysisResults = ({ analysis, stock }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!analysis) return <div>No analysis data available</div>;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'fundamental', label: 'Fundamental' },
    { id: 'technical', label: 'Technical' },
    { id: 'mutualfunds', label: 'Mutual Funds' },
    { id: 'growth', label: 'Growth' },
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
    </div>
  );
};

export default AnalysisResults;