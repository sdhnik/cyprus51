// "Share your stamp" images (ShareStamp design): drawn in the browser on a canvas,
// nothing is sent anywhere. Square 1080 × 1080 for posts and Strava, story 1080 × 1920.
import { asset } from './data.js';

const INK = '#0d1412', ORANGE = '#ff633e', GREY = '#a7a8a7', LIGHT = '#c9cbc7', MUTED = '#69716d';

const images = new Map();
function load(src) {
  if (!images.has(src)) {
    images.set(src, new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => { images.delete(src); fail(new Error('image')); };
      i.src = src;
    }));
  }
  return images.get(src);
}

// One-colour copy of a stamp (locked stamps and the dark international one on the dark card).
function tinted(img, colour, alpha = 1) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.globalAlpha = alpha;
  x.fillStyle = colour;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

// Largest font size (down to min) that keeps the text within maxWidth.
function fit(ctx, text, font, size, maxWidth, min = size * 0.5) {
  let s = size;
  while (s > min) { ctx.font = font(s); if (ctx.measureText(text).width <= maxWidth) break; s -= 2; }
  ctx.font = font(s);
  return s;
}

function pill(ctx, x, y, text, size, align = 'left') {
  ctx.font = `800 ${size}px Inter, sans-serif`;
  const w = ctx.measureText(text).width + size * 1.5, h = size * 1.85;
  const left = align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = ORANGE;
  ctx.beginPath(); ctx.roundRect(left, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(text, left + size * 0.75, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return left + w;
}

/**
 * @param {'square'|'story'} format
 * @param {{ stamp, title, subtitle, time, pb, pace, stamps: {stamp, earned}[], count }} d
 */
export async function drawCard(format, d) {
  const story = format === 'story';
  const W = 1080, H = story ? 1920 : 1080;
  await Promise.all(['400 150px Anton', '800 46px "Barlow Condensed"', '500 26px Inter', '600 26px Inter', '700 26px Inter', '800 24px Inter']
    .map((f) => document.fonts?.load(f).catch(() => {})));
  const [topo, main, ...row] = await Promise.all([
    load(asset('assets/patterns/cyprus-topo.webp')),
    load(asset(`assets/stamps/${d.stamp}-verified.webp`)),
    ...d.stamps.map((s) => load(asset(`assets/stamps/${s.stamp}-${s.earned ? 'verified' : 'locked'}.webp`))),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const light = (s, img) => (s === 'international' ? tinted(img, '#ffffff') : img);

  // Background, topo lines, orange top line
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.12;
  const tw = story ? W * 1.8 : W * 1.2, th = tw * (topo.naturalHeight / topo.naturalWidth);
  ctx.drawImage(topo, W - tw + W * 0.3, story ? H * 0.08 : -H * 0.05, tw, th);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, W, 14);

  // Wordmark and label
  const pad = story ? 90 : 70;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `800 ${story ? 56 : 46}px "Barlow Condensed", sans-serif`;
  ctx.fillStyle = '#ffffff'; ctx.fillText('CYPRUS ', pad, (story ? 150 : 80) + (story ? 48 : 40));
  ctx.fillStyle = ORANGE; ctx.fillText('5+1', pad + ctx.measureText('CYPRUS ').width, (story ? 150 : 80) + (story ? 48 : 40));
  ctx.font = `600 ${story ? 26 : 22}px Inter, sans-serif`; ctx.fillStyle = GREY; ctx.textAlign = 'right';
  ctx.letterSpacing = '2px';
  ctx.fillText('RUNNING PASSPORT', W - pad, (story ? 162 : 90) + (story ? 22 : 19));
  ctx.letterSpacing = '0px';

  // The stamp, tilted, with a soft shadow
  const big = (x, y, size) => {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2); ctx.rotate((-9 * Math.PI) / 180);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.drawImage(light(d.stamp, main), -size / 2, -size / 2, size, size);
    ctx.restore();
  };

  const stampRow = (cx, y, size, gap, align) => {
    const total = d.stamps.length * size + (d.stamps.length - 1) * gap;
    let x = align === 'center' ? cx - total / 2 : cx;
    d.stamps.forEach((s, i) => {
      ctx.drawImage(s.earned ? light(s.stamp, row[i]) : tinted(row[i], '#ffffff', 0.28), x, y, size, size);
      x += size + gap;
    });
  };

  if (!story) {
    big(60, 290, 450);
    const x = 550, maxW = W - x - 70;
    ctx.textAlign = 'left'; ctx.fillStyle = ORANGE; ctx.font = '700 26px Inter, sans-serif'; ctx.letterSpacing = '3px';
    ctx.fillText('STAMP COLLECTED', x, 326); ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff';
    fit(ctx, d.title.toUpperCase(), (s) => `400 ${s}px Anton, sans-serif`, 112, maxW, 64);
    ctx.fillText(d.title.toUpperCase(), x, 452);
    ctx.fillStyle = GREY; fit(ctx, d.subtitle, (s) => `500 ${s}px Inter, sans-serif`, 26, maxW, 18);
    ctx.fillText(d.subtitle, x, 500);
    ctx.fillStyle = '#ffffff'; fit(ctx, d.time, (s) => `400 ${s}px Anton, sans-serif`, 150, maxW, 96);
    ctx.fillText(d.time, x, 680);
    let px = x;
    if (d.pb) px = pill(ctx, x, 712, 'PERSONAL BEST', 24) + 16;
    ctx.fillStyle = LIGHT; ctx.font = '600 26px Inter, sans-serif'; ctx.fillText(d.pace, px, 755);
    stampRow(70, H - 70 - 92, 92, 14, 'left');
    ctx.textAlign = 'right'; ctx.font = '400 64px Anton, sans-serif';
    const of = ' / 6'; ctx.fillStyle = MUTED; ctx.fillText(of, W - 70, H - 108);
    ctx.fillStyle = '#ffffff'; ctx.fillText(String(d.count), W - 70 - ctx.measureText(of).width, H - 108);
    ctx.font = '600 20px Inter, sans-serif'; ctx.fillStyle = GREY; ctx.letterSpacing = '2px'; ctx.fillText('STAMPS', W - 70, H - 72); ctx.letterSpacing = '0px';
  } else {
    big(W / 2 - 290, 290, 580);
    const cx = W / 2, maxW = W - 180;
    ctx.textAlign = 'center'; ctx.fillStyle = ORANGE; ctx.font = '700 30px Inter, sans-serif'; ctx.letterSpacing = '4px';
    ctx.fillText('STAMP COLLECTED', cx, 970); ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff'; fit(ctx, d.title.toUpperCase(), (s) => `400 ${s}px Anton, sans-serif`, 150, maxW, 80);
    ctx.fillText(d.title.toUpperCase(), cx, 1135);
    ctx.fillStyle = GREY; fit(ctx, d.subtitle, (s) => `500 ${s}px Inter, sans-serif`, 30, maxW, 20);
    ctx.fillText(d.subtitle, cx, 1195);
    ctx.fillStyle = '#ffffff'; fit(ctx, d.time, (s) => `400 ${s}px Anton, sans-serif`, 190, maxW, 120);
    ctx.fillText(d.time, cx, 1425);
    // pill and pace centred together
    ctx.font = '600 30px Inter, sans-serif';
    const paceW = ctx.measureText(d.pace).width;
    ctx.font = '800 28px Inter, sans-serif';
    const pillW = d.pb ? ctx.measureText('PERSONAL BEST').width + 42 + 18 : 0;
    const left = cx - (pillW + paceW) / 2;
    if (d.pb) pill(ctx, left, 1462, 'PERSONAL BEST', 28);
    ctx.textAlign = 'left'; ctx.fillStyle = LIGHT; ctx.font = '600 30px Inter, sans-serif'; ctx.fillText(d.pace, left + pillW, 1498);
    stampRow(cx, H - 120 - 130 - 50, 130, 16, 'center');
    ctx.textAlign = 'center'; ctx.font = '600 28px Inter, sans-serif'; ctx.fillStyle = GREY; ctx.letterSpacing = '3px';
    ctx.fillText(`${d.count} OF 6 STAMPS`, cx, H - 120); ctx.letterSpacing = '0px';
  }
  return canvas;
}

export const toBlob = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
