// Log in, join, forgot password, set new password.
import { sb, APP_URL, authMessage } from '../supa.js';
import { field, setError, banner, wireReveal, busy, esc, icon } from '../ui.js';
import { asset } from '../data.js';
import { go } from '../router.js';
import '../rules.js';

const LEGAL = (page) => asset(`legal/${page}.html`);

function shell({ eyebrow, title, lead, body, foot = '' }) {
  return `<div class="auth">
    <div class="auth__main">
      <header class="auth__head">
        <a class="wordmark" href="#/">CYPRUS <span>5+1</span></a>
        <a class="auth__home" href="#/">${icon('back')}Home</a>
      </header>
      <main class="auth__body" id="main">
        <div class="auth__inner">
          <p class="eyebrow">${eyebrow}</p>
          <h1 class="auth__title">${title}</h1>
          ${lead ? `<p class="auth__lead">${lead}</p>` : ''}
          <div class="auth__slot">${body}</div>
          ${foot ? `<p class="auth__foot">${foot}</p>` : ''}
        </div>
      </main>
    </div>
    <aside class="auth__side" aria-hidden="true">
      <img src="${asset('assets/img/runner-old-town.webp')}" alt="">
      <div class="auth__band"><p class="auth__band-big">Six finish lines.<br>One passport.</p><p class="auth__band-small">Every runner. Every pace. You belong here.</p></div>
    </aside>
  </div>`;
}

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// Shows a general error above the form, or under the field it belongs to.
function showError(form, err, { asBanner = false } = {}) {
  const m = authMessage(err);
  if (asBanner) m.field = '';
  const box = form.querySelector('.form-msg');
  if (m.field && form.querySelector(`[data-field="${m.field}"]`)) {
    box.innerHTML = '';
    setError(form, m.field, m.text)?.focus();
  } else if (m.field === 'adult') {
    const c = form.querySelector('.c51-check');
    c.classList.add('is-error');
    box.innerHTML = banner('error', '', esc(m.text));
  } else {
    box.innerHTML = banner('error', '', esc(m.text));
    box.querySelector('[role]')?.focus?.();
  }
}

export function login(root, { notice, flash } = {}) {
  notice = notice || flash || '';
  root.innerHTML = shell({
    eyebrow: 'RUNNER LOGIN',
    title: 'Welcome back.',
    lead: 'Your passport is waiting.',
    body: `<form class="form" novalidate>
      <div class="form-msg" tabindex="-1">${notice || ''}</div>
      ${field({ name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' })}
      ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', reveal: true })}
      <a class="form__aside" href="#/forgot">Forgot password?</a>
      <button class="c51-btn c51-btn--primary c51-btn--block" type="submit">Log in ${icon('arrow')}</button>
    </form>`,
    foot: `New to Cyprus 5+1? <a href="#/join">Join the challenge</a>`,
  });
  const form = root.querySelector('form');
  wireReveal(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), password = form.password.value;
    setError(form, 'email', ''); setError(form, 'password', '');
    if (!emailOk(email)) return setError(form, 'email', 'Enter the email you joined with.').focus();
    if (!password) return setError(form, 'password', 'Enter your password.').focus();
    const done = busy(form.querySelector('[type=submit]'), 'Logging in…');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    done();
    if (error) return showError(form, error, { asBanner: true });
    go('passport');
  });
}

export function join(root) {
  root.innerHTML = shell({
    eyebrow: 'JOIN THE CHALLENGE',
    title: 'Your next<br>start line.',
    lead: 'One account, one passport, six finish lines.',
    body: `<form class="form" novalidate>
      <div class="form-msg" tabindex="-1"></div>
      ${field({ name: 'name', label: 'Full name', autocomplete: 'name', placeholder: 'Alex Runner', hint: 'As it appears in race results.' })}
      ${field({ name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' })}
      ${field({ name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', placeholder: 'Create a password', hint: 'At least 8 characters.', reveal: true })}
      <div class="c51-check">
        <label class="c51-check__row">
          <input class="c51-check__input" type="checkbox" name="adult" required>
          <span class="c51-check__box">${icon('check', 16)}</span>
          <span class="c51-check__label">I'm 18 or older and agree to the <a href="${LEGAL('rules')}" data-open-rules>Rules</a>, <a href="${LEGAL('terms')}" target="_blank">Terms</a> and <a href="${LEGAL('privacy')}" target="_blank">Privacy Policy</a>.</span>
        </label>
      </div>
      <button class="c51-btn c51-btn--primary c51-btn--block" type="submit">Create my passport ${icon('arrow')}</button>
    </form>`,
    foot: `Already have a passport? <a href="#/login">Log in</a>`,
  });
  const form = root.querySelector('form');
  wireReveal(form);
  form.adult.addEventListener('change', () => form.querySelector('.c51-check').classList.remove('is-error'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim(), email = form.email.value.trim(), password = form.password.value;
    ['name', 'email', 'password'].forEach((n) => setError(form, n, ''));
    form.querySelector('.form-msg').innerHTML = '';
    let first = null;
    if (!name) { const el = setError(form, 'name', 'Enter your name.'); first ??= el; }
    if (!emailOk(email)) { const el = setError(form, 'email', 'Enter a valid email address.'); first ??= el; }
    if (password.length < 8) { const el = setError(form, 'password', 'Use at least 8 characters.'); first ??= el; }
    if (!form.adult.checked) {
      form.querySelector('.c51-check').classList.add('is-error');
      form.querySelector('.form-msg').innerHTML = banner('error', '', 'Confirm you are 18 or older and accept the Rules, Terms and Privacy Policy.');
      first ??= form.adult;
    }
    if (first) return first.focus();
    const done = busy(form.querySelector('[type=submit]'), 'Creating your passport…');
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { emailRedirectTo: APP_URL + '?confirmed=1', data: { display_name: name, adult_confirmed: true } },
    });
    done();
    if (error) return showError(form, error);
    if (data.session) return go('passport');   // email confirmation switched off
    checkInbox(root, email);
  });
}

function checkInbox(root, email) {
  root.querySelector('.auth__slot').innerHTML = `<div class="form">
    ${banner('success', 'Check your inbox', `We sent a link to <strong>${esc(email)}</strong>. Open it on this device to activate your passport.`)}
    <p class="muted">No email after a few minutes? Check spam, or <a href="#/join">try again</a>.</p>
  </div>`;
  root.querySelector('.auth__lead').textContent = 'Almost there.';
  root.querySelector('.auth__foot').innerHTML = `Already confirmed? <a href="#/login">Log in</a>`;
}

export function forgot(root, { flash } = {}) {
  root.innerHTML = shell({
    eyebrow: 'ACCOUNT ACCESS',
    title: 'Reset your<br>password.',
    lead: 'Enter the email you joined with. We’ll send you a link to set a new password.',
    body: `<form class="form" novalidate>
      <div class="form-msg" tabindex="-1">${flash || ''}</div>
      ${field({ name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com', inputmode: 'email' })}
      <button class="c51-btn c51-btn--primary c51-btn--block" type="submit">Send reset link ${icon('arrow')}</button>
    </form>`,
    foot: `Remembered it? <a href="#/login">Log in</a>`,
  });
  const form = root.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    setError(form, 'email', '');
    if (!emailOk(email)) return setError(form, 'email', 'Enter the email you joined with.').focus();
    const done = busy(form.querySelector('[type=submit]'), 'Sending…');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL + '?reset=1' });
    done();
    // Other errors are not shown, so the page never reveals whether an email has an account.
    if (error && (error.status === 429 || !error.status || error.code === 'email_address_invalid')) return showError(form, error);
    root.querySelector('.auth__slot').innerHTML = `<div class="form">
      ${banner('success', 'Check your inbox', `If there is a passport for <strong>${esc(email)}</strong>, a reset link is on its way. It works for 60 minutes.`)}
      <a class="c51-btn c51-btn--primary c51-btn--block" href="#/login">Back to log in</a>
    </div>`;
  });
}

export function reset(root) {
  root.innerHTML = shell({
    eyebrow: 'ACCOUNT ACCESS',
    title: 'Set a new<br>password.',
    lead: 'Choose a new password for your passport.',
    body: `<form class="form" novalidate>
      <div class="form-msg" tabindex="-1"></div>
      ${field({ name: 'password', label: 'New password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters.', reveal: true })}
      <button class="c51-btn c51-btn--primary c51-btn--block" type="submit">Save password ${icon('arrow')}</button>
    </form>`,
  });
  const form = root.querySelector('form');
  wireReveal(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = form.password.value;
    setError(form, 'password', '');
    if (password.length < 8) return setError(form, 'password', 'Use at least 8 characters.').focus();
    const done = busy(form.querySelector('[type=submit]'), 'Saving…');
    const { error } = await sb.auth.updateUser({ password });
    done();
    if (error) return showError(form, error);
    go('passport', { flash: banner('success', 'Password changed', 'You are logged in with your new password.') });
  });
}

// Shown when a link from an email could not finish the sign-in here: it expired, or it was
// opened in another browser (for example the Gmail app's own browser).
export function linkProblem(root) {
  login(root, {
    notice: banner('pending', 'This link did not work here', 'It may have expired, or it was opened in a different browser. Log in below, or ask for a new link.'),
  });
}
