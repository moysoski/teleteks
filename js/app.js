// App: header, page lookup, remote control, HOLD / SIZE / REVEAL, night test card, timers.
import * as tt from './teletext.js';
import {put, CYN, GRN, RED, WHT, YEL} from './teletext.js';
import {loadWeather} from './weather.js';
import {loadData} from './data.js';
import {fastLinks} from './pages/common.js';
import {homePages, notFound} from './pages/home.js';
import {weatherPages} from './pages/weather.js';
import {moneyPages} from './pages/money.js';
import {footballPages} from './pages/football.js';
import {extraPages} from './pages/extra.js';
import {drawTestCard, toggleTone, stopTone} from './testcard.js';

const PAGES = {...homePages, ...weatherPages, ...moneyPages, ...footballPages, ...extraPages};
const HIDDEN = [888];  // easter eggs are skipped by ‹ ›
const NUMBERS = Object.keys(PAGES).map(Number).filter(n => !HIDDEN.includes(n)).sort((a, b) => a - b);
const SUBPAGE_SECONDS = 10;
const REFRESH_MINUTES = 30;
const NIGHT_HOURS = [1, 6];  // test card from 01:00 to 06:00 in the viewer's own time (diaspora included)
const NIGHT_IDLE_MINUTES = 15;

const state = {
  current: null,
  sub: 0,
  subTimer: 0,
  hold: false,
  searching: false,
  rollNum: 100,
  typed: '',
  testCard: false,
  tone: false,
  lastInput: Date.now()
};
let searchTimeout = null;

const canvas = document.getElementById('tt');
const srLive = document.getElementById('sr');
const colourButtons = [...document.querySelectorAll('.fast button')];
tt.init(canvas);

/* ---------- header row ---------- */
const DAY_ABBR = ['нед', 'пон', 'вто', 'сре', 'чет', 'пет', 'саб'];
const MONTH_ABBR = ['јан', 'фев', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'ное', 'дек'];
const pad = n => String(n).padStart(2, '0');
const clock = d => pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());

function header() {
  tt.clearRow(0);
  const d = new Date();
  if (state.hold) put(0, 0, 'СТОП', RED);
  else if (state.typed) put(0, 0, 'P' + state.typed.padEnd(3, '-'), WHT);
  else if (state.searching) put(0, 0, 'P' + state.rollNum, GRN);
  else put(0, 0, 'P' + (state.current || 100), WHT);
  put(0, 5, 'ТЕЛЕТЕКСТ', CYN);
  put(0, 19, DAY_ABBR[d.getDay()] + ' ' + pad(d.getDate()) + ' ' + MONTH_ABBR[d.getMonth()], WHT);
  put(0, 31, clock(d), YEL);
}

function refreshHeader() {
  header();
  tt.draw();
}

/* ---------- pages ---------- */
const page = () => PAGES[state.current];
const subpageCount = () => page()?.subpages?.() || 1;

function syncColourButtons() {
  fastLinks.forEach(([label, n], i) => colourButtons[i].setAttribute('aria-label', label + ', страница ' + n));
}

function render() {
  tt.clear();
  if (state.current != null) {
    const p = page();
    if (p) {
      state.sub = Math.min(state.sub, subpageCount() - 1);
      p.render(state.sub);
    } else notFound(state.current);
  }
  header();
  tt.draw();
  syncColourButtons();
  srLive.textContent = tt.text();
}

function go(n) {
  state.typed = '';
  state.searching = true;
  state.hold = false;
  tt.view.reveal = false;
  syncButtons();
  state.rollNum = state.current || 100;
  clearTimeout(searchTimeout);
  refreshHeader();
  // a page that does not exist takes longer to "find", like on a real TV
  searchTimeout = setTimeout(() => {
    state.searching = false;
    state.current = n;
    state.sub = 0;
    state.subTimer = 0;
    render();
    try { history.replaceState(null, '', '#p' + n); } catch (e) { /* file:// or sandboxed */ }
  }, PAGES[n] ? 1100 : 2400);
}

function digit(d) {
  if (!state.typed && d === '0') return;
  state.typed += d;
  if (state.typed.length === 3) go(parseInt(state.typed, 10));
  else refreshHeader();
}

function step(dir) {
  const cur = state.current || 100;
  const n = dir > 0
    ? NUMBERS.find(p => p > cur) ?? NUMBERS[0]
    : NUMBERS.filter(p => p < cur).pop() ?? NUMBERS[NUMBERS.length - 1];
  go(n);
}

const colour = i => go(fastLinks[i][1]);

/* ---------- HOLD / SIZE / REVEAL ---------- */
const fnButtons = {
  hold: document.querySelector('[data-fn="hold"]'),
  size: document.querySelector('[data-fn="size"]'),
  reveal: document.querySelector('[data-fn="reveal"]')
};

function syncButtons() {
  fnButtons.hold.setAttribute('aria-pressed', state.hold);
  fnButtons.size.setAttribute('aria-pressed', tt.view.size > 0);
  fnButtons.reveal.setAttribute('aria-pressed', tt.view.reveal);
}

function toggleHold() {
  if (state.searching) return;
  state.hold = !state.hold;
  state.subTimer = 0;
  syncButtons();
  refreshHeader();
}

function cycleSize() {
  tt.view.size = (tt.view.size + 1) % 3;
  syncButtons();
  tt.draw();
}

function toggleReveal() {
  tt.view.reveal = !tt.view.reveal;
  syncButtons();
  tt.draw();
  srLive.textContent = tt.text();
}

/* ---------- night test card ---------- */
const isNight = () => new Date().getHours() >= NIGHT_HOURS[0] && new Date().getHours() < NIGHT_HOURS[1];

function showTestCard() {
  state.testCard = true;
  tt.view.overlay = (ctx, w, h) => drawTestCard(ctx, w, h, {clock: clock(new Date()), toneOn: state.tone});
  tt.draw();
  srLive.textContent = 'Крај на програмата. Притисни копче на далечинскиот за телетекст.';
}

function hideTestCard() {
  state.testCard = false;
  state.tone = false;
  stopTone();
  tt.view.overlay = null;
  if (state.current == null) go(100); else render();
}

canvas.addEventListener('click', () => {
  if (!state.testCard) return;
  state.tone = toggleTone();
  tt.draw();
});

/* ---------- timers ---------- */
setInterval(() => {
  if (state.searching && !state.typed) {
    state.rollNum += 1 + Math.floor(Math.random() * 7);
    if (state.rollNum > 899) state.rollNum = 100;
    refreshHeader();
  }
}, 70);

setInterval(() => {
  tt.view.flashOn = !tt.view.flashOn;
  refreshHeader();
}, 500);

setInterval(() => {
  if (!state.testCard && isNight() && Date.now() - state.lastInput > NIGHT_IDLE_MINUTES * 60e3) showTestCard();
  if (state.testCard || state.searching || state.hold || subpageCount() < 2) return;
  if (++state.subTimer < SUBPAGE_SECONDS) return;
  state.subTimer = 0;
  state.sub = (state.sub + 1) % subpageCount();
  render();
}, 1000);

const rerender = () => { if (!state.searching && !state.testCard) render(); };
const reload = () => Promise.all([loadWeather(rerender), loadData(rerender)]);
setInterval(reload, REFRESH_MINUTES * 60 * 1000);

/* ---------- input ---------- */
// any remote button or key wakes the screen from the test card
function input(action) {
  return (...args) => {
    state.lastInput = Date.now();
    if (state.testCard) return hideTestCard();
    action(...args);
  };
}

document.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', input(() => digit(b.dataset.d))));
document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', input(() => step(+b.dataset.nav))));
colourButtons.forEach((b, i) => b.addEventListener('click', input(() => colour(i))));
fnButtons.hold.addEventListener('click', input(toggleHold));
fnButtons.size.addEventListener('click', input(cycleSize));
fnButtons.reveal.addEventListener('click', input(toggleReveal));

const KEYS = {
  ArrowRight: () => step(1), '+': () => step(1),
  ArrowLeft: () => step(-1), '-': () => step(-1),
  r: () => colour(0), g: () => colour(1), y: () => colour(2), c: () => colour(3),
  h: toggleHold, z: cycleSize, '?': toggleReveal, x: toggleReveal
};

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) input(digit)(e.key);
  else if (KEYS[e.key]) input(KEYS[e.key])();
});

const hashPage = () => {
  const m = location.hash.match(/^#p(\d{3})$/);
  return m ? +m[1] : null;
};
// #kraj opens the test card at any hour (handy for screenshots and videos)
const wantsTestCard = () => location.hash === '#kraj';

window.addEventListener('hashchange', () => {
  if (wantsTestCard()) return showTestCard();
  const n = hashPage();
  if (!n) return;
  if (state.testCard) hideTestCard();
  if (n !== state.current) go(n);
});

/* ---------- start ---------- */
new ResizeObserver(() => tt.resize()).observe(canvas);
header();
tt.resize();
syncButtons();
reload();

// a link to a page always opens teletext, even at night
const begin = () => (wantsTestCard() || (isNight() && !hashPage())) ? showTestCard() : go(hashPage() || 100);
document.fonts?.load('16px "Press Start 2P"', 'АБВЃЌЅЏЉЊЈ°µ').then(() => { tt.draw(); begin(); }, begin) ?? begin();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn(err));
}
