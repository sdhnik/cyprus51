// Review queue — AdminDesktop / AdminMobile designs.
import { sb } from '../supa.js';
import { appShell } from '../layout.js';
import { esc, icon, banner, busy } from '../ui.js';
import { loadRaces, formatRaceDate, fmtTime } from '../data.js';
import { HALF_KM } from '../model.js';
import { go } from '../router.js';

const REASONS = ["Time doesn't match the results page", 'Name not found on the results page', "Link doesn't open", 'Not an official half marathon'];
const TABS = [['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected']];

const ago = (iso) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
  if (d <= 0) { const h = Math.floor((Date.now() - new Date(iso)) / 36e5); return h <= 0 ? 'just now' : `${h} h ago`; }
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export async function admin(root, { state }) {
  if (!state.profile?.is_admin) return go('passport');
  const data = await loadRaces();
  const raceById = new Map(data.races.map((r) => [r.id, r]));
  let tab = 'pending', list = [], counts = {}, sel = null, toast = '';

  const raceLabel = (s) => {
    const r = raceById.get(s.race_id);
    if (r) return { name: r.city, date: formatRaceDate(r), abroad: false };
    return { name: [s.abroad_name, s.abroad_country].filter(Boolean).join(', ') || 'Race abroad', date: s.abroad_date ? dayFmt.format(new Date(s.abroad_date)).replace(',', '') : '', abroad: true };
  };
  const vsPb = (s) => {
    const prev = (s.history || []).map((h) => h.time).filter(Boolean);
    if (!prev.length) return { text: 'First result, sets PB', pb: true };
    const pb = Math.min(...prev), d = s.official_time_s - pb;
    return d < 0 ? { text: `New PB, −${fmtTime(-d)}`, pb: true } : { text: `+${fmtTime(d)} vs PB`, pb: false };
  };
  const histText = (s) => (s.history || []).length
    ? s.history.map((h) => `${raceById.get(h.race_id)?.city || 'Abroad'} ${fmtTime(h.time)}`).join(' · ')
    : 'First race';

  async function load() {
    const [c, l] = await Promise.all([sb.rpc('admin_counts'), sb.rpc('admin_submissions', { p_status: tab })]);
    if (l.error) throw l.error;
    counts = c.data || {};
    list = l.data || [];
    if (!list.find((x) => x.id === sel)) sel = list[0]?.id || null;
    draw();
  }

  function draw() {
    const cur = list.find((x) => x.id === sel);
    const rows = list.map((s) => {
      const r = raceLabel(s), v = s.official_time_s ? vsPb(s) : null, on = s.id === sel;
      const tag = r.abroad ? 'ABROAD' : v?.pb && tab === 'pending' ? 'NEW PB' : '';
      return `<button type="button" class="adm-row${on ? ' is-on' : ''}" data-id="${s.id}" aria-current="${on}">
        <span class="adm-row__who"><span class="adm-row__name">${esc(s.runner_name)}</span><span class="adm-row__meta">${esc(r.name)} · ${esc(ago(s.submitted_at || s.updated_at))}</span></span>
        <span class="adm-row__end"><span class="num">${esc(fmtTime(s.official_time_s))}</span>${tag ? `<span class="adm-row__tag${r.abroad ? ' is-abroad' : ''}">${tag}</span>` : ''}</span>
      </button>`;
    }).join('');

    let detail;
    if (!cur) {
      detail = `<div class="adm-empty"><p class="num">ALL CLEAR</p><p>${tab === 'pending' ? 'No results waiting for review.' : `No ${tab} results yet.`}</p></div>`;
    } else {
      const r = raceLabel(cur), v = vsPb(cur);
      const att = [cur.photo_path ? 'Finish photo (private)' : '', cur.gpx_path ? `<button type="button" class="adm-link" data-gpx="${esc(cur.gpx_path)}">Course GPX ${icon('ext', 14)}</button>` : ''].filter(Boolean).join('<br>') || 'None';
      const url = cur.result_url || '';
      detail = `<div class="adm-d">
        <div class="adm-d__head"><div><h2 class="h2 adm-d__name">${esc(cur.runner_name)}</h2><p class="adm-d__sub">${esc(cur.runner_email)} · submitted ${esc(ago(cur.submitted_at))}</p></div><span class="adm-d__race">${esc(r.name)}${r.date ? ` · ${esc(r.date)}` : ''}</span></div>
        <div class="adm-d__time"><div><p class="lbl">Claimed finish time</p><p class="num">${esc(fmtTime(cur.official_time_s))}</p></div><span class="adm-d__vs${v.pb ? ' is-pb' : ''}">${esc(v.text)}</span></div>
        <div class="adm-d__facts">
          <div><p class="lbl">Bib</p><p>${esc(cur.bib || 'Not given')}</p></div>
          <div><p class="lbl">Place</p><p>${cur.place ? `${cur.place.toLocaleString('en-GB')}${cur.place_of ? ` / ${cur.place_of.toLocaleString('en-GB')}` : ''}` : 'Not given'}</p></div>
          <div><p class="lbl">Pace</p><p>${cur.official_time_s ? `${fmtTime(Math.round(cur.official_time_s / HALF_KM))} /km` : '—'}</p></div>
          <div><p class="lbl">Attachments</p><p class="adm-d__att">${att}</p></div>
        </div>
        <div class="adm-d__link"><div><p class="lbl">Results link</p><p class="adm-d__url">${esc(url)}</p><p class="adm-d__hint">${cur.bib ? `Find bib ${esc(cur.bib)} and compare the time.` : 'Find the runner by name and compare the time.'}</p></div>
          ${url ? `<a class="adm-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open results ${icon('ext', 16)}</a>` : ''}</div>
        <p class="adm-d__hist"><strong>Verified so far:</strong> ${esc(histText(cur))}</p>
        ${tab === 'pending' ? `<div class="adm-d__act">
          <div class="adm-d__verify"><button type="button" class="c51-btn c51-btn--dark" data-act="verified">Verify result</button><span>The stamp appears in the runner’s passport.</span></div>
          <form class="adm-d__reject" novalidate>
            <p class="lbl">Or reject with a reason</p>
            <div class="adm-d__quick">${REASONS.map((q) => `<button type="button" class="chipbtn" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
            <div class="c51-field" data-field="reason"><div class="c51-field__box"><label class="c51-field__label" for="f-reason">Reason the runner will see</label><div class="c51-field__row"><input class="c51-field__input" id="f-reason" name="reason" maxlength="300" placeholder="e.g. The results page shows 1:51:41 for bib ${esc(cur.bib || '1127')}"></div></div><p class="c51-field__error" id="f-reason-err" hidden></p></div>
            <div><button type="submit" class="acc__danger">Reject</button></div>
          </form>
        </div>` : `<div class="adm-d__act">
          ${cur.status === 'rejected' ? `<p class="adm-d__reason"><span class="lbl">Reason</span><br>${esc(cur.reject_reason || '')}</p>` : ''}
          <p class="adm-d__hint">${cur.status === 'verified' ? 'Verified' : 'Rejected'} ${esc(ago(cur.reviewed_at))}.</p>
          <div><button type="button" class="c51-btn c51-btn--secondary" data-act="pending">Move back to review</button></div>
        </div>`}
      </div>`;
    }

    root.innerHTML = appShell(`
      <div class="adm-top">
        <div><span class="adm-badge">ADMIN</span><h1 class="page-title">Review queue</h1></div>
        <div class="seg" role="group" aria-label="Filter">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${l} · ${counts[k] || 0}</button>`).join('')}</div>
      </div>
      <div aria-live="polite">${toast}</div>
      <div class="adm">
        <section class="card adm-list" aria-label="${tab} results"><p class="lbl adm-list__head">Oldest first</p>${rows || `<p class="adm-list__none">Nothing here.</p>`}</section>
        <section class="card adm-detail" id="adm-detail" aria-label="Selected result">${detail}</section>
      </div>`);
    wire(cur);
  }

  function wire(cur) {
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', async () => { tab = b.dataset.tab; sel = null; toast = ''; await load(); }));
    root.querySelectorAll('.adm-row').forEach((b) => b.addEventListener('click', () => {
      sel = b.dataset.id; toast = ''; draw();
      if (matchMedia('(max-width: 900px)').matches) root.querySelector('#adm-detail').scrollIntoView({ behavior: 'smooth' });
    }));
    root.querySelector('[data-gpx]')?.addEventListener('click', async (e) => {
      const { data: d } = await sb.storage.from('gpx').createSignedUrl(e.currentTarget.dataset.gpx, 300);
      if (d?.signedUrl) window.open(d.signedUrl, '_blank', 'noopener');
    });
    if (!cur) return;
    const form = root.querySelector('.adm-d__reject');
    form?.querySelectorAll('[data-q]').forEach((q) => q.addEventListener('click', () => { form.reason.value = q.dataset.q; form.reason.focus(); }));
    const setReasonErr = (msg) => {
      const w = form.querySelector('[data-field=reason]'), e = form.querySelector('#f-reason-err');
      w.classList.toggle('is-error', !!msg); e.hidden = !msg; e.innerHTML = msg ? `${icon('alert', 16)}<span>${esc(msg)}</span>` : '';
    };
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const reason = form.reason.value.trim();
      if (!reason) { setReasonErr('Write a reason, the runner will see it.'); form.reason.focus(); return; }
      act('rejected', reason, form.querySelector('[type=submit]'));
    });
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, null, b)));

    async function act(status, reason, btn) {
      const done = busy(btn, 'Saving…');
      const patch = { status };
      if (status === 'rejected') patch.reject_reason = reason;
      const { error } = await sb.from('submissions').update(patch).eq('id', cur.id);
      done();
      if (error) { toast = banner('error', 'Could not save', esc(error.message)); draw(); return; }
      const label = `${cur.runner_name} · ${raceLabel(cur).name}`;
      toast = banner(status === 'verified' ? 'success' : 'info', `${status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Back in review'}: ${label}`);
      const i = list.findIndex((x) => x.id === cur.id);
      sel = list[i + 1]?.id || list[i - 1]?.id || null;
      await load();
    }
  }

  root.innerHTML = appShell(`<div aria-busy="true" role="status"><span class="sr">Loading…</span><div class="sk sk--card"></div></div>`);
  await load();
}
