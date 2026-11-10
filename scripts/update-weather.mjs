#!/usr/bin/env node
// Daily weather job (GitHub Actions, evening):
//  1. saves the forecast for tomorrow (once; the first saved forecast is final)
//  2. fills in the observed values for finished days
//  3. rebuilds data/weather-results.json
//
// Usage: node scripts/update-weather.mjs [--backfill DAYS]
// --backfill uses Open-Meteo's Previous Runs API (forecasts issued one day earlier)
// to create forecasts for past days, so the results table is not empty on launch.

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {CITIES, TZ} from '../js/cities.js';
import {score} from '../js/score.js';

const DATA = new URL('../data/', import.meta.url);
const HISTORY = new URL('weather-history.json', DATA);
const RESULTS = new URL('weather-results.json', DATA);
const MAX_BACKFILL = 90;

const lat = CITIES.map(c => c.lat).join(',');
const lon = CITIES.map(c => c.lon).join(',');
const tz = encodeURIComponent(TZ);

const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: TZ}).format(new Date());
const round1 = v => Math.round(v * 10) / 10;

async function getJSON(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
      const j = await res.json();
      return Array.isArray(j) ? j : [j];
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise(r => setTimeout(r, 5000 * i));
    }
  }
}

async function readHistory() {
  try {
    return JSON.parse(await readFile(HISTORY, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {days: {}};
    throw err;
  }
}

// One day per line keeps git diffs small
function formatHistory(history) {
  const lines = Object.keys(history.days).sort().map(d => JSON.stringify(d) + ':' + JSON.stringify(history.days[d]));
  return '{"days":{\n' + lines.join(',\n') + '\n}}\n';
}

// Daily min/max/sum from the Previous Runs API (hourly only), forecasts issued about a day earlier
async function backfillForecasts(history, days, t) {
  const url = 'https://previous-runs-api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&hourly=temperature_2m_previous_day1,precipitation_previous_day1&timezone=' + tz +
    '&past_days=' + days + '&forecast_days=1';
  const list = await getJSON(url);
  let added = 0;
  list.forEach((loc, i) => {
    const id = CITIES[i].id, h = loc.hourly, byDate = {};
    h.time.forEach((time, k) => {
      const temp = h.temperature_2m_previous_day1[k], rain = h.precipitation_previous_day1[k];
      if (temp == null || rain == null) return;
      const d = (byDate[time.slice(0, 10)] ??= {min: Infinity, max: -Infinity, rain: 0, hours: 0});
      d.min = Math.min(d.min, temp);
      d.max = Math.max(d.max, temp);
      d.rain += rain;
      d.hours++;
    });
    for (const [date, d] of Object.entries(byDate)) {
      // today is included: the forecast issued yesterday for today is exactly what the evening job saves
      if (date > t || d.hours < 24) continue;
      const day = (history.days[date] ??= {});
      if (day.forecast?.[id]) continue;
      (day.forecast ??= {})[id] = {min: round1(d.min), max: round1(d.max), rain: round1(d.rain)};
      day.source = 'backfill';
      added++;
    }
  });
  return added;
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--backfill');
  const backfill = i >= 0 ? Math.min(MAX_BACKFILL, Math.max(1, parseInt(args[i + 1], 10) || 30)) : 0;

  const t = today();
  const history = await readHistory();
  const log = [];

  if (backfill) log.push('backfilled forecasts: ' + await backfillForecasts(history, backfill, t));

  // past days give observed values (model analysis), the last day is tomorrow's forecast
  const pastDays = Math.max(7, backfill + 1);
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=' + tz +
    '&past_days=' + pastDays + '&forecast_days=2';
  const list = await getJSON(url);

  let saved = 0, observed = 0;
  list.forEach((loc, k) => {
    const id = CITIES[k].id, d = loc.daily;
    d.time.forEach((date, j) => {
      const min = d.temperature_2m_min[j], max = d.temperature_2m_max[j], rain = d.precipitation_sum[j];
      if (min == null || max == null || rain == null) return;
      const value = {min: round1(min), max: round1(max), rain: round1(rain)};
      if (date > t) {
        const day = (history.days[date] ??= {});
        if (!day.forecast?.[id]) {
          (day.forecast ??= {})[id] = value;
          day.savedOn ??= t;
          saved++;
        }
      } else if (date < t && history.days[date]?.forecast) {
        // observed values can still be corrected for a few days, so they are overwritten
        (history.days[date].actual ??= {})[id] = value;
        observed++;
      }
    });
  });
  log.push('tomorrow saved: ' + saved, 'observed updated: ' + observed);

  const results = score(history, CITIES);
  await mkdir(DATA, {recursive: true});
  await writeFile(HISTORY, formatHistory(history));
  await writeFile(RESULTS, JSON.stringify(results) + '\n');
  log.push('scored days: ' + results.days + ', hits ' + results.hits + '/' + results.total);
  console.log(log.join('\n'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
