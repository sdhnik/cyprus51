import { sb } from '../supa.js';
import { appShell } from '../layout.js';
import { esc, icon, banner } from '../ui.js';
import { loadRaces, raceDate, formatRaceDate, daysUntil, checkInOpen, seasonEnd, stampImg, course, profilePath, fmtTime, asset } from '../data.js';

const STATUS = {
  verified: { chip: 'verified', label: 'Verified' },
  pending: { chip: 'pending', label: 'Under review' },
  checked_in: { chip: 'pending', label: 'Checked in' },
  rejected: { chip: 'error', label: 'Not verified' },
};

function chip(kind, label) {
  return `<span class="c51-chip c51-chip--plain c51-chip--${kind}"><span class="c51-chip__dot" aria-hidden="true"></span>${esc(label)}</span>`;
}

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export async function passport(root, { state, flash }) {
  root.innerHTML = appShell(`<div class="skeleton" aria-busy="true" role="status"><span class="sr">Loading your passport…</span><div class="sk sk--hero"></div><div class="sk sk--card"></div></div>`);

  const [data, subsRes] = await Promise.all([
    loadRaces(),
    sb.from('submissions').select('race_id, status, watch_time_s, official_time_s, reject_reason'),
  ]);
  if (subsRes.error) throw subsRes.error;
  const subs = new Map(subsRes.data.map((s) => [s.race_id, s]));
  const now = new Date();

  const all = [...data.races, { ...data.abroad, city: 'International', abroad: true }];
  const verified = all.filter((r) => subs.get(r.id)?.status === 'verified').length;
  const review = [...subs.values()].filter((s) => s.status === 'pending').length;
  const daysLeft = Math.max(0, daysUntil(seasonEnd(data), now));
  const upcoming = data.races.filter((r) => raceDate(r).end >= now && subs.get(r.id)?.status !== 'verified');
  const next = upcoming[0];
  const raceDay = data.races.find((r) => checkInOpen(r, now) && !subs.has(r.id));
  const firstIn = next && !raceDate(next).tbc ? daysUntil(raceDate(next).start, now) : null;

  const chips = [
    `${verified} of 6 stamps`,
    review ? `${review} under review` : verified === 0 && firstIn != null ? `First race in ${plural(firstIn, 'day')}` : '',
    `${plural(daysLeft, 'day')} left in season`,
  ].filter(Boolean);

  const hero = `<section class="hero-pass" aria-label="Running passport">
    <img class="hero-pass__topo" src="${asset('assets/patterns/cyprus-topo.webp')}" alt="">
    <div class="hero-pass__who">
      <p class="eyebrow eyebrow--on-ink">RUNNING PASSPORT · SEASON ${data.season}</p>
      <h1 class="hero-pass__name">${esc(state.profile?.display_name || 'Runner')}</h1>
      <ul class="hero-pass__chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    </div>
    <div class="hero-pass__stamps" aria-label="${verified} of 6 stamps collected">
      ${all.map((r) => `<img src="${stampImg(r.stamp, subs.get(r.id)?.status === 'verified')}" alt="" class="${subs.get(r.id)?.status === 'verified' ? 'is-earned' : ''}">`).join('')}
    </div>
  </section>`;

  const raceDayCard = raceDay ? `<section class="raceday" aria-labelledby="rd-title">
    <img class="raceday__topo" src="${asset('assets/patterns/cyprus-topo.webp')}" alt="">
    <p class="eyebrow eyebrow--on-ink">RACE DAY · ${esc(raceDay.city.toUpperCase())}</p>
    <h2 id="rd-title" class="raceday__title">Finished?<br>Check in.</h2>
    <p class="raceday__text">Takes 20 seconds. Add the official link later, when results are out.</p>
    <a class="c51-btn c51-btn--primary" href="#/race/${raceDay.id}/checkin">I finished ${icon('arrow')}</a>
  </section>` : '';

  let nextCard = '';
  if (next) {
    const d = raceDate(next);
    const when = d.tbc ? formatRaceDate(next, { long: true }).toUpperCase() : `${formatRaceDate(next).toUpperCase()} · IN ${plural(daysUntil(d.start, now), 'DAY').toUpperCase()}`;
    nextCard = `<section class="card next" aria-labelledby="next-title">
      <p class="eyebrow">NEXT UP · ${esc(when)}</p>
      <h2 id="next-title" class="next__title">${esc(next.city)} Half Marathon</h2>
      <div class="next__facts" data-course="${next.id}">
        <div><p class="lbl">Distance</p><p class="num">21.1 KM</p></div>
        <div><p class="lbl">Elevation gain</p><p class="num" data-gain>—</p></div>
        ${next.startFinish ? `<div><p class="lbl">Start</p><p class="num">${esc(next.startFinish.toUpperCase())}</p></div>` : ''}
      </div>
      <svg class="next__profile" viewBox="0 0 600 70" preserveAspectRatio="none" aria-hidden="true"><path data-area fill="#ff633e" fill-opacity=".15"/><path data-line fill="none" stroke="#ff633e" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
      <div class="next__actions">
        <a class="c51-btn c51-btn--outline" href="${esc(next.website)}" target="_blank" rel="noopener">Race website ${icon('ext', 16)}</a>
      </div>
    </section>`;
  }

  const rows = all.map((r) => {
    const s = subs.get(r.id);
    let st, detail = '';
    if (s) {
      st = STATUS[s.status];
      detail = s.status === 'checked_in' ? `${fmtTime(s.watch_time_s)} · waiting for results`
        : s.status === 'rejected' ? 'Fix and resubmit'
        : fmtTime(s.official_time_s);
    } else if (r.abroad) {
      st = { chip: 'neutral', label: 'Any half abroad' };
    } else if (checkInOpen(r, now)) {
      st = { chip: 'pending', label: 'Race day' };
    } else if (raceDate(r).end < now) {
      st = { chip: 'neutral', label: 'No result' };
    } else {
      st = { chip: 'neutral', label: 'Upcoming' };
    }
    const date = r.abroad ? `Season ${data.season}` : formatRaceDate(r);
    return `<li class="season__row">
      <img src="${stampImg(r.stamp, s?.status === 'verified')}" alt="" class="season__stamp">
      <span class="season__city num">${esc(r.city)}</span>
      <span class="season__date">${esc(date)}</span>
      ${chip(st.chip, st.label)}
      <span class="season__detail">${esc(detail)}</span>
    </li>`;
  }).join('');

  const season = `<section class="card" aria-labelledby="season-title">
    <div class="card__head"><h2 id="season-title" class="h2">Season ${data.season}</h2><p class="muted">Five Cyprus cities and one half marathon abroad</p></div>
    <ol class="season">${rows}</ol>
  </section>`;

  root.innerHTML = appShell(`${flash || ''}${hero}${raceDayCard}<div class="grid-2">${nextCard}${tips(verified, data)}</div>${season}`);

  if (next) {
    const c = await course(next).catch(() => null);
    const box = root.querySelector(`[data-course="${next.id}"]`);
    if (c && box) {
      box.querySelector('[data-gain]').textContent = `${c.gain} M`;
      const p = profilePath(c);
      root.querySelector('.next__profile [data-area]').setAttribute('d', p.area);
      root.querySelector('.next__profile [data-line]').setAttribute('d', p.line);
    }
  }
}

// Simple guidance until challenges and achievements arrive.
function tips(verified, data) {
  const steps = verified === 0
    ? [['Pick your first race', 'Nicosia opens the season. Register on the organiser’s site.'], ['Check in at the finish', 'Open this app right after you cross the line.'], ['Add your official result', 'Paste the link from the results page. We verify it and the stamp is yours.']]
    : [['Keep the streak going', 'Your next race is on the left.'], ['Add results quickly', 'Check in at the finish, then add the official link.'], ['Run one abroad', 'Any official half outside Cyprus earns the International stamp.']];
  return `<section class="card how" aria-labelledby="how-title">
    <h2 id="how-title" class="h2">How it works</h2>
    <ol class="how__list">${steps.map(([t, s]) => `<li><strong>${esc(t)}</strong><span>${esc(s)}</span></li>`).join('')}</ol>
  </section>`;
}
