const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

// ponytail: per-boot random secret when JWT_SECRET is unset — tokens die on restart; set JWT_SECRET in .env for persistence
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set — using a per-boot secret; logins will not survive a server restart');
}

// Seed the default admin user (idempotent). Called from server.js after DB connect.
async function seedAdmin() {
  const existing = await User.findOne({ username: 'admin' });
  if (existing) return;
  const passwordHash = await bcrypt.hash('admin', 10);
  await User.create({ username: 'admin', passwordHash });
  console.log('Seeded default admin user');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() }).select('+passwordHash');
    // Same message for unknown user and wrong password — don't leak which usernames exist
    const ok = user && await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ sub: user._id.toString(), username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !/^[a-z0-9_.-]{3,30}$/i.test(username)) {
      return res.status(400).json({ message: 'Username must be 3-30 characters: letters, numbers, _ . -' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const normalized = username.toLowerCase().trim();
    if (await User.findOne({ username: normalized })) {
      return res.status(409).json({ message: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    try {
      user = await User.create({ username: normalized, passwordHash });
    } catch (err) {
      if (err.code === 11000) {
        // Lost the race between findOne and create
        return res.status(409).json({ message: 'Username is already taken' });
      }
      throw err;
    }

    const token = jwt.sign({ sub: user._id.toString(), username: user.username }, JWT_SECRET, { expiresIn: '12h' });
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

// Middleware: require a valid Bearer token
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { router, seedAdmin, requireAuth };
