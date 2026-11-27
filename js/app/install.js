// "Keep your passport on your home screen" (CheckIn design, screen 6).
// iPhone shows the Safari steps; Android/Chrome shows an Install button.
// On the passport: once after sign-up and again in race week. Always in Account.
import { esc, icon } from './ui.js';

let deferred = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  // A card already on screen (with manual steps) switches to the Install button.
  document.querySelectorAll('[data-inst]').forEach((card) => {
    card.innerHTML = body(!!card.querySelector('[data-inst-close]'));
    wireInstall(card.parentElement);
  });
  dispatchEvent(new Event('c51:installable'));
});
addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('c51-installed', '1'); } catch { /* blocked */ } });

export const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const phone = () => matchMedia('(pointer: coarse)').matches;
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };

const SHARE = 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7';
const ADD = 'M4 4h16v16H4zM12 8v8M8 12h8';
const MORE = 'M5 12h.01M12 12h.01M19 12h.01';
const svg = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// Which phone and browser, so the steps match what the runner sees.
function device() {
  const ua = navigator.userAgent;
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Telegram|WhatsApp|Snapchat|TikTok|LinkedInApp/i.test(ua);
  if (ios()) {
    const b = /CriOS/i.test(ua) ? 'Chrome' : /FxiOS/i.test(ua) ? 'Firefox' : /EdgiOS/i.test(ua) ? 'Edge' : inApp ? '' : 'Safari';
    if (!b) return { os: 'iPhone', steps: [[MORE, 'Open this page in <b>Safari</b> (menu ••• → Open in browser)'], [SHARE, 'Tap <b>Share</b>, then <b>Add to Home Screen</b>']] };
    if (b === 'Safari') return { os: 'iPhone · Safari', steps: [[SHARE, 'Tap <b>Share</b> in Safari'], [ADD, 'Choose <b>Add to Home Screen</b>']] };
    if (b === 'Chrome') return { os: 'iPhone · Chrome', steps: [[SHARE, 'Tap <b>Share</b> in the address bar'], [ADD, 'Choose <b>Add to Home Screen</b>']] };
    return { os: `iPhone · ${b}`, steps: [[MORE, 'Open the browser <b>menu</b>, then <b>Share</b>'], [ADD, 'Choose <b>Add to Home Screen</b>']] };
  }
  const label = phone() ? 'Android' : 'This computer';
  if (deferred) return { os: label, steps: [[ADD, 'Tap <b>Install</b> below']], button: true };
  if (inApp) return { os: label, steps: [[MORE, 'Open this page in <b>Chrome</b> (menu ⋮ → Open in browser)'], [ADD, 'Then menu ⋮ → <b>Install app</b>']] };
  const b = /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /Firefox/i.test(ua) ? 'Firefox' : '';
  return { os: b ? `${label} · ${b}` : label, steps: [[MORE, 'Open the browser <b>menu</b> (⋮ or ☰)'], [ADD, `Choose <b>${b === 'Samsung Internet' ? 'Add page to → Home screen' : 'Install app'}</b> or <b>Add to Home screen</b>`]] };
}

function body(closable) {
  const d = device();
  const x = closable ? `<button type="button" class="inst__x" data-inst-close aria-label="Close">×</button>` : '';
  return `<p class="inst__os">${esc(d.os)}</p>${x}<h2 class="inst__t">Keep your passport on your home screen</h2>
    <p class="inst__lead">Check in at the finish in one tap, even without signal.</p>
    <ol class="inst__steps">${d.steps.map(([ic, t]) => `<li><span>${svg(ic)}</span><p>${t}</p></li>`).join('')}</ol>
    ${d.button ? '<button type="button" class="c51-btn c51-btn--primary c51-btn--block" data-inst-go>Install</button>' : ''}`;
}

const canOffer = () => !installed() && (ios() || deferred || phone());

// Passport card: first visit after sign-up, then in each race week until closed for that race.
export function installCard(nextRace, daysToRace) {
  if (!canOffer() || !phone()) return '';
  const raceWeek = nextRace && daysToRace != null && daysToRace >= 0 && daysToRace <= 7;
  const firstTime = !get('c51-install-seen');
  if (!firstTime && !(raceWeek && get('c51-install-closed') !== nextRace)) return '';
  return `<section class="card inst" data-inst data-race="${esc(nextRace || '')}" aria-label="Install the app">${body(true)}</section>`;
}

export function wireInstall(root, onDone = () => {}) {
  const card = root.querySelector('[data-inst]');
  if (!card) return;
  set('c51-install-seen', '1');
  card.querySelector('[data-inst-close]')?.addEventListener('click', () => {
    if (card.dataset.race) set('c51-install-closed', card.dataset.race);
    card.remove();
  });
  card.querySelector('[data-inst-go]')?.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === 'accepted') { card.remove(); onDone(); }
  });
}

// Account section: always there, with the right words for the device.
export function installSection() {
  let inner;
  if (installed()) inner = `<p class="acc__sub">${icon('check', 16)} The app is on this device. Open it from your home screen.</p>`;
  else if (canOffer()) inner = `<div class="inst inst--plain" data-inst>${body(false)}</div>`;
  else inner = `<p class="acc__sub">Open this site in Safari on iPhone or in Chrome on Android, then add it to your home screen. You can check in at the finish in one tap, even without signal.</p>`;
  return `<section class="card acc__card" id="install" aria-labelledby="inst-title"><div><h2 id="inst-title" class="h2">Install app</h2></div>${inner}</section>`;
}
