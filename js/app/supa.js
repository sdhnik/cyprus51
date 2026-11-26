import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

// window.supabase comes from js/vendor/supabase-*.js (loaded before this module).
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Address of the app itself, used in links inside emails.
export const APP_URL = location.origin + location.pathname;

// Turns Supabase errors into sentences a runner understands.
export function authMessage(err) {
  const code = err?.code || '';
  const msg = (err?.message || '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return { field: 'password', text: 'Email or password is wrong.' };
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return { text: 'Confirm your email first. The link is in your inbox (check spam too).' };
  if (code === 'weak_password' || msg.includes('password should')) return { field: 'password', text: 'Choose a longer password: at least 8 characters.' };
  if (code === 'email_address_invalid' || msg.includes('invalid format') || msg.includes('email address') && msg.includes('invalid')) return { field: 'email', text: 'Enter a valid email address.' };
  if (code === 'same_password') return { field: 'password', text: 'Choose a password you have not used here before.' };
  if (code.startsWith('over_') || err?.status === 429) return { text: 'Too many attempts. Wait a few minutes and try again.' };
  if (msg.includes('18 or older')) return { field: 'adult', text: 'Confirm you are 18 or older to join.' };
  if (msg.includes('failed to fetch') || msg.includes('network')) return { text: 'No connection. Check your internet and try again.' };
  return { text: 'Something went wrong on our side. Please try again in a minute.' };
}
