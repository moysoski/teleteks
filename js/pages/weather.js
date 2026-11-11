// Weather section, pages 160-165.
import {put, putR, mos, rowBg, BLK, RED, GRN, YEL, BLU, MAG, CYN, WHT} from '../teletext.js';
import {CITIES, TZ, cityById} from '../cities.js';
import {weather, describe, windDir, skopjeNow} from '../weather.js';
import {sunTimes, moonPhase} from '../astro.js';
import {data, status} from '../data.js';
import {rained} from '../score.js';
import {title, subCounter, fastext, FAST_WEATHER, ready, tempColor, minMax, DAYS, shortDate, weekday} from './common.js';

/* ---------- mosaic icons (6x6 pixels = 3 cells x 2 rows) ---------- */
const ICONS = {
  sun:    {t: ['..##..', '.####.', '######'], tc: YEL, b: ['######', '.####.', '..##..'], bc: YEL},
  cloud:  {t: ['......', '..##..', '.####.'], tc: WHT, b: ['######', '######', '......'], bc: WHT},
  pcloud: {t: ['.##...', '####..', '##.##.'], tc: YEL, b: ['.#####', '######', '......'], bc: WHT},
  rain:   {t: ['.###..', '######', '######'], tc: WHT, b: ['#.#.#.', '.#.#.#', '#.#.#.'], bc: CYN},
  snow:   {t: ['.###..', '######', '######'], tc: WHT, b: ['#..#..', '..#..#', '.#..#.'], bc: WHT},
  storm:  {t: ['.###..', '######', '######'], tc: WHT, b: ['..##..', '.##...', '..##..'], bc: YEL},
  fog:    {t: ['######', '......', '######'], tc: WHT, b: ['......', '######', '......'], bc: WHT}
};

function bitsFrom(rows, cc) {
  let b = 0;
  for (let i = 0; i < 6; i++) if (rows[i >> 1][cc * 2 + (i & 1)] === '#') b |= 1 << i;
  return b;
}

function icon(r, c, name) {
  const ic = ICONS[name];
  for (let cc = 0; cc < 3; cc++) {
    mos(r, c + cc, bitsFrom(ic.t, cc), ic.tc);
    mos(r + 1, c + cc, bitsFrom(ic.b, cc), ic.bc);
  }
}

/* ---------- mosaic map of Macedonia ---------- */
const LON0 = 20.40, LON1 = 23.10, LAT0 = 40.80, LAT1 = 42.42, MAP_W = 60, MAP_H = 48, MAP_COL = 1, MAP_ROW = 3;
const BORDER = [[20.57,41.75],[20.62,41.95],[20.75,42.08],[20.80,42.22],[21.10,42.22],[21.30,42.15],[21.45,42.27],[21.70,42.32],[21.95,42.33],[22.25,42.38],[22.35,42.31],[22.55,42.20],[22.80,42.05],[22.88,41.90],[23.02,41.72],[22.95,41.55],[22.95,41.34],[22.75,41.32],[22.60,41.12],[22.25,41.15],[21.95,41.10],[21.75,40.95],[21.40,40.88],[21.08,40.86],[20.98,40.86],[20.75,40.90],[20.73,41.05],[20.70,41.16],[20.55,41.20],[20.50,41.40],[20.55,41.58],[20.47,41.65]];
const LAKES = [
  [[20.70,41.17],[20.80,41.15],[20.82,41.02],[20.78,40.92],[20.70,40.93],[20.66,41.05]], // Ohrid
  [[20.98,41.00],[21.06,40.98],[21.08,40.88],[20.98,40.86]]                               // Prespa
];

function inPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const MAP = [];
for (let cr = 0; cr < MAP_H / 3; cr++) {
  const row = [];
  for (let cc = 0; cc < MAP_W / 2; cc++) {
    let land = 0, lake = 0, lakePixels = 0;
    for (let i = 0; i < 6; i++) {
      const px = cc * 2 + (i & 1), py = cr * 3 + (i >> 1);
      const lon = LON0 + (px + 0.5) / MAP_W * (LON1 - LON0), lat = LAT1 - (py + 0.5) / MAP_H * (LAT1 - LAT0);
      if (!inPoly(lon, lat, BORDER)) continue;
      if (LAKES.some(l => inPoly(lon, lat, l))) { lake |= 1 << i; lakePixels++; } else land |= 1 << i;
    }
    row.push(lakePixels >= 2 ? {bits: lake, fg: BLU} : {bits: land, fg: GRN});
  }
  MAP.push(row);
}

function mapCell(c) {
  const px = (c.lon - LON0) / (LON1 - LON0) * MAP_W, py = (LAT1 - c.lat) / (LAT1 - LAT0) * MAP_H;
  return [MAP_ROW + Math.floor(py / 3), MAP_COL + Math.floor(px / 2) - 1];
}

/* ---------- 160 map, tomorrow ---------- */
function warning(days) {
  const coldest = days.reduce((a, b) => b.min < a.min ? b : a);
  const hottest = days.reduce((a, b) => b.max > a.max ? b : a);
  const wettest = days.reduce((a, b) => b.rain > a.rain ? b : a);
  if (coldest.min <= 0) return ['МРАЗ: ' + coldest.name + ' ДО ' + coldest.min + '°', WHT, RED, true];
  if (hottest.max >= 35) return ['ЖЕШТИНИ: ' + hottest.name + ' ДО ' + hottest.max + '°', YEL, RED, true];
  if (wettest.rain >= 10) return ['ПОВЕЌЕ ВРНЕЖИ: ' + wettest.name, WHT, BLU, false];
  return ['БЕЗ ПРЕДУПРЕДУВАЊА', BLK, GRN, false];
}

// Newsflash text for tomorrow's frost or heat, or null; shown as a box over any page (see app.js)
export function newsflash() {
  if (!weather.forecast) return null;
  const [text, , , urgent] = warning(weather.forecast.map(c => ({...c, ...c.days[1]})));
  return urgent ? text : null;
}

function p160() {
  title('ВРЕМЕТО УТРЕ', YEL, BLU, {line: false});
  put(1, 30, 'макс °C', WHT, BLU);
  if (!ready(weather.forecastStatus, weather.forecast)) return fastext(FAST_WEATHER);

  const days = weather.forecast.map(c => ({...c, ...c.days[1]}));
  put(2, 30, DAYS[weekday(days[0].date)].slice(0, 3) + ' ' + shortDate(days[0].date), WHT, BLU);

  for (let r = 0; r < MAP.length; r++) {
    for (let c = 0; c < MAP[r].length; c++) {
      const m = MAP[r][c];
      if (m.bits) mos(MAP_ROW + r, MAP_COL + c, m.bits, m.fg);
    }
  }
  for (const d of days) {
    const [row, col] = mapCell(d);
    put(row, col, d.code, WHT);
    put(row, col + 2, String(d.max), tempColor(d.max));
  }
  put(5, 33, 'под 0', CYN);
  put(7, 33, '0-9', WHT);
  put(9, 33, '10-19', YEL);
  put(11, 33, '20+', RED);

  days.forEach((d, i) => {
    const r = 19 + (i >> 1), c = (i & 1) ? 21 : 1;
    put(r, c, d.name, WHT);
    minMax(r, c + 9, d.min, d.max, false);
  });

  const [text, fg, bg, flash] = warning(days);
  rowBg(23, bg);
  put(23, 1, text, fg, bg, {fl: flash});
  fastext(FAST_WEATHER);
}

/* ---------- 161 five days, one subpage per city ---------- */
function p161(sub) {
  title('ПРОГНОЗА 5 ДЕНА');
  subCounter(sub, CITIES.length);
  if (!ready(weather.forecastStatus, weather.forecast)) return fastext(FAST_WEATHER);

  const city = weather.forecast[sub];
  put(4, 1, city.name, CYN, BLK, {dh: true});
  city.days.forEach((d, i) => {
    const r = 7 + i * 3;
    const [ic, text] = describe(d.wmo);
    icon(r, 1, ic);
    put(r, 6, i === 0 ? 'ДЕНЕС' : i === 1 ? 'УТРЕ' : DAYS[weekday(d.date)], YEL);
    if (d.rainChance >= 20) put(r, 18, d.rainChance + '%', CYN);
    put(r + 1, 6, text, WHT);
    minMax(r, 27, d.min, d.max);
    put(r + 1, 27, 'ВЕТЕР ' + windDir(d.windDir) + ' ' + d.wind, GRN);
  });
  put(22, 1, '% веројатност за врнежи', MAG);
  put(23, 1, 'ветер во km/h', MAG);
  fastext(FAST_WEATHER);
}

/* ---------- 162 PM10 ---------- */
function p162() {
  title('ВОЗДУХ  PM10', WHT, MAG);
  put(4, 1, 'Модел CAMS, просек 24 ч, µg/m³', CYN);
  if (!ready(weather.airStatus, weather.air)) return fastext(FAST_WEATHER);

  weather.air.forEach((p, i) => {
    const r = 6 + i * 2, v = p.pm10, col = v <= 50 ? GRN : v <= 100 ? YEL : RED;
    put(r, 1, p.name, WHT);
    const px = Math.min(50, Math.round(v / 2.5)); // half-cell steps, clamped to fit the row
    let c = 10;
    for (let k = 0; k < px >> 1; k++) mos(r, c++, 63, col);
    if (px & 1) mos(r, c++, 21, col);
    put(r, c + 1, String(v), col);
  });
  mos(22, 1, 63, GRN); put(22, 3, 'до 50', WHT);
  mos(22, 11, 63, YEL); put(22, 13, '51-100', WHT);
  mos(22, 22, 63, RED); put(22, 24, 'над 100', WHT);
  put(23, 1, 'Дневна граница во ЕУ: 50', MAG);
  fastext(FAST_WEATHER);
}

/* ---------- 163 results, football-table style ---------- */
const RESULT_SUBS = ['ТАБЕЛА НА ПОГОДОЦИ', 'НАЈТОПЛО И НАЈСТУДЕНО', 'СЕРИИ НА ТОЧНИ ДЕНОВИ'];
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;

function cityRows(list, columns) {
  list.forEach((s, i) => {
    const r = 6 + i;
    putR(r, 2, (i + 1) + '.', WHT);
    put(r, 4, cityById(s.id).name, WHT);
    for (const [end, value, fg] of columns(s)) putR(r, end, value, fg);
  });
}

function resultsTable(res) {
  put(5, 4, 'ГРАД', YEL);
  putR(5, 16, 'ИГ', YEL); putR(5, 20, 'П', YEL); putR(5, 24, 'ПР', YEL); putR(5, 29, '%', YEL); putR(5, 34, 'СЕР', YEL);
  const list = [...res.cities].sort((a, b) => b.hits - a.hits || pct(b.hits, b.played) - pct(a.hits, a.played));
  cityRows(list, s => [[16, s.played, GRN], [20, s.hits, GRN], [24, s.misses, GRN], [29, pct(s.hits, s.played), CYN], [34, s.streak, YEL]]);

  const last = res.last;
  if (!last) return;
  put(4, 33, 'Д=ДОЖД', MAG);
  put(15, 1, 'ВЧЕРА ' + shortDate(last.date), YEL);
  put(15, 13, 'ПРОГ.', YEL);
  put(15, 23, 'ИЗМЕР.', YEL);
  put(15, 34, last.hits + '/' + last.rows.length, YEL);
  last.rows.forEach((x, i) => {
    const r = 16 + i, round = d => ({min: Math.round(d.min), max: Math.round(d.max)});
    const f = round(x.forecast), a = round(x.actual);
    put(r, 1, cityById(x.id).code, WHT);
    minMax(r, 13, f.min, f.max);
    put(r, 21, rained(x.forecast) ? 'Д' : '-', CYN);
    minMax(r, 23, a.min, a.max);
    put(r, 31, rained(x.actual) ? 'Д' : '-', CYN);
    put(r, 33, x.hit ? 'ПОГОДОК' : 'ПРОМАШ', x.hit ? GRN : RED);
  });
}

function record(r, label, rec, fg) {
  if (!rec) return;
  put(r, 1, label, WHT);
  put(r, 13, cityById(rec.id).name, fg);
  put(r, 23, Math.round(rec.temp) + '°', tempColor(rec.temp));
  put(r, 30, shortDate(rec.date), WHT);
}

function resultsExtremes(res) {
  put(5, 4, 'ГРАД', YEL);
  putR(5, 26, 'НАЈТОПЛ.', RED);
  putR(5, 36, 'НАЈСТУД.', CYN);
  const list = [...res.cities].sort((a, b) => b.hottest - a.hottest || a.coldest - b.coldest);
  cityRows(list, s => [[26, s.hottest, RED], [36, s.coldest, CYN]]);
  put(16, 1, 'РЕКОРДИ', YEL);
  record(18, 'НАЈТОПЛО', res.hotRecord, RED);
  record(20, 'НАЈСТУДЕНО', res.coldRecord, CYN);
  put(22, 1, res.days + ' ДЕНА ОД ' + shortDate(res.from), MAG);
}

function resultsStreaks(res) {
  put(5, 4, 'ГРАД', YEL);
  putR(5, 26, 'СЕГА', YEL);
  putR(5, 36, 'НАЈДОЛГА', YEL);
  const list = [...res.cities].sort((a, b) => b.best - a.best || b.streak - a.streak);
  cityRows(list, s => [[26, s.streak, GRN], [36, s.best, GRN]]);
  put(16, 1, 'ВКУПНО', YEL);
  put(18, 1, res.hits + '/' + res.total + ' ПОГОДОЦИ', WHT);
  put(18, 30, pct(res.hits, res.total) + '%', CYN);
  put(20, 1, 'Серија = точни денови по ред.', MAG);
  put(22, 1, 'Погодок: ±2°C и точен дожд.', MAG);
}

function p163(sub) {
  title('РЕЗУЛТАТИ');
  subCounter(sub, RESULT_SUBS.length);
  const res = data.weatherResults;
  if (!ready(status.weatherResults, res)) return fastext(FAST_WEATHER);
  if (!res.days) {
    put(6, 1, 'СЕЗОНАТА ПОЧНУВА', YEL, BLK, {dh: true});
    put(10, 1, 'Секоја вечер ја зачувуваме', WHT);
    put(11, 1, 'прогнозата за утре.', WHT);
    put(13, 1, 'Првите резултати по првиот', WHT);
    put(14, 1, 'изминат ден.', WHT);
    return fastext(FAST_WEATHER);
  }
  put(4, 1, RESULT_SUBS[sub], CYN);
  [resultsTable, resultsExtremes, resultsStreaks][sub](res);
  fastext(FAST_WEATHER);
}

/* ---------- 164 quiz, answer hidden until REVEAL ---------- */
function p164() {
  title('КВИЗ', YEL, MAG);
  if (!ready(weather.forecastStatus, weather.forecast)) return fastext(FAST_WEATHER);

  const tomorrow = weather.forecast[0].days[1].date;
  const seed = [...tomorrow].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);
  const city = weather.forecast[Math.abs(seed) % CITIES.length];
  const [today, next] = city.days;

  put(5, 1, 'ПОГОДИ ЈА УТРЕШНАТА', WHT);
  put(6, 1, 'МИНИМАЛНА ТЕМПЕРАТУРА ВО', WHT);
  put(8, 1, city.name, CYN, BLK, {dh: true});
  put(11, 1, 'Денес:', YEL);
  minMax(11, 9, today.min, today.max);
  put(12, 1, 'Утре:', YEL);
  put(12, 9, describe(next.wmo)[1], WHT);

  put(15, 1, 'ОДГОВОР:', WHT);
  put(15, 11, next.min + '°', tempColor(next.min), BLK, {dh: true, cn: true});

  put(19, 1, 'Притисни ? (ОТКРИЈ)', GRN);
  put(20, 1, 'на далечинскиот.', GRN);
  fastext(FAST_WEATHER);
}

/* ---------- 165 sun and moon, computed locally ---------- */
const clockFormat = new Intl.DateTimeFormat('en-GB', {timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
const hhmm = d => clockFormat.format(d);
const duration = ms => Math.floor(ms / 3600e3) + ':' + String(Math.round(ms / 60e3) % 60).padStart(2, '0');
const dayMonth = d => new Intl.DateTimeFormat('en-GB', {timeZone: TZ, day: '2-digit', month: '2-digit'}).format(d).replace('/', '.');

// Mosaic moon: lit part in yellow, the dark part in blue, on a disc of radius R sextant pixels centred on (px, py).
// A cell has one colour, so a cell with any lit pixel shows only its lit pixels.
function moon(px, py, R, fraction) {
  const k = Math.cos(2 * Math.PI * fraction), waxing = fraction < 0.5;
  for (let r = Math.floor((py - R) / 3); r <= Math.floor((py + R) / 3); r++) {
    for (let c = Math.floor((px - R) / 2); c <= Math.floor((px + R) / 2); c++) {
      let lit = 0, dark = 0;
      for (let i = 0; i < 6; i++) {
        const nx = (c * 2 + (i & 1) + 0.5 - px) / R, ny = (r * 3 + (i >> 1) + 0.5 - py) / R;
        if (nx * nx + ny * ny > 1) continue;
        const edge = k * Math.sqrt(1 - ny * ny);
        if (waxing ? nx > edge : nx < -edge) lit |= 1 << i;  // the right side grows first (northern sky)
        else dark |= 1 << i;
      }
      if (lit) mos(r, c, lit, YEL);
      else if (dark) mos(r, c, dark, BLU);
    }
  }
}

function p165() {
  title('СОНЦЕ И МЕСЕЧИНА');
  const today = skopjeNow().date;
  put(4, 1, DAYS[weekday(today)] + ' ' + shortDate(today), CYN);
  put(5, 1, 'ГРАД', YEL);
  putR(5, 18, 'ИЗГРЕВ', YEL);
  putR(5, 27, 'ЗАЈДИС.', YEL);
  putR(5, 36, 'ДЕН', YEL);
  CITIES.forEach((c, i) => {
    const r = 6 + i, t = sunTimes(today, c.lat, c.lon);
    put(r, 1, c.name, WHT);
    putR(r, 18, hhmm(t.rise), YEL);
    putR(r, 27, hhmm(t.set), RED);
    putR(r, 36, duration(t.set - t.rise), GRN);
  });

  const m = moonPhase();
  moon(12, 57, 10, m.fraction);
  put(15, 14, 'МЕСЕЧИНА', YEL);
  put(17, 14, m.name, WHT);
  put(19, 14, 'Осветлена: ' + Math.round(m.lit * 100) + '%', CYN);
  put(20, 14, 'Полна: ' + dayMonth(m.nextFull), WHT);
  put(21, 14, 'Млада: ' + dayMonth(m.nextNew), WHT);
  put(23, 1, 'Пресметано, без надворешен извор.', MAG);
  fastext(FAST_WEATHER);
}

export const weatherPages = {
  160: {render: p160},
  161: {render: p161, subpages: () => CITIES.length},
  162: {render: p162},
  163: {render: p163, subpages: () => data.weatherResults?.days ? RESULT_SUBS.length : 1},
  164: {render: p164},
  165: {render: p165}
};
