// Building blocks shared by all pages.
import {put, mos, rowBg, COLS, BLK, RED, GRN, YEL, BLU, CYN, WHT} from '../teletext.js';

// Section title: double height on a coloured band (rows 1-2), thin red mosaic line under it (row 3)
export function title(text, fg = YEL, bg = BLU, {line = true} = {}) {
  rowBg(1, bg);
  rowBg(2, bg);
  put(1, 1, text, fg, bg, {dh: true});
  if (line) for (let c = 0; c < COLS; c++) mos(3, c, 0b000011, RED);
}

// Subpage counter in the title band, e.g. "2/3"
export function subCounter(sub, count, bg = BLU, fg = WHT) {
  if (count > 1) put(1, 36, (sub + 1) + '/' + count, fg, bg);
}

/* ---------- Fastext: four coloured links on row 24, different per section ---------- */
export const FAST_WEATHER = [['КАРТА', 160], ['5 ДЕНА', 161], ['ВОЗДУХ', 162], ['ИНДЕКС', 100]];
export const FAST_FOOTBALL = [['РЕЗУЛТАТИ', 300], ['ТАБЕЛА', 301], ['РАСПОРЕД', 302], ['ИНДЕКС', 100]];
export const FAST_DEFAULT = [['ВРЕМЕ', 160], ['КУРС', 200], ['ФУДБАЛ', 300], ['ИНДЕКС', 100]];

// The remote's colour buttons follow whatever the current page drew
export let fastLinks = FAST_DEFAULT;

export function fastext(links = FAST_DEFAULT) {
  fastLinks = links;
  [RED, GRN, YEL, CYN].forEach((fg, i) => put(24, 1 + i * 10, links[i][0], fg));
}

/* ---------- newsflash: an urgent box over whatever page is shown ---------- */
export function newsflashBox(text, page) {
  for (let r = 17; r <= 21; r++) put(r, 1, ' '.repeat(38), WHT, RED);
  put(17, 2, 'ВОНРЕДНО', YEL, RED, {fl: true});
  put(18, 2, text, WHT, RED, {dh: true});
  put(20, 2, 'Детали на страница ' + page, YEL, RED);
}

/* ---------- loading states ---------- */
export function loading(row = 8) {
  put(row, 1, 'ВЧИТУВАЊЕ...', WHT, BLK, {fl: true});
}

export function failed(row = 8) {
  put(row, 1, 'НЕМА ВРСКА СО ИЗВОРОТ', RED, BLK, {dh: true});
  put(row + 3, 1, 'Обиди се повторно подоцна.', WHT);
}

// Shows a loading/error message and returns false while the data is not usable
export function ready(status, value) {
  if (value) return true;
  if (status === 'error') failed(); else loading();
  return false;
}

/* ---------- formatting ---------- */
export const tempColor = t => t <= 0 ? CYN : t < 10 ? WHT : t < 20 ? YEL : RED;

// "-2°/12°" coloured by temperature, starting at column c; returns the end column
export function minMax(r, c, min, max, deg = true) {
  const a = min + (deg ? '°' : ''), b = max + (deg ? '°' : '');
  put(r, c, a, tempColor(min));
  put(r, c + a.length, '/', WHT);
  put(r, c + a.length + 1, b, tempColor(max));
  return c + a.length + 1 + b.length;
}

export const DAYS = ['НЕДЕЛА', 'ПОНЕДЕЛНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВРТОК', 'ПЕТОК', 'САБОТА'];

// '2026-11-10' -> '10.11'
export const shortDate = iso => iso.slice(8, 10) + '.' + iso.slice(5, 7);

// Weekday of an ISO date, independent of the viewer's time zone
export const weekday = iso => new Date(iso.slice(0, 10) + 'T12:00:00Z').getUTCDay();

// Number with a fixed count of decimals and a comma, Macedonian style: 61,4953
export const decimal = (n, digits) => n.toFixed(digits).replace('.', ',');

// 25774000 -> '25.774.000'
export const thousands = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
