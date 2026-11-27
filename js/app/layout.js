import { esc, initials, stravaMark } from './ui.js';
import { asset } from './data.js';
import { state } from './state.js';
import { sb } from './supa.js';
import { SEASON, STRAVA_CLUB_URL } from '../config.js';
import './rules.js';

// Header + footer around signed-in screens. The avatar opens the profile menu (ProfileMenuOpen design).
export function appShell(content) {
  const name = state.profile?.display_name || '';
  const email = state.session?.user?.email || '';
  return `<div class="app">
    <a class="skip" href="#main">Skip to content</a>
    <header class="app__head">
      <a class="wordmark" href="#/passport">CYPRUS <span>5+1</span></a>
      <div class="pmenu">
        <button type="button" class="avatar" aria-haspopup="menu" aria-expanded="false" aria-controls="pmenu" aria-label="Account menu for ${esc(name)}">${esc(initials(name || email))}</button>
        <div class="c51-menu pmenu__list" id="pmenu" role="menu" hidden>
          <div class="c51-menu__who"><p class="c51-menu__name">${esc(name)}</p><p class="c51-menu__email">${esc(email)}</p></div>
          <a class="c51-menu__item" role="menuitem" href="#/passport">Passport</a>
          <a class="c51-menu__item" role="menuitem" href="#/account">Account details</a>
          <a class="c51-menu__item" role="menuitem" href="#/account/password">Change password</a>
          <button type="button" class="c51-menu__item" role="menuitem" data-open-rules>Rules</button>
          ${state.profile?.is_admin ? `<a class="c51-menu__item" role="menuitem" href="#/admin">Review results</a>` : ''}
          <button type="button" class="c51-menu__item has-divider" role="menuitem" data-logout>Log out</button>
        </div>
      </div>
    </header>
    ${state.profile?.test_today ? `<p class="testbar" role="status"><b>Test account</b> · today is ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(state.profile.test_today + 'T12:00:00')).replace(',', '')} · not counted in stats</p>` : ''}
    <main class="app__main" id="main">${content}</main>
    <footer class="app__foot">
      <span>Cyprus 5+1 · ${SEASON}</span>
      <nav aria-label="Rules and legal"><button type="button" data-open-rules>Rules</button><a href="${asset('legal/terms.html')}">Terms</a><a href="${asset('legal/privacy.html')}">Privacy Policy</a><a href="${STRAVA_CLUB_URL}" target="_blank" rel="noopener" class="app__strava">${stravaMark()}<span>club</span></a></nav>
    </footer>
  </div>`;
}

// Profile menu behaviour, wired once for the whole app.
function toggle(btn, list, show, refocus = true) {
  list.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
  btn.classList.toggle('is-open', show);
  if (!show && refocus) btn.focus();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-logout]')) sb.auth.signOut();
  const btn = e.target.closest('.pmenu .avatar');
  const open = document.querySelector('.pmenu__list:not([hidden])');
  if (btn) {
    const list = btn.nextElementSibling;
    const show = list.hidden;
    toggle(btn, list, show, false);
    if (show) list.querySelector('[role=menuitem]')?.focus();
    return;
  }
  if (!open) return;
  if (!e.target.closest('.pmenu__list')) toggle(open.previousElementSibling, open, false, false);
  else if (e.target.closest('[role=menuitem]')) toggle(open.previousElementSibling, open, false, false);
});

document.addEventListener('keydown', (e) => {
  const list = document.querySelector('.pmenu__list:not([hidden])');
  if (!list) return;
  const items = [...list.querySelectorAll('[role=menuitem]')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') toggle(list.previousElementSibling, list, false);
  else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === 'Tab') toggle(list.previousElementSibling, list, false, false);
});

// Hairline under the sticky header once the page is scrolled.
addEventListener('scroll', () => {
  document.querySelector('.app__head')?.classList.toggle('is-stuck', scrollY > 4);
}, { passive: true });
