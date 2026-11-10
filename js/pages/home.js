// Index (100) and the "page not found" screen.
import {put, mos, COLS, BLK, RED, GRN, YEL, BLU, MAG, CYN, WHT} from '../teletext.js';
import {title, fastext} from './common.js';

// [page, text, flashing NEW], null = empty row
const ENTRIES = [
  [160, 'Време: карта утре'],
  [161, 'Прогноза 5 дена'],
  [162, 'Загадување PM10'],
  [163, 'Колку погоди прогнозата', true],
  [164, 'Квиз за утре'],
  null,
  [200, 'Курсна листа НБРМ'],
  [250, 'Цени на горива'],
  null,
  [300, 'Фудбал: резултати'],
  [301, 'Табела, Прва лига'],
  [302, 'Распоред'],
  null,
  [500, 'Лото 7']
];

function rainbow(r) {
  const colors = [RED, YEL, GRN, CYN, BLU, MAG];
  for (let c = 0; c < COLS; c++) {
    mos(r, c, c % 2 ? 0b001111 : 0b111100, colors[Math.floor(c / 7) % 6]);
    mos(r + 1, c, c % 2 ? 0b111100 : 0b001111, colors[Math.floor(c / 7 + 1) % 6]);
  }
}

function p100() {
  title('ТЕЛЕТЕКСТ', YEL, BLU);
  put(1, 26, 'ИНДЕКС', WHT, BLU);
  ENTRIES.forEach((e, i) => {
    if (!e) return;
    const [n, text, isNew] = e, r = 5 + i;
    put(r, 2, String(n), YEL);
    put(r, 7, text, WHT);
    if (isNew) put(r, 33, 'НОВО', RED, BLK, {fl: true});
  });
  rainbow(20);
  put(23, 1, 'Внеси 3 цифри или притисни боја.', CYN);
  fastext();
}

export function notFound(n) {
  put(4, 1, 'СТРАНАТА ' + n + ' НЕ ПОСТОИ', RED, BLK, {dh: true});
  put(8, 1, 'Обиди се со:', WHT);
  [[100, 'Индекс'], ...ENTRIES.filter(Boolean)].forEach(([p, text], i) => {
    put(9 + i, 2, String(p), YEL);
    put(9 + i, 7, text, WHT);
  });
  fastext();
}

export const homePages = {
  100: {render: p100}
};
