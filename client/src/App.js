import React from 'react';
import { Routes, Route } from 'react-router-dom';
import StockSearch from './pages/StockSearch';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import Analysis from './pages/Analysis';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Financial AI Agents</h1>
        <p>Advanced Stock Analysis Platform</p>
      </header>
      <nav>
        <ul>
          <li><a href="/">Stock Search</a></li>
          <li><a href="/portfolio">Portfolio</a></li>
          <li><a href="/watchlist">Watchlist</a></li>
          <li><a href="/analysis">Analysis</a></li>
        </ul>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<StockSearch />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/analysis" element={<Analysis />} />
        </Routes>
      </main>
      <footer>
        <p>&copy; {new Date().getFullYear()} Financial AI Agents. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;