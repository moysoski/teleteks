// JSON files written by the GitHub Actions scripts (data/*.json).
const FILES = {
  weatherResults: 'data/weather-results.json',
  rates: 'data/rates.json',
  football: 'data/football.json',
  leagues: 'data/leagues.json',
  lotto: 'data/lotto.json'
};

export const data = {};
export const status = Object.fromEntries(Object.keys(FILES).map(k => [k, 'loading']));

async function load(key) {
  try {
    const res = await fetch(FILES[key], {cache: 'no-cache'});
    if (!res.ok) throw new Error(res.status + ' ' + FILES[key]);
    data[key] = await res.json();
    status[key] = 'ok';
  } catch (err) {
    console.warn(err);
    // keep showing older data if a refresh fails
    if (status[key] !== 'ok') status[key] = 'error';
  }
}

export function loadData(onChange) {
  return Promise.all(Object.keys(FILES).map(k => load(k).then(onChange)));
}
