// Race page, race-day check-in and result submission.
// Designs: RaceDesktop/Mobile, RaceDone*, RaceDayDesktop, CheckIn, Submit*, SubmitStates, PhotoEmpty.
import { sb } from '../supa.js';
import { appShell } from '../layout.js';
import { esc, icon, field, setError, banner, busy, wireTime, stravaLink } from '../ui.js';
import { raceDate, formatRaceDate, daysUntil, stampImg, course, fmtTime, parseTime, asset } from '../data.js';
import { loadSeason, HALF_KM, SUB130, badgeImg, offlineNote } from '../model.js';
import { planCourse, openAbroad } from '../abroad.js';
import { combobox, countryNames } from '../combobox.js';
import { routeSvg, elevationSvg } from '../course.js';
import { routeMap } from '../map.js';
import { drawCard, toBlob } from '../sharecard.js';
import { compressPhoto, photoError, uploadPhoto, photoUrl, removePhoto, toDataUrl } from '../photo.js';
import { enqueue, queued, isOffline, flush } from '../outbox.js';
import { go, render } from '../router.js';
import { SEASON, STRAVA_CLUB_URL } from '../../config.js';

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const DAY_Y = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const day = (d) => DAY.format(new Date(d)).replace(',', '');
const isoDay = (iso) => new Date(iso + 'T00:00:00');
const paceOf = (s) => fmtTime(Math.round(s / HALF_KM));
const num = (n) => Number(n).toLocaleString('en-GB');
const toEu = (iso) => (iso ? iso.split('-').reverse().join('.') : '');
function fromEu(text) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(text).trim());
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if (dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[1]) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const SHARE_IC = 'M12 3v12M8 7l4-4 4 4M5 12v8h14v-8';
const DOWNLOAD_IC = 'M12 4v11M7 10l5 5 5-5M5 20h14';
const CAMERA = 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z';
const LOCK = 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4';
const ROUTE = 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8';
const TROPHY = 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3';
const svg = (d, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const CHIP = { verified: ['Verified', 'verified'], pending: ['In review', 'pending'], checked_in: ['Checked in', 'pending'], rejected: ['Needs a fix', 'error'], none: ['Not submitted', 'neutral'] };
const chip = (st) => { const [l, t] = CHIP[st] || CHIP.none; return `<span class="c51-chip c51-chip--${t}"><span class="c51-chip__dot" aria-hidden="true"></span>${l}</span>`; };

// ── Everything the race screens need, in one place ─────────────────────────
async function load(state, id) {
  const m = await loadSeason();
  const abroad = id === 'abroad';
  const r = abroad ? m.abroad : m.cyprus.find((x) => x.id === id);
  if (!r) return { m, r: null };
  let { data: sub, error } = m.offline ? { data: m.subs.get(r.id) || null } : await sb.from('submissions').select('*').eq('user_id', state.session.user.id).eq('race_id', r.id).maybeSingle();
  if (error && isOffline(error)) ({ data: sub, error } = { data: m.subs.get(r.id) || null });
  if (error) throw error;
  const plan = m.plan;
  const n = abroad ? 6 : m.cyprus.indexOf(r) + 1;
  const name = abroad ? (sub?.abroad_name || plan?.race_name || 'Your race abroad') : `${r.city} Half Marathon`;
  const iso = abroad ? (sub?.abroad_date || plan?.race_date) : null;
  const date = abroad ? (iso ? { tbc: false, start: isoDay(iso) } : null) : raceDate(r);
  const toRace = date && !date.tbc ? daysUntil(date.start, m.now) : null;
  const st = sub ? sub.status : 'none';
  const q = !sub && queued(r.id, state.session.user.id);
  return {
    m, r, sub, st, q, plan, abroad, n, name, date, toRace,
    website: abroad ? (plan?.website || '') : r.website,
    open: abroad ? true : toRace != null && toRace <= 0,                  // results can be sent
    checkIn: toRace != null && toRace <= 0 && toRace >= -3,              // race-day check-in window
    uid: state.session.user.id,
  };
}

function whenText(x) {
  if (!x.date) return 'ANY HALF MARATHON OUTSIDE CYPRUS';
  if (x.date.tbc) return formatRaceDate(x.r, { long: true }).toUpperCase();
  return DAY_Y.format(x.date.start).replace(',', '').toUpperCase();
}

function description(x) {
  if (x.abroad) {
    if (!x.plan && !x.sub) return `Any official half marathon outside Cyprus in ${SEASON} earns the sixth stamp. Add yours to the season, or submit a race you have already run.`;
    const c = x.sub?.abroad_country || x.plan?.country;
    return `${c ? c + '. ' : ''}Your sixth stamp: any official half marathon outside Cyprus in ${SEASON}.`;
  }
  const r = x.r;
  return `${r.officialName.replace(' — ', ', ')}.${r.course ? ` ${r.course}.` : ''}${r.startFinish ? ` Start and finish: ${r.startFinish}.` : ''}`;
}

// ── Race page ──────────────────────────────────────────────────────────────
export async function race(root, { state, args, flash }) {
  root.innerHTML = appShell(`<div aria-busy="true" role="status"><span class="sr">Loading the race…</span><div class="sk sk--hero"></div><div class="sk sk--card"></div></div>`);
  await flush().catch(() => {});
  const x = await load(state, args[0]);
  if (!x.r) return notFound(root);
  if (args[1] === 'submit') return submitPage(root, x, flash);
  const { m, r, sub, st, q } = x;
  const verified = st === 'verified';
  const showCheckIn = args[1] === 'checkin' && st === 'none' && !q && x.checkIn;

  // Hero
  const ring = verified ? 'is-done' : st === 'checked_in' || st === 'pending' || q ? 'is-wait' : st === 'rejected' ? 'is-fix' : '';
  const stampCap = verified ? `<span class="rc-stamp__cap is-done"><span class="dot"></span>Stamp collected${sub.reviewed_at ? ` · ${day(sub.reviewed_at).replace(/^\w+ /, '')}` : ''}</span>`
    : q ? `<span class="rc-stamp__cap is-wait">${icon('clock', 14)}Saved on your phone</span>`
    : st === 'checked_in' ? `<span class="rc-stamp__cap is-wait">${icon('clock', 14)}Checked in · ${fmtTime(sub.watch_time_s)}</span>`
    : st === 'pending' ? `<span class="rc-stamp__cap is-wait">${icon('clock', 14)}In review</span>`
    : st === 'rejected' ? `<span class="rc-stamp__cap is-fix">Needs a fix</span>`
    : `<span class="rc-stamp__cap">Stamp not collected</span>`;
  let eyebrow = `RACE ${x.n} OF 6 · ${whenText(x)}`;
  if (verified) eyebrow += ' · FINISHED';
  else if (st === 'checked_in' || q) eyebrow = 'CHECKED IN · WAITING FOR OFFICIAL RESULTS';
  else if (x.toRace === 0) eyebrow = `RACE DAY · TODAY · RACE ${x.n} OF 6`;
  else if (x.toRace > 0) eyebrow += ` · IN ${x.toRace} ${x.toRace === 1 ? 'DAY' : 'DAYS'}`;
  const heroText = st === 'checked_in' ? 'Nice run. When the organiser posts results, add the link and your stamp goes to review.'
    : q ? 'No signal at the finish. Your check-in is saved on this phone and goes out by itself when you’re back online.'
    : description(x);

  const site = x.website ? `<a class="rc-hero__ghost" href="${esc(x.website)}" target="_blank" rel="noopener"><span>Race website</span>${icon('ext', 16)}</a>` : '';
  const results = sub?.result_url ? `<a class="rc-hero__ghost${verified ? ' is-light' : ''}" href="${esc(sub.result_url)}" target="_blank" rel="noopener"><span>Official results</span>${icon('ext', 16)}</a>` : '';
  const href = (sfx) => `#/race/${x.abroad ? 'abroad' : r.id}/${sfx}`;
  let actions;
  if (verified) actions = `${results}${site}`;
  else if (q) actions = `<button type="button" class="c51-btn c51-btn--primary" data-retry>Try now</button>${site}<p class="rc-hero__note">Sends by itself when you’re online</p>`;
  else if (st === 'checked_in') actions = `<a class="c51-btn c51-btn--primary" href="${href('submit')}">Add result ${icon('arrow')}</a>${site}<p class="rc-hero__note">One step left: the official link</p>`;
  else if (st === 'pending') actions = `<a class="c51-btn c51-btn--secondary rc-hero__light" href="${href('submit')}">Edit submission</a>${site}<p class="rc-hero__note">In review since ${day(sub.submitted_at)}</p>`;
  else if (st === 'rejected') actions = `<a class="c51-btn c51-btn--primary" href="${href('submit')}">Fix result ${icon('arrow')}</a>${site}`;
  else if (x.checkIn) actions = `<a class="c51-btn c51-btn--primary" href="${href('checkin')}" data-checkin>I finished ${icon('arrow')}</a>${site}<p class="rc-hero__note">Check-in is open until ${WEEKDAY.format(new Date(x.date.start.getTime() + 3 * 864e5))}</p>`;
  else if (x.open) actions = `<a class="c51-btn c51-btn--primary" href="${href('submit')}">Submit result ${icon('arrow')}</a>${x.abroad && !x.plan ? `<button type="button" class="rc-hero__ghost" data-abroad>Add to my season</button>` : site}`;
  else actions = `<button type="button" class="c51-btn c51-btn--primary" disabled>Submit result</button>${site}<p class="rc-hero__note">Submitting opens on race day</p>`;

  const hero = `<section class="rc-hero" aria-labelledby="race-title">
    <img class="rc-hero__topo" src="${asset('assets/patterns/cyprus-topo.webp')}" alt="">
    <div class="rc-stamp ${ring}"><div class="rc-stamp__ring"><img src="${stampImg(r.stamp, verified)}" alt="${verified ? `${esc(r.city)} stamp` : ''}"></div>${stampCap}</div>
    <div class="rc-hero__main"><p class="ps-eyebrow">${esc(eyebrow)}</p><h1 id="race-title" class="rc-hero__title${x.name.length > 26 ? ' is-long' : ''}">${esc(x.name)}</h1><p class="rc-hero__text">${esc(heroText)}</p></div>
    <div class="rc-hero__actions">${actions}</div>
  </section>`;

  // Course
  const cData = x.abroad ? (x.plan?.course_gpx ? planCourse(x.plan) : Promise.resolve(null)) : course(r);
  const courseCard = `<section class="card rc-course" aria-labelledby="course-title">
    <div class="card__head"><h2 id="course-title" class="h2">Course</h2><p class="rc-note">${x.abroad ? 'From your GPX' : 'From the organiser’s GPX'}</p></div>
    <div data-course><div class="sk rc-sk"></div></div>
  </section>`;

  // Your result (not verified yet)
  const READY = ['Official finish time', 'Link to the results page', 'Bib number (optional)', 'Place (optional)', 'Finish photo, only you see it (optional)'];
  let resultBody;
  if (q) resultBody = `<p class="rc-p">Your check-in with <b>${fmtTime(q.watch_time_s)}</b> is saved on this phone. It goes out by itself when you’re back online. You can close the app.</p>`;
  else if (st === 'checked_in') resultBody = `<p class="rc-p">You checked in with <b>${fmtTime(sub.watch_time_s)}</b> from your watch. When the official results are out, add the link and the chip time. Then it goes to review.</p><div><a class="c51-btn c51-btn--dark" href="${href('submit')}">Add official result</a></div>`;
  else if (st === 'pending') resultBody = `<div class="rc-facts rc-facts--3">${fact('Official time', fmtTime(sub.official_time_s))}${fact('Bib', sub.bib || '—')}${fact('Place', sub.place ? `${num(sub.place)}${sub.place_of ? ' / ' + num(sub.place_of) : ''}` : '—')}</div>
    <p class="rc-p">Submitted ${day(sub.submitted_at)}. We check it against the official results within a week and email you when the stamp is in your passport.</p>`;
  else if (st === 'rejected') resultBody = `${banner('error', 'We could not verify this result', esc(sub.reject_reason || ''))}<div><a class="c51-btn c51-btn--dark" href="${href('submit')}">Fix and resubmit</a></div>`;
  else resultBody = `<p class="rc-p">${x.open ? 'Submit with the button at the top.' : 'Submit from race day with the button at the top.'} We verify results within a week. Have these ready:</p><ul class="rc-list">${READY.map((t) => `<li>${t}</li>`).join('')}</ul>`;
  const resultCard = `<section class="card${st !== 'none' || q ? ' rc-result-on' : ''}" aria-labelledby="result-title"><div class="card__head"><h2 id="result-title" class="h2">Your result</h2>${chip(q ? 'checked_in' : st)}</div>${resultBody}</section>`;

  let body;
  if (verified) {
    body = `<div class="rc-grid"><div class="rc-col">${doneCard(x)}${courseCard}</div><div class="rc-col">${photoCard()}${earnedCard(x)}</div></div>`;
  } else {
    body = `<div class="rc-grid"><div class="rc-col">${courseCard}${resultCard}</div><div class="rc-col">${targetCard(m)}</div></div>`;
  }
  const back = `<a class="back" href="#/passport">${icon('back')}Passport</a>`;
  root.innerHTML = appShell(`${flash || ''}${back}${offlineNote(m)}${hero}${showCheckIn ? checkInCard(x) : ''}${body}`);

  root.querySelector('[data-abroad]')?.addEventListener('click', () => openAbroad(x.plan, () => render()));
  root.querySelector('[data-retry]')?.addEventListener('click', async (e) => {
    const done = busy(e.currentTarget, 'Sending…');
    const n = await flush().catch(() => 0);
    done();
    if (n) render();
  });
  if (showCheckIn) wireCheckIn(root, x);
  if (!verified) wireTarget(root, m);
  else { wirePhoto(root, x); drawStats(root, x); wireShare(root, x); }

  // Course drawing
  cData.then((c) => {
    const box = root.querySelector('[data-course]');
    if (!box) return;
    if (!c) {
      box.innerHTML = `<div class="rc-empty">${svg(ROUTE, 26)}<p class="rc-empty__t">${x.abroad && x.plan ? 'Add the course GPX' : 'Course not added yet'}</p><p class="rc-empty__s">${x.abroad ? 'From the race website, Strava or Garmin. It draws the map and the elevation profile.' : 'The organiser has not published the GPX yet.'}</p>${x.abroad ? `<button type="button" class="c51-btn c51-btn--secondary" data-course-add>${x.plan ? 'Add GPX' : 'Add your race'}</button>` : ''}</div>`;
      box.querySelector('[data-course-add]')?.addEventListener('click', () => openAbroad(x.plan, () => render()));
      return;
    }
    const raw = c.pts.map((p) => p[2]);
    const hi = Math.round(Math.max(...raw)), lo = Math.round(Math.min(...raw));
    box.innerHTML = `<div class="rc-mapbox" data-map><span class="rc-wide">${routeSvg(c, `Course map of ${esc(x.name)}`)}</span><span class="rc-narrow">${routeSvg(c, `Course map of ${esc(x.name)}`, 340, 240)}</span></div>
      <div class="rc-legend"><span><i class="rc-legend__line"></i>Route</span><span><i class="rc-legend__km">5</i>Kilometre marks</span></div>
      <div class="rc-sec"><p class="lbl">Elevation, metres</p><div class="rc-wide">${elevationSvg(c, `Elevation profile: ${lo} to ${hi} metres, ${c.gain} metres of climbing`)}</div><div class="rc-narrow">${elevationSvg(c, `Elevation profile: ${lo} to ${hi} metres, ${c.gain} metres of climbing`, 340, 190)}</div></div>
      <div class="rc-sec rc-facts rc-facts--3">${fact('Distance', '21.1 km')}${fact('Elevation gain', `${c.gain} m`)}${fact('Highest point', `${hi} m`)}${fact('Lowest point', `${lo} m`)}
        ${x.abroad ? fact('Country', x.sub?.abroad_country || x.plan?.country || '—') : (r.startFinish ? fact('Start & finish', r.startFinish) : '') + (r.course ? fact('Course', r.course) : '')}</div>`;
    // Swap the drawing for the real map once Leaflet is loaded; keep the drawing if it can't load.
    const mapEl = box.querySelector('[data-map]');
    const live = document.createElement('div');
    live.className = 'rc-live';
    mapEl.appendChild(live);
    routeMap(live, c, `Course map of ${x.name}`).then(() => mapEl.classList.add('is-live')).catch(() => live.remove());
  }).catch(() => { const b = root.querySelector('[data-course]'); if (b) b.innerHTML = `<p class="rc-p">The course could not be loaded. Try again later.</p>`; });
}

const fact = (l, v) => `<div><p class="lbl">${esc(l)}</p><p class="num rc-fact">${esc(v)}</p></div>`;

function notFound(root) {
  root.innerHTML = appShell(`<section class="page-error is-404"><p class="ps-eyebrow">ERROR 404</p><h1 class="page-error__title">Wrong turn.</h1>
    <p class="page-error__text">This race is not on the ${SEASON} calendar. The link may be old, or the address has a typo.</p>
    <div class="page-error__actions"><a class="c51-btn c51-btn--primary" href="#/passport">Back to your passport ${icon('arrow')}</a></div></section>`);
}

// ── Target time and splits ────────────────────────────────────────────────
function targetCard(m) {
  return `<section class="card rc-target" aria-labelledby="calc-title">
    <div><h2 id="calc-title" class="h2">Target time</h2><p class="rc-p rc-sub">Pick a finish time and get the pace and splits to hold.</p></div>
    ${field({ name: 'target', label: 'Target finish time', inputmode: 'numeric', placeholder: 'h:mm:ss', hint: 'Format h:mm:ss', required: false })}
    <div class="rc-presets" aria-label="Quick targets" data-presets></div>
    <div class="rc-pace"><div><p class="lbl">Average pace</p><p class="num rc-pace__v" aria-live="polite" data-pace>—</p></div><p class="rc-pace__vs" data-vs></p></div>
    <div class="rc-splits">
      <div class="rc-splits__head"><p class="lbl">Splits</p><div class="seg" role="group" aria-label="Pacing strategy"><button type="button" data-neg="0" aria-pressed="true">Even</button><button type="button" data-neg="1" aria-pressed="false">Negative split</button></div></div>
      <div role="table" aria-label="Splits" class="rc-table"><div role="row" class="rc-tr rc-th"><span role="columnheader">Point</span><span role="columnheader">Pace</span><span role="columnheader">Clock</span></div><div data-rows></div></div>
      <p class="rc-note" data-strat></p>
    </div>
  </section>`;
}

function wireTarget(root, m) {
  const pb = m.pb?.s.official_time_s || null, avg = m.nV >= 2 ? m.avg : null;
  const presets = [];
  if (pb) presets.push(['Beat PB', pb - 1]);
  if (avg) presets.push(['Your average', avg]);
  const marks = [];
  for (let t = 9000; t >= 4500; t -= 300) if (t < (pb || 7201)) marks.push(t);
  marks.slice(0, pb ? 2 : 3).forEach((t) => presets.push([`Sub ${fmtTime(t).replace(/:00$/, '')}`, t - 1]));
  const input = root.querySelector('#f-target');
  wireTime(input);
  let neg = false;
  input.value = fmtTime(presets[0][1]);
  const pr = root.querySelector('[data-presets]');
  pr.innerHTML = presets.map(([l, t]) => `<button type="button" class="chipbtn" data-t="${t}" aria-pressed="false">${esc(l)} · ${fmtTime(t)}</button>`).join('');
  const calc = () => {
    const T = parseTime(input.value);
    const ok = T != null && T >= 3600 && T <= 10800;
    setError(root, 'target', ok || !input.value ? '' : 'Enter a time between 1:00:00 and 3:00:00, like 1:45:00');
    pr.querySelectorAll('[data-t]').forEach((b) => b.setAttribute('aria-pressed', String(ok && +b.dataset.t === T)));
    root.querySelectorAll('[data-neg]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.neg === '1') === neg)));
    const KM = HALF_KM, half = KM / 2, avgP = ok ? T / KM : 0;
    const p1 = neg ? avgP * 1.01 : avgP, p2 = neg ? (T - p1 * half) / half : avgP;
    const at = (d) => (d <= half ? p1 * d : p1 * half + p2 * (d - half));
    const pc = (s) => fmtTime(Math.round(s));
    root.querySelector('[data-pace]').textContent = ok ? `${pc(avgP)} /KM` : '—';
    const diff = ok && pb ? T - pb : null;
    root.querySelector('[data-vs]').textContent = diff == null ? '' : diff < 0 ? `${pc(-diff)} faster than your PB` : diff === 0 ? 'Equals your PB' : `${pc(diff)} slower than your PB`;
    root.querySelector('[data-rows]').innerHTML = [[5, '5 km'], [10, '10 km'], [half, 'Halfway'], [15, '15 km'], [20, '20 km'], [KM, 'Finish']].map(([d, l]) =>
      `<div role="row" class="rc-tr${l === 'Finish' ? ' is-end' : ''}"><span role="cell">${l}</span><span role="cell">${ok ? `${pc(d <= half ? p1 : p2)} /km` : '—'}</span><span role="cell">${ok ? fmtTime(Math.round(at(d))) : '—'}</span></div>`).join('');
    root.querySelector('[data-strat]').textContent = neg ? 'First half 1% slower, second half faster. Saves legs for the last 10 km.' : 'Same pace all the way. Simple to hold, best on a flat course.';
  };
  input.addEventListener('input', calc);
  pr.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { input.value = fmtTime(+b.dataset.t); calc(); } });
  root.querySelectorAll('[data-neg]').forEach((b) => b.addEventListener('click', () => { neg = b.dataset.neg === '1'; calc(); }));
  calc();
}

// ── Finished race: result, distribution, photo, badges ───────────────────
function doneCard(x) {
  const { sub, m, r } = x;
  const isPb = m.pb && m.pb.r.id === r.id;
  const pct = sub.place && sub.place_of ? Math.max(1, Math.round((100 * sub.place) / sub.place_of)) : null;
  return `<section class="card rc-done" aria-labelledby="done-title">
    <div class="card__head"><h2 id="done-title" class="h2">Your result</h2>${chip('verified')}</div>
    <div class="rc-done__time"><p class="num">${fmtTime(sub.official_time_s)}</p>${isPb ? `<span class="rc-tag">${svg(TROPHY, 16)}Personal best · set here</span>` : ''}</div>
    <div class="rc-sec rc-facts rc-facts--3">
      <div><p class="lbl">Average pace</p><p class="num rc-fact">${paceOf(sub.official_time_s)} /km</p><p class="rc-note">${isPb ? 'Your fastest so far' : `PB ${paceOf(m.pb.s.official_time_s)} /km`}</p></div>
      <div><p class="lbl">Place</p><p class="num rc-fact">${sub.place ? `${num(sub.place)}${sub.place_of ? ' / ' + num(sub.place_of) : ''}` : '—'}</p><p class="rc-note">${pct ? `Top ${pct}%` : 'Not given'}</p></div>
      <div><p class="lbl">Bib</p><p class="num rc-fact">${esc(sub.bib || '—')}</p><p class="rc-note">${sub.bib ? 'Checked against results' : 'Not given'}</p></div>
    </div>
    <div class="rc-sec" data-stats hidden></div>
    <div class="rc-sec rc-share">
      <div><p class="lbl">Share your stamp</p><p class="rc-note">An image for Instagram or Strava, and a line for your activity.</p></div>
      <div class="rc-share__btns"><button type="button" class="c51-btn c51-btn--dark" data-share>${svg(SHARE_IC, 18)}Share</button>${stravaLink(STRAVA_CLUB_URL, 'club', 'c51-btn c51-btn--secondary')}</div>
    </div>
    <p class="rc-meta">${sub.submitted_at ? `<span>Submitted ${day(sub.submitted_at)}</span>` : ''}${sub.reviewed_at ? `<span>Verified ${day(sub.reviewed_at)}</span>` : ''}${sub.result_url ? `<a href="${esc(sub.result_url)}" target="_blank" rel="noopener">Official results ${icon('ext', 14)}</a>` : ''}</p>
  </section>`;
}

async function drawStats(root, x) {
  const { data } = await sb.rpc('race_stats', { p_race_id: x.r.id });
  const box = root.querySelector('[data-stats]');
  if (!data || !box || !data.bins?.length) return;
  // 5-minute bins from the server → 15-minute bars
  const bars = new Map();
  data.bins.forEach((b) => { const k = Math.floor(b.from_s / 900) * 900; bars.set(k, (bars.get(k) || 0) + b.n); });
  const keys = [...bars.keys()].sort((a, b) => a - b);
  const from = keys[0], to = keys[keys.length - 1], all = [];
  for (let k = from; k <= to; k += 900) all.push([k, bars.get(k) || 0]);
  const mine = Math.floor(x.sub.official_time_s / 900) * 900, max = Math.max(...all.map((a) => a[1]));
  box.hidden = false;
  box.innerHTML = `<div class="rc-where"><span class="num">${data.slower_than_me_pct ?? 0}%</span><span>of Cyprus 5+1 runners here were slower than you</span></div>
    <div class="rc-hist">${all.map(([k, n]) => `<div class="rc-hist__col${k === mine ? ' is-you' : ''}">${k === mine ? '<span class="rc-hist__you">YOU</span>' : ''}<div class="rc-hist__bar" style="height:${Math.max(4, (n / max) * 100)}%"></div><span class="rc-hist__l">${fmtTime(k).replace(/:00$/, '')}</span></div>`).join('')}</div>
    <p class="rc-note">Finish times of ${num(data.count)} Cyprus 5+1 runners at ${esc(x.abroad ? 'races abroad' : x.r.city)} · anonymous</p>`;
}

function photoCard() {
  return `<section class="card rc-photo" aria-labelledby="photo-title">
    <div class="card__head"><h2 id="photo-title" class="h2">Finish photo</h2><span class="rc-only">${svg(LOCK, 14)}Only you</span></div>
    <div data-photo><div class="sk rc-sk rc-sk--photo"></div></div>
    <input type="file" accept="image/*" class="sr-only" data-photo-input aria-label="Choose a finish photo">
  </section>`;
}

async function wirePhoto(root, x) {
  const box = root.querySelector('[data-photo]'), input = root.querySelector('[data-photo-input]');
  let path = x.sub.photo_path;
  const draw = async (msg = '') => {
    const url = await photoUrl(path);
    box.innerHTML = (msg ? banner('error', '', esc(msg)) : '') + (url
      ? `<img class="rc-photo__img" src="${url}" alt="Your finish photo from ${esc(x.r.city)}"><div class="rc-photo__btns"><button type="button" class="c51-btn c51-btn--secondary" data-pick>Replace</button><button type="button" class="c51-btn c51-btn--outline rc-danger" data-del>Remove</button></div>`
      : `<button type="button" class="rc-drop" data-pick>${'<span class="rc-drop__ic">' + svg(CAMERA, 24) + '</span>'}<b>Add your finish photo</b><span>Only you will see it.<br>JPG or PNG, up to 10 MB.</span></button><button type="button" class="c51-btn c51-btn--secondary c51-btn--block" data-pick>Upload photo</button>`);
    box.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => input.click()));
    box.querySelector('[data-del]')?.addEventListener('click', async (e) => {
      const done = busy(e.currentTarget, 'Removing…');
      await removePhoto(path);
      const { error } = await sb.from('submissions').update({ photo_path: null }).eq('id', x.sub.id);
      done();
      if (!error) path = null;
      draw(error ? 'Could not remove it. Try again.' : '');
    });
  };
  input.addEventListener('change', async () => {
    const f = input.files[0]; input.value = '';
    if (!f) return;
    box.innerHTML = '<div class="sk rc-sk rc-sk--photo"></div>';
    try {
      const blob = await compressPhoto(f);
      const p = await uploadPhoto(x.uid, x.r.id, blob);
      const { error } = await sb.from('submissions').update({ photo_path: p }).eq('id', x.sub.id);
      if (error) throw error;
      path = p; draw();
    } catch (e) { draw(['too-big', 'not-image'].includes(e.message) ? photoError(e) : 'Could not upload the photo. Try again.'); }
  });
  draw();
}

function earnedCard(x) {
  const { m, r } = x;
  const isPb = m.pb && m.pb.r.id === r.id;
  const sub130 = x.sub.official_time_s < SUB130;
  const here = [isPb && ['personal-best', 'Personal Best', 'Your fastest verified race'], sub130 && ['sub-1-30-elite', 'Sub 1:30 Elite', fmtTime(x.sub.official_time_s)]].filter(Boolean);
  const also = m.badges.filter((b) => (x.abroad ? ['international-finisher', '5plus1-finisher'] : ['5-cities-finisher', '5plus1-finisher']).includes(b.slug));
  return `<section class="card" aria-labelledby="earned-title"><h2 id="earned-title" class="h2">${here.length ? 'Earned here' : 'Counts towards'}</h2>
    ${here.map(([slug, n, t]) => `<a class="rc-earned" href="#/achievement/${slug}"><img src="${badgeImg(slug, true)}" alt=""><span><span class="num">${n}</span><span>${esc(t)}</span></span></a>`).join('')}
    ${here.length ? '<p class="lbl">Also counts towards</p>' : ''}
    <div class="rc-also">${also.map((b) => `<a class="rc-also__row" href="#/achievement/${b.slug}"><img src="${b.img}" alt=""><span><span class="num">${b.name}</span><span class="c51-progress"><span class="c51-progress__track"><span class="c51-progress__fill" style="width:${(100 * b.v) / b.max}%"></span></span></span><span class="rc-note">${b.earned ? 'Earned' : `${b.v} of ${b.max}`}</span></span></a>`).join('')}</div>
  </section>`;
}

// ── Check-in (race day) ───────────────────────────────────────────────────
function checkInCard(x) {
  return `<section class="card rc-ci" id="checkin" aria-labelledby="ci-title">
    <form novalidate>
      <div class="rc-ci__grid">
        <div class="rc-ci__step">
          <div><p class="lbl">Step 1 · now</p><h2 id="ci-title" class="h2">Check in</h2></div>
          <div class="form-msg" tabindex="-1"></div>
          ${field({ name: 'watch', label: 'Time from your watch', inputmode: 'numeric', placeholder: 'h:mm:ss', hint: 'Close enough is fine. The official time replaces it later.' })}
          ${photoPick('Finish selfie', 'Optional · only you see it')}
          <div class="c51-check"><label class="c51-check__row"><input class="c51-check__input" type="checkbox" name="ran" required><span class="c51-check__box">${icon('check', 16)}</span><span class="c51-check__label">I ran the ${esc(x.abroad ? x.name : x.r.city + ' half marathon')}${x.toRace === 0 ? ' today' : ''}</span></label></div>
        </div>
        <div class="rc-ci__step rc-ci__step--2">
          <div><p class="lbl">Step 2 · when results are out</p><h2 class="h2">Official result</h2></div>
          <p class="rc-p">Already posted? Add it now and both steps go in one go. Not yet? Leave it empty and come back later.</p>
          ${field({ name: 'url', label: 'Link to your result · optional now', inputmode: 'url', placeholder: 'https://', required: false })}
          ${field({ name: 'official', label: 'Official time · optional now', inputmode: 'numeric', placeholder: 'h:mm:ss', required: false })}
        </div>
      </div>
      <div class="rc-ci__foot"><p class="rc-note">Without a link you’re checked in. With a link it goes straight to review. Works without signal.</p>
        <div class="rc-ci__btns"><a class="c51-btn c51-btn--secondary" href="#/race/${x.abroad ? 'abroad' : x.r.id}">Cancel</a><button type="submit" class="c51-btn c51-btn--primary">Check in ${icon('arrow')}</button></div></div>
    </form>
  </section>`;
}

function photoPick(title, sub) {
  return `<div class="rc-pick" data-pick-box>
    <span class="rc-pick__ic">${svg(CAMERA, 20)}</span>
    <span class="rc-pick__t"><b>${title}</b><span data-pick-sub>${sub}</span></span>
    <label class="rc-pick__btn"><span data-pick-label>Choose</span><input type="file" accept="image/*" class="sr-only" name="photo"></label>
    <button type="button" class="rc-pick__x" data-pick-x aria-label="Remove the photo" hidden>×</button>
  </div><p class="c51-field__error" data-pick-err hidden></p>`;
}

// Photo picker state: { blob } new photo, { keep } existing photo, {} none.
function wirePhotoPick(form, existing, sub) {
  const st = { keep: !!existing, blob: null };
  const subEl = form.querySelector('[data-pick-sub]'), lab = form.querySelector('[data-pick-label]'), x = form.querySelector('[data-pick-x]'), err = form.querySelector('[data-pick-err]');
  const paint = () => { const has = st.blob || st.keep; subEl.textContent = st.blob ? `${st.name} · ready` : st.keep ? 'Added · only you see it' : sub; lab.textContent = has ? 'Replace' : 'Choose'; x.hidden = !has; };
  form.photo.addEventListener('change', async () => {
    const f = form.photo.files[0]; form.photo.value = ''; err.hidden = true;
    if (!f) return;
    try { st.blob = await compressPhoto(f); st.name = f.name; st.keep = false; } catch (e) { err.hidden = false; err.innerHTML = `${icon('alert', 16)}<span>${esc(photoError(e))}</span>`; }
    paint();
  });
  x.addEventListener('click', () => { st.blob = null; st.keep = false; paint(); });
  paint();
  return st;
}

function wireCheckIn(root, x) {
  const f = root.querySelector('#checkin form');
  wireTime(f.watch); wireTime(f.official);
  const photo = wirePhotoPick(f, null, 'Optional · only you see it');
  root.querySelector('#checkin').scrollIntoView({ block: 'start' });
  f.watch.focus({ preventScroll: true });
  f.ran.addEventListener('change', () => f.querySelector('.c51-check').classList.remove('is-error'));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    ['watch', 'url', 'official'].forEach((n) => setError(f, n, ''));
    f.querySelector('.form-msg').innerHTML = '';
    let first = null;
    const err = (n, msg) => { const el = setError(f, n, msg); first ??= el; };
    const watch = parseTime(f.watch.value);
    if (watch == null) err('watch', 'Enter the time as h:mm:ss, e.g. 1:44:10.');
    else if (watch < 1800 || watch > 14400) err('watch', 'A half marathon time is between 0:30:00 and 4:00:00.');
    let url = f.url.value.trim();
    const official = f.official.value.trim() ? parseTime(f.official.value) : null;
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    url = url.replace(/^http:/i, 'https:');
    if (url && !/^https:\/\/[^\s.]+\.[^\s]+$/.test(url)) err('url', 'Enter the address of the results page.');
    if (f.official.value.trim() && (official == null || official < 1800 || official > 14400)) err('official', 'Enter the chip time as h:mm:ss.');
    if (url && !f.official.value.trim()) err('official', 'Add the official time too, or leave both empty.');
    if (!url && f.official.value.trim()) err('url', 'Add the link too, or leave both empty.');
    if (!f.ran.checked) { f.querySelector('.c51-check').classList.add('is-error'); first ??= f.ran; }
    if (first) return first.focus();

    const row = { race_id: x.r.id, watch_time_s: watch, status: url ? 'pending' : 'checked_in' };
    if (url) Object.assign(row, { result_url: url, official_time_s: official });
    if (x.abroad) Object.assign(row, { abroad_name: x.plan?.race_name, abroad_date: x.plan?.race_date, abroad_country: x.plan?.country, gpx_path: x.plan?.course_gpx || null });
    const done = busy(f.querySelector('[type=submit]'), 'Checking in…');
    try {
      if (photo.blob) row.photo_path = await uploadPhoto(x.uid, x.r.id, photo.blob);
      const { error } = await sb.from('submissions').insert(row);
      if (error) throw error;
      done();
      go(`race/${x.abroad ? 'abroad' : x.r.id}`, { flash: banner('success', url ? 'Sent for review' : 'Checked in', url ? `Nice run. ${esc(fmtTime(official))} is in review now.` : `Nice run. ${esc(fmtTime(watch))} is saved. Add the official link when results are out.`) });
    } catch (error) {
      done();
      if (isOffline(error)) {
        const kept = enqueue({ ...row, uid: x.uid, photo: photo.blob ? await toDataUrl(photo.blob) : null });
        if (kept === 'failed') {
          f.querySelector('.form-msg').innerHTML = banner('error', 'No signal, and no room to save it', 'Your phone’s storage for this site is full. Keep this screen open and tap Check in again when you have signal.');
          return;
        }
        go(`race/${x.abroad ? 'abroad' : x.r.id}`, { flash: banner('pending', 'Saved on your phone', kept === 'saved' ? 'No signal at the finish. Your check-in goes out by itself when you’re back online.' : 'No signal at the finish. Your check-in goes out by itself when you’re back online. The selfie didn’t fit on the phone: add it with your official result.') });
      } else {
        f.querySelector('.form-msg').innerHTML = banner('error', 'Could not check in', esc(error.message || 'Try again in a minute.'));
      }
    }
  });
}

// ── Submit / edit / fix ───────────────────────────────────────────────────
function submitPage(root, x, flash) {
  const { sub, st, r } = x;
  const base = `#/race/${x.abroad ? 'abroad' : r.id}`;
  if (st === 'verified') return go(base.slice(2));
  if (!x.open) return go(base.slice(2));
  const editing = st === 'pending', fixing = st === 'rejected';
  const title = x.abroad && st === 'none' ? 'Submit a race abroad' : editing || fixing ? `Your ${x.abroad ? 'race abroad' : r.city} result` : 'Submit your result';
  const v = sub || {};
  const plan = x.plan || {};
  const notice = editing ? banner('pending', `Under review since ${day(sub.submitted_at)}`, 'We check results within a week. You can edit until we start checking.')
    : fixing ? banner('error', 'We could not verify this result', esc(sub.reject_reason || ''))
    : st === 'checked_in' ? banner('pending', `Checked in · ${fmtTime(sub.watch_time_s)}`, 'One step left: the official time and the link to the results page.') : '';

  const raceFields = x.abroad ? `<div class="rc-group"><p class="lbl">Race</p>
      ${field({ name: 'race_name', label: 'Race name', placeholder: 'e.g. Valencia Half Marathon', value: v.abroad_name || plan.race_name || '' })}
      <div class="sheet__pair">${field({ name: 'country', label: 'Country', placeholder: 'Start typing, e.g. Spain', value: v.abroad_country || plan.country || '' })}
      ${field({ name: 'race_date', label: 'Race date', inputmode: 'numeric', placeholder: 'DD.MM.YYYY', hint: `Season ${SEASON} only`, value: toEu(v.abroad_date || plan.race_date) })}</div></div>` : '';

  const form = `<form class="card rc-form" novalidate>
    <div class="form-msg" tabindex="-1">${notice}</div>
    ${x.abroad && st === 'none' ? `<p class="rc-p">Any official half marathon outside Cyprus in the ${SEASON} season.</p>` : ''}
    ${raceFields}
    <div class="rc-group"><p class="lbl">Your result</p>
      ${field({ name: 'official', label: 'Official finish time', inputmode: 'numeric', placeholder: 'h:mm:ss', hint: v.watch_time_s && !v.official_time_s ? `Chip time from the official results. Your watch said ${fmtTime(v.watch_time_s)}.` : 'Chip time from the official results. Type digits, we add the colons.', value: v.official_time_s ? fmtTime(v.official_time_s) : '' })}
      ${field({ name: 'url', label: 'Link to your result', inputmode: 'url', placeholder: 'results-site.com/…', hint: 'The page with your name and time. https:// is optional.', value: v.result_url || '' })}
    </div>
    <div class="rc-group"><p class="lbl">Extra details · optional</p>
      ${field({ name: 'bib', label: 'Bib number', inputmode: 'numeric', hint: 'Helps us find you in the results faster.', value: v.bib || '', required: false })}
      <div class="sheet__pair">${field({ name: 'place', label: 'Your place', inputmode: 'numeric', value: v.place || '', required: false })}${field({ name: 'place_of', label: 'Of finishers', inputmode: 'numeric', value: v.place_of || '', required: false })}</div>
      <p class="rc-note rc-note--tight">Overall place, if you know it. We check it with the time.</p>
      ${x.abroad ? `<div class="rc-gpxline">${svg(ROUTE, 20)}<span>${plan.course_gpx || v.gpx_path ? '<b>Course GPX added</b> · it draws your course map.' : '<b>No course GPX</b> · optional. Add it from <button type="button" class="rc-link" data-abroad-plan>your race plan</button>.'}</span></div>` : ''}
      ${photoPick('Finish photo', 'Only you will see it · JPG or PNG, up to 10 MB')}
    </div>
    ${editing ? '' : `<div class="c51-check"><label class="c51-check__row"><input class="c51-check__input" type="checkbox" name="own" required><span class="c51-check__box">${icon('check', 16)}</span><span class="c51-check__label">This is my own result, and the time matches the official results.</span></label></div>`}
    <div class="rc-form__btns">
      <button type="submit" class="c51-btn c51-btn--primary">${editing ? 'Save changes' : fixing ? 'Resubmit for review' : 'Submit for review'}</button>
      ${editing ? '<button type="button" class="c51-btn c51-btn--outline rc-danger" data-withdraw>Withdraw submission</button>' : `<a class="c51-btn c51-btn--secondary" href="${base}">Cancel</a>`}
    </div>
  </form>`;

  const steps = [['Submit', 'Your time, the results link and anything optional.'], ['We check', 'Against the official results, within a week.'], ['Stamp', `The ${x.abroad ? 'International' : r.city} stamp lands in your passport.`]];
  const side = `<aside class="card rc-side">
    <div class="rc-side__race"><div class="rc-stamp is-${st === 'none' ? 'none' : 'wait'} rc-stamp--sm"><div class="rc-stamp__ring"><img src="${stampImg(r.stamp, false)}" alt=""></div></div>
      <div><p class="num rc-side__name">${esc(x.name)}</p><p class="rc-note">${esc(x.date ? (x.date.tbc ? formatRaceDate(r, { long: true }) : DAY_Y.format(x.date.start).replace(',', '')) : 'Any race abroad')}</p><p class="rc-note">Race ${x.n} of 6</p></div></div>
    <p class="lbl">What happens next</p>
    <ol class="rc-steps">${steps.map(([t, s], i) => `<li class="${(i === 0 && !editing) || (i === 1 && editing) ? 'is-on' : ''}"><span>${i + 1}</span><div><b>${t}</b><p>${s}</p></div></li>`).join('')}</ol>
    <p class="rc-tip">Made a typo? You can edit the submission until we start checking it.</p>
  </aside>`;

  root.innerHTML = appShell(`${flash || ''}<a class="back" href="${base}">${icon('back')}${esc(x.name)}</a>
    <h1 class="page-title">${esc(title)}</h1>
    <div class="rc-submit">${form}${side}</div>`);

  const f = root.querySelector('.rc-form');
  wireTime(f.official);
  const photo = wirePhotoPick(f, v.photo_path, 'Only you will see it · JPG or PNG, up to 10 MB');
  const country = x.abroad ? combobox(f.country, countryNames()) : null;
  if (x.abroad) f.race_date.addEventListener('input', () => { const d = f.race_date.value.replace(/\D/g, '').slice(0, 8); f.race_date.value = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('.'); });
  f.querySelector('[data-abroad-plan]')?.addEventListener('click', () => openAbroad(x.plan, () => render()));
  f.own?.addEventListener('change', () => f.querySelector('.c51-check').classList.remove('is-error'));

  f.querySelector('[data-withdraw]')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to withdraw'; return; }
    const done = busy(b, 'Withdrawing…');
    const { error } = await sb.from('submissions').delete().eq('id', sub.id);
    if (!error && sub.photo_path) await removePhoto(sub.photo_path);
    done();
    if (error) { f.querySelector('.form-msg').innerHTML = banner('error', 'Could not withdraw it', esc(error.message)); return; }
    go(base.slice(2), { flash: banner('success', 'Submission withdrawn', 'You can submit again any time this season.') });
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const names = ['official', 'url', 'bib', 'place', 'place_of'].concat(x.abroad ? ['race_name', 'country', 'race_date'] : []);
    names.forEach((n) => setError(f, n, ''));
    let first = null;
    const err = (n, msg) => { const el = setError(f, n, msg); first ??= el; };
    const row = {};
    if (x.abroad) {
      row.abroad_name = f.race_name.value.trim();
      row.abroad_country = f.country.value.trim();
      row.abroad_date = fromEu(f.race_date.value);
      if (row.abroad_name.length < 2) err('race_name', 'Enter the race name.');
      if (!country.valid()) err('country', 'Pick a country from the list.');
      if (!row.abroad_date) err('race_date', 'Enter the date as DD.MM.YYYY, e.g. 14.02.2027.');
      else if (!row.abroad_date.startsWith(String(SEASON))) err('race_date', `The race has to be in ${SEASON}.`);
      else if (isoDay(row.abroad_date) > x.m.now) err('race_date', 'This date is still ahead. Submit after the race.');
    }
    const t = parseTime(f.official.value);
    if (t == null) err('official', 'Enter the time as h:mm:ss, e.g. 1:45:32.');
    else if (t < 1800 || t > 14400) err('official', 'A half marathon time is between 0:30:00 and 4:00:00.');
    let url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    url = url.replace(/^http:/i, 'https:');
    if (!url) err('url', 'Add the link to the results page.');
    else if (!/^https:\/\/[^\s.]+\.[^\s]+$/.test(url)) err('url', 'Enter the address of the results page.');
    const bib = f.bib.value.trim();
    if (bib.length > 12) err('bib', 'A bib number is up to 12 characters.');
    const place = f.place.value.trim() ? +f.place.value : null, of = f.place_of.value.trim() ? +f.place_of.value : null;
    if (place != null && !(Number.isInteger(place) && place > 0)) err('place', 'A whole number, like 412.');
    if (of != null && !(Number.isInteger(of) && of > 0)) err('place_of', 'A whole number, like 1180.');
    else if (place && of && place > of) err('place_of', 'Should be at least your place.');
    if (f.own && !f.own.checked) { f.querySelector('.c51-check').classList.add('is-error'); first ??= f.own; }
    if (first) return first.focus();

    Object.assign(row, { official_time_s: t, result_url: url, bib: bib || null, place, place_of: of, status: 'pending' });
    if (x.abroad) row.gpx_path = x.plan?.course_gpx || v.gpx_path || null;
    const btn = f.querySelector('[type=submit]');
    const done = busy(btn, 'Sending…');
    try {
      if (photo.blob) row.photo_path = await uploadPhoto(x.uid, r.id, photo.blob);
      else if (!photo.keep && v.photo_path) { await removePhoto(v.photo_path); row.photo_path = null; }
      const res = sub ? await sb.from('submissions').update(row).eq('id', sub.id) : await sb.from('submissions').insert({ race_id: r.id, ...row });
      if (res.error) throw res.error;
      if (x.abroad) await sb.from('abroad_plans').upsert({ race_name: row.abroad_name, race_date: row.abroad_date, country: row.abroad_country, website: x.plan?.website || null, course_gpx: x.plan?.course_gpx || null, updated_at: new Date().toISOString() });
      done();
      thanks(root, x, row, editing);
    } catch (error) {
      done();
      f.querySelector('.form-msg').innerHTML = banner('error', isOffline(error) ? 'You’re offline' : 'Could not send it', isOffline(error) ? 'Nothing is lost. Send it again when you have signal.' : esc(error.message || 'Try again in a minute.'));
      f.querySelector('.form-msg').focus();
    }
  });
}

function thanks(root, x, row, editing) {
  root.querySelector('.rc-form').outerHTML = `<section class="card rc-form rc-thanks" aria-labelledby="thx-title" tabindex="-1">
    ${chip('pending')}
    <h2 id="thx-title" class="rc-thanks__t">${editing ? 'Changes saved' : 'Thanks, we got it'}</h2>
    <p class="rc-p">Finish time <b>${fmtTime(row.official_time_s)}</b> for ${esc(x.abroad ? row.abroad_name : x.r.city)} is under review. We check it against the official results within a week and email you when the stamp is in your passport.</p>
    <div><a class="c51-btn c51-btn--dark" href="#/passport">Back to passport</a></div>
  </section>`;
  root.querySelector('.rc-steps li.is-on')?.classList.remove('is-on');
  root.querySelectorAll('.rc-steps li')[1]?.classList.add('is-on');
  root.querySelector('.rc-thanks').focus();
  window.scrollTo(0, 0);
}

// "Share your stamp" (ShareStamp design): square or story image drawn on a canvas,
// shared through the phone's menu or downloaded, plus a line for the Strava activity.
function wireShare(root, x) {
  const open = root.querySelector('[data-share]');
  if (!open) return;
  const { m, sub, r } = x;
  const isPb = m.pb && m.pb.r.id === r.id;
  const title = x.abroad ? 'International' : r.city;
  const when = x.date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(x.date.start) : '';
  const card = {
    stamp: r.stamp, title,
    subtitle: [x.abroad ? sub.abroad_name || 'Half marathon abroad' : 'Half marathon', when].filter(Boolean).join(' · '),
    time: fmtTime(sub.official_time_s), pb: isPb, pace: `${paceOf(sub.official_time_s)} /km`,
    stamps: m.races.map((q) => ({ stamp: q.stamp, earned: m.isV(q) })), count: m.nV,
  };
  const text = `🟠 Cyprus 5+1 · ${title} stamp collected · ${m.nV} of 6 · ${isPb ? 'PB ' : ''}${fmtTime(sub.official_time_s)}\nSix finish lines, one passport → ${STRAVA_CLUB_URL.replace(/^https:\/\/(www\.)?/, '')}`;
  const canCopy = !!navigator.clipboard?.writeText && isSecureContext;
  const file = (blob, format) => new File([blob], `cyprus51-${r.stamp}-${format}.png`, { type: 'image/png' });
  const canShareFiles = () => { try { return !!navigator.canShare?.({ files: [file(new Blob(['x'], { type: 'image/png' }), 'test')] }); } catch { return false; } };

  open.addEventListener('click', () => {
    const dlg = document.createElement('dialog');
    dlg.className = 'sheet share';
    dlg.setAttribute('aria-labelledby', 'share-title');
    const phoneShare = canShareFiles();
    dlg.innerHTML = `<div class="c51-dialog sheet__box share__box">
      <div class="c51-dialog__head"><h2 id="share-title" class="c51-dialog__title share__title">Share your stamp</h2><button type="button" class="c51-dialog__close" data-close>Close</button></div>
      <div class="seg share__seg" role="group" aria-label="Image format"><button type="button" data-fmt="square" aria-pressed="true">Square · post</button><button type="button" data-fmt="story" aria-pressed="false">Story</button></div>
      <div class="share__preview" data-preview aria-live="polite"><div class="sk share__sk"></div></div>
      <button type="button" class="c51-btn c51-btn--primary c51-btn--block" data-go disabled>${svg(phoneShare ? SHARE_IC : DOWNLOAD_IC, 18)}${phoneShare ? 'Share image' : 'Download image'}</button>
      ${canCopy ? '<button type="button" class="c51-btn c51-btn--secondary c51-btn--block" data-copy>Copy for Strava</button>' : ''}
      ${phoneShare ? '<p class="share__note">Share opens your phone’s menu: Instagram, WhatsApp, Save image. Add the image to your activity in the Strava app.</p>'
        : `<p class="share__note">Download the image for a post or a story.${canCopy ? ' Copy the line for your Strava activity description:' : ''}</p>${canCopy ? `<pre class="share__text">${esc(text)}</pre>` : ''}`}
    </div>`;
    document.body.appendChild(dlg);
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('close', () => { dlg.remove(); open.focus(); });
    dlg.querySelector('[data-close]').addEventListener('click', close);

    let format = 'square', blob = null, url = null;
    const go = dlg.querySelector('[data-go]'), preview = dlg.querySelector('[data-preview]');
    const draw = async () => {
      go.disabled = true;
      preview.className = `share__preview is-${format}`;
      preview.innerHTML = '<div class="sk share__sk"></div>';
      try {
        blob = await toBlob(await drawCard(format, card));
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        preview.innerHTML = `<img src="${url}" alt="${esc(`Share image: ${title} stamp collected, ${card.time}${isPb ? ', personal best' : ''}, ${card.count} of 6 stamps`)}">`;
        go.disabled = false;
      } catch { preview.innerHTML = '<p class="rc-note">The image could not be made in this browser.</p>'; }
    };
    dlg.querySelectorAll('[data-fmt]').forEach((b) => b.addEventListener('click', () => {
      format = b.dataset.fmt;
      dlg.querySelectorAll('[data-fmt]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      draw();
    }));
    go.addEventListener('click', async () => {
      if (!blob) return;
      if (phoneShare) {
        try { await navigator.share({ files: [file(blob, format)], text }); } catch { /* closed the menu */ }
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = `cyprus51-${r.stamp}-${format}.png`;
        document.body.appendChild(a); a.click(); a.remove();
      }
    });
    dlg.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(text); } catch { window.open(STRAVA_CLUB_URL, '_blank', 'noopener'); return; }
      b.classList.add('is-done');
      b.innerHTML = `${icon('check', 16)}Copied. Paste it into your Strava activity`;
      setTimeout(() => { b.classList.remove('is-done'); b.textContent = 'Copy for Strava'; }, 2400);
    });
    dlg.showModal();
    draw();
  });
}
