// "Add your race abroad" dialog: saves the runner's planned half marathon outside Cyprus.
import { sb } from './supa.js';
import { field, setError, banner, busy, esc } from './ui.js';
import { SEASON } from '../config.js';
import { combobox, countryNames } from './combobox.js';

// European date: DD.MM.YYYY on screen, YYYY-MM-DD in the database.
const toEu = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
function fromEu(text) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

let dlg;

export function openAbroad(plan, onSaved) {
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.setAttribute('aria-labelledby', 'abroad-title');
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  const opener = document.activeElement;
  dlg.onclose = () => opener?.focus?.();
  dlg.innerHTML = `<form class="c51-dialog sheet__box" novalidate>
    <div class="c51-dialog__head"><p class="c51-dialog__eyebrow">Race abroad · stamp 6</p><button type="button" class="c51-dialog__close" data-close>Close</button></div>
    <h2 id="abroad-title" class="c51-dialog__title">${plan ? 'Your race abroad' : 'Add your race abroad'}</h2>
    <p class="c51-dialog__lead">Any official half marathon outside Cyprus in ${SEASON}. It goes into your season calendar. After the race, check in and add the result like any other.</p>
    <div class="c51-dialog__body">
      <div class="form-msg" tabindex="-1"></div>
      ${field({ name: 'race_name', label: 'Race name', placeholder: 'Barcelona Half Marathon', value: plan?.race_name || '' })}
      <div class="sheet__pair">
        ${field({ name: 'race_date', label: 'Race date', inputmode: 'numeric', placeholder: 'DD.MM.YYYY', value: toEu(plan?.race_date) })}
        ${field({ name: 'country', label: 'Country', placeholder: 'Start typing, e.g. Spain', value: plan?.country || '' })}
      </div>
      ${field({ name: 'website', label: 'Race website · optional', type: 'url', inputmode: 'url', placeholder: 'https://', value: plan?.website || '', required: false })}
    </div>
    <div class="c51-dialog__actions sheet__actions">
      <button type="submit" class="c51-btn c51-btn--primary">${plan ? 'Save changes' : 'Add to my season'}</button>
      ${plan ? `<button type="button" class="c51-btn c51-btn--secondary" data-remove>Remove this race</button>` : ''}
    </div>
  </form>`;
  const f = dlg.querySelector('form');
  const country = combobox(f.country, countryNames());
  // Type digits, the dots appear by themselves: 14022027 → 14.02.2027
  f.race_date.addEventListener('input', () => {
    const d = f.race_date.value.replace(/\D/g, '').slice(0, 8);
    f.race_date.value = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.');
  });
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-remove]')?.addEventListener('click', async (e) => {
    const done = busy(e.currentTarget, 'Removing…');
    const { error } = await sb.from('abroad_plans').delete().eq('user_id', plan.user_id);
    done();
    if (error) { f.querySelector('.form-msg').innerHTML = banner('error', '', 'Could not remove it. Try again in a minute.'); return; }
    dlg.close(); onSaved?.();
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = { race_name: f.race_name.value.trim(), race_date: fromEu(f.race_date.value), country: f.country.value.trim(), website: f.website.value.trim() };
    ['race_name', 'race_date', 'country', 'website'].forEach((n) => setError(f, n, ''));
    let first = null;
    if (v.race_name.length < 2) first ??= setError(f, 'race_name', 'Enter the race name.');
    if (!v.race_date) first ??= setError(f, 'race_date', 'Enter the date as DD.MM.YYYY, e.g. 14.02.2027.');
    else if (!v.race_date.startsWith(String(SEASON))) first ??= setError(f, 'race_date', `The race has to be in ${SEASON}.`);
    if (!country.valid()) first ??= setError(f, 'country', 'Pick a country from the list.');
    if (v.website && !/^https?:\/\//.test(v.website)) v.website = 'https://' + v.website;
    if (v.website && !/^https:\/\/[^\s.]+\.[^\s]+$/.test(v.website)) first ??= setError(f, 'website', 'Enter a web address, or leave it empty.');
    if (/^http:/.test(v.website)) v.website = v.website.replace(/^http:/, 'https:');
    if (first) return first.focus();
    const done = busy(f.querySelector('[type=submit]'), 'Saving…');
    const { error } = await sb.from('abroad_plans').upsert({ ...v, website: v.website || null, updated_at: new Date().toISOString() });
    done();
    if (error) { f.querySelector('.form-msg').innerHTML = banner('error', '', `Could not save. ${esc(error.message)}`); return; }
    dlg.close(); onSaved?.();
  });
  dlg.showModal();
  f.race_name.focus();
}
