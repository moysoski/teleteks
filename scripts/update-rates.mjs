#!/usr/bin/env node
// Exchange rates from the National Bank (NBRM), middle rate. The API has no CORS, so it runs here.
// Keeps the latest list and the one before it, to show the daily change.
import {getJSON, writeData, run} from './lib.mjs';

const ddmmyyyy = d => [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()].map(n => String(n).padStart(2, '0')).join('.');
const ORDER = ['EUR', 'USD', 'CHF', 'GBP'];

run(async () => {
  const end = new Date(Date.now() + 2 * 86400e3);  // NBRM publishes tomorrow's list in the afternoon
  const start = new Date(Date.now() - 10 * 86400e3);
  const url = 'https://www.nbrm.mk/KLServiceNOV/GetExchangeRate?StartDate=' + ddmmyyyy(start) +
    '&EndDate=' + ddmmyyyy(end) + '&format=json';
  const rows = await getJSON(url);

  const byDate = {};
  for (const r of rows) (byDate[r.datum.slice(0, 10)] ??= []).push(r);
  const dates = Object.keys(byDate).sort();
  if (!dates.length) throw new Error('NBRM returned no rates');

  const list = date => byDate[date]
    .map(r => ({code: r.oznaka, name: r.nazivMak.toUpperCase(), unit: r.nomin, rate: r.sreden}))
    .sort((a, b) => {
      const ia = ORDER.indexOf(a.code), ib = ORDER.indexOf(b.code);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.code.localeCompare(b.code);
    });

  const date = dates[dates.length - 1], prevDate = dates[dates.length - 2] || null;
  const prev = prevDate ? Object.fromEntries(list(prevDate).map(r => [r.code, r.rate])) : {};
  const rates = list(date).map(r => ({...r, change: prev[r.code] != null ? Math.round((r.rate - prev[r.code]) * 1e4) / 1e4 : null}));

  const changed = await writeData('rates.json', {date, prevDate, rates});
  console.log('rates', date, rates.length, changed ? 'updated' : 'unchanged');
});
