// Course drawings for the race page: route map and elevation profile, both as inline SVG.
// Input is the parsed GPX from data.js (pts [lat, lon, ele], dist in metres, smoothed ele).

const KM_MARKS = [5, 10, 15, 20];

function indexAt(c, metres) {
  let i = 0;
  while (i < c.dist.length - 1 && c.dist[i] < metres) i++;
  return i;
}

// Route on a light grid, kilometre marks and the start/finish.
export function routeSvg(c, label, W = 700, H = 360) {
  const lat0 = c.pts.reduce((a, p) => a + p[0], 0) / c.pts.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xy = c.pts.map((p) => [p[1] * kx, -p[0]]);
  const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 36;
  const s = Math.min((W - 2 * pad) / (x1 - x0 || 1e-9), (H - 2 * pad) / (y1 - y0 || 1e-9));
  const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const P = (i) => [ox + (xy[i][0] - x0) * s, oy + (xy[i][1] - y0) * s];
  const step = Math.max(1, Math.floor(xy.length / 600));
  const d = [];
  for (let i = 0; i < xy.length; i += step) d.push(P(i).map((v) => v.toFixed(1)).join(' '));
  d.push(P(xy.length - 1).map((v) => v.toFixed(1)).join(' '));

  let grid = '';
  for (let x = 0; x <= W; x += 40) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`;
  for (let y = 0; y <= H; y += 40) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;

  const total = c.dist[c.dist.length - 1];
  const marks = KM_MARKS.filter((k) => k * 1000 < total - 200).map((k) => {
    const [x, y] = P(indexAt(c, k * 1000));
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11" fill="#fff" stroke="#0d1412" stroke-width="1.5"/><text y="3.5" text-anchor="middle" font-size="10" font-weight="700" fill="#0d1412">${k}</text></g>`;
  }).join('');
  const [sx, sy] = P(0), [fx, fy] = P(xy.length - 1);
  const loop = Math.hypot(sx - fx, sy - fy) < 14;
  const pin = (x, y, t) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="14" fill="#0d1412"/><text y="3.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${t}</text></g>`;
  const ends = loop ? pin(sx, sy, 'S/F') : pin(fx, fy, 'F') + pin(sx, sy, 'S');

  return `<svg class="rc-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
    <rect width="${W}" height="${H}" fill="#f8f7f4"/><g stroke="#e4e5df" stroke-width="1">${grid}</g>
    <path d="M${d.join(' L')}" fill="none" stroke="#ff633e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${marks}${ends}</svg>`;
}

// Elevation in metres along the course, with axis labels.
export function elevationSvg(c, label, W = 700, H = 180) {
  const L = 36, R = W - 8, T = 14, B = H - 28;
  const mn = Math.min(...c.ele), mx = Math.max(...c.ele);
  const span = Math.max(20, mx - mn);
  const stepY = [5, 10, 20, 25, 50, 100].find((s) => span / s <= 4) || 200;
  const lo = Math.floor(mn / stepY) * stepY, hi = Math.max(lo + 2 * stepY, Math.ceil(mx / stepY) * stepY);
  const total = c.dist[c.dist.length - 1];
  const X = (m) => L + ((R - L) * m) / total, Y = (e) => B - ((B - T) * (e - lo)) / (hi - lo);
  const n = 220, line = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const t = (total * i) / n;
    while (j < c.dist.length - 1 && c.dist[j] < t) j++;
    line.push(`${X(t).toFixed(1)} ${Y(c.ele[j]).toFixed(1)}`);
  }
  let axis = '';
  for (let e = lo; e <= hi + 0.01; e += stepY) axis += `<line x1="${L}" y1="${Y(e).toFixed(1)}" x2="${R}" y2="${Y(e).toFixed(1)}" stroke="#e4e5df"/><text x="${L - 6}" y="${(Y(e) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#69716d">${e}</text>`;
  for (let k = 0; k * 1000 <= total; k += 5) axis += `<text x="${X(k * 1000).toFixed(1)}" y="${H - 8}" text-anchor="${k ? 'middle' : 'start'}" font-size="11" fill="#69716d">${k}${k ? '' : ' km'}</text>`;
  return `<svg class="rc-elev" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${axis}
    <path d="M${L} ${B} L${line.join(' L')} L${R} ${B} Z" fill="#ff633e" fill-opacity=".14"/>
    <path d="M${line.join(' L')}" fill="none" stroke="#ff633e" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
