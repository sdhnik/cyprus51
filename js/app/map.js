// Course on a real map: Leaflet (self-hosted) with OpenStreetMap tiles, toned down to a light grey in CSS.
// Loaded only on race pages. Without network the SVG drawing from course.js stays.
import { asset } from './data.js';

let loading;
function leaflet() {
  if (window.L) return Promise.resolve(window.L);
  loading ??= new Promise((ok, fail) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = asset('js/vendor/leaflet/leaflet.css');
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = asset('js/vendor/leaflet/leaflet.js');
    s.onload = () => ok(window.L);
    s.onerror = () => { loading = null; fail(new Error('leaflet')); };
    document.head.appendChild(s);
  });
  return loading;
}

function indexAt(c, metres) {
  let i = 0;
  while (i < c.dist.length - 1 && c.dist[i] < metres) i++;
  return i;
}

export async function routeMap(el, c, label) {
  const L = await leaflet();
  const touch = matchMedia('(pointer: coarse)').matches;
  const map = L.map(el, { scrollWheelZoom: false, dragging: !touch, tap: false, zoomSnap: 0.25, attributionControl: true });
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', label);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.attributionControl.setPrefix(false);

  const step = Math.max(1, Math.floor(c.pts.length / 1500));
  const line = c.pts.filter((_, i) => i % step === 0 || i === c.pts.length - 1).map((p) => [p[0], p[1]]);
  L.polyline(line, { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(map);
  const route = L.polyline(line, { color: '#ff633e', weight: 5, lineJoin: 'round', interactive: false }).addTo(map);

  const total = c.dist[c.dist.length - 1];
  const pin = (html, cls, size) => L.divIcon({ className: '', html: `<span class="rc-pin ${cls}">${html}</span>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  [5, 10, 15, 20].filter((k) => k * 1000 < total - 200).forEach((k) => {
    const p = c.pts[indexAt(c, k * 1000)];
    L.marker([p[0], p[1]], { icon: pin(k, 'rc-pin--km', 24), keyboard: false, interactive: false }).addTo(map);
  });
  const s = c.pts[0], f = c.pts[c.pts.length - 1];
  const loop = map.distance([s[0], s[1]], [f[0], f[1]]) < 300;
  if (!loop) L.marker([f[0], f[1]], { icon: pin('F', 'rc-pin--end', 30), keyboard: false, interactive: false }).addTo(map);
  L.marker([s[0], s[1]], { icon: pin(loop ? 'S/F' : 'S', 'rc-pin--end', 30), keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(map);

  map.fitBounds(route.getBounds(), { padding: [28, 28] });
  // On phones the page scrolls with one finger; panning turns on once zoomed in.
  if (touch) {
    const z0 = map.getZoom();
    map.on('zoomend', () => (map.getZoom() > z0 ? map.dragging.enable() : map.dragging.disable()));
  }
  return map;
}
