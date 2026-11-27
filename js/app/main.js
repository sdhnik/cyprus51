import { sb } from './supa.js';
import { route, onRender, render, go, takeFlash } from './router.js';
import * as auth from './views/auth.js';
import { passport } from './views/passport.js';
import { account } from './views/account.js';
import { home } from './views/home.js';
import { achievement } from './views/achievement.js';
import { admin } from './views/admin.js';
import { race } from './views/race.js';
import { esc, icon } from './ui.js';
import { appShell } from './layout.js';
import { state, loadProfile } from './state.js';

const root = document.getElementById('app');

// Browser tab titles: page first, site name last.
const BADGES = { 'personal-best': 'Personal Best', '5-cities-finisher': '5 Cities Finisher', 'international-finisher': 'International Finisher', '5plus1-finisher': '5+1 Finisher', 'sub-1-30-elite': 'Sub 1:30 Elite' };
const CITY = { 'nicosia-2027': 'Nicosia', 'paphos-2027': 'Paphos', 'limassol-2027': 'Limassol', 'larnaka-2027': 'Larnaka', 'ayia-napa-2027': 'Ayia Napa' };
function raceTitle([id, sub] = []) {
  const name = id === 'abroad' ? 'Race abroad' : CITY[id] ? `${CITY[id]} Half Marathon` : 'Race';
  return sub === 'submit' ? `Submit result · ${name}` : sub === 'checkin' ? `Check in · ${name}` : name;
}
function pageTitle(name, args = []) {
  const t = {
    '': 'Cyprus 5+1 · Running passport for Cyprus half marathons',
    rules: 'Rules · Cyprus 5+1',
    login: 'Log in · Cyprus 5+1',
    'link-problem': 'Log in · Cyprus 5+1',
    join: 'Join the challenge · Cyprus 5+1',
    forgot: 'Reset your password · Cyprus 5+1',
    reset: 'Set a new password · Cyprus 5+1',
    passport: 'Your passport · Cyprus 5+1',
    account: 'Account · Cyprus 5+1',
    achievement: `${BADGES[args[0]] || 'Achievement'} · Achievements · Cyprus 5+1`,
    admin: 'Review queue · Cyprus 5+1',
    race: `${raceTitle(args)} · Cyprus 5+1`,
  }[name];
  return document.querySelector('.is-404') ? 'Page not found · Cyprus 5+1' : document.querySelector('.page-error') ? 'Something went wrong · Cyprus 5+1' : (t || 'Cyprus 5+1');
}

route('', home, { guest: true });
route('rules', (root, o) => home(root, { ...o, args: ['rules'] }), { guest: true });
route('login', auth.login, { guest: true });
route('join', auth.join, { guest: true });
route('forgot', auth.forgot, { guest: true });
route('reset', auth.reset, { user: true });
route('link-problem', auth.linkProblem, { guest: true });
route('passport', passport, { user: true });
route('account', account, { user: true });
route('achievement', achievement, { user: true });
route('admin', admin, { user: true });
route('race', race, { user: true });

onRender(async (name, r, args) => {
  state.session = (await sb.auth.getSession()).data.session;   // local read, no network
  // Reload the profile when the signed-in user changed (another tab, log out and in).
  if (state.session && state.profile?.id !== state.session.user.id) await loadProfile();
  if (!state.session) state.profile = null;
  if (!r) return go(state.session ? 'passport' : '');
  if (r.user && !state.session) return go('login');
  if (r.guest && state.session && name !== 'link-problem') return go('passport');
  window.scrollTo(0, 0);
  const flash = takeFlash();
  try {
    await r.view(root, { args, state, flash });
  } catch (e) {
    console.error(e);
    const body = `<section class="page-error">
      <p class="ps-eyebrow">ERROR</p>
      <h1 class="page-error__title">Something went wrong.</h1>
      <p class="page-error__text">It’s on our side, and nothing is lost. Try again in a minute.</p>
      <div class="page-error__actions">
        <button type="button" class="c51-btn c51-btn--primary" onclick="location.reload()">Try again</button>
        <a class="c51-btn c51-btn--secondary" href="#/${state.session ? 'passport' : ''}">${state.session ? 'Back to your passport' : 'Home'}</a>
      </div>
      <details class="err-details"><summary>Technical details</summary><p>${esc(e?.message || e)}</p></details>
    </section>`;
    root.innerHTML = state.session ? appShell(body)
      : `<div class="app"><header class="app__head"><a class="wordmark" href="#/">CYPRUS <span>5+1</span></a></header><main class="app__main" id="main">${body}</main></div>`;
  }
  const h1 = root.querySelector('h1');
  if (h1) h1.tabIndex = -1;
  document.title = pageTitle(name, args);
});

async function start() {
  const params = new URLSearchParams(location.search);
  const fromEmail = params.has('code') || params.has('confirmed') || params.has('reset') || params.has('error');
  let recovery = params.has('reset');

  sb.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') { state.profile = null; go(''); }
    else if (session && state.profile && state.profile.id !== session.user.id) { state.profile = null; render(); }
  });

  const { data } = await sb.auth.getSession();   // also finishes the login from an email link
  state.session = data.session;
  if (state.session) await loadProfile();

  if (fromEmail) {
    history.replaceState(null, '', location.pathname + location.hash);   // drop ?code=… from the address
    if (!state.session) {
      const expired = params.has('error') || /expired|invalid/i.test(location.hash);
      if (params.has('reset')) {
        return go('forgot', { flash: banner('pending', expired ? 'This reset link has expired' : 'Open the reset link in this browser', expired ? 'Ask for a new one below. It works for 60 minutes.' : 'The link was opened in a different app or browser. Ask for a new link here and open it in this browser.') });
      }
      if (params.has('confirmed') && !expired) {
        return go('login', { flash: banner('success', 'Email confirmed', 'Your passport is ready. Log in to continue.') });
      }
      return go('link-problem');
    }
    if (recovery) return go('reset');
    if (params.has('confirmed')) return go('passport', { flash: banner('success', 'Email confirmed', 'Welcome to Cyprus 5+1. Your passport is ready.') });
  }
  render();
}

start();
