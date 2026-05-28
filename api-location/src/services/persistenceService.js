'use strict';

const mongoose = require('mongoose');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const locationQuerySchema = new mongoose.Schema({
  ip:          String,
  city:        { type: String, index: true },
  region:      String,
  country:     String,
  countryCode: String,
  zip:         String,
  lat:         Number,
  lon:         Number,
  timezone:    String,
  isp:         String,
  org:         String,
  source:      String,
  timestamp:   { type: Date, default: Date.now, index: true },
});

const LocationQuery = mongoose.model('LocationQuery', locationQuerySchema);

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/temperaturadb');
    console.log('MongoDB connected');
  } catch (err) { console.error('MongoDB failed:', err.message); }
};

let db = null;

const initSqlite = () => {
  try {
    const dbPath = process.env.SQLITE_PATH || path.join('/data', 'api-location.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, service TEXT NOT NULL, endpoint TEXT NOT NULL,
        method TEXT NOT NULL, status INTEGER NOT NULL, duration_ms INTEGER,
        input_hash TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at);
    `);
    console.log('SQLite initialized');
  } catch (err) { console.error('SQLite init failed:', err.message); }
};

const logTransaction = (service, endpoint, method, status, durationMs, inputHash = '') => {
  if (!db) return;
  try {
    db.prepare(`INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)`)
      .run(uuidv4(), service, endpoint, method, status, durationMs, inputHash, new Date().toISOString());
  } catch (err) { console.error('SQLite log error:', err.message); }
};

const saveLocationQuery = async (data) => {
  try { await LocationQuery.create(data); }
  catch (err) { console.error('MongoDB save error:', err.message); }
};

const getLocationHistory = async (limit = 10) =>
  LocationQuery.find().sort({ timestamp: -1 }).limit(limit).lean();

const getTransactions = (limit = 50, offset = 0) => {
  if (!db) return [];
  return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
};

module.exports = { connectMongo, initSqlite, logTransaction, saveLocationQuery, getLocationHistory, getTransactions };
