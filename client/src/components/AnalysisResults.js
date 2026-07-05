import React from 'react';
import FundamentalAnalysis from './FundamentalAnalysis';
import TechnicalAnalysis from './TechnicalAnalysis';
import MutualFundAnalysis from './MutualFundAnalysis';
import GrowthAnalysis from './GrowthAnalysis';
import RiskAnalysis from './RiskAnalysis';
import RecommendationCard from './RecommendationCard';

const AnalysisResults = ({ analysis, stock }) => {
  if (!analysis) return <div>No analysis data available</div>;

  return (
    <div className="analysis-results">
      <div className="analysis-tabs">
        <button className="active" onclick={() => {}}>
          Overview
        </button>
        <button onclick={() => {}}>
          Fundamental
        </button>
        <button onclick={() => {}}>
          Technical
        </button>
        <button onclick={() => {}}>
          Mutual Funds
        </button>
        <button onclick={() => {}}>
          Growth
        </button>
        <button onclick={() => {}}>
          Risk
        </button>
      </div>

      <RecommendationCard recommendation={analysis.overall.recommendation} />

      <div className="analysis-sections">
        <div className="analysis-grid">
          <FundamentalAnalysis data={analysis.fundamental} />
          <TechnicalAnalysis data={analysis.technical} />
          <MutualFundAnalysis data={analysis.mutualFundConviction} />
          <GrowthAnalysis data={analysis.growth} />
          <RiskAnalysis data={analysis.risk} />
        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;