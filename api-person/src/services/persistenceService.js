'use strict';

const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const personQuerySchema = new mongoose.Schema({
  name:               { type: String, required: true, index: true },
  birthdate:          String,
  age_years:          Number,
  age_months:         Number,
  age_days:           Number,
  total_days:         Number,
  zodiac_sign:        String,
  is_birthday_today:  Boolean,
  timestamp:          { type: Date, default: Date.now, index: true },
});

const PersonQuery = mongoose.model('PersonQuery', personQuerySchema);

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/temperaturadb');
    console.log('MongoDB connected');
  } catch (err) { console.error('MongoDB failed:', err.message); }
};

let db = null;

const initSqlite = () => {
  try {
    const dbPath = process.env.SQLITE_PATH || path.join('/data', 'api-person.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, service TEXT NOT NULL, endpoint TEXT NOT NULL,
        method TEXT NOT NULL, status INTEGER NOT NULL, duration_ms INTEGER,
        input_hash TEXT, created_at TEXT NOT NULL
      );
    `);
    console.log('SQLite initialized');
  } catch (err) { console.error('SQLite init failed:', err.message); }
};

const logTransaction = (service, endpoint, method, status, durationMs, inputHash = '') => {
  if (!db) return;
  try {
    db.prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)')
      .run(uuidv4(), service, endpoint, method, status, durationMs, inputHash, new Date().toISOString());
  } catch (err) { console.error('SQLite log error:', err.message); }
};

const savePersonQuery = async (data) => {
  try { await PersonQuery.create(data); }
  catch (err) { console.error('MongoDB save error:', err.message); }
};

const getPersonHistory = async (name, limit = 10) =>
  PersonQuery.find(name ? { name: new RegExp(name, 'i') } : {})
    .sort({ timestamp: -1 }).limit(limit).lean();

const getTransactions = (limit = 50, offset = 0) => {
  if (!db) return [];
  return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
};

module.exports = { connectMongo, initSqlite, logTransaction, savePersonQuery, getPersonHistory, getTransactions };
