// Small helpers for building screens with template strings.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  ext: 'M7 17 17 7M8 7h9v9',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 12l5 5 9-10',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
};
export const icon = (name, size = 18) =>
  `<svg class="c51-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

export function field({ name, label, type = 'text', autocomplete = 'off', placeholder = '', hint = '', value = '', inputmode = '', reveal = false, required = true }) {
  const id = `f-${name}`;
  const desc = hint ? `${id}-hint` : '';
  return `<div class="c51-field" data-field="${name}">
    <div class="c51-field__box">
      <label class="c51-field__label" for="${id}">${esc(label)}</label>
      <div class="c51-field__row">
        <input class="c51-field__input" id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}"
          ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}" value="${esc(value)}"
          ${required ? 'required' : ''} ${desc ? `aria-describedby="${desc}"` : ''}>
        ${reveal ? `<button type="button" class="c51-field__reveal" data-reveal="${id}" aria-controls="${id}" aria-pressed="false">${icon('eye')}<span>Show</span></button>` : ''}
      </div>
    </div>
    ${hint ? `<p class="c51-field__hint" id="${desc}">${esc(hint)}</p>` : ''}
    <p class="c51-field__error" id="${id}-err" hidden></p>
  </div>`;
}

// Shows or clears an error under a field. Returns the input for focusing.
export function setError(form, name, msg) {
  const wrap = form.querySelector(`[data-field="${name}"]`);
  if (!wrap) return null;
  const input = wrap.querySelector('input');
  const err = wrap.querySelector('.c51-field__error');
  wrap.classList.toggle('is-error', !!msg);
  err.hidden = !msg;
  err.innerHTML = msg ? `${icon('alert', 16)}<span>${esc(msg)}</span>` : '';
  if (input.dataset.desc === undefined) input.dataset.desc = input.getAttribute('aria-describedby') || '';
  const ids = `${input.dataset.desc} ${msg ? err.id : ''}`.trim();
  if (ids) input.setAttribute('aria-describedby', ids); else input.removeAttribute('aria-describedby');
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  return input;
}

export function banner(tone, title, text = '') {
  const ic = tone === 'success' ? 'check' : tone === 'pending' ? 'clock' : 'alert';
  return `<div class="c51-banner c51-banner--${tone}" role="${tone === 'error' ? 'alert' : 'status'}">${icon(ic)}<div class="c51-banner__text">${title ? `<p class="c51-banner__title">${esc(title)}</p>` : ''}${text ? `<p>${text}</p>` : ''}</div></div>`;
}

// Wires the Show/Hide password buttons inside a container.
export function wireReveal(root) {
  root.querySelectorAll('[data-reveal]').forEach((b) => {
    b.addEventListener('click', () => {
      const input = root.querySelector('#' + b.dataset.reveal);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.innerHTML = `${icon(show ? 'eyeOff' : 'eye')}<span>${show ? 'Hide' : 'Show'}</span>`;
    });
  });
}

// Puts a button into a loading state; returns a function that restores it.
export function busy(btn, label = 'Please wait…') {
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.innerHTML = `<span class="c51-spinner" aria-hidden="true"></span><span>${esc(label)}</span>`;
  return () => { btn.disabled = false; btn.classList.remove('is-loading'); btn.innerHTML = html; };
}

export const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Time fields: type digits, the colons appear by themselves (14410 → 1:44:10).
export function wireTime(input) {
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 6);
    if (d.length <= 2) { input.value = d; return; }
    const s = d.slice(-2), rest = d.slice(0, -2);
    input.value = rest.length <= 2 ? `${rest}:${s}` : `${rest.slice(0, -2)}:${rest.slice(-2)}:${s}`;
  });
}

// Link to the Cyprus 5+1 club on Strava. "Strava" in Strava orange and bold, as their guidelines ask
// for links to Strava; an official Strava logo file can replace the word later.
export const stravaLink = (url, label = 'club', cls = '') =>
  `<a class="strava-link ${cls}" href="${url}" target="_blank" rel="noopener"><span>Join the</span> <b class="strava-word">Strava</b> <span>${label}</span>${icon('ext', 14)}</a>`;
