import { sb } from './supa.js';
import { route, onRender, render, go, takeFlash } from './router.js';
import * as auth from './views/auth.js';
import { passport } from './views/passport.js';
import { account } from './views/account.js';
import { home } from './views/home.js';
import { achievement } from './views/achievement.js';
import { banner, esc } from './ui.js';
import { state, loadProfile } from './state.js';

const root = document.getElementById('app');

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

onRender(async (name, r, args) => {
  state.session = (await sb.auth.getSession()).data.session;   // local read, no network
  if (state.session && !state.profile) await loadProfile();
  if (!r) return go(state.session ? 'passport' : '');
  if (r.user && !state.session) return go('login');
  if (r.guest && state.session && name !== 'link-problem') return go('passport');
  window.scrollTo(0, 0);
  const flash = takeFlash();
  try {
    await r.view(root, { args, state, flash });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<main class="page-error" id="main">${banner('error', 'Something went wrong on our side', 'Nothing is lost. Reload the page, or try again in a minute.')}<details class="err-details"><summary>Technical details</summary><p>${esc(e?.message || e)}</p></details><button class="c51-btn c51-btn--secondary" onclick="location.reload()">Reload</button></main>`;
  }
  const h1 = root.querySelector('h1');
  if (h1) { h1.tabIndex = -1; document.title = `${h1.textContent.trim()} · Cyprus 5+1`; }
});

async function start() {
  const params = new URLSearchParams(location.search);
  const fromEmail = params.has('code') || params.has('confirmed') || params.has('reset') || params.has('error');
  let recovery = params.has('reset');

  sb.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') { state.profile = null; go(''); }
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
