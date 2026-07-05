const express = require('express');
const router = express.Router();
const Portfolio = require('../models/Portfolio');
const Stock = require('../models/Stock');

// Get all portfolios for a user (simplified - in real app would use auth)
router.get('/', async (req, res) => {
  try {
    const { userId = 'default-user' } = req.query;
    const portfolios = await Portfolio.find({ userId }).populate('stocks.stock');
    res.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({
      message: 'Error fetching portfolios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get a specific portfolio
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'default-user' } = req.query;
    const portfolio = await Portfolio.findOne({ _id: id, userId }).populate('stocks.stock');

    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({
      message: 'Error fetching portfolio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create a new portfolio
router.post('/', async (req, res) => {
  try {
    const { userId = 'default-user', name, description, stocks } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Portfolio name is required' });
    }

    const portfolio = await Portfolio.create({
      userId,
      name,
      description: description || '',
      stocks: stocks || []
    });

    res.status(201).json(portfolio);
  } catch (error) {
    console.error('Error creating portfolio:', error);
    res.status(500).json({
      message: 'Error creating portfolio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add stock to portfolio
router.post('/:id/stocks', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'default-user' } = req.query;
    const { stockSymbol, allocatedPercentage, notes } = req.body;

    if (!stockSymbol) {
      return res.status(400).json({ message: 'Stock symbol is required' });
    }

    // Find or create the stock
    let stock = await Stock.findOne({ symbol: stockSymbol.toUpperCase() });
    if (!stock) {
      stock = await Stock.create({
        symbol: stockSymbol.toUpperCase(),
        name: `${stockSymbol} Limited`
      });
    }

    // Add stock to portfolio
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId },
      {
        $push: {
          stocks: {
            stock: stock._id,
            allocatedPercentage: allocatedPercentage || 0,
            notes: notes || '',
            addedAt: new Date()
          }
        }
      },
      { new: true }
    ).populate('stocks.stock');

    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error adding stock to portfolio:', error);
    res.status(500).json({
      message: 'Error adding stock to portfolio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Remove stock from portfolio
router.delete('/:id/stocks/:stockId', async (req, res) => {
  try {
    const { id, stockId } = req.params;
    const { userId = 'default-user' } = req.query;

    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId },
      {
        $pull: {
          stocks: { stock: stockId }
        }
      },
      { new: true }
    ).populate('stocks.stock');

    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error removing stock from portfolio:', error);
    res.status(500).json({
      message: 'Error removing stock from portfolio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update portfolio allocation
router.put('/:id/allocate', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'default-user' } = req.query;
    const { allocationStrategy } = req.body;

    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId },
      { $set: { allocationStrategy: allocationStrategy || 'equal_weight' } },
      { new: true }
    ).populate('stocks.stock');

    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found' });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Error updating portfolio allocation:', error);
    res.status(500).json({
      message: 'Error updating portfolio allocation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;