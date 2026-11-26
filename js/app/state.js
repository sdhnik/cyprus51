import { sb } from './supa.js';

export const state = { session: null, profile: null };

export async function loadProfile() {
  if (!state.session) { state.profile = null; return null; }
  const { data } = await sb.from('profiles').select('display_name, is_admin').eq('id', state.session.user.id).maybeSingle();
  state.profile = data;
  return data;
}
