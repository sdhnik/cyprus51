// Public home (Main / HomeMobile designs) with the Rules dialog (RulesDesktop / RulesMobile).
import { esc, icon, stravaMark } from '../ui.js';
import { asset } from '../data.js';
import { openRules } from '../rules.js';
import { STRAVA_CLUB_URL } from '../../config.js';

const TICKER = ['Cyprus 5+1', 'Six finish lines', 'One passport', 'Mediterranean coastal run'];

export function home(root, { args } = {}) {
  root.innerHTML = `<div class="home">
    <header class="home__head">
      <a class="wordmark" href="#/">CYPRUS <span>5+1</span></a>
      <nav class="home__nav">
        <button type="button" class="c51-btn c51-btn--outline c51-btn--sm" data-open-rules="join">Rules</button>
        <a class="c51-btn c51-btn--dark c51-btn--sm" href="#/login">Log in</a>
      </nav>
    </header>
    <main class="home__main" id="main">
      <div class="home__photo">
        <img src="${asset('assets/img/runner-old-town.webp')}" alt="A runner in an orange shirt on a stone street in an old Cypriot town">
        <div class="home__fade" aria-hidden="true"></div>
        <p class="home__tag">THE FINISHER’S ATLAS · SEASON 2027</p>
      </div>
      <div class="home__copy">
        <p class="home__eyebrow">THE FINISHER’S ATLAS · SEASON 2027</p>
        <div>
          <h1 class="home__title">Run<br class="home__br"> beyond.</h1>
          <p class="home__badge">5+1 CHALLENGE</p>
        </div>
        <p class="home__lead">Five half marathons across Cyprus. One international adventure. Six finish lines to collect in your running passport.</p>
        <div class="home__actions"><a class="c51-btn c51-btn--primary home__cta" href="#/join"><span>Join the challenge</span>${icon('arrow')}</a><a class="c51-btn c51-btn--secondary home__strava" href="${STRAVA_CLUB_URL}" target="_blank" rel="noopener">${stravaMark()}<span>club</span>${icon('ext', 16)}</a></div>
        <p class="home__note"><span aria-hidden="true">✳</span>5 CYPRUS RACES · 1 INTERNATIONAL</p>
      </div>
    </main>
    <div class="c51-ticker home__ticker" aria-label="${esc(TICKER.join(', '))}"><div class="c51-ticker__track" aria-hidden="true"></div></div>
  </div>`;

  fillTicker(root.querySelector('.home__ticker .c51-ticker__track'));

  if (args?.[0] === 'rules') openRules({ joinCta: true });
}

// Endless ticker: one group of items is repeated until it is wider than the screen,
// then the group is doubled and the track moves by exactly one group (-50%).
// Speed stays the same on every screen width.
function fillTicker(track) {
  const item = (t) => `<span class="c51-ticker__item">${esc(t)}</span>`;
  const build = () => {
    track.innerHTML = TICKER.map(item).join('');
    const one = track.scrollWidth || 1;
    const reps = Math.max(1, Math.ceil((window.innerWidth + one) / one));
    const group = Array.from({ length: reps }, () => TICKER.map(item).join('')).join('');
    track.innerHTML = group + group;
    track.style.animationDuration = `${Math.round((one * reps) / 70)}s`;   // ~70 px per second
  };
  build();
  document.fonts?.ready.then(() => track.isConnected && build());   // re-measure with the real font
  let w = window.innerWidth;
  const onResize = () => {
    if (!track.isConnected) return window.removeEventListener('resize', onResize);
    if (window.innerWidth > w) { w = window.innerWidth; build(); }
  };
  window.addEventListener('resize', onResize);
}
