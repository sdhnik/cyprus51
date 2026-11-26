import { esc, initials } from './ui.js';
import { asset } from './data.js';
import { state } from './state.js';

// Header + footer around signed-in screens.
export function appShell(content) {
  const name = state.profile?.display_name || '';
  return `<div class="app">
    <a class="skip" href="#main">Skip to content</a>
    <header class="app__head">
      <a class="wordmark" href="#/passport">CYPRUS <span>5+1</span></a>
      <nav class="app__nav">
        <a class="avatar" href="#/account" aria-label="Account for ${esc(name)}">${esc(initials(name))}</a>
      </nav>
    </header>
    <main class="app__main" id="main">${content}</main>
    <footer class="app__foot">
      <span>Cyprus 5+1 · ${new Date().getFullYear()}</span>
      <nav><a href="${asset('legal/rules.html')}">Rules</a><a href="${asset('legal/terms.html')}">Terms</a><a href="${asset('legal/privacy.html')}">Privacy Policy</a></nav>
    </footer>
  </div>`;
}
