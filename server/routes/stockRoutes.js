const express = require('express');
const router = express.Router();
const Stock = require('../models/Stock');

// Get stock information by symbol
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'NSE' } = req.query;

    // Find or create stock
    let stock = await Stock.findOne({
      symbol: symbol.toUpperCase(),
      exchange
    });

    if (!stock) {
      // Create new stock entry (in real app, would fetch from API)
      stock = await Stock.create({
        symbol: symbol.toUpperCase(),
        exchange,
        name: `${symbol} Limited` // Placeholder
      });
    }

    res.json(stock);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({
      message: 'Error fetching stock information',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Search for stocks
router.get('/', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const stocks = await Stock.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(parseInt(limit));

    res.json(stocks);
  } catch (error) {
    console.error('Error searching stocks:', error);
    res.status(500).json({
      message: 'Error searching for stocks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get multiple stocks by symbols
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ message: 'Symbols array required' });
    }

    const stocks = await Stock.find({
      symbol: { $in: symbols.map(s => s.toUpperCase()) }
    });

    res.json(stocks);
  } catch (error) {
    console.error('Error fetching batch stocks:', error);
    res.status(500).json({
      message: 'Error fetching batch stocks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;