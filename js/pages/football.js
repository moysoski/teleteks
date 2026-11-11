// Football section (not live): 300 results, 301 table, 302 fixtures of the Macedonian First League;
// 310 results and 311 fixtures of foreign leagues, one rotating subpage per league.
import {put, putR, BLK, RED, GRN, YEL, MAG, CYN, WHT} from '../teletext.js';
import {TZ} from '../cities.js';
import {data, status} from '../data.js';
import {isFinished, isPostponed} from '../match-status.js';
import {title, subCounter, fastext, FAST_FOOTBALL, ready, DAYS} from './common.js';

const NEW_RESULT_HOURS = 6;
const FIXTURE_ROUNDS = 3;

const localFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

// UTC ISO time -> {date: '20.11', time: '13:00', day: 'ПЕТ'} in Skopje time
function local(iso) {
  const d = new Date(iso), p = Object.fromEntries(localFormat.formatToParts(d).map(x => [x.type, x.value]));
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return {date: p.day + '.' + p.month, time: p.hour + ':' + p.minute, day: DAYS[dayIndex].slice(0, 3)};
}

function header() {
  title('ФУДБАЛ', BLK, GRN);
}

// One line: date, home - away, score or kick-off time
function matchLine(r, m) {
  const t = local(m.time);
  put(r, 1, t.date, WHT);
  put(r, 7, m.home, YEL);
  put(r, 19, '-', WHT);
  put(r, 20, m.away, YEL);
  if (isFinished(m)) {
    // a fresh result flashes, like the teletext "ја затвори" moment
    const fresh = Date.now() - new Date(m.time).getTime() < NEW_RESULT_HOURS * 3600e3;
    putR(r, 38, m.hs + ':' + m.as, CYN, BLK, {fl: fresh});
  } else if (isPostponed(m)) {
    putR(r, 38, 'ОДЛ.', RED);
  } else {
    putR(r, 38, t.time, WHT);
  }
}

/* ---------- 300 last round and the next one ---------- */
function p300() {
  header();
  const f = data.football;
  if (!ready(status.football, f)) return fastext(FAST_FOOTBALL);

  if (f.lastRound) {
    put(4, 1, 'ПРВА ЛИГА, ' + f.lastRound + '. КОЛО', CYN);
    f.rounds[f.lastRound].slice(0, 7).forEach((m, i) => matchLine(6 + i, m));
  }
  if (f.nextRound && f.nextRound !== f.lastRound) {
    put(14, 1, 'СЛЕДНО: ' + f.nextRound + '. КОЛО', CYN);
    f.rounds[f.nextRound].slice(0, 7).forEach((m, i) => matchLine(16 + i, m));
  }
  fastext(FAST_FOOTBALL);
}

/* ---------- 301 table, 2 subpages: table and form ---------- */
function p301(sub) {
  header();
  subCounter(sub, 2, GRN, BLK);
  const f = data.football;
  if (!ready(status.football, f)) return fastext(FAST_FOOTBALL);

  put(4, 1, sub ? 'ФОРМА, ПОСЛЕДНИ 5' : 'ТАБЕЛА, ПРВА ЛИГА', CYN);
  putR(4, 39, f.season.replace('-', '/'), WHT);
  put(5, 4, 'КЛУБ', YEL);
  if (sub) {
    putR(5, 38, 'Б', YEL);
  } else {
    putR(5, 18, 'О', YEL); putR(5, 21, 'П', YEL); putR(5, 24, 'Н', YEL); putR(5, 27, 'И', YEL);
    putR(5, 34, 'ГОЛОВИ', YEL); putR(5, 38, 'Б', YEL);
  }

  f.table.slice(0, 16).forEach((t, i) => {
    const r = 6 + i;
    putR(r, 2, (i + 1) + '.', WHT);
    put(r, 4, t.team, WHT);
    if (sub) {
      [...t.form].forEach((x, k) => put(r, 20 + k * 2, x, x === 'П' ? GRN : x === 'Н' ? YEL : RED));
    } else {
      putR(r, 18, t.played, GRN); putR(r, 21, t.won, GRN); putR(r, 24, t.drawn, GRN); putR(r, 27, t.lost, GRN);
      putR(r, 34, t.gf + ':' + t.ga, GRN);
    }
    putR(r, 38, t.points, YEL);
  });

  if (sub) put(22, 1, 'П победа  Н нерешено  И пораз', MAG);
  else put(22, 1, 'О одиграни П победи Н нерешени И порази', MAG);
  put(23, 1, 'Ред: бодови, гол-разлика, голови.', MAG);
  fastext(FAST_FOOTBALL);
}

/* ---------- 302 fixtures, one subpage per upcoming round ---------- */
function upcoming(f) {
  if (!f?.nextRound) return [];
  return Object.keys(f.rounds).map(Number).filter(r => r >= f.nextRound).sort((a, b) => a - b).slice(0, FIXTURE_ROUNDS);
}

function p302(sub) {
  header();
  const f = data.football;
  if (!ready(status.football, f)) return fastext(FAST_FOOTBALL);
  const list = upcoming(f);
  subCounter(sub, list.length, GRN, BLK);
  if (!list.length) {
    put(6, 1, 'НЕМА ЗАКАЖАНИ НАТПРЕВАРИ', YEL);
    return fastext(FAST_FOOTBALL);
  }

  const round = list[sub];
  put(4, 1, 'РАСПОРЕД, ' + round + '. КОЛО', CYN);
  f.rounds[round].slice(0, 6).forEach((m, i) => {
    const r = 6 + i * 3, t = local(m.time);
    put(r, 1, t.day + ' ' + t.date, WHT);
    put(r, 11, isPostponed(m) ? 'ОДЛОЖЕН' : isFinished(m) ? m.hs + ':' + m.as : t.time, CYN);
    put(r + 1, 3, m.home + ' - ' + m.away, YEL);
  });
  fastext(FAST_FOOTBALL);
}

/* ---------- 310 / 311 foreign leagues: each league (or part of a long round) is a subpage ---------- */
// Many subpages on a 10-second carousel: you wait for your match, and it is gone before you finish reading
const MATCHES_PER_SUBPAGE = 10;

function leagueSubpages(which) {
  const out = [];
  for (const league of data.leagues?.leagues || []) {
    const round = which === 'last' ? league.lastRound : league.nextRound;
    const matches = round ? league.rounds[round] || [] : [];
    for (let i = 0; i < matches.length; i += MATCHES_PER_SUBPAGE) {
      out.push({league, round, matches: matches.slice(i, i + MATCHES_PER_SUBPAGE)});
    }
  }
  return out;
}

function foreign(sub, which) {
  header();
  if (!ready(status.leagues, data.leagues)) return fastext(FAST_FOOTBALL);
  const subs = leagueSubpages(which);
  subCounter(sub, subs.length, GRN, BLK);
  if (!subs.length) {
    put(6, 1, 'НЕМА НАТПРЕВАРИ', YEL);
    return fastext(FAST_FOOTBALL);
  }
  const s = subs[sub];
  put(4, 1, s.league.name, CYN);
  putR(4, 39, (which === 'next' ? 'СЛЕДНО ' : '') + s.round + '. КОЛО', WHT);
  s.matches.forEach((m, i) => matchLine(6 + i, m));
  put(22, 1, which === 'last' ? 'Распоред: страница 311' : 'Резултати: страница 310', MAG);
  put(23, 1, 'Подстраниците се менуваат сами.', MAG);
  fastext(FAST_FOOTBALL);
}

export const footballPages = {
  300: {render: p300},
  301: {render: p301, subpages: () => 2},
  302: {render: p302, subpages: () => Math.max(1, upcoming(data.football).length)},
  310: {render: sub => foreign(sub, 'last'), subpages: () => Math.max(1, leagueSubpages('last').length)},
  311: {render: sub => foreign(sub, 'next'), subpages: () => Math.max(1, leagueSubpages('next').length)}
};
