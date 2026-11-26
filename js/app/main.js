import { sb } from './supa.js';
import { route, onRender, render, go, takeFlash } from './router.js';
import * as auth from './views/auth.js';
import { passport } from './views/passport.js';
import { account } from './views/account.js';
import { banner } from './ui.js';
import { state, loadProfile } from './state.js';

const root = document.getElementById('app');

route('login', auth.login, { guest: true });
route('join', auth.join, { guest: true });
route('forgot', auth.forgot, { guest: true });
route('reset', auth.reset, { user: true });
route('link-problem', auth.linkProblem, { guest: true });
route('passport', passport, { user: true });
route('account', account, { user: true });

onRender(async (name, r, args) => {
  state.session = (await sb.auth.getSession()).data.session;   // local read, no network
  if (state.session && !state.profile) await loadProfile();
  if (!r) return go(state.session ? 'passport' : 'login');
  if (r.user && !state.session) return go('login');
  if (r.guest && state.session && name !== 'link-problem') return go('passport');
  window.scrollTo(0, 0);
  const flash = takeFlash();
  try {
    await r.view(root, { args, state, flash });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<main class="page-error" id="main">${banner('error', 'Something went wrong on our side', 'Nothing is lost. Reload the page, or try again in a minute.')}<button class="c51-btn c51-btn--secondary" onclick="location.reload()">Reload</button></main>`;
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
    if (event === 'SIGNED_OUT') { state.profile = null; go('login'); }
  });

  const { data } = await sb.auth.getSession();   // also finishes the login from an email link
  state.session = data.session;
  if (state.session) await loadProfile();

  if (fromEmail) {
    history.replaceState(null, '', location.pathname + location.hash);   // drop ?code=… from the address
    if (!state.session) return go('link-problem');
    if (recovery) return go('reset');
    if (params.has('confirmed')) return go('passport', { flash: banner('success', 'Email confirmed', 'Welcome to Cyprus 5+1. Your passport is ready.') });
  }
  render();
}

start();
