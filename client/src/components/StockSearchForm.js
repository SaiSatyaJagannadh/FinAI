import React, { useState } from 'react';

const StockSearchForm = ({ onSearch }) => {
  const [symbol, setSymbol] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (symbol.trim()) {
      onSearch(symbol.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stock-search-form">
      <div className="form-group">
        <label htmlFor="stock-symbol">Stock Symbol:</label>
        <input
          type="text"
          id="stock-symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Enter stock symbol (e.g., RELIANCE)"
          autoFocus
        />
      </div>
      <button type="submit" className="search-button">
        Analyze Stock
      </button>
    </form>
  );
};

export default StockSearchForm;