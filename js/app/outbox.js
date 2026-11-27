// Check-ins made without signal wait on the phone and go out when it is back online.
import { sb } from './supa.js';
import { uploadPhoto, fromDataUrl } from './photo.js';

const KEY = 'c51-outbox';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ } };

export const isOffline = (error) => !navigator.onLine || /fetch|network|load failed/i.test(error?.message || String(error || ''));
export const queued = (raceId, uid) => read().find((x) => x.race_id === raceId && x.uid === uid) || null;

export function enqueue(item) {
  write(read().filter((x) => !(x.race_id === item.race_id && x.uid === item.uid)).concat({ ...item, saved_at: new Date().toISOString() }));
}

let running = null;
export function flush() {
  if (running) return running;
  running = (async () => {
    const list = read();
    if (!list.length || !navigator.onLine) return 0;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return 0;
    let sent = 0;
    for (const item of list.filter((x) => x.uid === session.user.id)) {   // only this runner's check-ins
      const { photo, saved_at, uid, ...row } = item;
      try {
        if (photo) row.photo_path = await uploadPhoto(session.user.id, row.race_id, await fromDataUrl(photo));
      } catch { /* the check-in matters more than the photo */ }
      const { error } = await sb.from('submissions').insert(row);
      // 23505: already there (sent from another device) — nothing left to do.
      if (!error || error.code === '23505') { write(read().filter((x) => !(x.race_id === row.race_id && x.uid === uid))); sent++; }
      else if (isOffline(error)) break;
    }
    return sent;
  })().finally(() => { running = null; });
  return running;
}

addEventListener('online', () => flush().then((n) => { if (n) dispatchEvent(new CustomEvent('c51:outbox-sent')); }));
