// "Add your race abroad" dialog: saves the runner's planned half marathon outside Cyprus.
import { sb } from './supa.js';
import { field, setError, banner, busy, esc } from './ui.js';
import { SEASON } from '../config.js';
import { combobox, countryNames } from './combobox.js';
import { parseGpx } from './data.js';

// Course GPX of the race abroad lives in storage: gpx/<user id>/abroad-course.gpx
const cache = new Map();
export function planCourse(plan) {
  if (!plan?.course_gpx) return Promise.resolve(null);
  const key = plan.course_gpx + plan.updated_at;
  if (!cache.has(key)) {
    cache.set(key, sb.storage.from('gpx').download(plan.course_gpx)
      .then(({ data, error }) => { if (error) throw error; return data.text(); })
      .then(parseGpx));
  }
  return cache.get(key);
}
const kmText = (c) => `${c.km.toFixed(1)} km · ${c.gain} m climb`;

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
      <div class="c51-field gpxpick" data-field="gpx">
        <div class="gpxpick__box">
          <span class="gpxpick__icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 3-4 6 6"/><path d="M3 21h18"/></svg></span>
          <div class="gpxpick__txt"><p class="gpxpick__label">Course GPX · optional</p><p class="gpxpick__value" data-gpx-value></p></div>
          <label class="c51-btn c51-btn--secondary c51-btn--sm gpxpick__btn"><span data-gpx-btn></span><input type="file" name="gpx" accept=".gpx,application/gpx+xml" class="sr-only"></label>
          <button type="button" class="gpxpick__x" data-gpx-remove aria-label="Remove the course file" title="Remove">×</button>
        </div>
        <p class="c51-field__hint">From the race website, Strava or Garmin. Draws the elevation profile.</p>
        <p class="c51-field__error" id="err-gpx" hidden></p>
      </div>
      ${field({ name: 'website', label: 'Race website · optional', type: 'url', inputmode: 'url', placeholder: 'https://', value: plan?.website || '', required: false })}
    </div>
    <div class="c51-dialog__actions sheet__actions">
      <button type="submit" class="c51-btn c51-btn--primary">${plan ? 'Save changes' : 'Add to my season'}</button>
      ${plan ? `<button type="button" class="c51-btn c51-btn--secondary" data-remove>Remove this race</button>` : ''}
    </div>
  </form>`;
  const f = dlg.querySelector('form');
  f.race_name.maxLength = 80;
  f.website.maxLength = 300;
  const country = combobox(f.country, countryNames());

  // Course file: keep the old one, replace it with a new one, or remove it.
  let gpx = { keep: !!plan?.course_gpx, text: null, info: '' };
  const gv = f.querySelector('[data-gpx-value]'), gb = f.querySelector('[data-gpx-btn]'), gx = f.querySelector('[data-gpx-remove]');
  const paint = () => {
    const has = gpx.keep || gpx.text;
    gv.textContent = gpx.text ? gpx.info : gpx.keep ? (gpx.info || 'Course added') : 'No file yet';
    gv.classList.toggle('is-empty', !has);
    gb.textContent = has ? 'Replace' : 'Choose file';
    gx.hidden = !has;
  };
  if (gpx.keep) planCourse(plan).then((c) => { if (c && gpx.keep && !gpx.text) { gpx.info = kmText(c); paint(); } }).catch(() => {});
  paint();
  f.gpx.addEventListener('change', async () => {
    const file = f.gpx.files[0];
    f.gpx.value = '';
    setError(f, 'gpx', '');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError(f, 'gpx', 'The file is over 5 MB. Export the route without extra data.');
    let c = null, text = '';
    try { text = await file.text(); c = parseGpx(text); } catch { /* not XML */ }
    if (!c || c.pts.length < 20) return setError(f, 'gpx', 'This is not a GPX route. Export the course as a .gpx file.');
    if (c.km < 15 || c.km > 30) return setError(f, 'gpx', `This route is ${c.km.toFixed(1)} km. Add the half marathon course, about 21 km.`);
    gpx = { keep: false, text, info: `${file.name} · ${kmText(c)}` };
    paint();
  });
  gx.addEventListener('click', () => { gpx = { keep: false, text: null, info: '' }; setError(f, 'gpx', ''); paint(); });
  // Type digits, the dots appear by themselves: 14022027 → 14.02.2027
  f.race_date.addEventListener('input', () => {
    const d = f.race_date.value.replace(/\D/g, '').slice(0, 8);
    f.race_date.value = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.');
  });
  dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
  dlg.querySelector('[data-remove]')?.addEventListener('click', async (e) => {
    const done = busy(e.currentTarget, 'Removing…');
    const { error } = await sb.from('abroad_plans').delete().eq('user_id', plan.user_id);
    if (!error && plan.course_gpx) await sb.storage.from('gpx').remove([plan.course_gpx]);
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
    const { data: { session } } = await sb.auth.getSession();
    const path = `${session.user.id}/abroad-course.gpx`;
    let course_gpx = gpx.keep ? plan.course_gpx : null;
    if (gpx.text) {
      const up = await sb.storage.from('gpx').upload(path, new Blob([gpx.text], { type: 'application/gpx+xml' }), { upsert: true, contentType: 'application/gpx+xml' });
      if (up.error) { done(); f.querySelector('.form-msg').innerHTML = banner('error', '', 'Could not upload the course file. Try again, or save without it.'); return; }
      course_gpx = path;
    } else if (!gpx.keep && plan?.course_gpx) {
      await sb.storage.from('gpx').remove([plan.course_gpx]);
    }
    const { error } = await sb.from('abroad_plans').upsert({ ...v, website: v.website || null, course_gpx, updated_at: new Date().toISOString() });
    done();
    if (error) { f.querySelector('.form-msg').innerHTML = banner('error', '', `Could not save. ${esc(error.message)}`); return; }
    dlg.close(); onSaved?.();
  });
  dlg.showModal();
  f.race_name.focus();
}
