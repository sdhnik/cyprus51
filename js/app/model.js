// Everything the passport and the achievement pages know about a runner's season.
import { today, state } from './state.js';
import { sb } from './supa.js';
import { loadRaces, raceDate, daysUntil, fmtTime, asset } from './data.js';

export const HALF_KM = 21.0975;
export const SUB130 = 90 * 60;
export const badgeImg = (slug, earned) => asset(`assets/achievements/${slug}-${earned ? 'earned' : 'locked'}.webp`);

export async function loadSeason() {
  // Always the signed-in runner's own rows: an admin can read everyone's.
  const uid = state.session.user.id;
  const [data, subsRes, commRes, planRes] = await Promise.all([
    loadRaces(),
    sb.from('submissions').select('race_id, status, watch_time_s, official_time_s, place, place_of').eq('user_id', uid),
    sb.rpc('community_stats'),
    sb.from('abroad_plans').select('*').eq('user_id', uid).maybeSingle(),
  ]);
  if (subsRes.error) throw subsRes.error;
  return model(data, subsRes.data, commRes.error ? null : commRes.data, planRes.error ? null : planRes.data, today());
}

export function model(data, rows, community, plan = null, now = new Date()) {
  const subs = new Map(rows.map((s) => [s.race_id, s]));
  const cyprus = data.races;
  const abroad = { ...data.abroad, city: 'International', abroad: true, plan };
  const races = [...cyprus, abroad];
  const isV = (r) => subs.get(r.id)?.status === 'verified';
  const verified = races.filter(isV).map((r) => ({ r, s: subs.get(r.id) }));
  const nV = verified.length;
  const nCyprusV = cyprus.filter(isV).length;
  const nReview = rows.filter((s) => s.status === 'pending').length;
  const times = verified.map((v) => v.s.official_time_s);
  const pb = nV ? verified.reduce((a, b) => (b.s.official_time_s < a.s.official_time_s ? b : a)) : null;
  const avg = nV ? Math.round(times.reduce((a, b) => a + b, 0) / nV) : null;
  const next = cyprus.find((r) => raceDate(r).end >= now && !subs.has(r.id));
  const nextDays = next && !raceDate(next).tbc ? daysUntil(raceDate(next).start, now) : null;
  const dated = cyprus.filter((r) => !raceDate(r).tbc).map((r) => raceDate(r).start);
  const seasonStart = dated.length ? new Date(Math.min(...dated)) : null;
  const abroadDone = isV(abroad);

  const sub130 = pb && pb.s.official_time_s < SUB130;
  const badges = [
    { slug: 'personal-best', name: 'Personal Best', v: nV ? 1 : 0, max: 1,
      cap: pb ? `${fmtTime(pb.s.official_time_s)} · ${pb.r.city}` : 'First verified race',
      text: `Your fastest verified half marathon of the ${data.season} season. Your first verified race sets it; every faster finish updates it.` },
    { slug: '5-cities-finisher', name: '5 Cities Finisher', v: nCyprusV, max: 5, cap: `${nCyprusV} of 5`,
      text: `Finish all five Cyprus half marathons in the ${data.season} season.` },
    { slug: 'international-finisher', name: 'International Finisher', v: abroadDone ? 1 : 0, max: 1, cap: abroadDone ? 'Earned' : 'Race abroad',
      text: `Finish one official half marathon outside Cyprus during the ${data.season} season.` },
    { slug: '5plus1-finisher', name: '5+1 Finisher', v: nV, max: 6, cap: `${nV} of 6`,
      text: 'Collect all six stamps: five Cyprus cities and one race abroad.' },
    { slug: 'sub-1-30-elite', name: 'Sub 1:30 Elite', v: sub130 ? 1 : 0, max: 1,
      cap: pb ? (sub130 ? fmtTime(pb.s.official_time_s) : `${fmtTime(pb.s.official_time_s - SUB130 + 1)} to find`) : 'Under 1:30',
      text: 'Finish any verified half marathon under 1:30:00, in Cyprus or abroad.' },
  ];
  badges.forEach((b) => { b.earned = b.v >= b.max; b.img = badgeImg(b.slug, b.earned); });

  return { data, plan, subs, cyprus, abroad, races, isV, verified, nV, nCyprusV, nReview, times, pb, avg, next, nextDays, seasonStart, abroadDone, badges, community, now };
}
