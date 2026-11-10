// Night mode: a test card ("Крај на програмата") drawn straight on the canvas, with an optional 1 kHz tone.

const BARS = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];
const GREYS = ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'];

function text(ctx, s, x, y, size, color = '#ffffff') {
  ctx.font = size + 'px "Press Start 2P", ui-monospace, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function drawTestCard(ctx, w, h, {clock, toneOn}) {
  const cx = w / 2, cy = h * 0.46, rad = w * 0.42, cell = w / 14;

  // grey background with a white grid
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, w / 320);
  ctx.beginPath();
  for (let x = cell / 2; x < w; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = cell / 2; y < h; y += cell) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // the circle, filled band by band
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.clip();
  const top = cy - rad, band = (2 * rad) / 8;
  const x0 = cx - rad, width = 2 * rad;

  BARS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x0 + i * width / 8, top, width / 8 + 1, band * 2); });
  ctx.fillStyle = '#000000';
  ctx.fillRect(x0, top + band * 2, width, band * 1.3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, top + band * 3.3, width, band * 0.15);
  GREYS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x0 + i * width / 6, top + band * 3.45, width / 6 + 1, band * 1.1); });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, top + band * 4.55, width, band * 0.15);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x0, top + band * 4.7, width, band * 1.3);
  for (let i = 0; i < 16; i++) {  // fine stripes, like the resolution bars
    ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
    ctx.fillRect(x0 + i * width / 16, top + band * 6, width / 16 + 1, band);
  }
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(x0, top + band * 7, width / 2, band);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(cx, top + band * 7, width / 2, band);
  ctx.restore();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, w / 160);
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();

  text(ctx, 'КРАЈ НА', cx, top + band * 2.35, w / 26);
  text(ctx, 'ПРОГРАМАТА', cx, top + band * 2.95, w / 26);
  text(ctx, clock, cx, top + band * 5.35, w / 22, '#ffff00');

  // hint strip under the circle
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
  text(ctx, toneOn ? 'ДОПРИ ЕКРАН: БЕЗ ТОН' : 'ДОПРИ ЕКРАН: ТОН', cx, h * 0.93, w / 48);
  text(ctx, 'КОПЧЕ НА ДАЛЕЧИНСКИОТ: ТЕЛЕТЕКСТ', cx, h * 0.97, w / 48, '#00ffff');
}

// 1 kHz sine, quiet; created only after the viewer taps, so browsers allow it
let audio = null, osc = null;

export function toggleTone() {
  if (osc) {
    stopTone();
    return false;
  }
  audio ??= new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  const gain = audio.createGain();
  gain.gain.value = 0.04;
  osc = audio.createOscillator();
  osc.frequency.value = 1000;
  osc.connect(gain).connect(audio.destination);
  osc.start();
  return true;
}

export function stopTone() {
  if (!osc) return;
  osc.stop();
  osc.disconnect();
  osc = null;
}
