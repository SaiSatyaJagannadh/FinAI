const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    select: false // never returned in queries unless explicitly asked for
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
