// "Add your race abroad" dialog: saves the runner's planned half marathon outside Cyprus.
import { sb } from './supa.js';
import { field, setError, banner, busy, esc } from './ui.js';
import { SEASON } from '../config.js';

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
        ${field({ name: 'race_date', label: 'Race date', type: 'date', value: plan?.race_date || '' })}
        ${field({ name: 'country', label: 'Country', autocomplete: 'country-name', placeholder: 'Spain', value: plan?.country || '' })}
      </div>
      ${field({ name: 'website', label: 'Race website · optional', type: 'url', inputmode: 'url', placeholder: 'https://', value: plan?.website || '', required: false })}
    </div>
    <div class="c51-dialog__actions sheet__actions">
      <button type="submit" class="c51-btn c51-btn--primary">${plan ? 'Save changes' : 'Add to my season'}</button>
      ${plan ? `<button type="button" class="c51-btn c51-btn--secondary" data-remove>Remove this race</button>` : ''}
    </div>
  </form>`;
  const f = dlg.querySelector('form');
  f.race_date.min = `${SEASON}-01-01`;
  f.race_date.max = `${SEASON}-12-31`;
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
    const v = { race_name: f.race_name.value.trim(), race_date: f.race_date.value, country: f.country.value.trim(), website: f.website.value.trim() };
    ['race_name', 'race_date', 'country', 'website'].forEach((n) => setError(f, n, ''));
    let first = null;
    if (v.race_name.length < 2) first ??= setError(f, 'race_name', 'Enter the race name.');
    if (!v.race_date) first ??= setError(f, 'race_date', 'Pick the race date.');
    else if (!v.race_date.startsWith(String(SEASON))) first ??= setError(f, 'race_date', `The race has to be in ${SEASON}.`);
    if (v.country.length < 2) first ??= setError(f, 'country', 'Enter the country.');
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
