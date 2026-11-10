#!/usr/bin/env node
// Snapshot of the live forecast and PM10 in data/weather-live.json. The browser uses it only when
// Open-Meteo fails for the viewer. One extra day is kept so the snapshot still covers 5 days after midnight.
import {getJSON, writeData, run} from './lib.mjs';
import {forecastUrl, airUrl} from '../js/weather.js';

const clean = j => (Array.isArray(j) ? j : [j]).map(({generationtime_ms, ...rest}) => rest);

run(async () => {
  const forecast = clean(await getJSON(forecastUrl(6)));
  const air = clean(await getJSON(airUrl(2)));
  const changed = await writeData('weather-live.json', {forecast, air}, {pretty: false});
  console.log('weather snapshot', forecast.length, 'locations', changed ? 'updated' : 'unchanged');
});
