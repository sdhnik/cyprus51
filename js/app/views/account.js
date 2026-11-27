// Account — AccountDesktop / AccountMobile designs: side menu with details, password, rules, delete, log out.
import { sb } from '../supa.js';
import { appShell } from '../layout.js';
import { field, setError, banner, busy, esc, icon, wireReveal, initials } from '../ui.js';
import { loadProfile } from '../state.js';
import { go } from '../router.js';

const SECTIONS = [['details', 'Account details'], ['password', 'Change password'], ['delete', 'Delete account']];

export async function account(root, { state, flash, args }) {
  const email = state.session.user.email;
  root.innerHTML = appShell(`${flash || ''}
    <a class="back" href="#/passport">${icon('back')}Passport</a>
    <h1 class="page-title">Account</h1>
    <div class="acc">
      <nav class="acc__nav" aria-label="Account sections">
        ${SECTIONS.slice(0, 2).map(([id, label]) => `<a href="#/account/${id}" data-sec="${id}">${label}</a>`).join('')}
        ${state.profile?.is_admin ? `<a href="#/admin">Review results</a>` : ''}
        <a href="#/account/delete" data-sec="delete" class="is-danger">Delete account</a>
        <button type="button" class="acc__logout" data-logout>Log out</button>
      </nav>
      <div class="acc__body">
        <section class="card acc__card" id="details" aria-labelledby="det-title">
          <div><h2 id="det-title" class="h2">Account details</h2><p class="acc__sub">Your name shows on your passport.</p></div>
          <form class="form" id="f-details" novalidate>
            <div class="form-msg" tabindex="-1"></div>
            <div class="acc__pair">
              ${field({ name: 'name', label: 'Full name', autocomplete: 'name', value: state.profile?.display_name || '' })}
              <div class="c51-field is-readonly"><div class="c51-field__box"><span class="c51-field__label">Email</span><div class="c51-field__row"><span class="c51-field__input">${esc(email)}</span></div></div><p class="c51-field__hint">Your login. Ask the Administrator to change it.</p></div>
            </div>
            <div><button class="c51-btn c51-btn--dark" type="submit">Save changes</button></div>
          </form>
        </section>
        <section class="card acc__card" id="password" aria-labelledby="pw-title">
          <div><h2 id="pw-title" class="h2">Change password</h2><p class="acc__sub">At least 8 characters.</p></div>
          <form class="form acc__narrow" id="f-password" novalidate>
            <div class="form-msg" tabindex="-1"></div>
            ${field({ name: 'current', label: 'Current password', type: 'password', autocomplete: 'current-password', reveal: true })}
            ${field({ name: 'next', label: 'New password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters', reveal: true })}
            <div><button class="c51-btn c51-btn--dark" type="submit">Update password</button></div>
          </form>
        </section>
        <section class="card acc__card" id="delete" aria-labelledby="del-title">
          <div><h2 id="del-title" class="h2">Delete account</h2><p class="acc__sub">This removes your passport, results, finish photos and GPX files. It cannot be undone.</p></div>
          <div><button type="button" class="acc__danger" id="delete-start">Delete account</button></div>
          <div id="del-zone"></div>
        </section>
      </div>
    </div>`);

  // Highlight the section in view; open a section from the URL (#/account/password).
  const links = [...root.querySelectorAll('[data-sec]')];
  const mark = (id) => links.forEach((a) => a.setAttribute('aria-current', String(a.dataset.sec === id)));
  mark(args?.[0] || 'details');
  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
    root.querySelector('#' + a.dataset.sec).scrollIntoView({ behavior: 'smooth', block: 'start' });
    mark(a.dataset.sec);
  }));
  if (args?.[0]) requestAnimationFrame(() => root.querySelector('#' + args[0])?.scrollIntoView({ block: 'start' }));
  const io = new IntersectionObserver((es) => es.forEach((en) => en.isIntersecting && mark(en.target.id)), { rootMargin: '-30% 0px -60% 0px' });
  SECTIONS.forEach(([id]) => io.observe(root.querySelector('#' + id)));

  // Details
  const fd = root.querySelector('#f-details');
  fd.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = fd.name.value.trim();
    const msg = fd.querySelector('.form-msg');
    setError(fd, 'name', ''); msg.innerHTML = '';
    if (!name) return setError(fd, 'name', 'Enter your name.').focus();
    const done = busy(fd.querySelector('[type=submit]'), 'Saving…');
    const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', state.session.user.id);
    done();
    if (error) { msg.innerHTML = banner('error', '', 'Could not save. Try again in a minute.'); return; }
    await loadProfile();
    msg.innerHTML = banner('success', '', 'Saved.');
    root.querySelector('.pmenu .avatar').textContent = initials(name);
    root.querySelector('.c51-menu__name').textContent = name;
  });

  // Password: check the current one first, then set the new one.
  const fp = root.querySelector('#f-password');
  wireReveal(fp);
  fp.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = fp.querySelector('.form-msg');
    ['current', 'next'].forEach((n) => setError(fp, n, '')); msg.innerHTML = '';
    if (!fp.current.value) return setError(fp, 'current', 'Enter your current password.').focus();
    if (fp.next.value.length < 8) return setError(fp, 'next', 'Use at least 8 characters.').focus();
    if (fp.next.value === fp.current.value) return setError(fp, 'next', 'Choose a password different from the current one.').focus();
    const done = busy(fp.querySelector('[type=submit]'), 'Updating…');
    const check = await sb.auth.signInWithPassword({ email, password: fp.current.value });
    if (check.error) { done(); return setError(fp, 'current', check.error.status === 429 ? 'Too many attempts. Wait a few minutes.' : 'This is not your current password.').focus(); }
    const { error } = await sb.auth.updateUser({ password: fp.next.value });
    done();
    if (error) { msg.innerHTML = banner('error', '', 'Could not update the password. Try again in a minute.'); return; }
    fp.reset();
    msg.innerHTML = banner('success', '', 'Password updated.');
  });

  // Delete
  root.querySelector('#delete-start').addEventListener('click', () => {
    const zone = root.querySelector('#del-zone');
    zone.innerHTML = `<form class="form confirm" novalidate>
      ${banner('error', 'Delete everything?', 'Type <strong>DELETE</strong> to confirm.')}
      ${field({ name: 'confirm', label: 'Type DELETE', autocomplete: 'off' })}
      <div class="row-btns"><button class="c51-btn c51-btn--dark" type="submit">Delete for good</button><button class="c51-btn c51-btn--secondary" type="button" data-cancel>Cancel</button></div>
    </form>`;
    const f = zone.querySelector('form');
    f.confirm.focus();
    f.querySelector('[data-cancel]').addEventListener('click', () => { zone.innerHTML = ''; root.querySelector('#delete-start').focus(); });
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
      go('');
    });
  });
}
