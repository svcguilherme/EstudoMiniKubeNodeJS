'use strict';

const axios = require('axios');
const cache = require('./cacheService');
const messaging = require('./messagingService');
const persistence = require('./persistenceService');
const { cacheHits, cacheMisses } = require('../middleware/metrics');

const CACHE_TTL_CURRENT  = 600;   // 10 min
const CACHE_TTL_FORECAST = 1800;  // 30 min
const CACHE_TTL_CSV      = 3600;  // 1 h

const cityKey = (city) => city.toLowerCase().replace(/\s+/g, '_');

const getCurrentWeather = async (city) => {
  const key = `weather:${cityKey(city)}`;
  const cached = await cache.get(key);

  let result;
  if (cached) {
    cacheHits.inc({ service: 'api-weather' });
    result = { ...JSON.parse(cached), timestamp: new Date().toISOString() };
  } else {
    cacheMisses.inc({ service: 'api-weather' });

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured');

    const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: { q: city, appid: apiKey, units: 'metric', lang: 'pt_br' },
    });

    result = {
      city:        data.name,
      country:     data.sys.country,
      temperature: data.main.temp,
      feels_like:  data.main.feels_like,
      humidity:    data.main.humidity,
      wind_speed:  data.wind.speed,
      description: data.weather[0].description,
      icon:        `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
      timestamp:   new Date().toISOString(),
      source:      'openweathermap',
    };

    await cache.set(key, JSON.stringify(result), CACHE_TTL_CURRENT);

    const csvKey = `csv:weather:${cityKey(city)}:${result.timestamp.split('T')[0]}`;
    await cache.set(csvKey, cache.buildCsvString(result), CACHE_TTL_CSV);
  }

  await persistence.saveWeatherQuery(result);
  await messaging.publish(messaging.EXCHANGES.climate, 'weather.queried', {
    ...result, service: 'api-weather',
  });

  return result;
};

const getForecast = async (city, days = 5) => {
  const key = `forecast:${cityKey(city)}:${days}`;
  const cached = await cache.get(key);

  if (cached) {
    cacheHits.inc({ service: 'api-weather' });
    return JSON.parse(cached);
  }

  cacheMisses.inc({ service: 'api-weather' });

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHER_API_KEY not configured');

  const { data } = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
    params: { q: city, appid: apiKey, units: 'metric', lang: 'pt_br', cnt: days * 8 },
  });

  const grouped = {};
  data.list.forEach((item) => {
    const date = item.dt_txt.split(' ')[0];
    (grouped[date] = grouped[date] || []).push(item);
  });

  const forecast = Object.entries(grouped)
    .slice(0, days)
    .map(([date, items]) => {
      const temps = items.map((i) => i.main.temp);
      const mid   = items[Math.floor(items.length / 2)];
      return {
        date,
        temp_min:    Math.min(...temps),
        temp_max:    Math.max(...temps),
        description: mid.weather[0].description,
        icon:        `https://openweathermap.org/img/wn/${mid.weather[0].icon}@2x.png`,
        humidity:    Math.round(items.reduce((s, i) => s + i.main.humidity, 0) / items.length),
      };
    });

  const result = { city, days, forecast, timestamp: new Date().toISOString() };

  await cache.set(key, JSON.stringify(result), CACHE_TTL_FORECAST);
  await persistence.saveForecastQuery(result);
  await messaging.publish(messaging.EXCHANGES.climate, 'weather.forecast.queried', {
    city, days, service: 'api-weather',
  });

  return result;
};

module.exports = { getCurrentWeather, getForecast };
