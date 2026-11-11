// Helpers shared by the data update scripts.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {TZ} from '../js/cities.js';

const DATA = new URL('../data/', import.meta.url);
const USER_AGENT = 'teletekst-data-bot (static teletext site, one request per run)';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// Today's date in Skopje as YYYY-MM-DD, and the current hour there (0-23)
export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: TZ}).format(new Date());
export const skopjeHour = () => +new Intl.DateTimeFormat('en-GB', {timeZone: TZ, hour: '2-digit', hourCycle: 'h23'}).format(new Date());

// 'YYYY-MM-DD' plus n days
export const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);

async function get(url, parse, tries = 4) {
  for (let i = 1; ; i++) {
    let wait = 5000 * i;
    try {
      const res = await fetch(url, {headers: {'User-Agent': USER_AGENT}});
      if (res.status === 429) wait = 30000 * i;  // rate limited: back off longer
      if (!res.ok) throw new Error(res.status + ' ' + url);
      return await parse(res);
    } catch (err) {
      if (i >= tries) throw err;
      await sleep(wait);
    }
  }
}

export const getJSON = url => get(url, r => r.json());
export const getText = url => get(url, r => r.text());

export async function readData(name, fallback) {
  try {
    return JSON.parse(await readFile(new URL(name, DATA), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// Writes data/<name> only when something other than `updated` changed, so runs without news make no commit.
// pretty: one value per line (readable diffs); off for large machine-only files.
export async function writeData(name, obj, {pretty = true} = {}) {
  const old = await readData(name, null);
  const strip = o => JSON.stringify({...o, updated: null});
  if (old && strip(old) === strip(obj)) return false;
  await mkdir(DATA, {recursive: true});
  await writeFile(new URL(name, DATA), JSON.stringify({...obj, updated: new Date().toISOString()}, null, pretty ? 1 : 0) + '\n');
  return true;
}

// HTML helpers for the scraped sources (no dependencies)
export const stripTags = html => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// True when the file is run directly (node scripts/x.mjs), false when it is imported
export const isMain = url => process.argv[1] && url === pathToFileURL(process.argv[1]).href;

export function run(main) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
