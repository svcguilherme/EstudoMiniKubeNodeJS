'use strict';

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// ─── MongoDB schemas ──────────────────────────────────────────────────────────

const weatherQuerySchema = new mongoose.Schema({
  city:        { type: String, required: true, index: true },
  country:     String,
  temperature: Number,
  feels_like:  Number,
  humidity:    Number,
  wind_speed:  Number,
  description: String,
  icon:        String,
  source:      String,
  timestamp:   { type: Date, default: Date.now, index: true },
});

const forecastQuerySchema = new mongoose.Schema({
  city:      { type: String, required: true, index: true },
  days:      Number,
  forecast:  mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
});

const WeatherQuery = mongoose.model('WeatherQuery', weatherQuerySchema);
const ForecastQuery = mongoose.model('ForecastQuery', forecastQuerySchema);

const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/temperaturadb');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB failed:', err.message);
  }
};

// ─── SQLite ───────────────────────────────────────────────────────────────────

let db = null;

const initSqlite = () => {
  try {
    const dbPath = process.env.SQLITE_PATH || path.join('/data', 'api-weather.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id         TEXT PRIMARY KEY,
        service    TEXT NOT NULL,
        endpoint   TEXT NOT NULL,
        method     TEXT NOT NULL,
        status     INTEGER NOT NULL,
        duration_ms INTEGER,
        input_hash TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_service ON transactions(service);
      CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at);
    `);
    console.log('SQLite initialized at', dbPath);
  } catch (err) {
    console.error('SQLite init failed:', err.message);
  }
};

const logTransaction = (service, endpoint, method, status, durationMs, inputHash = '') => {
  if (!db) return;
  try {
    db.prepare(`
      INSERT INTO transactions (id, service, endpoint, method, status, duration_ms, input_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), service, endpoint, method, status, durationMs, inputHash, new Date().toISOString());
  } catch (err) {
    console.error('SQLite log error:', err.message);
  }
};

const getTransactions = (limit = 50, offset = 0) => {
  if (!db) return [];
  return db.prepare(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
};

// ─── Persistence helpers ──────────────────────────────────────────────────────

const saveWeatherQuery = async (data) => {
  try {
    await WeatherQuery.create(data);
  } catch (err) {
    console.error('MongoDB weather save error:', err.message);
  }
};

const saveForecastQuery = async (data) => {
  try {
    await ForecastQuery.create(data);
  } catch (err) {
    console.error('MongoDB forecast save error:', err.message);
  }
};

const getWeatherHistory = async (city, limit = 10) => {
  return WeatherQuery.find(city ? { city: new RegExp(city, 'i') } : {})
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

module.exports = {
  connectMongo,
  initSqlite,
  logTransaction,
  getTransactions,
  saveWeatherQuery,
  saveForecastQuery,
  getWeatherHistory,
};
