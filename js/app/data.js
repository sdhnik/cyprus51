// Race data from data/races.json, plus date helpers and GPX course maths.

const BASE = new URL('../../', import.meta.url);   // site root
let racesCache;

export async function loadRaces() {
  if (!racesCache) {
    racesCache = fetch(new URL('data/races.json', BASE)).then((r) => {
      if (!r.ok) throw new Error('Could not load races.json');
      return r.json();
    });
  }
  return racesCache;
}

export const asset = (path) => new URL(path, BASE).href;
export const stampImg = (stamp, earned) => asset(`assets/stamps/${stamp}-${earned ? 'verified' : 'locked'}.png`);

// "2027-01-24" → exact day; "2027-11" → month only, date not announced yet.
export function raceDate(r) {
  const [y, m, d] = r.date.split('-').map(Number);
  return { tbc: !d, start: new Date(y, m - 1, d || 1), end: d ? new Date(y, m - 1, d, 23, 59) : new Date(y, m, 0, 23, 59) };
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const MONTH_SHORT = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

export function formatRaceDate(r, { long = false } = {}) {
  const { tbc, start } = raceDate(r);
  if (tbc) return long ? `${MONTH_LONG.format(start)} · date TBC` : `${MONTH_SHORT.format(start)}, date TBC`;
  return DAY.format(start).replace(',', '');
}

export const daysUntil = (date, now = new Date()) =>
  Math.ceil((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);

// Check-in is open from race morning until 3 days after (exact dates only).
export function checkInOpen(r, now = new Date()) {
  const { tbc, start } = raceDate(r);
  if (tbc) return false;
  const d = daysUntil(start, now);
  return d <= 0 && d >= -3;
}

export function seasonEnd(data) {
  return new Date(data.season, 11, 31, 23, 59);
}

// ── Times ──────────────────────────────────────────────
export function fmtTime(s) {
  if (s == null) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

// Accepts "1:45:32", "1.45.32", "14532" (digits only) → seconds, or null.
export function parseTime(text) {
  const t = String(text).trim();
  let h, m, s;
  if (/^\d{5,6}$/.test(t)) { s = +t.slice(-2); m = +t.slice(-4, -2); h = +t.slice(0, -4); }
  else {
    const p = t.split(/[:.\s]/).filter(Boolean).map(Number);
    if (p.length !== 3 || p.some(Number.isNaN)) return null;
    [h, m, s] = p;
  }
  if (m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

// ── GPX ────────────────────────────────────────────────
const gpxCache = new Map();

export function course(r) {
  if (!gpxCache.has(r.id)) {
    gpxCache.set(r.id, fetch(new URL('data/' + r.gpx, BASE)).then((res) => res.text()).then(parseGpx));
  }
  return gpxCache.get(r.id);
}

function hav(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * rad, dLo = (b[1] - a[1]) * rad;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function parseGpx(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const nodes = [...doc.getElementsByTagName('trkpt')].concat([...doc.getElementsByTagName('rtept')]);
  const pts = nodes.map((n) => [+n.getAttribute('lat'), +n.getAttribute('lon'), +(n.getElementsByTagName('ele')[0]?.textContent ?? 0)]);
  const dist = [0];
  for (let i = 1; i < pts.length; i++) dist.push(dist[i - 1] + hav(pts[i - 1], pts[i]));
  // Smoothed line for drawing the profile.
  const w = 5;
  const ele = pts.map((_, i) => {
    const a = pts.slice(Math.max(0, i - w), i + w + 1);
    return a.reduce((s, p) => s + p[2], 0) / a.length;
  });
  // Climb counted with a 3 m threshold both ways, so GPS jitter does not add up.
  const raw = pts.map((p) => p[2]);
  let gain = 0, ref = raw[0];
  for (const e of raw) {
    if (e - ref >= 3) { gain += e - ref; ref = e; }
    else if (ref - e >= 3) ref = e;
  }
  return {
    pts, dist, ele,
    km: dist[dist.length - 1] / 1000,
    gain: Math.round(gain),
    min: Math.round(Math.min(...raw)),
    max: Math.round(Math.max(...raw)),
  };
}

// Elevation profile as an SVG path in a 600×70 box (for cards).
export function profilePath(c, w = 600, h = 70) {
  const lo = Math.min(...c.ele), hi = Math.max(...c.ele, lo + 20);
  const tot = c.dist[c.dist.length - 1], n = 80;
  let j = 0;
  const line = [];
  for (let i = 0; i <= n; i++) {
    const t = (tot * i) / n;
    while (j < c.dist.length - 1 && c.dist[j] < t) j++;
    line.push(`${((w * i) / n).toFixed(1)} ${(h - 4 - ((h - 14) * (c.ele[j] - lo)) / (hi - lo)).toFixed(1)}`);
  }
  const d = 'M' + line.join(' L');
  return { line: d, area: `${d} L${w} ${h} L0 ${h} Z` };
}
