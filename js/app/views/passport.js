// Passport — follows the PassportDesktop / PassportMobile / PassportEmpty designs.
import { appShell } from '../layout.js';
import { esc, icon, stravaLink } from '../ui.js';
import { STRAVA_CLUB_URL } from '../../config.js';
import { raceDate, formatRaceDate, daysUntil, checkInOpen, seasonEnd, stampImg, course, profilePath, fmtTime, asset } from '../data.js';
import { loadSeason, HALF_KM, SUB130, badgeImg, offlineNote } from '../model.js';
import { openAbroad, planCourse } from '../abroad.js';
import { installCard, wireInstall } from '../install.js';

let focusAbroad = false;
import { render } from '../router.js';

const dayShort = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00')).replace(',', '');
const dayLong = (iso) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00'));
// Long names step down in size so a word never breaks in the middle.
function nameSize(n) {
  const word = Math.max(...n.split(/\s+/).map((w) => w.length)), all = n.length;
  if (word > 13 || all > 34) return ' is-xs';
  if (word > 10 || all > 24) return ' is-s';
  if (all > 16) return ' is-m';
  return '';
}
const plural = (n, one, many = one + 's') => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const pace = (sec) => fmtTime(Math.round(sec / HALF_KM));

const ICON = {
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  plus: 'M12 5v14M5 12h14',
};
const svgIcon = (d, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const CHIP = { verified: ['Verified', 'verified'], pending: ['In review', 'pending'], checked_in: ['Checked in', 'pending'], rejected: ['Rejected', 'error'], none: ['Not submitted', 'neutral'] };
const chip = (state, label) => {
  const [l, tone] = CHIP[state] || CHIP.none;
  return `<span class="c51-chip c51-chip--plain c51-chip--${tone}"><span class="c51-chip__dot" aria-hidden="true"></span>${esc(label || l)}</span>`;
};
const progress = (value, max, caption, label) => `<div class="c51-progress">
  <div class="c51-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" aria-label="${esc(label)}"><div class="c51-progress__fill" style="width:${Math.min(100, (value / max) * 100)}%"></div></div>
  ${caption ? `<p class="c51-progress__caption">${esc(caption)}</p>` : ''}</div>`;

export async function passport(root, { state, flash }) {
  root.innerHTML = appShell(`<div aria-busy="true" role="status"><span class="sr">Loading your passport…</span><div class="sk sk--hero"></div><div class="sk sk--card"></div></div>`);

  const m = await loadSeason();
  const { data, plan, subs, races, cyprus, isV, verified, nV, nCyprusV, nReview, times, pb, avg, next, nextDays, seasonStart, abroadDone } = m;
  const now = m.now;
  const daysLeft = Math.max(0, daysUntil(seasonEnd(data), now));
  const abroadR = races.find((r) => r.abroad);
  const planD = plan ? daysUntil(new Date(plan.race_date + 'T00:00:00'), now) : null;
  const raceDay = cyprus.find((r) => checkInOpen(r, now) && !subs.has(r.id))
    || (plan && planD <= 0 && planD >= -3 && !subs.has(abroadR.id) ? { id: 'abroad', city: plan.race_name } : null);
  const name = state.profile?.display_name || 'Runner';

  // ── Hero ───────────────────────────────────────────
  const chips = [`${nV} of 6 stamps`];
  const toStart = seasonStart ? daysUntil(seasonStart, now) : 0;
  if (nReview) chips.push(`${nReview} under review`);
  if (toStart > 0) chips.push(`Season starts in ${plural(toStart, 'day')}`);
  else {
    if (!nReview && nV === 0 && nextDays != null) chips.push(nextDays === 0 ? 'Race day today' : `Next race in ${plural(nextDays, 'day')}`);
    chips.push(`${plural(daysLeft, 'day')} left in season`);
  }
  const stats = [
    { label: 'Best time', value: pb ? fmtTime(pb.s.official_time_s) : '—', note: pb ? pb.r.city : 'not set yet' },
    { label: 'Avg pace', value: avg ? pace(avg) : '—', note: 'min per km' },
    { label: 'Distance', value: nV ? (HALF_KM * nV).toFixed(1) : '—', note: 'km verified' },
    { label: 'On course', value: nV ? fmtTime(times.reduce((a, b) => a + b, 0)) : '—', note: plural(nV, 'race') },
  ];
  const hero = `<section class="ps-hero" aria-label="Running passport">
    <img class="ps-hero__topo" src="${asset('assets/patterns/cyprus-topo.webp')}" alt="">
    <div class="ps-hero__who">
      <p class="ps-eyebrow">RUNNING PASSPORT · SEASON ${data.season}</p>
      <h1 class="ps-hero__name${nameSize(name)}">${esc(name)}</h1>
      <div class="ps-hero__chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    </div>
    <div class="ps-hero__stats">${stats.map((s) => `<div class="ps-stat"><p class="ps-stat__label">${s.label}</p><p class="num ps-stat__value">${esc(s.value)}</p><p class="ps-stat__note">${esc(s.note)}</p></div>`).join('')}</div>
  </section>`;

  // ── Race day ───────────────────────────────────────
  const raceDayCard = raceDay ? `<section class="raceday" aria-labelledby="rd-title">
    <img class="raceday__topo" src="${asset('assets/patterns/cyprus-topo.webp')}" alt="">
    <div class="raceday__main">
      <p class="ps-eyebrow">RACE DAY · ${esc(raceDay.city.toUpperCase())}</p>
      <h2 id="rd-title" class="raceday__title">Finished?<br>Check in.</h2>
      <p class="raceday__text">Takes 20 seconds. Add the official link later, when results are out.</p>
    </div>
    <a class="c51-btn c51-btn--primary raceday__btn" href="#/race/${raceDay.id}/checkin">I finished ${icon('arrow')}</a>
  </section>` : '';

  // ── Next up ────────────────────────────────────────
  // The race abroad takes the card when it comes before the next Cyprus race.
  const abroadRace = races.find((r) => r.abroad);
  const planStart = plan ? new Date(plan.race_date + 'T00:00:00') : null;
  const planNext = plan && !abroadDone && !subs.has(abroadRace.id) && daysUntil(planStart, now) >= 0
    && (!next || planStart < raceDate(next).start) ? plan : null;
  let nextCard = '';
  if (planNext) {
    const pd = daysUntil(planStart, now);
    const long = planNext.race_name.length > 26;
    nextCard = `<section class="ps-next" aria-labelledby="next-title">
      <img class="ps-next__bg" src="${asset('assets/patterns/route-lines.webp')}" alt="">
      <div><p class="ps-next__eyebrow">NEXT UP · ${esc(dayShort(planNext.race_date).toUpperCase())} · ${pd === 0 ? 'TODAY' : `IN ${plural(pd, 'DAY', 'DAYS')}`}</p><h2 id="next-title" class="ps-next__title${long ? ' is-long' : ''}" title="${esc(planNext.race_name)}">${esc(planNext.race_name)}</h2></div>
      <div class="ps-next__facts">
        <div><p>Distance</p><p class="num">21.1 KM</p></div>
        <div><p>Elevation gain</p><p class="num" data-gain>— M</p></div>
        <div><p>Country</p><p class="num is-text">${esc(planNext.country.toUpperCase())}</p></div>
      </div>
      ${planNext.course_gpx
        ? `<svg class="ps-next__profile" viewBox="0 0 600 70" preserveAspectRatio="none" aria-hidden="true"><path data-area fill="#0d1412" fill-opacity=".18"/><path data-line fill="none" stroke="#0d1412" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`
        : `<button type="button" class="ps-next__nogpx" data-abroad>${svgIcon(ICON.plus, 18)}Add the course GPX to see the elevation profile</button>`}
      <div class="ps-next__actions">
        <a class="c51-btn c51-btn--dark" href="#/race/abroad">Plan this race ${icon('arrow')}</a>
        ${planNext.website ? `<a class="ps-next__site" href="${esc(planNext.website)}" target="_blank" rel="noopener"><span>Race website</span>${svgIcon(ICON.arrowUpRight, 16)}</a>` : ''}
      </div>
    </section>`;
  } else if (next) {
    const d = raceDate(next);
    const when = d.tbc ? formatRaceDate(next, { long: true }).toUpperCase() : `${formatRaceDate(next).toUpperCase()} · ${nextDays === 0 ? 'TODAY' : `IN ${plural(nextDays, 'DAY', 'DAYS')}`}`;
    nextCard = `<section class="ps-next" aria-labelledby="next-title">
      <img class="ps-next__bg" src="${asset('assets/patterns/route-lines.webp')}" alt="">
      <div><p class="ps-next__eyebrow">NEXT UP · ${esc(when)}</p><h2 id="next-title" class="ps-next__title">${esc(next.city)} Half Marathon</h2></div>
      <div class="ps-next__facts">
        <div><p>Distance</p><p class="num">21.1 KM</p></div>
        <div><p>Elevation gain</p><p class="num" data-gain>— M</p></div>
        ${next.startFinish ? `<div><p>Start</p><p class="num">${esc(next.startFinish.toUpperCase())}</p></div>` : ''}
      </div>
      <svg class="ps-next__profile" viewBox="0 0 600 70" preserveAspectRatio="none" aria-hidden="true"><path data-area fill="#0d1412" fill-opacity=".18"/><path data-line fill="none" stroke="#0d1412" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
      <div class="ps-next__actions">
        <a class="c51-btn c51-btn--dark" href="#/race/${next.id}">Plan this race ${icon('arrow')}</a>
        <a class="ps-next__site" href="${esc(next.website)}" target="_blank" rel="noopener"><span>Race website</span>${svgIcon(ICON.arrowUpRight, 16)}</a>
      </div>
    </section>`;
  } else {
    nextCard = `<section class="ps-next" aria-labelledby="next-title"><img class="ps-next__bg" src="${asset('assets/patterns/route-lines.webp')}" alt="">
      <p class="ps-next__eyebrow">SEASON ${data.season}</p><h2 id="next-title" class="ps-next__title">All Cyprus races are behind you</h2>
      <p style="position:relative;margin:0">One half marathon abroad still counts until the end of the season.</p></section>`;
  }

  // ── Challenges ─────────────────────────────────────
  const CH = [];
  const nextName = next ? next.city : '';
  if (nV === 0) {
    if (next) {
      CH.push({ kind: 'Next race', icon: ICON.trophy, title: 'Earn your first stamp', text: `Finish ${nextName} ${raceDate(next).tbc ? 'this season' : 'on ' + formatRaceDate(next).replace(/^\w+ /, '')} and submit your result.`, tlabel: 'Race day', target: formatRaceDate(next).toUpperCase(), cta: `#/race/${next.id}`, unlock: 'Personal Best', unlockImg: badgeImg('personal-best', true) });
      if (nextDays != null) CH.push({ kind: 'Planning', icon: ICON.target, title: 'Pick a target time', text: `Choose a goal for ${nextName} and get the pace per km to hold.`, tlabel: 'Days to race', target: String(nextDays), cta: `#/race/${next.id}` });
    }
  } else {
    if (next) CH.push({ kind: 'Next race', icon: ICON.trophy, title: `Beat your PB in ${nextName}`, text: `Finish ${nextName} under ${fmtTime(pb.s.official_time_s)}. Hold this pace or faster.`, tlabel: 'Target pace', target: `${pace(pb.s.official_time_s - 1)} /KM`, cta: `#/race/${next.id}` });
    if (nCyprusV < 5) CH.push({ kind: 'Achievement', icon: ICON.pin, title: 'Finish 5 Cyprus cities', text: `${['No', 'One', 'Two', 'Three', 'Four', 'Five'][5 - nCyprusV]} more Cyprus ${5 - nCyprusV === 1 ? 'race' : 'races'} to go.${next ? ` ${nextName} is next.` : ''}`, progress: [nCyprusV, 5, `${nCyprusV} of 5${nReview ? ` · ${nReview} in review` : ''}`], unlock: '5 Cities Finisher', unlockImg: badgeImg('5-cities-finisher', true) });
    if (pb.s.official_time_s > SUB130) CH.push({ kind: 'Achievement', icon: ICON.bolt, title: 'Break 1:30', text: `Your best is ${fmtTime(pb.s.official_time_s)}. Any half marathon counts, home or abroad.`, tlabel: 'Time to cut', target: fmtTime(pb.s.official_time_s - SUB130 + 1), unlock: 'Sub 1:30 Elite', unlockImg: badgeImg('sub-1-30-elite', true) });
    if (nV >= 2 && next) CH.push({ kind: 'Consistency', icon: ICON.target, title: 'Consistent finish', text: `Finish ${nextName} within 3 minutes of your average, ${fmtTime(avg)}.`, tlabel: 'Finish window', target: `${fmtTime(avg - 180)} – ${fmtTime(avg + 180)}`, small: true, cta: `#/race/${next.id}` });
  }
  if (!abroadDone) {
    const planDays = planD;
    const abroadSub = subs.get(abroadR.id);
    CH.push(plan && planDays < 0 && !abroadSub
      ? { kind: 'Race abroad', icon: ICON.globe, title: 'Add your result abroad', text: `Ran ${plan.race_name}? Add the official result for your sixth stamp.`, tlabel: 'Race day', target: dayShort(plan.race_date).toUpperCase(), cta: '#/race/abroad/submit', ctaLabel: 'Submit your result abroad', unlock: 'International Finisher', unlockImg: badgeImg('international-finisher', true) }
      : plan
      ? { kind: 'Race abroad', icon: ICON.globe, title: plan.race_name.length > 22 ? plan.race_name : `Run ${plan.race_name}`, text: `${plan.country} · ${dayShort(plan.race_date)}. Your sixth stamp.`, tlabel: planDays > 0 ? 'Days to race' : 'Race day', target: planDays > 0 ? String(planDays) : dayShort(plan.race_date).toUpperCase(), edit: true, unlock: 'International Finisher', unlockImg: badgeImg('international-finisher', true) }
      : { kind: 'Race abroad', icon: ICON.globe, title: 'Add your race abroad', text: `Entered a half abroad? Add it to your ${data.season} calendar.`, tlabel: 'Stamp 6', target: 'Not added yet', muted: true, add: true, unlock: 'International Finisher', unlockImg: badgeImg('international-finisher', true) });
  }

  const challengeCard = CH.length ? `<section class="card ps-ch" aria-labelledby="goal-title">
    <div class="ps-ch__head"><p class="lbl">A challenge for you</p><span class="ps-ch__kind" data-ch="kind"></span></div>
    <div class="ps-ch__body" aria-live="polite" data-ch="body"></div>
    <div class="ps-ch__foot">
      <button type="button" class="ps-ch__more" data-ch="next">${svgIcon(ICON.refresh, 18)}Show another</button>
      <div class="ps-ch__dots">${CH.map((_, n) => `<button type="button" data-ch-go="${n}" aria-label="Challenge ${n + 1} of ${CH.length}"><span></span></button>`).join('')}</div>
    </div>
  </section>` : '';

  // Results chart in date order: the race abroad sits at its own date (or last, if not planned).
  const when = (r) => (r.abroad ? (plan ? new Date(plan.race_date + 'T00:00:00') : new Date(8.64e15)) : raceDate(r).start);
  const chartRaces = [...races].sort((a, b) => when(a) - when(b));

  // ── Season timeline ────────────────────────────────
  const rows = races.map((r) => {
    const s = subs.get(r.id);
    const st = s ? s.status : 'none';
    const isNext = planNext ? !!r.abroad : next && r.id === next.id;
    const detail = st === 'verified' ? fmtTime(s.official_time_s) : st === 'pending' ? fmtTime(s.official_time_s || s.watch_time_s) : st === 'checked_in' ? fmtTime(s.watch_time_s) : st === 'rejected' ? 'Fix result' : isNext ? 'Next up' : r.abroad && plan ? (planD < 0 ? 'Add result' : 'Planned') : '';
    const img = stampImg(r.stamp, st === 'verified' || st === 'pending');
    const op = st === 'pending' ? .45 : 1;
    return { r, st, detail, img, op, date: r.abroad ? (plan ? `${dayShort(plan.race_date)} · ${plan.country}` : 'Any race abroad') : formatRaceDate(r), href: r.abroad ? '#/race/abroad' : `#/race/${r.id}` };
  });
  const season = `<section class="card ps-season" aria-labelledby="season-title">
    <div class="ps-head"><h2 id="season-title" class="h2">Season ${data.season}</h2><p class="ps-head__note">Select a race for course, target time and your result</p></div>
    <ol class="ps-tl">${rows.map((x, i) => `<li class="ps-tl__item${i === rows.length - 1 ? ' is-last' : ''}">
      <a href="${x.href}" class="ps-tl__link">
        <img src="${x.img}" alt="" style="opacity:${x.op}">
        <span class="ps-tl__text"><span class="num ps-tl__city">${esc(x.r.city)}</span><span class="ps-tl__date">${esc(x.date)}</span>${chip(x.st)}</span>
        <span class="ps-tl__detail">${esc(x.detail)}</span>
      </a></li>`).join('')}</ol>
  </section>`;

  // ── Results ────────────────────────────────────────
  const places = verified.filter((v) => v.s.place && v.s.place_of).map((v) => ({ ...v, pct: v.s.place / v.s.place_of }));
  const bestPlace = places.length ? places.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;
  const fastest = pb;
  const rStats = nV ? [
    ['Fastest pace', `${pace(fastest.s.official_time_s)} /KM`, fastest.r.city],
    ['Best place', bestPlace ? `${bestPlace.s.place.toLocaleString('en-GB')} / ${bestPlace.s.place_of.toLocaleString('en-GB')}` : '—', bestPlace ? `${bestPlace.r.city} · top ${Math.max(1, Math.round(bestPlace.pct * 100))}%` : 'Add your place when you submit'],
    ['Average finish', fmtTime(avg), plural(nV, 'verified race')],
  ] : [
    ['Fastest pace', '—', 'After your first race'],
    ['Best place', '—', 'Add your place when you submit'],
    ['Average finish', '—', '0 verified races'],
  ];
  const results = `<section class="card ps-results" aria-labelledby="results-title">
    <div class="ps-head"><h2 id="results-title" class="h2">Your results</h2><p class="ps-head__note">${pb ? `<span class="ps-pbline"></span> Personal best ${fmtTime(pb.s.official_time_s)}` : 'No results yet'}</p></div>
    <div class="ps-chart ps-chart--wide">${chart(chartRaces, subs, pb, 680, 280)}</div>
    <div class="ps-chart ps-chart--narrow">${chart(chartRaces, subs, pb, 318, 240)}</div>
    <div class="ps-rstats">${rStats.map(([l, v, n]) => `<div><p class="lbl">${l}</p><p class="num ps-rstats__v${v === '—' ? ' is-empty' : ''}">${esc(v)}</p><p class="ps-rstats__n">${esc(n)}</p></div>`).join('')}</div>
  </section>`;

  // ── Community ──────────────────────────────────────
  const c = m.community;
  let community = `<section class="card ps-com" aria-labelledby="community-title">
      <h2 id="community-title" class="h2">The challenge</h2>
      <p class="ps-com__lead">${c === null ? 'Runner numbers are not available right now. Try again a bit later.' : 'Runner numbers appear here once people start collecting stamps.'}</p>
      <div class="ps-com__empty" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map((k) => `<div><div></div><span>${k}</span></div>`).join('')}</div>
      <p class="ps-com__note">Runners by number of stamps, 0–6 · anonymous</p>
      <div class="ps-com__btns"><button type="button" class="c51-btn c51-btn--secondary" data-invite>Invite a friend</button>${stravaLink(STRAVA_CLUB_URL, 'club', 'c51-btn c51-btn--secondary')}</div>
    </section>`;
  if (c && c.runners) {
    const mine = Math.min(c.my_stamps ?? nV, 6);
    const maxN = Math.max(...c.dist, 1);
    const big = mine === 0
      ? `<span class="num ps-com__big">${Math.max(0, c.dist[0] - 1).toLocaleString('en-GB')}</span><span>runners are also waiting for their first stamp</span>`
      : `<span class="num ps-com__big">${Math.round((100 * c.fewer_than_me) / c.runners)}%</span><span>of runners have fewer stamps than you</span>`;
    community = `<section class="card ps-com" aria-labelledby="community-title">
      <h2 id="community-title" class="h2">The challenge</h2>
      <p class="ps-com__lead"><strong>${plural(c.runners, 'runner')}</strong> ${c.runners === 1 ? 'is' : 'are'} collecting stamps this season.</p>
      <div class="ps-com__row">${big}</div>
      <div class="ps-com__bars" role="img" aria-label="Runners by number of stamps; you are in the ${mine}-stamp group">
        ${c.dist.map((n, k) => `<div>${k === mine ? '<span class="ps-com__you">YOU</span>' : ''}<div style="height:${Math.max(4, (n / maxN) * 100)}%;background:${k === mine ? '#ff633e' : '#d3d5cf'}"></div><span>${k}</span></div>`).join('')}
      </div>
      <p class="ps-com__note">Runners by number of stamps, 0–6 · anonymous</p>
      <div class="ps-com__btns"><button type="button" class="c51-btn c51-btn--secondary" data-invite>Invite a friend</button>${stravaLink(STRAVA_CLUB_URL, 'club', 'c51-btn c51-btn--secondary')}</div>
    </section>`;
  }

  // ── Achievements ───────────────────────────────────
  const badges = m.badges;
  const earned = badges.filter((b) => b.earned).length;
  const awards = `<section class="card ps-awards" aria-labelledby="awards-title">
    <div class="ps-head"><h2 id="awards-title" class="h2">Achievements</h2><p class="ps-head__note">${earned} of 5 earned</p></div>
    <ul class="ps-awards__list">${badges.map((b) => `<li><a class="ps-badge" href="#/achievement/${b.slug}"><img src="${b.img}" alt=""><div class="ps-badge__text"><span class="num ps-badge__name">${b.name}</span>${progress(b.v, b.max, b.cap, b.name)}</div></a></li>`).join('')}</ul>
  </section>`;

  root.innerHTML = appShell(`${flash || ''}${offlineNote(m)}${raceDayCard}<div data-inst-slot></div>${hero}
    <div class="ps-row">${nextCard}${challengeCard}</div>
    ${season}
    <div class="ps-row">${results}${community}</div>
    ${awards}`);
  // Random order on every visit; after saving a race abroad, open on that tip.
  for (let k = CH.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [CH[k], CH[j]] = [CH[j], CH[k]]; }
  if (focusAbroad) {
    const k = CH.findIndex((c) => c.kind === 'Race abroad');
    if (k > 0) CH.unshift(...CH.splice(k, 1));
    focusAbroad = false;
  }

  // Challenge carousel: every slide sits in the same grid cell, so the card keeps
  // the height of the tallest one and nothing jumps when switching.
  if (CH.length) {
    let i = 0;
    const card = root.querySelector('.ps-ch');
    const body = card.querySelector('[data-ch="body"]');
    body.innerHTML = CH.map((ch, n) => `<div class="ps-ch__slide" data-slide="${n}">
        <div class="ps-ch__top"><div class="ps-ch__title"><span class="ps-ch__icon">${svgIcon(ch.icon, 28)}</span><h2 class="h2"${n === 0 ? ' id="goal-title"' : ''} title="${esc(ch.title)}">${esc(ch.title)}</h2></div><p class="ps-ch__text">${esc(ch.text)}</p></div>
        <div class="ps-ch__result">
          ${ch.progress ? progress(ch.progress[0], ch.progress[1], ch.progress[2], ch.title) : ''}
          ${ch.target ? `<div class="ps-ch__target"><div><p class="ps-ch__tlabel">${esc(ch.tlabel)}</p><p class="num ps-ch__tvalue${ch.small ? ' is-small' : ''}${ch.muted ? ' is-muted' : ''}">${esc(ch.target)}</p></div>${ch.cta ? `<a href="${ch.cta}" class="ps-ch__cta" aria-label="${esc(ch.ctaLabel || `Plan ${nextName} with this target`)}" title="${esc(ch.ctaLabel ? 'Open' : 'Plan this race')}">${svgIcon(ICON.arrow, 20)}</a>` : ''}${ch.edit ? `<button type="button" class="ps-ch__cta" data-abroad aria-label="Edit your race abroad" title="Edit race">${svgIcon(ICON.edit, 18)}</button>` : ''}${ch.add ? `<button type="button" class="ps-ch__add" data-abroad>${svgIcon(ICON.plus, 18)}Add race</button>` : ''}</div>` : ''}
          ${ch.unlock ? `<div class="ps-ch__unlock"><img src="${ch.unlockImg}" alt=""><p><span>Unlocks</span> <strong>${esc(ch.unlock)}</strong></p></div>` : ''}
        </div></div>`).join('');
    const show = () => {
      card.querySelector('[data-ch="kind"]').textContent = CH[i].kind;
      body.querySelectorAll('[data-slide]').forEach((el, n) => {
        const on = n === i;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-hidden', String(!on));
        el.inert = !on;
      });
      card.querySelectorAll('[data-ch-go]').forEach((b, n) => { b.setAttribute('aria-current', String(n === i)); b.classList.toggle('is-on', n === i); });
    };
    card.querySelector('[data-ch="next"]').addEventListener('click', () => { i = (i + 1) % CH.length; show(); });
    card.querySelectorAll('[data-ch-go]').forEach((b) => b.addEventListener('click', () => { i = +b.dataset.chGo; show(); }));
    card.querySelector('.ps-ch__foot').hidden = CH.length < 2;
    show();
  }

  // Race abroad dialog
  root.querySelectorAll('[data-abroad]').forEach((b) => b.addEventListener('click', () => openAbroad(plan, () => { focusAbroad = true; render(); })));

  // Install prompt: now, or as soon as the browser says the app can be installed
  const instId = planNext ? 'abroad' : next?.id, instDays = planNext ? daysUntil(new Date(planNext.race_date + 'T00:00:00'), now) : nextDays;
  const fillInstall = () => {
    const slot = root.querySelector('[data-inst-slot]');
    if (!slot || slot.firstChild) return;
    slot.innerHTML = installCard(instId, instDays);
    wireInstall(slot);
  };
  fillInstall();
  addEventListener('c51:installable', fillInstall, { once: true });

  // Invite a friend
  root.querySelector('[data-invite]')?.addEventListener('click', async (e) => {
    const url = asset('');
    const text = 'Join me for the Cyprus 5+1 running passport: six half marathons, one passport.';
    try {
      if (navigator.share) await navigator.share({ title: 'Cyprus 5+1', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); e.target.textContent = 'Link copied'; }
    } catch { /* closed the share sheet */ }
  });

  // Course profile of the next race
  if (planNext ? planNext.course_gpx : next) {
    const cs = await (planNext ? planCourse(planNext) : course(next)).catch(() => null);
    if (cs) {
      root.querySelector('[data-gain]').textContent = `${cs.gain} M`;
      const p = profilePath(cs);
      root.querySelector('.ps-next__profile [data-area]').setAttribute('d', p.area);
      root.querySelector('.ps-next__profile [data-line]').setAttribute('d', p.line);
    }
  }
}

// Finish-time chart: verified times as a line, PB as a dashed line, races to come as dashed columns.
function chart(races, subs, pb, W, H) {
  const narrow = W < 400;
  const x0 = narrow ? 44 : 60, x1 = W - 10, y0 = 24, y1 = H - (narrow ? 44 : 48);
  const step = (x1 - x0) / races.length;
  const X = (i) => x0 + step * (i + 0.5);
  const short = (r) => (r.abroad ? (narrow ? 'Intl.' : 'International') : narrow && r.city === 'Ayia Napa' ? 'A. Napa' : r.city);
  const sub = (r) => (r.abroad ? (r.plan ? dayShort(r.plan.race_date).replace(/^\w+ /, '') : 'Any') : raceDate(r).tbc ? formatRaceDate(r).split(',')[0] : formatRaceDate(r).replace(/^\w+ /, ''));
  const labels = races.map((r, i) => `<text x="${X(i).toFixed(1)}" y="${y1 + 20}" text-anchor="middle" font-size="${narrow ? 9.5 : 12}" font-weight="600" fill="#0d1412">${esc(short(r))}</text><text x="${X(i).toFixed(1)}" y="${y1 + 36}" text-anchor="middle" font-size="${narrow ? 9.5 : 11}" fill="#69716d">${esc(sub(r))}</text>`).join('');
  const pts = races.map((r, i) => ({ i, s: subs.get(r.id) })).filter((p) => p.s?.status === 'verified');

  if (!pts.length) {
    const colW = Math.min(46, step * 0.45);
    const cols = races.map((_, i) => `<rect x="${(X(i) - colW / 2).toFixed(1)}" y="${(y0 + (y1 - y0) / 3).toFixed(1)}" width="${colW.toFixed(1)}" height="${((y1 - y0) * 2 / 3).toFixed(1)}" rx="4" fill="none" stroke="#d3d5cf" stroke-width="1.5" stroke-dasharray="4 4"/>`).join('');
    const bw = narrow ? 260 : 320, bx = (W - bw) / 2, by = y0 + (y1 - y0) / 3 + 3;
    const grid = [0, 1, 2, 3].map((k) => `<line x1="10" y1="${(y0 + ((y1 - y0) * k) / 3).toFixed(1)}" x2="${x1}" y2="${(y0 + ((y1 - y0) * k) / 3).toFixed(1)}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="No results yet. Your finish times will appear here after your first verified race." style="width:100%;height:auto;font-family:Inter,sans-serif"><g stroke="#e4e5df">${grid}</g>${cols}${labels}<rect x="${bx}" y="${by}" width="${bw}" height="60" rx="12" fill="#ffffff" stroke="#e4e5df"/><text x="${W / 2}" y="${by + 24}" text-anchor="middle" font-size="${narrow ? 13 : 15}" font-weight="700" fill="#0d1412">Your finish times will appear here</text><text x="${W / 2}" y="${by + 45}" text-anchor="middle" font-size="13" fill="#69716d">after your first verified race</text></svg>`;
  }

  const ts = pts.map((p) => p.s.official_time_s);
  let lo = Math.floor((Math.min(...ts) - 120) / 300) * 300, hi = Math.ceil((Math.max(...ts) + 120) / 300) * 300;
  while ((hi - lo) / 300 < 3) hi += 300;
  const Y = (t) => y0 + ((t - lo) / (hi - lo)) * (y1 - y0);
  const hm = (t) => `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`;
  const ticks = [];
  for (let t = lo; t <= hi; t += 300) ticks.push(t);
  const grid = ticks.map((t) => `<line x1="${x0}" y1="${Y(t).toFixed(1)}" x2="${x1}" y2="${Y(t).toFixed(1)}" stroke="#e4e5df"/><text x="${x0 - 8}" y="${(Y(t) + 4).toFixed(1)}" font-size="${narrow ? 11 : 12}" fill="#69716d" text-anchor="end">${hm(t)}</text>`).join('');
  const future = races.map((r, i) => (subs.get(r.id)?.status === 'verified' ? '' : `<line x1="${X(i).toFixed(1)}" y1="${y0}" x2="${X(i).toFixed(1)}" y2="${y1}" stroke="#d3d5cf" stroke-dasharray="3 5"/>`)).join('');
  const line = pts.length > 1 ? `<polyline points="${pts.map((p) => `${X(p.i).toFixed(1)},${Y(p.s.official_time_s).toFixed(1)}`).join(' ')}" fill="none" stroke="#0d1412" stroke-width="2"/>` : '';
  const dots = pts.map((p) => { const y = Y(p.s.official_time_s); const above = p.s.official_time_s === pb.s.official_time_s; return `<circle cx="${X(p.i).toFixed(1)}" cy="${y.toFixed(1)}" r="${narrow ? 6 : 7}" fill="#0d1412"/><text x="${X(p.i).toFixed(1)}" y="${(above ? y - 12 : y + 22).toFixed(1)}" text-anchor="middle" font-size="${narrow ? 12 : 13}" font-weight="600" fill="#0d1412">${fmtTime(p.s.official_time_s)}</text>`; }).join('');
  const pbY = Y(pb.s.official_time_s);
  const desc = `Finish times: ${pts.map((p) => `${races[p.i].city} ${fmtTime(p.s.official_time_s)}`).join(', ')}`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}" style="width:100%;height:auto;font-family:Inter,sans-serif">${grid}${future}<line x1="${x0}" y1="${pbY.toFixed(1)}" x2="${x1}" y2="${pbY.toFixed(1)}" stroke="#ff633e" stroke-width="2" stroke-dasharray="6 6"/>${line}${dots}${labels}</svg>`;
}
