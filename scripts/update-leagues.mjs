#!/usr/bin/env node
// Foreign leagues for pages 310/311: the last round and the next one, from TheSportsDB.
// Three requests per league: the latest finished match (gives season and round), that round, the next round.
// Team names stay in Latin, shortened, like on the HRT teletext.
import {getJSON, writeData, sleep, run, isMain} from './lib.mjs';
import {API, toMatch} from './update-football.mjs';

const DELAY_MS = 3000;  // the free key allows about 30 requests per minute

const LEAGUES = [
  {id: 4328, name: 'АНГЛИЈА'},
  {id: 4335, name: 'ШПАНИЈА'},
  {id: 4332, name: 'ИТАЛИЈА'},
  {id: 4331, name: 'ГЕРМАНИЈА'},
  {id: 4334, name: 'ФРАНЦИЈА'},
  {id: 4480, name: 'ЛИГА НА ШАМПИОНИ'}
];

// Known long names; everything else is cleaned up, and if still longer than 12 characters,
// only its first word is kept (Racing de Santander -> RACING, PSV Eindhoven -> PSV)
const SHORT = {
  'Manchester United': 'MAN UNITED', 'Manchester City': 'MAN CITY', 'Tottenham Hotspur': 'TOTTENHAM',
  'Newcastle United': 'NEWCASTLE', 'Nottingham Forest': "NOTT'M FOR.", 'Wolverhampton Wanderers': 'WOLVES',
  'Brighton and Hove Albion': 'BRIGHTON', 'West Ham United': 'WEST HAM', 'Crystal Palace': 'CR. PALACE',
  'Sheffield United': 'SHEFFIELD U', 'Leeds United': 'LEEDS', 'Coventry City': 'COVENTRY',
  'Atlético Madrid': 'ATLETICO', 'Athletic Bilbao': 'ATH. BILBAO', 'Deportivo Alavés': 'ALAVES',
  'Real Sociedad': 'R. SOCIEDAD', 'Rayo Vallecano': 'RAYO', 'Celta Vigo': 'CELTA',
  'Inter Milan': 'INTER', 'AC Milan': 'MILAN', 'Hellas Verona': 'VERONA',
  'Bayern Munich': 'BAYERN', 'Borussia Dortmund': 'DORTMUND', 'Borussia Mönchengladbach': "M'GLADBACH",
  'Bayer Leverkusen': 'LEVERKUSEN', 'Eintracht Frankfurt': 'FRANKFURT', 'RB Leipzig': 'LEIPZIG',
  'VfB Stuttgart': 'STUTTGART', 'VfL Wolfsburg': 'WOLFSBURG', 'Werder Bremen': 'WERDER',
  'TSG Hoffenheim': 'HOFFENHEIM', 'Union Berlin': 'UNION BERLIN', '1. FC Köln': 'KOLN',
  'Paris Saint-Germain': 'PSG', 'Olympique Marseille': 'MARSEILLE', 'Olympique Lyonnais': 'LYON',
  'Stade Rennais': 'RENNES', 'AS Monaco': 'MONACO'
};

export function shortName(name) {
  if (SHORT[name]) return SHORT[name];
  const clean = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // the font has no Latin accents
    .replace(/[Øø]/g, 'O').replace(/ß/g, 'SS').replace(/[Łł]/g, 'L')
    .replace(/^1\.\s*/, '')
    .replace(/\b(FC|AFC|CF|SC|AC|AS|SS|SSC|US|VfB|VfL|TSG)\b\.?/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
  return (clean.length <= 12 ? clean : clean.split(' ')[0]).slice(0, 12);
}

async function league({id, name}, first) {
  if (!first) await sleep(DELAY_MS);
  const last = (await getJSON(API + '/eventspastleague.php?id=' + id)).events?.[0];
  if (!last) throw new Error(name + ': no finished matches');
  const season = last.strSeason, lastRound = +last.intRound;

  const round = async r => {
    await sleep(DELAY_MS);
    const events = (await getJSON(API + '/eventsround.php?id=' + id + '&r=' + r + '&s=' + season)).events || [];
    return events.map(e => toMatch(e, shortName)).sort((a, b) => a.time.localeCompare(b.time));
  };
  const rounds = {[lastRound]: await round(lastRound)};
  const next = await round(lastRound + 1);
  if (next.length) rounds[lastRound + 1] = next;
  return {id, name, season, lastRound, nextRound: next.length ? lastRound + 1 : null, rounds};
}

if (isMain(import.meta.url)) run(async () => {
  const leagues = [];
  for (const [i, l] of LEAGUES.entries()) {
    try {
      leagues.push(await league(l, i === 0));
    } catch (err) {
      console.error(err.message);  // one failing league does not drop the others
    }
  }
  if (!leagues.length) throw new Error('no league could be fetched');
  const changed = await writeData('leagues.json', {leagues});
  console.log('leagues', leagues.map(l => l.name + ' ' + l.lastRound).join(', '), changed ? 'updated' : 'unchanged');
});
