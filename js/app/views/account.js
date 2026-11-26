import { sb } from '../supa.js';
import { appShell } from '../layout.js';
import { field, setError, banner, busy, esc, icon } from '../ui.js';
import { loadProfile } from '../state.js';
import { go } from '../router.js';

export async function account(root, { state, flash }) {
  const email = state.session.user.email;
  root.innerHTML = appShell(`${flash || ''}
    <a class="back" href="#/passport">${icon('back')}Passport</a>
    <h1 class="page-title">Account</h1>
    <div class="grid-2 grid-2--top">
      <section class="card" aria-labelledby="prof-title">
        <h2 id="prof-title" class="h2">Your details</h2>
        <form class="form" id="profile" novalidate>
          <div class="form-msg" tabindex="-1"></div>
          ${field({ name: 'name', label: 'Full name', autocomplete: 'name', value: state.profile?.display_name || '', hint: 'As it appears in race results.' })}
          <div class="c51-field is-readonly"><div class="c51-field__box"><span class="c51-field__label">Email address</span><div class="c51-field__row"><span class="c51-field__input">${esc(email)}</span></div></div></div>
          <button class="c51-btn c51-btn--dark" type="submit">Save changes</button>
        </form>
      </section>
      <section class="card" aria-labelledby="sess-title">
        <h2 id="sess-title" class="h2">Session</h2>
        <p class="muted">You stay logged in on this device until you log out.</p>
        <button class="c51-btn c51-btn--secondary" id="logout">${icon('logout')}Log out</button>
        <hr class="rule">
        <h2 class="h2">Delete account</h2>
        <p class="muted">Removes your passport, results, photos and GPX files for good. This cannot be undone.</p>
        <button class="c51-btn c51-btn--outline danger" id="delete">Delete my account</button>
        <div id="del-zone"></div>
      </section>
    </div>`);

  const form = root.querySelector('#profile');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    setError(form, 'name', '');
    if (!name) return setError(form, 'name', 'Enter your name.').focus();
    const done = busy(form.querySelector('[type=submit]'), 'Saving…');
    const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', state.session.user.id);
    done();
    const msg = form.querySelector('.form-msg');
    if (error) { msg.innerHTML = banner('error', '', 'Could not save. Try again in a minute.'); return; }
    await loadProfile();
    msg.innerHTML = banner('success', '', 'Saved.');
    root.querySelector('.avatar').textContent = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  });

  root.querySelector('#logout').addEventListener('click', async () => {
    await sb.auth.signOut();
  });

  root.querySelector('#delete').addEventListener('click', () => {
    const zone = root.querySelector('#del-zone');
    zone.innerHTML = `<form class="form confirm" novalidate>
      ${banner('error', 'Delete everything?', 'Type <strong>DELETE</strong> to confirm.')}
      ${field({ name: 'confirm', label: 'Type DELETE', autocomplete: 'off' })}
      <div class="row-btns"><button class="c51-btn c51-btn--dark" type="submit">Delete for good</button><button class="c51-btn c51-btn--secondary" type="button" data-cancel>Cancel</button></div>
    </form>`;
    const f = zone.querySelector('form');
    f.confirm.focus();
    f.querySelector('[data-cancel]').addEventListener('click', () => { zone.innerHTML = ''; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (f.confirm.value.trim() !== 'DELETE') return setError(f, 'confirm', 'Type DELETE in capital letters.').focus();
      const done = busy(f.querySelector('[type=submit]'), 'Deleting…');
      const uid = state.session.user.id;
      for (const bucket of ['photos', 'gpx']) {
        const { data: files } = await sb.storage.from(bucket).list(uid, { limit: 1000 });
        if (files?.length) await sb.storage.from(bucket).remove(files.map((x) => `${uid}/${x.name}`));
      }
      const { error } = await sb.rpc('delete_my_account');
      if (error) { done(); f.insertAdjacentHTML('afterbegin', banner('error', '', 'Could not delete the account. Try again in a minute.')); return; }
      await sb.auth.signOut({ scope: 'local' });
      go('login');
    });
  });
}
