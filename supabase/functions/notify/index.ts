// @ts-nocheck — the Edge runtime runs this without type checks; kept as one file so it can be pasted into the dashboard editor.
// Cyprus 5+1 result emails, sent from the project Gmail.
//   { kind: 'review', submission_id }  – called by the database when a result is verified or rejected
//   { kind: 'reminders' }               – called once a day: check-ins without an official result yet
//   { kind: 'test', to? }               – sends the three emails with sample data (to GMAIL_USER by default)
// Every call must carry the header x-notify-secret: NOTIFY_SECRET.
// Secrets (Edge Functions → Secrets): GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_SECRET; optional SITE_URL, APP_URL.
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const SITE = Deno.env.get('SITE_URL') ?? 'https://sdhnik.github.io/cyprus51/';
const APP = Deno.env.get('APP_URL') ?? `${SITE}app/`;
const GMAIL = Deno.env.get('GMAIL_USER') ?? '';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? 465);   // SMTP_HOST/PORT only for local tests
const smtp = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST') ?? 'smtp.gmail.com', port: SMTP_PORT, secure: SMTP_PORT === 465,
  auth: { user: GMAIL, pass: Deno.env.get('GMAIL_APP_PASSWORD') ?? '' },
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const secret = (Deno.env.get('NOTIFY_SECRET') ?? '').trim();
  const given = (req.headers.get('x-notify-secret') ?? '').trim();
  if (!secret) return json({ error: 'NOTIFY_SECRET is not set in Edge Functions → Secrets' }, 500);
  if (!given) return json({ error: 'header x-notify-secret is missing' }, 401);
  if (given !== secret) return json({ error: `x-notify-secret does not match NOTIFY_SECRET (header has ${given.length} characters, secret has ${secret.length})` }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.kind === 'review') return json(await review(body.submission_id));
    if (body.kind === 'reminders') return json(await reminders());
    if (body.kind === 'test') return json(await test(body.to || GMAIL));
    return json({ error: 'unknown kind' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

// ── Email templates (Emails design: one 560px column, inline styles, Arial) ──

const F = 'Arial, Helvetica, sans-serif';
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function wrap(site, preheader, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Cyprus 5+1</title>
</head>
<body style="margin:0; padding:0; background:#f1f1ed;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1ed;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; border-collapse:collapse;">
      <tr><td style="padding:20px 28px; background:#0d1412; border-radius:14px 14px 0 0;">
        <span style="font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif; font-weight:800; font-size:26px; line-height:26px; letter-spacing:0.5px; color:#ffffff; text-transform:uppercase;">CYPRUS <span style="color:#ff633e;">5+1</span></span>
      </td></tr>
      <tr><td style="padding:32px 28px 28px; background:#ffffff; border-top:4px solid #ff633e; font:16px/24px ${F}; color:#0d1412;">
${body}
      </td></tr>
      <tr><td style="padding:20px 28px; background:#f8f7f4; border-radius:0 0 14px 14px; border-top:1px solid #e4e5df; font:12px/18px ${F}; color:#69716d;">
        You get this email because of a Cyprus 5+1 account.<br>
        <a href="${site}legal/rules.html" style="color:#69716d;">Rules</a> · <a href="${site}legal/terms.html" style="color:#69716d;">Terms</a> · <a href="${site}legal/privacy.html" style="color:#69716d;">Privacy</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const label = (t, colour = '#b83c20') => `        <p style="margin:0 0 6px; font:bold 12px/16px ${F}; letter-spacing:1.5px; color:${colour};">${esc(t)}</p>`;
const h1 = (t) => `        <h1 style="margin:0 0 12px; font:bold 28px/32px ${F}; color:#0d1412;">${esc(t)}</h1>`;
const p = (html) => `        <p style="margin:0 0 20px;">${html}</p>`;
const small = (html) => `        <p style="margin:24px 0 0; font-size:13px; line-height:20px; color:#69716d;">${html}</p>`;
const button = (href, t) => `        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px; background:#ff633e;">
          <a href="${esc(href)}" style="display:inline-block; padding:14px 28px; font:bold 16px/20px ${F}; color:#0d1412; text-decoration:none; border-radius:10px;">${esc(t)}</a>
        </td></tr></table>`;
const facts = (rows) => `        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px; border-collapse:collapse;">
${rows.map(([k, v]) => `          <tr><td style="padding:10px 0; border-top:1px solid #e4e5df; font:14px/20px ${F}; color:#69716d; width:110px;">${esc(k)}</td><td style="padding:10px 0; border-top:1px solid #e4e5df; font:bold 15px/20px ${F}; color:#0d1412;">${esc(v)}</td></tr>`).join('\n')}
        </table>`;

const hi = (name) => (name ? `Hi ${esc(name)}, ` : '');
const first = (name) => (name || '').trim().split(/\s+/)[0] || '';

/**
 * d: { site, app, name, place, raceId, time, pb, count, next, earned[], reason, watch, stampPng }
 * Returns { subject, html, text }.
 */
function verified(d) {
  const subject = `Stamp collected: ${d.place}`;
  const pre = `Your ${d.time} is verified. ${d.count} of 6 stamps.`;
  const rows = [['Time', `${d.time}${d.pb ? ' · new PB' : ''}`], ['Passport', `${d.count} of 6 stamps`]];
  if (d.next) rows.push(['Next up', d.next]);
  const body = [
    `        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>
          <td style="padding-right:16px; vertical-align:middle;"><img src="${esc(d.stampPng)}" width="88" height="88" alt="${esc(d.place)} stamp" style="display:block; width:88px; height:88px;"></td>
          <td style="vertical-align:middle;">
${label('RESULT VERIFIED', '#1d6b34')}
          <h1 style="margin:0; font:bold 26px/30px ${F}; color:#0d1412;">${esc(subject)}</h1>
          </td></tr></table>`,
    p(`Nice run${d.name ? `, ${esc(first(d.name))}` : ''}. Your result is checked and the stamp is in your passport.`),
    facts(rows),
    button(`${d.app}#/race/${d.raceId}`, 'Open your passport'),
    d.earned?.length ? small(`Earned here: ${esc(d.earned.join(', '))}.`) : '',
  ].filter(Boolean).join('\n');
  const text = [`${subject}`, '', `Nice run${d.name ? `, ${first(d.name)}` : ''}. Your result is checked and the stamp is in your passport.`, '',
    ...rows.map(([k, v]) => `${k}: ${v}`), '', `Open your passport: ${d.app}#/race/${d.raceId}`,
    d.earned?.length ? `\nEarned here: ${d.earned.join(', ')}.` : ''].join('\n');
  return { subject, html: wrap(d.site, pre, body), text: text + footerText(d.site) };
}

function rejected(d) {
  const subject = `We couldn’t verify your ${d.place} result`;
  const pre = 'Fix one detail and send it again.';
  const body = [
    label('NOT VERIFIED'),
    h1(subject),
    p(`${hi(first(d.name))}the reviewer couldn’t match your submission with the official results. Here is why:`),
    `        <p style="margin:0 0 20px; padding:14px 16px; border-left:4px solid #ff633e; background:#fff0e9; font:16px/24px ${F}; color:#0d1412;">“${esc(d.reason)}”</p>`,
    p('Correct the details and submit again. Nothing else is lost.'),
    button(`${d.app}#/race/${d.raceId}/submit`, 'Fix and resubmit'),
    small('Think it’s a mistake? Reply to this email and we’ll take another look.'),
  ].join('\n');
  const text = [subject, '', `${d.name ? `Hi ${first(d.name)}, the` : 'The'} reviewer couldn’t match your submission with the official results. Here is why:`,
    '', `“${d.reason}”`, '', 'Correct the details and submit again. Nothing else is lost.', '', `Fix and resubmit: ${d.app}#/race/${d.raceId}/submit`,
    '', 'Think it’s a mistake? Reply to this email and we’ll take another look.'].join('\n');
  return { subject, html: wrap(d.site, pre, body), text: text + footerText(d.site) };
}

function reminder(d) {
  const subject = `Add your ${d.place} result`;
  const pre = 'One step left for your stamp.';
  const body = [
    label('ONE STEP LEFT'),
    h1('Add your official result'),
    p(`${hi(first(d.name))}you checked in at ${esc(d.place)}${d.watch ? ` with <b>${esc(d.watch)}</b>` : ''}. When the organiser posts the results, add the link and your chip time. Then the stamp goes to review.`),
    button(`${d.app}#/race/${d.raceId}/submit`, 'Add result'),
    small('Results not out yet? Your check-in is saved. This is the only reminder we send.'),
  ].join('\n');
  const text = [subject, '', `${d.name ? `Hi ${first(d.name)}, you` : 'You'} checked in at ${d.place}${d.watch ? ` with ${d.watch}` : ''}. When the organiser posts the results, add the link and your chip time. Then the stamp goes to review.`,
    '', `Add result: ${d.app}#/race/${d.raceId}/submit`, '', 'Results not out yet? Your check-in is saved. This is the only reminder we send.'].join('\n');
  return { subject, html: wrap(d.site, pre, body), text: text + footerText(d.site) };
}

const footerText = (site) => `\n\n—\nYou get this email because of a Cyprus 5+1 account.\nRules: ${site}legal/rules.html · Terms: ${site}legal/terms.html · Privacy: ${site}legal/privacy.html\n`;

// ── Data helpers ────────────────────────────────────────────────────────────
type Race = { id: string; city: string; date: string; stamp: string };
let racesCache: { races: Race[]; abroad: { id: string; stamp: string } } | null = null;
async function season() {
  if (!racesCache) {
    const res = await fetch(`${SITE}data/races.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`races.json: ${res.status}`);
    racesCache = await res.json();
  }
  return racesCache!;
}

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
const raceDay = (r: Race) => {
  const [y, m, d] = r.date.split('-').map(Number);
  return d
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d)).replace(',', '')
    : `${new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1))} ${y}`;
};

async function runner(userId: string) {
  const [{ data: profile }, { data: u }] = await Promise.all([
    db.from('profiles').select('display_name, is_test').eq('id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  return { name: profile?.display_name ?? '', email: u?.user?.email ?? '' };
}

async function place(sub: { race_id: string; abroad_name?: string | null }) {
  const s = await season();
  if (sub.race_id === s.abroad.id || sub.race_id.startsWith('abroad-')) return { place: sub.abroad_name || 'your race abroad', raceId: 'abroad', stamp: s.abroad.stamp, cyprus: false };
  const r = s.races.find((x) => x.id === sub.race_id);
  return { place: r?.city ?? sub.race_id, raceId: sub.race_id, stamp: r?.stamp ?? 'international', cyprus: true };
}

// Sends once per key: the row in email_log is the "already sent" mark (removed again if sending fails).
async function sendOnce(key: string, to: string, mail: { subject: string; html: string; text: string }) {
  if (!to || /@example\.(com|org|net)$/i.test(to)) return 'skipped (no real address)';
  const { error } = await db.from('email_log').insert({ id: key, sent_to: to });
  if (error) return error.code === '23505' ? 'already sent' : Promise.reject(error);
  try {
    await smtp.sendMail({ from: `Cyprus 5+1 <${GMAIL}>`, replyTo: GMAIL, to, subject: mail.subject, html: mail.html, text: mail.text });
    return 'sent';
  } catch (e) {
    await db.from('email_log').delete().eq('id', key);
    throw e;
  }
}

// ── Verified / rejected ─────────────────────────────────────────────────────
async function review(id: string) {
  const { data: sub, error } = await db.from('submissions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!sub || !['verified', 'rejected'].includes(sub.status)) return { result: 'nothing to send' };
  const who = await runner(sub.user_id);
  const where = await place(sub);
  const key = `${sub.id}:${sub.status}:${sub.reviewed_at ?? ''}`;

  if (sub.status === 'rejected') {
    const mail = rejected({ site: SITE, app: APP, name: who.name, place: where.place, raceId: where.raceId, reason: sub.reject_reason ?? '' });
    return { result: await sendOnce(key, who.email, mail) };
  }

  const { data: mine } = await db.from('submissions').select('id, race_id, official_time_s, status').eq('user_id', sub.user_id);
  const done = (mine ?? []).filter((x) => x.status === 'verified');
  const others = done.filter((x) => x.id !== sub.id).map((x) => x.official_time_s);
  const t = sub.official_time_s as number;
  const pb = others.length === 0 || t < Math.min(...others);
  const s = await season();
  const cyprusDone = done.filter((x) => s.races.some((r) => r.id === x.race_id)).length;
  const earned: string[] = [];
  if (pb) earned.push('Personal Best');
  if (t < 5400 && !others.some((o) => o < 5400)) earned.push('Sub 1:30 Elite');
  if (where.cyprus && cyprusDone === 5) earned.push('5 Cities Finisher');
  if (!where.cyprus) earned.push('International Finisher');
  if (done.length >= 6) earned.push('5+1 Finisher');
  const today = new Date().toISOString().slice(0, 10);
  const taken = new Set((mine ?? []).map((x) => x.race_id));
  const nextRace = s.races.find((r) => !taken.has(r.id) && (r.date.length === 7 ? r.date >= today.slice(0, 7) : r.date >= today));
  const mail = verified({
    site: SITE, app: APP, name: who.name, place: where.place, raceId: where.raceId, time: fmtTime(t), pb, count: done.length,
    next: nextRace ? `${nextRace.city} · ${raceDay(nextRace)}` : '', earned,
    stampPng: `${SITE}assets/stamps/email/${where.stamp}.png`,
  });
  return { result: await sendOnce(key, who.email, mail) };
}

// ── Daily reminder: checked in, no official result after a day ─────────────
async function reminders() {
  const now = Date.now();
  const { data: subs, error } = await db.from('submissions').select('*').eq('status', 'checked_in')
    .lt('checked_in_at', new Date(now - 18 * 3600e3).toISOString())
    .gt('checked_in_at', new Date(now - 14 * 86400e3).toISOString());
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const sub of subs ?? []) {
    try {
      const who = await runner(sub.user_id);
      const where = await place(sub);
      const mail = reminder({ site: SITE, app: APP, name: who.name, place: where.place, raceId: where.raceId, watch: sub.watch_time_s ? fmtTime(sub.watch_time_s) : '' });
      out[sub.id] = await sendOnce(`${sub.id}:reminder`, who.email, mail);
    } catch (e) {
      out[sub.id] = `failed: ${(e as Error).message}`;
    }
  }
  return { checked: (subs ?? []).length, results: out };
}

// ── Samples for checking the look ──────────────────────────────────────────
async function test(to: string) {
  const base = { site: SITE, app: APP, name: 'Alex Runner', raceId: 'nicosia-2027' };
  const mails = [
    verified({ ...base, place: 'Nicosia', time: '1:45:32', pb: true, count: 2, next: 'Paphos · Sun 28 Feb', earned: ['Personal Best'], stampPng: `${SITE}assets/stamps/email/nicosia.png` }),
    rejected({ ...base, place: 'Limassol', raceId: 'limassol-2027', reason: 'The results page shows 1:51:41 for bib 1127, not 1:49:41.' }),
    reminder({ ...base, place: 'Larnaka', raceId: 'larnaka-2027', watch: '1:44:10' }),
  ];
  for (const m of mails) await smtp.sendMail({ from: `Cyprus 5+1 <${GMAIL}>`, replyTo: GMAIL, to, subject: `[Test] ${m.subject}`, html: m.html, text: m.text });
  return { result: `3 test emails sent to ${to}` };
}
