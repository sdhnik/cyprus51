import { sb } from './supa.js';

export const state = { session: null, profile: null };

export async function loadProfile() {
  if (!state.session) { state.profile = null; return null; }
  const key = `c51-profile-${state.session.user.id}`;
  const saved = () => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  if (!navigator.onLine) return (state.profile = saved());      // no signal: the profile from last time
  let q = sb.from('profiles').select('*').eq('id', state.session.user.id);
  if (saved() && AbortSignal.timeout) q = q.abortSignal(AbortSignal.timeout(6000));   // weak signal: don't wait long
  const { data, error } = await q.maybeSingle();
  if (error && !data) return (state.profile = saved());
  state.profile = data;
  try { if (data) localStorage.setItem(key, JSON.stringify(data)); } catch { /* full or blocked */ }
  return data;
}

// Test accounts live on a fixed day (profiles.test_today), so race-day screens can be tried any time.
export function today() {
  const t = state.profile?.test_today;
  if (!t) return new Date();
  const d = new Date(), [y, m, day] = t.split('-').map(Number);
  d.setFullYear(y, m - 1, day);
  return d;
}
