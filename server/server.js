const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables (server/.env regardless of cwd)
dotenv.config({ path: path.join(__dirname, '.env') });

// Import routes
const stockRoutes = require('./routes/stockRoutes');
const analysisRoutes = require('./routes/analysisRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const { router: authRoutes, seedAdmin } = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.set('trust proxy', 1);           // Render terminates TLS upstream — req.ip must be the real client
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Rate limiting. Every /api/analysis call shells out to yfinance + two scrapers,
// so unthrottled traffic burns upstream quota and gets our IP blocked.
const rateLimit = require('./rateLimit');

// Auth is stricter than the rest — this window is what makes password guessing impractical.
app.use('/api/auth', rateLimit({
  max: 10, windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts. Try again in 15 minutes.',
}));
app.use('/api', rateLimit({
  max: 60, windowMs: 15 * 60 * 1000,
  message: 'Too many requests. Try again in a few minutes.',
}));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financialai', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected');
  return seedAdmin();
})
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/portfolio', portfolioRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Financial AI Agents API'
  });
});

// Serve React build (single-service deployment); API 404s stay JSON
const clientBuild = path.join(__dirname, '../client/build');
app.use(express.static(clientBuild));
app.use('*', (req, res) => {
  if (!req.originalUrl.startsWith('/api')) {
    return res.sendFile(path.join(clientBuild, 'index.html'), (err) => {
      if (err) res.status(404).json({ message: 'Route not found' });
    });
  }
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;