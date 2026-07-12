import React, { useState } from 'react';
import axios from 'axios';
import AnalysisResults from '../components/AnalysisResults';
import StockSearchForm from '../components/StockSearchForm';

const StockSearch = () => {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (symbol) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`/api/analysis/${symbol}`, {
        exchange: 'NSE',
        depth: 'full',
        forceRefresh: true
      });

      setAnalysisData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during analysis');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stock-search-page">
      <div className="search-container">
        <StockSearchForm onSearch={handleSearch} />

        {loading && <div className="loading">Analyzing stock...</div>}

        {error && <div className="error">{error}</div>}

        {analysisData && (
          <div className="results-container">
            <h2>Analysis Results for {analysisData.symbol}</h2>
            <AnalysisResults analysis={analysisData.analysis} stock={analysisData} />
          </div>
        )}

        {!loading && !error && !analysisData && (
          <div className="placeholder">
            <p>Enter a stock symbol above to get detailed analysis</p>
            <p>Try: RELIANCE, TCS, HDFCBANK, INFY, etc.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockSearch;