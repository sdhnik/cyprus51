// Downloads every file from the private storage buckets (finish photos, GPX) into ./backup/storage.
// Runs in the backup workflow with the service role key from GitHub secrets; never commit that key.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKETS = ['photos', 'gpx'];
const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function list(bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_}/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    for (const item of page) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(path);                       // a file
      else out.push(...(await list(bucket, path)));      // a folder (one per runner)
    }
    if (page.length < 1000) return out;
  }
}

let n = 0;
for (const bucket of BUCKETS) {
  for (const path of await list(bucket)) {
    const res = await fetch(`${URL_}/storage/v1/object/${bucket}/${path}`, { headers: auth });
    if (!res.ok) throw new Error(`get ${bucket}/${path}: ${res.status}`);
    const file = join('backup', 'storage', bucket, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    n++;
  }
}
console.log(`storage: ${n} files`);
