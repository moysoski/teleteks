#!/usr/bin/env node
// Morning health check of every data source: reachable, still free (no key, no paywall, no rate limit),
// same format as the parsers expect, plausible values, and fresh data in data/*.json.
// Prints a table, writes a Markdown summary for GitHub Actions, exits 1 if anything failed.
import {appendFile} from 'node:fs/promises';
import {CITIES} from '../js/cities.js';
import {FORECAST_URL, AIR_URL} from '../js/weather.js';
import {parse as parseLotto} from './update-lotto.mjs';
import {API as SPORTS_API, LEAGUE} from './update-football.mjs';
import {readData, sleep, today} from './lib.mjs';

const TIMEOUT_MS = 20000;
const SLOW_MS = 8000;
const DAY = 86400e3;

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const daysAgo = iso => (Date.now() - new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso)) / DAY;

// One retry, so a single network hiccup does not raise an alarm
async function fetchTimed(url, as = 'json') {
  let last;
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS)});
      const ms = Date.now() - t0;
      // 401/402/403: a key or payment is now required; 429: the free limit is hit
      if ([401, 402, 403].includes(res.status)) throw new Error('HTTP ' + res.status + ': no longer free or blocked');
      if (res.status === 429) throw new Error('HTTP 429: rate limited');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (as === 'text') return {body: text, ms};
      try {
        return {body: JSON.parse(text), ms};
      } catch {
        throw new Error('not JSON: ' + text.slice(0, 120).replace(/\s+/g, ' '));
      }
    } catch (err) {
      last = err;
      if (/HTTP 40[123]/.test(err.message)) break;
      await sleep(5000);
    }
  }
  throw last;
}

const ddmmyyyy = d => [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()].map(n => String(n).padStart(2, '0')).join('.');

// Each check returns a short note on success, or throws. `ms` is the slowest request it made.
const CHECKS = [
  ['Open-Meteo прогноза', async () => {
    const {body, ms} = await fetchTimed(FORECAST_URL);
    const list = Array.isArray(body) ? body : [body];
    assert(list.length === CITIES.length, 'expected ' + CITIES.length + ' locations, got ' + list.length);
    for (const loc of list) {
      assert(loc.daily?.time?.length === 5, 'daily forecast is not 5 days');
      assert(loc.daily.temperature_2m_max.every(v => v != null && v > -40 && v < 50), 'missing or odd max temperatures');
    }
    return {ms, note: CITIES.length + ' града, 5 дена'};
  }],

  ['Open-Meteo PM10', async () => {
    const {body, ms} = await fetchTimed(AIR_URL);
    const list = Array.isArray(body) ? body : [body];
    const values = list.flatMap(l => l.hourly?.pm10 || []).filter(v => v != null);
    assert(values.length > 24 * CITIES.length, 'too few PM10 values: ' + values.length);
    return {ms, note: values.length + ' часовни вредности'};
  }],

  ['НБРМ курсна листа', async () => {
    const end = new Date(Date.now() + DAY), start = new Date(Date.now() - 6 * DAY);
    const {body, ms} = await fetchTimed('https://www.nbrm.mk/KLServiceNOV/GetExchangeRate?StartDate=' +
      ddmmyyyy(start) + '&EndDate=' + ddmmyyyy(end) + '&format=json');
    assert(Array.isArray(body) && body.length, 'no rates returned');
    const eur = body.filter(r => r.oznaka === 'EUR').pop();
    assert(eur && eur.sreden > 55 && eur.sreden < 70, 'EUR rate missing or implausible: ' + eur?.sreden);
    return {ms, note: 'EUR ' + eur.sreden + ' (' + eur.datum.slice(0, 10) + ')'};
  }],

  ['Државна лотарија', async () => {
    const {body, ms} = await fetchTimed('https://www.loto.mk/Results', 'text');
    const d = parseLotto(body);
    assert(d.numbers.every(n => n >= 1 && n <= 39) && new Set(d.numbers).size === 7, 'odd numbers: ' + d.numbers);
    assert(/^\d{6}$/.test(d.joker), 'odd Joker: ' + d.joker);
    assert(daysAgo(d.date) < 8, 'latest draw is old: ' + d.date);
    return {ms, note: d.round + '. коло, ' + d.date};
  }],

  ['TheSportsDB фудбал', async () => {
    const {body, ms} = await fetchTimed(SPORTS_API + '/lookupleague.php?id=' + LEAGUE);
    const league = body.leagues?.[0];
    assert(league?.idLeague === String(LEAGUE), 'league ' + LEAGUE + ' not found');
    const f = await readData('football.json', null);
    const round = f?.nextRound || f?.lastRound || 1;
    await sleep(2500);
    const r = await fetchTimed(SPORTS_API + '/eventsround.php?id=' + LEAGUE + '&r=' + round + '&s=' + league.strCurrentSeason);
    assert(r.body.events?.length >= 4, 'round ' + round + ' has ' + (r.body.events?.length || 0) + ' matches, expected a full round');
    return {ms: Math.max(ms, r.ms), note: league.strCurrentSeason + ', ' + round + '. коло: ' + r.body.events.length + ' натпревари'};
  }],

  // Freshness of what the scheduled workflows wrote
  ['Свежина на data/', async () => {
    const problems = [], t = today();
    const history = await readData('weather-history.json', {days: {}});
    if (!history.days[t]?.forecast) problems.push('вчерашната прогноза за денес не е зачувана (Weather)');
    const rates = await readData('rates.json', null);
    if (!rates || daysAgo(rates.date) > 6) problems.push('курсната листа е стара: ' + rates?.date);
    const lotto = await readData('lotto.json', null);
    if (!lotto || daysAgo(lotto.date) > 8) problems.push('лото е старо: ' + lotto?.date);
    const snap = await readData('weather-live.json', null);
    if (!snap || daysAgo(snap.updated) > 1) problems.push('резервната прогноза е стара: ' + snap?.updated?.slice(0, 10));
    const f = await readData('football.json', null);
    const next = f?.nextRound && f.rounds[f.nextRound]?.[0];
    if (!f) problems.push('нема фудбалски податоци');
    else if (next && daysAgo(next.time) > 3) problems.push('следното коло е во минатото, фудбалот не се ажурира');
    const leagues = (await readData('leagues.json', null))?.leagues || [];
    if (leagues.length < 4) problems.push('странски лиги: само ' + leagues.length + ' од 6');
    for (const l of leagues) {
      const first = l.nextRound && l.rounds[l.nextRound]?.[0];
      if (first && daysAgo(first.time) > 3) problems.push(l.name + ': следното коло е во минатото');
    }
    assert(!problems.length, problems.join('; '));
    return {ms: 0, note: 'сите датотеки се свежи'};
  }]
];

const results = [];
for (const [name, check] of CHECKS) {
  try {
    const {ms, note} = await check();
    results.push({name, ok: true, slow: ms > SLOW_MS, ms, note});
  } catch (err) {
    results.push({name, ok: false, ms: 0, note: err.message});
  }
}

const icon = r => r.ok ? (r.slow ? '🐢' : '✅') : '❌';
for (const r of results) console.log(icon(r), r.name.padEnd(22), r.ms ? String(r.ms).padStart(6) + ' ms' : '         ', r.note);

const failed = results.filter(r => !r.ok);
const summary = [
  '## Проверка на извори ' + today(),
  '',
  '| | Извор | Време | Белешка |',
  '|---|---|---|---|',
  ...results.map(r => `| ${icon(r)} | ${r.name} | ${r.ms ? r.ms + ' ms' : ''} | ${r.note.replace(/\|/g, '/')} |`),
  '',
  failed.length ? `**${failed.length} од ${results.length} не поминаа.**` : 'Сите извори се достапни, бесплатни и свежи.',
  ''
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
if (process.env.SUMMARY_FILE) await appendFile(process.env.SUMMARY_FILE, summary);
process.exit(failed.length ? 1 : 0);
