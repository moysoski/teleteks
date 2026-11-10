// 500 Lotto 7 (State Lottery) and 888 subtitles (an easter egg, not listed in the index).
import {put, putR, mos, COLS, BLK, RED, GRN, YEL, BLU, MAG, CYN, WHT} from '../teletext.js';
import {data, status} from '../data.js';
import {title, fastext, ready, shortDate, thousands, DAYS, weekday} from './common.js';

function p500() {
  title('ЛОТО 7', YEL, MAG);
  const d = data.lotto;
  if (!ready(status.lotto, d)) return fastext();

  put(4, 1, d.round + '. КОЛО', CYN);
  putR(4, 39, DAYS[weekday(d.date)] + ' ' + shortDate(d.date) + '.' + d.date.slice(0, 4), WHT);

  put(6, 1, 'ИЗВЛЕЧЕНИ БРОЕВИ', WHT);
  d.numbers.forEach((n, i) => {
    put(8, 1 + i * 5, ' ' + String(n).padStart(2, ' ') + ' ', YEL, BLU, {dh: true});
  });

  put(12, 1, 'ЏОКЕР', WHT);
  [...d.joker].forEach((digit, i) => put(14, 1 + i * 4, ' ' + digit + ' ', WHT, RED, {dh: true}));

  if (d.jackpot) {
    put(18, 1, 'ОЧЕКУВАН ФОНД ЗА 7 ПОГОДОЦИ', WHT);
    put(19, 1, thousands(d.jackpot) + ' ДЕН', YEL, BLK, {dh: true});
  }
  put(22, 1, 'Извор: loto.mk. Тикетот провери го', MAG);
  put(23, 1, 'кај Државната лотарија. Само 18+.', MAG);
  fastext();
}

// Mosaic "TV picture" behind the subtitles: sky, sun and hills, in sextant pixels (80x69)
function picture() {
  const hill = x => 40 + Math.round(5 * Math.sin(x / 9) + 3 * Math.sin(x / 4 + 1));
  const sun = (x, y) => (x - 58) ** 2 + ((y - 14) * 1.3) ** 2 < 49;
  for (let r = 1; r < 24; r++) {
    for (let c = 0; c < COLS; c++) {
      let land = 0, sunBits = 0;
      for (let i = 0; i < 6; i++) {
        const x = c * 2 + (i & 1), y = r * 3 + (i >> 1);
        if (y >= hill(x)) land |= 1 << i;
        else if (sun(x, y)) sunBits |= 1 << i;
      }
      mos(r, c, land || sunBits, land ? GRN : YEL, BLU);
    }
  }
}

// Real teletext subtitles: page 888, text in black boxes over the TV picture
function p888() {
  picture();
  const lines = ['ТИТЛОВИТЕ НЕ СЕ ДОСТАПНИ', 'ЗА ОВАА ПРОГРАМА'];
  lines.forEach((text, i) => {
    const r = 17 + i * 3, c = Math.floor((40 - text.length - 2) / 2);
    put(r, c, ' ' + text + ' ', WHT, BLK, {dh: true});
  });
}

export const extraPages = {
  500: {render: p500},
  888: {render: p888}
};
