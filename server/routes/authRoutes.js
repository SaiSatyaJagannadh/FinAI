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

// Seed the admin user (idempotent). Called from server.js after DB connect.
// No-op unless ADMIN_PASSWORD is set — a hardcoded admin/admin on a public
// deployment is a free account for anyone who reads this repo.
async function seedAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    if (password) console.warn('ADMIN_PASSWORD is shorter than 8 characters — admin not seeded');
    return;
  }
  if (await User.findOne({ username: 'admin' })) return;
  await User.create({ username: 'admin', passwordHash: await bcrypt.hash(password, 10) });
  console.log('Seeded admin user from ADMIN_PASSWORD');
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
