// Fills sw.js with the files the app needs offline and a version for this deploy.
// Runs in the Pages workflow before upload: node scripts/build-sw.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
  const p = join(dir, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

const files = [
  'app/index.html', 'manifest.webmanifest',
  ...walk('css'),
  ...walk('js').filter((f) => !f.includes('vendor/maplibre') && f.endsWith('.js')),   // the map library loads on demand
  ...walk('data'),
  ...walk('assets/fonts').filter((f) => f.endsWith('.woff2')),
  ...walk('assets/stamps').filter((f) => f.endsWith('.webp')),
  ...walk('assets/achievements').filter((f) => f.endsWith('.webp')),
  'assets/patterns/cyprus-topo.webp', ...walk('assets/brand'),   // icons and the Next up pattern load when needed
].map((f) => f.split('\\').join('/')).sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(root, f)));
const version = hash.digest('hex').slice(0, 12);

const swPath = join(root, 'sw.js');
const sw = readFileSync(swPath, 'utf8')
  .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
  .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(files, null, 0)};`);
if (!sw.includes(version)) throw new Error('sw.js placeholders not found');
writeFileSync(swPath, sw);
const kb = files.reduce((a, f) => a + statSync(join(root, f)).size, 0) / 1024;
console.log(`sw.js: version ${version}, ${files.length} files, ${Math.round(kb)} KB`);
