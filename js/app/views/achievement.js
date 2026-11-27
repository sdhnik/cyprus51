// Achievement page — AchievementDesktop / AchievementMobile designs.
import { appShell } from '../layout.js';
import { esc, icon } from '../ui.js';
import { formatRaceDate, raceDate, stampImg, fmtTime, asset } from '../data.js';
import { loadSeason, SUB130 } from '../model.js';
import { go } from '../router.js';

const CHIP = { verified: ['Verified', 'verified'], pending: ['In review', 'pending'], checked_in: ['Checked in', 'pending'], rejected: ['Rejected', 'error'], none: ['Not submitted', 'neutral'] };
const chip = (st) => { const [l, t] = CHIP[st] || CHIP.none; return `<span class="c51-chip c51-chip--plain c51-chip--${t}"><span class="c51-chip__dot" aria-hidden="true"></span>${l}</span>`; };
const progress = (v, max, cap, label) => `<div class="c51-progress"><div class="c51-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}" aria-label="${esc(label)}"><div class="c51-progress__fill" style="width:${Math.min(100, (v / max) * 100)}%"></div></div>${cap ? `<p class="c51-progress__caption">${esc(cap)}</p>` : ''}</div>`;

export async function achievement(root, { state, args }) {
  root.innerHTML = appShell(`<div aria-busy="true" role="status"><span class="sr">Loading…</span><div class="sk sk--hero"></div><div class="sk sk--card"></div></div>`);
  const m = await loadSeason();
  const b = m.badges.find((x) => x.slug === args[0]);
  if (!b) return go('passport');
  const { subs, races, cyprus, abroad, pb, nReview, next, data } = m;

  // Which races count for this achievement
  const list = b.slug === '5-cities-finisher' ? cyprus
    : b.slug === 'international-finisher' ? [abroad]
    : b.slug === '5plus1-finisher' ? races
    : races.filter((r) => subs.has(r.id));
  const inReview = list.filter((r) => subs.get(r.id)?.status === 'pending').map((r) => r.city);

  // Progress shown in the ring and the bar
  let ringV = b.v / b.max, barV = b.v, barMax = b.max, cap;
  if (b.slug === 'sub-1-30-elite' && pb && !b.earned) {
    ringV = Math.min(.99, SUB130 / pb.s.official_time_s); barV = Math.round(ringV * 100); barMax = 100;
    cap = `Best ${fmtTime(pb.s.official_time_s)} · ${fmtTime(pb.s.official_time_s - SUB130 + 1)} to find`;
  } else if (b.slug === 'personal-best') {
    cap = pb ? `${fmtTime(pb.s.official_time_s)} · ${pb.r.city}` : 'Earned with your first verified race';
  } else {
    cap = `${b.v} of ${b.max}${b.slug === '5-cities-finisher' ? ' Cyprus races' : ' stamps'}${inReview.length ? ` · ${inReview.join(', ')} in review` : ''}`;
  }
  const reviewRing = !b.earned && b.max > 1 ? Math.min(1 - ringV, inReview.length / b.max) : 0;

  const status = b.earned ? 'EARNED' : b.v > 0 || (b.slug === 'sub-1-30-elite' && pb) ? 'IN PROGRESS' : 'NOT STARTED';
  const chips = [];
  if (b.slug === 'personal-best') chips.push(pb ? `${fmtTime(pb.s.official_time_s)} · ${pb.r.city}` : 'No verified race yet');
  else if (b.slug === 'sub-1-30-elite') chips.push(pb ? (b.earned ? `${fmtTime(pb.s.official_time_s)}` : `${fmtTime(pb.s.official_time_s - SUB130 + 1)} to find`) : 'No verified race yet');
  else chips.push(`${b.v} of ${b.max} verified`);
  if (inReview.length && !b.earned) chips.push(`${inReview.length} in review`);
  if (!b.earned && next && b.slug !== 'international-finisher') chips.push(`Next: ${next.city}, ${raceDate(next).tbc ? formatRaceDate(next).split(',')[0] : formatRaceDate(next).replace(/^\w+ /, '')}`);

  // Ring: 168 box, r 76
  const C = 2 * Math.PI * 76;
  const ring = `<svg viewBox="0 0 168 168" aria-hidden="true" class="ach-ring"><circle cx="84" cy="84" r="76" fill="none" stroke="#2a312f" stroke-width="6"/>
    <circle cx="84" cy="84" r="76" fill="none" stroke="#ff633e" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C * ringV).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 84 84)"/>
    ${reviewRing ? `<circle cx="84" cy="84" r="76" fill="none" stroke="#ff633e" stroke-opacity=".35" stroke-width="6" stroke-dasharray="0 ${(C * ringV).toFixed(1)} ${(C * reviewRing).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 84 84)"/>` : ''}</svg>`;

  const rows = list.map((r, i) => {
    const s = subs.get(r.id);
    const st = s ? s.status : 'none';
    const detail = st === 'verified' ? fmtTime(s.official_time_s) : st === 'pending' ? fmtTime(s.official_time_s || s.watch_time_s) : st === 'checked_in' ? fmtTime(s.watch_time_s) : '';
    const img = stampImg(r.stamp, st === 'verified' || st === 'pending');
    return `<a class="ach-row" href="${r.abroad ? '#/race/abroad' : `#/race/${r.id}`}">
      <img src="${img}" alt="" style="opacity:${st === 'pending' ? .5 : 1}">
      <span class="ach-row__text"><span class="num ach-row__city">${esc(r.city)}</span><span class="ach-row__date">${esc(r.abroad ? (r.plan ? `${new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(r.plan.race_date + 'T00:00:00')).replace(',', '')} · ${r.plan.country}` : 'Any race abroad') : formatRaceDate(r))}</span></span>
      <span class="ach-row__end">${chip(st)}<span class="ach-row__detail">${esc(detail)}</span></span>
    </a>`;
  }).join('');
  const NOTE = {
    '5-cities-finisher': 'The international race does not count here. It counts towards 5+1 Finisher and International Finisher.',
    'international-finisher': 'Any official half marathon outside Cyprus counts. Add the race GPX with your result.',
    'personal-best': 'Every verified race counts, in Cyprus or abroad. Your best time updates by itself.',
    '5plus1-finisher': 'All five Cyprus races and one half marathon abroad, all in one season.',
    'sub-1-30-elite': 'Official chip time under 1:30:00 in any verified race.',
  }[b.slug];

  // Where runners are
  const c = m.community;
  let where = '';
  // Stamps say nothing about a time-based badge, so those pages skip this card.
  if (c && c.runners && !['personal-best', 'sub-1-30-elite'].includes(b.slug)) {
    const mine = Math.min(c.my_stamps ?? m.nV, 6);
    const ahead = c.dist.slice(mine + 1).reduce((a, n) => a + n, 0);
    const maxN = Math.max(...c.dist, 1);
    where = `<section class="card" aria-labelledby="where-title">
      <h2 id="where-title" class="h2">Where runners are</h2>
      <div class="ach-where"><span class="num">${Math.round((100 * ahead) / c.runners)}%</span><span>of runners are further along than you</span></div>
      <div class="ps-com__bars ach-bars" role="img" aria-label="Runners by number of stamps, 0 to 6; you have ${mine}">
        ${c.dist.map((n, k) => `<div>${k === mine ? '<span class="ps-com__you">YOU</span>' : ''}<div style="height:${Math.max(4, (n / maxN) * 100)}%;background:${k === mine ? '#ff633e' : '#d3d5cf'}"></div><span>${k}</span></div>`).join('')}
      </div>
      <p class="ps-com__note">Runners by number of stamps, 0–6 · anonymous</p>
    </section>`;
  }
  const others = m.badges.filter((x) => x.slug !== b.slug).map((x) => `<a class="ach-other" href="#/achievement/${x.slug}"><img src="${x.img}" alt=""><span><span class="num">${esc(x.name)}</span><span>${x.earned ? 'Earned' : esc(x.cap)}</span></span></a>`).join('');

  root.innerHTML = appShell(`
    <a class="back" href="#/passport">${icon('back')}Passport</a>
    <section class="ach-hero" aria-labelledby="ach-title">
      <img class="ach-hero__topo" src="${asset('assets/patterns/cyprus-topo.webp')}" alt="">
      <div class="ach-hero__badge">${ring}<img src="${b.img}" alt="${esc(b.name)} badge, ${b.earned ? 'earned' : 'not earned yet'}"></div>
      <div class="ach-hero__text">
        <p class="ps-eyebrow">ACHIEVEMENT · ${status}</p>
        <h1 id="ach-title" class="ach-hero__title">${esc(b.name)}</h1>
        <p class="ach-hero__desc">${esc(b.text)}</p>
        <div class="ps-hero__chips">${chips.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
      </div>
    </section>
    <div class="ps-row ach-grid">
      <section class="card" aria-labelledby="how-title">
        <div class="ps-head"><h2 id="how-title" class="h2">How to earn it</h2><p class="ps-head__note">Verified results only</p></div>
        ${progress(barV, barMax, cap, b.name)}
        ${rows ? `<div class="ach-rows">${rows}</div>` : `<p class="muted">No results yet. Your races will show up here once you check in.</p>`}
        <p class="ach-note">${esc(NOTE)}</p>
      </section>
      <div class="ach-side">${where}<section class="card" aria-labelledby="oth-title"><h2 id="oth-title" class="h2">Other achievements</h2><div class="ach-others">${others}</div></section></div>
    </div>`);
}
