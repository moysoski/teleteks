#!/usr/bin/env node
// Macedonian First League from TheSportsDB. The free key ("123") returns full rounds but cuts the
// standings to 5 teams, so the table is computed here from the results.
// Finished rounds are kept in data/football.json and not fetched again.
// Optional secret: THESPORTSDB_KEY (premium key), otherwise the public free key is used.
import {getJSON, readData, writeData, sleep, run, isMain} from './lib.mjs';

export const API = 'https://www.thesportsdb.com/api/v1/json/' + (process.env.THESPORTSDB_KEY || '123');
export const LEAGUE = 4652;
const MAX_ROUNDS = 40;
const DELAY_MS = 3000;  // the free key allows about 30 requests per minute
const FINISHED = ['FT', 'AET', 'PEN', 'Match Finished'];

// Names on the page, at most 12 characters
const TEAMS = {
  'Arsimi': 'АРСИМИ',
  'Bashkimi': 'БАШКИМИ',
  'Belasica': 'БЕЛАСИЦА',
  'Bregalnica Štip': 'БРЕГАЛНИЦА',
  'Gostivar': 'ГОСТИВАР',
  'Makedonija GP': 'МАКЕДОНИЈА',
  'Pelister': 'ПЕЛИСТЕР',
  'Pobeda': 'ПОБЕДА',
  'Rabotnički': 'РАБОТНИЧКИ',
  'Shkëndija': 'ШКЕНДИЈА',
  'Shkëndija Haraçinë': 'Ш. ХАРАЧИНЕ',
  'Shkupi': 'ШКУПИ',
  'Sileks': 'СИЛЕКС',
  'Skopje': 'СКОПЈЕ',
  'Struga': 'СТРУГА',
  'Tikvesh': 'ТИКВЕШ',
  'Vardar': 'ВАРДАР'
};

// Fallback for teams not in the list above: rough Latin -> Macedonian Cyrillic
const LATIN = [['dž', 'џ'], ['lj', 'љ'], ['nj', 'њ'], ['kj', 'ќ'], ['gj', 'ѓ'], ['sh', 'ш'], ['zh', 'ж'], ['ch', 'ч'],
  ['š', 'ш'], ['ž', 'ж'], ['č', 'ч'], ['ć', 'ќ'], ['ç', 'ч'], ['đ', 'ѓ'], ['ë', 'е'], ['a', 'а'], ['b', 'б'], ['c', 'ц'],
  ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'ј'], ['k', 'к'], ['l', 'л'], ['m', 'м'],
  ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'],
  ['y', 'ј'], ['z', 'з']];

function teamName(name) {
  if (TEAMS[name]) return TEAMS[name];
  let s = name.toLowerCase();
  for (const [a, b] of LATIN) s = s.split(a).join(b);
  console.warn('unknown team, add it to TEAMS:', name);
  return s.toUpperCase().slice(0, 12);
}

const isFinished = m => FINISHED.includes(m.status);

// One TheSportsDB event -> {time (UTC ISO), home, away, hs, as, status}; `name` shortens the team names
export function toMatch(e, name = teamName) {
  const score = v => v === null || v === '' ? null : +v;
  return {
    time: e.strTimestamp ? e.strTimestamp.replace(/(\+00:00)?$/, 'Z') : e.dateEvent + 'T00:00:00Z',
    home: name(e.strHomeTeam),
    away: name(e.strAwayTeam),
    hs: score(e.intHomeScore),
    as: score(e.intAwayScore),
    status: e.strStatus || 'NS'
  };
}

function standings(rounds) {
  const t = {};
  const row = name => (t[name] ??= {team: name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: []});
  const matches = Object.keys(rounds).sort((a, b) => a - b).flatMap(r => rounds[r]).filter(isFinished)
    .sort((a, b) => a.time.localeCompare(b.time));
  for (const m of matches) {
    const h = row(m.home), a = row(m.away);
    h.played++; a.played++;
    h.gf += m.hs; h.ga += m.as; a.gf += m.as; a.ga += m.hs;
    if (m.hs > m.as) { h.won++; a.lost++; h.points += 3; h.form.push('П'); a.form.push('И'); }
    else if (m.hs < m.as) { a.won++; h.lost++; a.points += 3; a.form.push('П'); h.form.push('И'); }
    else { h.drawn++; a.drawn++; h.points++; a.points++; h.form.push('Н'); a.form.push('Н'); }
  }
  // points, goal difference, goals scored (the league's head-to-head rule is not applied)
  return Object.values(t)
    .map(r => ({...r, form: r.form.slice(-5).join('')}))
    .sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.localeCompare(b.team));
}

if (isMain(import.meta.url)) run(async () => {
  const league = (await getJSON(API + '/lookupleague.php?id=' + LEAGUE)).leagues[0];
  const season = league.strCurrentSeason;
  const old = await readData('football.json', null);
  const rounds = old && old.season === season ? {...old.rounds} : {};
  const soon = new Date(Date.now() + 7 * 86400e3).toISOString();

  let fetched = 0;
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const stored = rounds[r];
    // a stored round is fetched again only while it has unfinished matches that are due
    if (stored && !stored.some(m => !isFinished(m) && m.time <= soon)) continue;
    await sleep(fetched ? DELAY_MS : 0);
    const events = (await getJSON(API + '/eventsround.php?id=' + LEAGUE + '&r=' + r + '&s=' + season)).events;
    fetched++;
    if (!events?.length) {
      if (!stored) break;  // the first round that does not exist yet ends the season so far
      continue;
    }
    rounds[r] = events.map(e => toMatch(e)).sort((a, b) => a.time.localeCompare(b.time));
  }

  const numbers = Object.keys(rounds).map(Number);
  const lastRound = Math.max(0, ...numbers.filter(r => rounds[r].some(isFinished)));
  const nextRound = Math.min(...numbers.filter(r => rounds[r].some(m => !isFinished(m))), Infinity);

  const data = {
    season,
    lastRound: lastRound || null,
    nextRound: Number.isFinite(nextRound) ? nextRound : null,
    table: standings(rounds),
    rounds
  };
  const changed = await writeData('football.json', data);
  console.log('football', season, 'rounds', numbers.length, 'fetched', fetched, 'last', data.lastRound, 'next', data.nextRound,
    changed ? 'updated' : 'unchanged');
});
