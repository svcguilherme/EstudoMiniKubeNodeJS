'use strict';

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  retryStrategy: (times) => Math.min(times * 200, 3000),
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err.message));

const get = async (key) => { try { return await redis.get(key); } catch { return null; } };

const set = async (key, value, ttlSeconds) => {
  try {
    ttlSeconds ? await redis.setex(key, ttlSeconds, value) : await redis.set(key, value);
  } catch (err) { console.error('Redis set error:', err.message); }
};

const buildCsvString = (data) => {
  const flat = {};
  const flatten = (obj, prefix = '') => {
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? `${prefix}_${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key);
      else flat[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    });
  };
  flatten(data);
  const headers = Object.keys(flat).join(',');
  const values  = Object.values(flat).map(v =>
    typeof v === 'string' && v.includes(',') ? `"${v}"` : v
  ).join(',');
  return `${headers}\n${values}`;
};

module.exports = { get, set, buildCsvString, redis };
