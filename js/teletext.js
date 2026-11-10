// Teletext screen: a 40x25 cell buffer drawn onto a <canvas>.
// Each cell: {ch, fg, bg, mos (sextant bitmask or null), fl (flash), dh (0, 1 top / 2 bottom of double height), cn (concealed)}

export const PAL = ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'];
export const BLK = 0, RED = 1, GRN = 2, YEL = 3, BLU = 4, MAG = 5, CYN = 6, WHT = 7;
export const COLS = 40, ROWS = 25;

// size: 0 normal, 1 top half doubled, 2 bottom half doubled (row 24 always stays normal)
// overlay: optional function(ctx, width, height) drawn instead of the page
export const view = {flashOn: true, reveal: false, size: 0, overlay: null};

let canvas, ctx, buf = [];

const blank = () => ({ch: ' ', fg: WHT, bg: BLK, mos: null, fl: false, dh: 0, cn: false});

export function init(el) {
  canvas = el;
  ctx = el.getContext('2d');
  clear();
}

export function clear() {
  buf = [];
  for (let r = 0; r < ROWS; r++) buf.push(Array.from({length: COLS}, blank));
}

export function clearRow(r) {
  for (let c = 0; c < COLS; c++) buf[r][c] = blank();
}

export function rowBg(r, bg) {
  for (let c = 0; c < COLS; c++) buf[r][c].bg = bg;
}

export function put(r, c, s, fg = WHT, bg = BLK, o = {}) {
  const a = Array.from(String(s));
  for (let i = 0; i < a.length; i++) {
    const x = c + i;
    if (x < 0 || x >= COLS || r < 0 || r >= ROWS) continue;
    buf[r][x] = {ch: a[i], fg, bg, mos: null, fl: !!o.fl, dh: o.dh ? 1 : 0, cn: !!o.cn};
    if (o.dh && r + 1 < ROWS) buf[r + 1][x] = {...blank(), fg, bg, dh: 2, cn: !!o.cn};
  }
}

// Right-aligned text ending at column `end` (inclusive)
export function putR(r, end, s, fg = WHT, bg = BLK, o = {}) {
  s = String(s);
  put(r, end - Array.from(s).length + 1, s, fg, bg, o);
}

export function mos(r, c, bits, fg, bg = BLK) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  buf[r][c] = {...blank(), fg, bg, mos: bits};
}

export function rows() {
  return buf;
}

// Visible text of the screen, for the screen-reader live region
export function text() {
  return buf.slice(1).map(row => row.map(k => (k.dh === 2 || (k.cn && !view.reveal)) ? ' ' : k.ch).join('').trim())
    .filter(Boolean).join('. ');
}

// Rows to draw as [row, y, height] in canvas pixels
function slots(ch) {
  if (!view.size) return Array.from({length: ROWS}, (_, r) => [r, r * ch, ch]);
  const first = view.size === 1 ? 0 : 12;
  const out = [];
  for (let i = 0; i < 12; i++) out.push([first + i, i * 2 * ch, 2 * ch]);
  out.push([24, 24 * ch, ch]);
  return out;
}

export function draw() {
  if (!ctx) return;
  // something drawn instead of the teletext page (the night test card)
  if (view.overlay) return view.overlay(ctx, canvas.width, canvas.height);
  const cw = canvas.width / COLS, ch = canvas.height / ROWS;
  const list = slots(ch);
  const fontPx = cw * 0.72;
  const zoomEnd = view.size ? Math.round(24 * ch) : canvas.height;
  const xs = c => Math.round(c * cw);

  // Pass 1: backgrounds and mosaics
  for (const [r, y, h] of list) {
    const y0 = Math.round(y), y1 = Math.round(y + h);
    for (let c = 0; c < COLS; c++) {
      const k = buf[r][c], x0 = xs(c), x1 = xs(c + 1);
      ctx.fillStyle = PAL[k.bg];
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (k.mos == null || (k.cn && !view.reveal)) continue;
      ctx.fillStyle = PAL[k.fg];
      const xm = Math.round((x0 + x1) / 2), ya = Math.round(y0 + (y1 - y0) / 3), yb = Math.round(y0 + 2 * (y1 - y0) / 3);
      const px = [x0, xm, x1], py = [y0, ya, yb, y1];
      for (let i = 0; i < 6; i++) {
        if (!(k.mos & (1 << i))) continue;
        const cx = i & 1, cy = i >> 1;
        ctx.fillRect(px[cx], py[cy], px[cx + 1] - px[cx], py[cy + 1] - py[cy]);
      }
    }
  }

  // Pass 2: text on top, so double-height glyphs are not painted over by the row below
  ctx.font = fontPx + 'px "Press Start 2P", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const [r, y, h] of list) {
    const sy = (h * 0.72) / fontPx;
    for (let c = 0; c < COLS; c++) {
      const k = buf[r][c];
      if (k.mos != null || k.ch === ' ' || k.dh === 2) continue;
      if (k.fl && !view.flashOn) continue;
      if (k.cn && !view.reveal) continue;
      const x0 = xs(c), x1 = xs(c + 1);
      ctx.save();
      if (k.dh) {
        ctx.beginPath();
        ctx.rect(x0, y, x1 - x0, Math.min(2 * h, (r < 24 ? zoomEnd : canvas.height) - y));
        ctx.clip();
      }
      ctx.fillStyle = PAL[k.fg];
      ctx.translate((x0 + x1) / 2, y + h * (k.dh ? 0.24 : 0.13));
      ctx.scale(1, k.dh ? sy * 2 : sy);
      ctx.fillText(k.ch, 0, 0);
      ctx.restore();
    }
  }
}

export function resize() {
  const w = canvas.clientWidth || 480, dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(w * dpr * 500 / 480);
  draw();
}
