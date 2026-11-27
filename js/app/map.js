// Course on a real map: MapLibre (self-hosted) with CARTO Positron vector tiles from
// OpenStreetMap data. Vector tiles let us show place names in English.
// Loaded only on race pages; without network or WebGL the drawn SVG map stays.
import { asset } from './data.js';
import { CARTO_KEY } from '../config.js';

const STYLE = `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json?key=${CARTO_KEY}`;
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
const ENGLISH = ['coalesce', ['get', 'name_en'], ['get', 'name:en'], ['get', 'name_int'], ['get', 'name:latin'], ['get', 'name']];

let lib;
const maplibre = () => {
  if (!lib) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = asset('js/vendor/maplibre/maplibre-gl.css');
    document.head.appendChild(css);
    lib = import(asset('js/vendor/maplibre/maplibre-gl.mjs')).catch((e) => { lib = null; throw e; });
  }
  return lib;
};

// Every CARTO request (style, tiles, fonts, icons) carries the key.
const withKey = (url) => (url.includes('cartocdn.com') && !url.includes('key=') ? { url: url + (url.includes('?') ? '&' : '?') + 'key=' + CARTO_KEY } : undefined);

function indexAt(c, metres) {
  let i = 0;
  while (i < c.dist.length - 1 && c.dist[i] < metres) i++;
  return i;
}

export async function routeMap(el, c, label) {
  const ml = await maplibre();
  const step = Math.max(1, Math.floor(c.pts.length / 1500));
  const coords = c.pts.filter((_, i) => i % step === 0 || i === c.pts.length - 1).map((p) => [p[1], p[0]]);
  const lons = coords.map((p) => p[0]), lats = coords.map((p) => p[1]);
  const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];

  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', label);
  const map = new ml.Map({
    container: el, style: STYLE, bounds, fitBoundsOptions: { padding: 32 },
    transformRequest: withKey, attributionControl: false,
    cooperativeGestures: true,           // page scrolls; two fingers or Ctrl + scroll move the map
    dragRotate: false, pitchWithRotate: false, touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left');
  map.addControl(new ml.AttributionControl({ compact: false, customAttribution: ATTRIBUTION }), 'bottom-right');

  await new Promise((ok, fail) => {
    map.once('load', ok);
    map.once('error', (e) => (map.loaded() ? null : fail(e.error || e)));
  });

  // Place names in English where OpenStreetMap has them
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'text-field')) map.setLayoutProperty(layer.id, 'text-field', ENGLISH);
  }

  map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
  map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } });
  map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ff633e', 'line-width': 5 } });

  const pin = (lonlat, text, cls) => {
    const e = document.createElement('span');
    e.className = `rc-pin ${cls}`;
    e.textContent = text;
    e.setAttribute('aria-hidden', 'true');
    new ml.Marker({ element: e }).setLngLat(lonlat).addTo(map);
  };
  const total = c.dist[c.dist.length - 1];
  [5, 10, 15, 20].filter((k) => k * 1000 < total - 200).forEach((k) => { const p = c.pts[indexAt(c, k * 1000)]; pin([p[1], p[0]], k, 'rc-pin--km'); });
  const s = c.pts[0], f = c.pts[c.pts.length - 1];
  const loop = Math.hypot((s[0] - f[0]) * 111000, (s[1] - f[1]) * 111000 * Math.cos((s[0] * Math.PI) / 180)) < 300;
  if (!loop) pin([f[1], f[0]], 'F', 'rc-pin--end');
  pin([s[1], s[0]], loop ? 'S/F' : 'S', 'rc-pin--end');
  return map;
}
