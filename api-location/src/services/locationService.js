'use strict';

const axios   = require('axios');
const cache   = require('./cacheService');
const messaging   = require('./messagingService');
const persistence = require('./persistenceService');
const { cacheHits, cacheMisses } = require('../middleware/metrics');

const CACHE_TTL = 86400; // 24 h — IP location is stable

const getLocation = async (ip) => {
  const cleanIp = ip === '::1' || ip === '127.0.0.1' ? '8.8.8.8' : ip;
  const key     = `location:${cleanIp}`;

  const cached = await cache.get(key);

  let result;
  if (cached) {
    cacheHits.inc({ service: 'api-location' });
    result = { ...JSON.parse(cached), timestamp: new Date().toISOString() };
  } else {
    cacheMisses.inc({ service: 'api-location' });

    const { data } = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,query`);

    if (data.status === 'fail') {
      throw new Error(data.message || 'Location lookup failed');
    }

    result = {
      ip:          data.query,
      city:        data.city,
      region:      data.regionName,
      country:     data.country,
      countryCode: data.countryCode,
      zip:         data.zip,
      lat:         data.lat,
      lon:         data.lon,
      timezone:    data.timezone,
      isp:         data.isp,
      org:         data.org,
      timestamp:   new Date().toISOString(),
      source:      'ip-api.com',
    };

    await cache.set(key, JSON.stringify(result), CACHE_TTL);

    const csvKey = `csv:location:${cleanIp}`;
    await cache.set(csvKey, cache.buildCsvString(result), 3600);
  }

  await persistence.saveLocationQuery(result);
  await messaging.publish(messaging.EXCHANGES.location, 'location.queried', {
    ...result, service: 'api-location',
  });

  return result;
};

module.exports = { getLocation };
