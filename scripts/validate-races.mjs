// Checks data/races.json before the site is published. Run: node scripts/validate-races.mjs
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

let data;
try {
  data = JSON.parse(readFileSync('data/races.json', 'utf8'));
} catch (e) {
  console.error(`data/races.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const ID = /^[a-z0-9-]{3,60}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;   // month only = date not announced yet (shown as "date TBC")
const ids = new Set();

if (!Number.isInteger(data.season)) fail('season', 'must be a year, e.g. 2027');
if (!Array.isArray(data.races) || data.races.length === 0) fail('races', 'must be a non-empty list');

(data.races || []).forEach((r, i) => {
  const at = `races[${i}]${r && r.city ? ' (' + r.city + ')' : ''}`;
  for (const k of ['id', 'city', 'officialName', 'date', 'website', 'gpx', 'stamp']) {
    if (typeof r[k] !== 'string' || !r[k].trim()) fail(at, `"${k}" is required`);
  }
  if (r.id && !ID.test(r.id)) fail(at, `"id" may only use a-z, 0-9 and "-"`);
  if (r.id && ids.has(r.id)) fail(at, `"id" ${r.id} is used twice`);
  ids.add(r.id);
  if (r.date) {
    if (DAY.test(r.date)) {
      if (Number.isNaN(Date.parse(r.date + 'T00:00:00Z'))) fail(at, `"date" ${r.date} is not a real day`);
    } else if (!MONTH.test(r.date)) {
      fail(at, `"date" must be YYYY-MM-DD, or YYYY-MM while the date is not announced`);
    }
  }
  if (r.website && !/^https:\/\//.test(r.website)) fail(at, `"website" must start with https://`);
  if (r.gpx && !existsSync('data/' + r.gpx)) fail(at, `GPX file data/${r.gpx} not found`);
  if (r.gpx && existsSync('data/' + r.gpx) && !/<trkpt|<rtept/.test(readFileSync('data/' + r.gpx, 'utf8'))) {
    fail(at, `data/${r.gpx} has no track points`);
  }
  if (r.stamp && !existsSync(`assets/stamps/${r.stamp}-verified.png`)) fail(at, `no stamp image assets/stamps/${r.stamp}-verified.png`);
  for (const k of ['startFinish', 'course']) {
    if (k in r && typeof r[k] !== 'string') fail(at, `"${k}" must be text`);
  }
});

if (!data.abroad || !ID.test(data.abroad.id || '')) fail('abroad', '"id" is required');

if (errors.length) {
  console.error('races.json has problems:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`races.json OK: ${data.races.length} races, season ${data.season}`);
