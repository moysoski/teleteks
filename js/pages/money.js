// Money section: 200 exchange rates (NBRM).
import {put, putR, RED, GRN, YEL, MAG, CYN, WHT} from '../teletext.js';
import {data, status} from '../data.js';
import {title, subCounter, fastext, ready, shortDate, decimal} from './common.js';

/* ---------- 200 exchange rates ---------- */
const RATES_PER_PAGE = 16;

function signed(n, digits) {
  if (Math.abs(n) < 0.5 / 10 ** digits) return '=';
  return (n > 0 ? '+' : '') + decimal(n, digits);
}

function p200(sub) {
  title('КУРСНА ЛИСТА');
  const res = data.rates;
  if (!ready(status.rates, res)) return fastext();
  subCounter(sub, Math.ceil(res.rates.length / RATES_PER_PAGE));

  put(4, 1, 'НБРМ, СРЕДЕН КУРС', CYN);
  putR(4, 39, 'ВАЖИ ' + shortDate(res.date), WHT);
  put(5, 1, 'ВАЛ', YEL);
  put(5, 5, 'ВАЛУТА', YEL);
  putR(5, 32, 'ДЕНАРИ', YEL);
  putR(5, 39, 'ПРОМ.', YEL);

  res.rates.slice(sub * RATES_PER_PAGE, (sub + 1) * RATES_PER_PAGE).forEach((x, i) => {
    const r = 6 + i;
    put(r, 1, x.code, YEL);
    put(r, 5, ((x.unit > 1 ? x.unit + ' ' : '') + x.name).slice(0, 18), WHT);
    putR(r, 32, decimal(x.rate, 4), CYN);
    if (x.change != null) {
      const s = signed(x.change, 3);
      putR(r, 39, s, s === '=' ? WHT : x.change > 0 ? GRN : RED);
    }
  });
  put(23, 1, 'Денари за една единица валута.', MAG);
  fastext();
}

export const moneyPages = {
  200: {render: p200, subpages: () => data.rates ? Math.ceil(data.rates.rates.length / RATES_PER_PAGE) : 1}
};
