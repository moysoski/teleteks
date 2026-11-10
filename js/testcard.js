// Idents drawn straight on the canvas instead of teletext:
// night test card ("Крај на програмата") with an optional 1 kHz tone, and the morning station clock.

const BARS = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff', '#000000'];
const GREYS = ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'];

function text(ctx, s, x, y, size, color = '#ffffff') {
  ctx.font = size + 'px "Press Start 2P", ui-monospace, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function drawTestCard(ctx, w, h, {clock, toneOn, until}) {
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

  // colour strips down the left and right edges, as on PM5544-style cards
  const EDGE = ['#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
  for (let y = cell / 2, i = 0; y < h * 0.9; y += cell, i++) {
    ctx.fillStyle = EDGE[i % EDGE.length];
    ctx.fillRect(0, y, cell / 2, cell);
    ctx.fillStyle = EDGE[(i + 3) % EDGE.length];
    ctx.fillRect(w - cell / 2, y, cell / 2, cell);
  }

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
  ctx.fillStyle = '#ffff00';
  ctx.fillRect(x0, top + band * 7, width, band);
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(cx - width / 6, top + band * 7, width / 3, band);
  // centre cross over the grey steps
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - w / 400, top + band * 3.3, w / 200, band * 1.4);
  ctx.fillRect(x0, cy - w / 400, width, w / 200);
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
  text(ctx, 'ПРОГРАМАТА ПРОДОЛЖУВА ВО ' + until, cx, h * 0.93, w / 44, '#ffff00');
  text(ctx, (toneOn ? 'ДОПРИ: БЕЗ ТОН' : 'ДОПРИ: ТОН') + '   КОПЧЕ: ТЕЛЕТЕКСТ', cx, h * 0.97, w / 52, '#00ffff');
}

// Morning: station clock before the programme starts, counting down to teletext
export function drawStartClock(ctx, w, h, {now, left}) {
  const cx = w / 2, cy = h * 0.43, rad = w * 0.3;
  ctx.fillStyle = '#000033';
  ctx.fillRect(0, 0, w, h);

  text(ctx, 'ПОЧЕТОК НА ПРОГРАМАТА', cx, h * 0.06, w / 30, '#00ffff');

  // 60 minute dots, bigger blocks for the hours
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, x = cx + Math.sin(a) * rad, y = cy - Math.cos(a) * rad;
    const s = i % 5 ? w / 160 : w / 55;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillRect(-s / 2, -s, s, s * (i % 5 ? 1 : 2.2));
    ctx.restore();
  }

  // hands; the second hand jumps once a second, like on a real station clock
  const sec = now.getSeconds(), min = now.getMinutes() + sec / 60, hr = now.getHours() % 12 + min / 60;
  const hand = (turns, length, width, color) => {
    const a = turns * Math.PI * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - Math.sin(a) * length * 0.15, cy + Math.cos(a) * length * 0.15);
    ctx.lineTo(cx + Math.sin(a) * length, cy - Math.cos(a) * length);
    ctx.stroke();
  };
  hand(hr / 12, rad * 0.55, w / 40, '#ffffff');
  hand(min / 60, rad * 0.82, w / 60, '#ffffff');
  hand(sec / 60, rad * 0.9, w / 160, '#ff0000');
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(cx, cy, w / 90, 0, Math.PI * 2);
  ctx.fill();

  const pad = n => String(n).padStart(2, '0');
  text(ctx, pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(sec), cx, h * 0.8, w / 22, '#ffff00');
  text(ctx, 'ДОБРО УТРО', cx, h * 0.87, w / 26);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, h * 0.92, w, h * 0.08);
  text(ctx, 'ТЕЛЕТЕКСТ ЗА ' + left, cx, h * 0.96, w / 40, '#00ffff');
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
