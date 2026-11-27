// "Keep your passport on your home screen" (CheckIn design, screen 6).
// iPhone shows the Safari steps; Android/Chrome shows an Install button.
// On the passport: once after sign-up and again in race week. Always in Account.
import { esc, icon } from './ui.js';

let deferred = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; dispatchEvent(new Event('c51:installable')); });
addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('c51-installed', '1'); } catch { /* blocked */ } });

export const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const phone = () => matchMedia('(pointer: coarse)').matches;
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } };

const SHARE = 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7';
const ADD = 'M4 4h16v16H4zM12 8v8M8 12h8';
const svg = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

function body(closable) {
  const x = closable ? `<button type="button" class="inst__x" data-inst-close aria-label="Close">×</button>` : '';
  const lead = '<p class="inst__lead">Check in at the finish in one tap, even without signal.</p>';
  if (ios()) {
    return `<p class="inst__os">iPhone</p>${x}<h2 class="inst__t">Keep your passport on your home screen</h2>${lead}
      <ol class="inst__steps"><li><span>${svg(SHARE)}</span><p>Tap <b>Share</b> in Safari</p></li><li><span>${svg(ADD)}</span><p>Choose <b>Add to Home Screen</b></p></li></ol>`;
  }
  return `<p class="inst__os">${phone() ? 'Android' : 'This computer'}</p>${x}<h2 class="inst__t">Keep your passport on your home screen</h2>${lead}
    <ol class="inst__steps"><li><span>${svg(ADD)}</span><p>Tap <b>Install</b> below</p></li></ol>
    <button type="button" class="c51-btn c51-btn--primary c51-btn--block" data-inst-go>Install</button>`;
}

const canOffer = () => !installed() && (ios() || deferred);

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
