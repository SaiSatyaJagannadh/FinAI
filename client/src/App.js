import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import StockSearch from './pages/StockSearch';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import Analysis from './pages/Analysis';
import Login from './pages/Login';
import './App.css';

function App() {
  const [user, setUser] = useState(() =>
    localStorage.getItem('token') ? localStorage.getItem('username') : null
  );

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
  };

  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Financial AI Agents</h1>
          <p>Advanced Stock Analysis Platform</p>
        </header>
        <Login onLogin={setUser} />
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Financial AI Agents</h1>
        <p>Advanced Stock Analysis Platform</p>
      </header>
      <nav>
        <ul>
          <li><a href="/">Stock Search</a></li>
          <li><button onClick={handleLogout}>Logout ({user})</button></li>
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