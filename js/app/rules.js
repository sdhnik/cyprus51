// The Rules dialog (RulesDesktop / RulesMobile). One instance, opened from anywhere.
import { esc, icon } from './ui.js';
import { asset } from './data.js';
import { SEASON } from '../config.js';

const RULES = [
  ['Five Cyprus half marathons', 'Nicosia, Paphos, Limassol, Larnaka and Ayia Napa. Dates are in your passport.'],
  ['One international wildcard', `Any official half marathon outside Cyprus during the ${SEASON} season.`],
  ['Submit your finish result', 'Check in at the finish with your watch time, then add the official time and a link to the results. A bib number helps us find you faster.'],
  ['Get verified. Collect the stamp.', 'Every result is checked by hand, usually within a week.'],
];

let dlg;
let opener;

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'rules';
  dlg.setAttribute('aria-labelledby', 'rules-title');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // dimmed backdrop
  dlg.addEventListener('close', () => opener?.focus?.());
}

// joinCta: show "Join the challenge" (guests) or not (signed-in runners).
export function openRules({ joinCta = false } = {}) {
  if (!dlg) build();
  opener = document.activeElement;
  dlg.innerHTML = `<div class="rules__box">
    <div class="rules__head">
      <h2 id="rules-title" class="rules__title">The rules.</h2>
      <button type="button" class="rules__close" data-close aria-label="Close rules"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>Close</button>
    </div>
    <ol class="rules__list">${RULES.map(([t, d], i) => `<li><span class="rules__n">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ol>
    <div class="rules__foot">
      <p>Full <a href="${asset('legal/terms.html')}">Terms</a> and <a href="${asset('legal/privacy.html')}">Privacy Policy</a></p>
      ${joinCta ? `<a class="c51-btn c51-btn--primary" href="#/join" data-close>Join the challenge ${icon('arrow')}</a>` : `<button type="button" class="c51-btn c51-btn--primary" data-close>Got it</button>`}
    </div>
  </div>`;
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.showModal();
  dlg.querySelector('.rules__close').focus();
}

// Any element with data-open-rules opens the dialog.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open-rules]');
  if (!t) return;
  e.preventDefault();
  openRules({ joinCta: t.dataset.openRules === 'join' });
});
