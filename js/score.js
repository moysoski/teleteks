// Forecast scoring, shared by the update script (writes data/weather-results.json) and tests.
// A day is a "hit" for a city when min and max are within TOLERANCE and rain yes/no was right.

export const TOLERANCE = 2;   // °C
export const RAIN_MM = 1;     // daily precipitation at or above this counts as rain

export const rained = d => d.rain >= RAIN_MM;

export function isHit(f, a) {
  return Math.abs(f.min - a.min) <= TOLERANCE &&
    Math.abs(f.max - a.max) <= TOLERANCE &&
    rained(f) === rained(a);
}

export function score(history, cities) {
  const dates = Object.keys(history.days).sort().filter(d => history.days[d].forecast && history.days[d].actual);
  const table = {};
  for (const c of cities) table[c.id] = {id: c.id, played: 0, hits: 0, misses: 0, streak: 0, best: 0, hottest: 0, coldest: 0};

  let total = 0, hits = 0, hotRecord = null, coldRecord = null, last = null;

  for (const date of dates) {
    const {forecast, actual} = history.days[date];
    let hot = null, cold = null;
    const rows = [];
    for (const c of cities) {
      const f = forecast[c.id], a = actual[c.id];
      if (!f || !a) continue;
      const s = table[c.id], hit = isHit(f, a);
      s.played++;
      total++;
      if (hit) {
        s.hits++;
        hits++;
        s.streak++;
        s.best = Math.max(s.best, s.streak);
      } else {
        s.misses++;
        s.streak = 0;
      }
      rows.push({id: c.id, forecast: f, actual: a, hit});
      if (!hot || a.max > actual[hot].max) hot = c.id;
      if (!cold || a.min < actual[cold].min) cold = c.id;
      if (!hotRecord || a.max > hotRecord.temp) hotRecord = {id: c.id, temp: a.max, date};
      if (!coldRecord || a.min < coldRecord.temp) coldRecord = {id: c.id, temp: a.min, date};
    }
    if (hot) table[hot].hottest++;
    if (cold) table[cold].coldest++;
    if (rows.length) last = {date, rows, hits: rows.filter(r => r.hit).length};
  }

  return {
    updated: new Date().toISOString(),
    from: dates[0] || null,
    days: dates.length,
    total,
    hits,
    cities: Object.values(table),
    last,
    hotRecord,
    coldRecord
  };
}
