// Live weather for the browser: forecast and PM10 straight from Open-Meteo (it allows CORS).
import {CITIES, TZ} from './cities.js';

const lat = CITIES.map(c => c.lat).join(',');
const lon = CITIES.map(c => c.lon).join(',');
const tz = encodeURIComponent(TZ);

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,' +
  'wind_speed_10m_max,wind_direction_10m_dominant&timezone=' + tz + '&forecast_days=5';
export const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon +
  '&hourly=pm10&past_days=1&forecast_days=1&timezone=' + tz;

// status per source: 'loading' | 'ok' | 'error'
export const weather = {
  forecast: null, forecastStatus: 'loading',
  air: null, airStatus: 'loading'
};

async function getJSON(url) {
  const res = await fetch(url, {cache: 'no-cache'});
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.json();
}

const asList = j => Array.isArray(j) ? j : [j];

// Current date and hour in Skopje, e.g. {date: '2026-11-10', hour: '2026-11-10T21:00'}
export function skopjeNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const date = p.year + '-' + p.month + '-' + p.day;
  return {date, hour: date + 'T' + p.hour + ':00'};
}

async function loadForecast() {
  const list = asList(await getJSON(FORECAST_URL));
  weather.forecast = CITIES.map((c, i) => {
    const d = list[i].daily;
    return {
      ...c,
      days: d.time.map((date, k) => ({
        date,
        wmo: d.weather_code[k],
        min: Math.round(d.temperature_2m_min[k]),
        max: Math.round(d.temperature_2m_max[k]),
        rain: d.precipitation_sum[k],
        rainChance: d.precipitation_probability_max[k],
        wind: Math.round(d.wind_speed_10m_max[k]),
        windDir: d.wind_direction_10m_dominant[k]
      }))
    };
  });
}

async function loadAir() {
  const list = asList(await getJSON(AIR_URL));
  const now = skopjeNow().hour;
  weather.air = CITIES.map((c, i) => {
    const h = list[i].hourly;
    const values = h.time.map((t, k) => t <= now ? h.pm10[k] : null).filter(v => v != null).slice(-24);
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    return {...c, pm10: avg};
  }).filter(c => c.pm10 != null).sort((a, b) => b.pm10 - a.pm10);
}

function track(fn, key, onChange) {
  return fn().then(() => { weather[key] = 'ok'; }, err => {
    console.warn(err);
    // keep showing older data if a refresh fails
    if (weather[key] !== 'ok') weather[key] = 'error';
  }).then(onChange);
}

export function loadWeather(onChange) {
  return Promise.all([
    track(loadForecast, 'forecastStatus', onChange),
    track(loadAir, 'airStatus', onChange)
  ]);
}

// WMO weather code -> [icon, Macedonian description]
export function describe(code) {
  if (code === 0) return ['sun', 'СОНЧЕВО'];
  if (code <= 2) return ['pcloud', 'ДЕЛУМНО ОБЛАЧНО'];
  if (code === 3) return ['cloud', 'ОБЛАЧНО'];
  if (code === 45 || code === 48) return ['fog', 'МАГЛА'];
  if (code >= 51 && code <= 57) return ['rain', 'РОСУЛКА'];
  if (code === 66 || code === 67) return ['rain', 'ЛЕДЕН ДОЖД'];
  if (code >= 61 && code <= 65) return ['rain', 'ДОЖД'];
  if (code >= 71 && code <= 77) return ['snow', 'СНЕГ'];
  if (code >= 80 && code <= 82) return ['rain', 'ПЛУСКОВИ'];
  if (code === 85 || code === 86) return ['snow', 'СНЕЖНИ ВРНЕЖИ'];
  if (code >= 95) return ['storm', 'ГРМОТЕВИЦИ'];
  return ['cloud', 'ОБЛАЧНО'];
}

const DIRS = ['С', 'СИ', 'И', 'ЈИ', 'Ј', 'ЈЗ', 'З', 'СЗ'];
export const windDir = deg => DIRS[Math.round(deg / 45) % 8];
