// Public home (Main / HomeMobile designs) with the Rules dialog (RulesDesktop / RulesMobile).
import { esc, icon } from '../ui.js';
import { asset } from '../data.js';

const RULES = [
  ['Five Cyprus half marathons', 'Nicosia, Paphos, Limassol, Larnaka and Ayia Napa. Dates are in your passport.'],
  ['One international wildcard', 'Any official half marathon outside Cyprus during the 2027 season.'],
  ['Submit your finish result', 'Your time and a link to the official results. A bib number helps us find you faster.'],
  ['Get verified. Collect the stamp.', 'Every result is checked by hand, usually within a week.'],
];
const TICKER = ['Cyprus 5+1', 'Six finish lines', 'One passport', 'Mediterranean coastal run'];

export function home(root, { args } = {}) {
  root.innerHTML = `<div class="home">
    <header class="home__head">
      <a class="wordmark" href="#/">CYPRUS <span>5+1</span></a>
      <nav class="home__nav">
        <button type="button" class="c51-btn c51-btn--outline c51-btn--sm" data-rules>Rules</button>
        <a class="c51-btn c51-btn--dark c51-btn--sm" href="#/login">Log in</a>
      </nav>
    </header>
    <main class="home__main" id="main">
      <div class="home__photo">
        <img src="${asset('assets/img/runner-old-town.webp')}" alt="A runner in an orange shirt on a stone street in an old Cypriot town">
        <div class="home__fade" aria-hidden="true"></div>
        <p class="home__tag">THE FINISHER’S ATLAS / 2027</p>
      </div>
      <div class="home__copy">
        <p class="home__eyebrow">THE FINISHER’S ATLAS — SEASON 2027</p>
        <div>
          <h1 class="home__title">Run<br class="home__br"> beyond.</h1>
          <p class="home__badge">5+1 CHALLENGE</p>
        </div>
        <p class="home__lead">Five half marathons across Cyprus. One international adventure. Six finish lines to collect in your running passport.</p>
        <div><a class="c51-btn c51-btn--primary home__cta" href="#/join"><span>Join the challenge</span>${icon('arrow')}</a></div>
        <p class="home__note"><span aria-hidden="true">✳</span>5 CYPRUS RACES · 1 INTERNATIONAL</p>
      </div>
    </main>
    <div class="c51-ticker home__ticker" aria-label="${esc(TICKER.join(', '))}"><div class="c51-ticker__track" aria-hidden="true">${TICKER.concat(TICKER).map((t) => `<span class="c51-ticker__item">${esc(t)}</span>`).join('')}</div></div>
  </div>
  <dialog class="rules" aria-labelledby="rules-title"><div class="rules__box">
    <div class="rules__head">
      <h2 id="rules-title" class="rules__title">The rules.</h2>
      <button type="button" class="rules__close" data-close aria-label="Close rules"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>Close</button>
    </div>
    <ol class="rules__list">${RULES.map(([t, d], i) => `<li><span class="rules__n">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join('')}</ol>
    <div class="rules__foot">
      <p>Full <a href="${asset('legal/terms.html')}">Terms</a> and <a href="${asset('legal/privacy.html')}">Privacy Policy</a></p>
      <a class="c51-btn c51-btn--primary" href="#/join" data-close-nav>Join the challenge ${icon('arrow')}</a>
    </div>
  </div></dialog>`;

  const dlg = root.querySelector('.rules');
  const open = () => { dlg.showModal(); dlg.querySelector('[data-close]').focus(); };
  root.querySelector('[data-rules]').addEventListener('click', open);
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-close-nav]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // click on the dimmed backdrop
  if (args?.[0] === 'rules') open();
}
