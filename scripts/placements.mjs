#!/usr/bin/env node
// The one CLI for the placement office. Human tables by default, --json for machines.
//
//   npm run placements -- attention
//   npm run placements -- show nguyen
//   npm run placements -- allocate raman --round=R-BN3-A --site=SITE-EFP --by="Hannah Lee"
//   npm run placements -- import inplace --students=students.csv --placements=placements.csv --by="Hannah Lee"
//
// Students match on code, student number, id prefix or part of the name, case-insensitive.
// An ambiguous match lists the candidates and exits 1. Every write needs --by and lands in the audit log.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { heading, isoDate, table, truncate } from './lib/format.mjs';

// ---------------------------------------------------------------- input helpers

export function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq < 0) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else pos.push(a);
  }
  return { pos, flags };
}

export function date(v, what = 'date') {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const s = String(v).trim();
  if (s === 'today') return isoDate(new Date());
  const m = s.match(/^([+-]\d+)d$/);
  if (m) return isoDate(new Date(Date.now() + Number(m[1]) * 86400000));
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // NZ and Australian exports: 31/03/2026
  const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Invalid ${what} "${s}": use YYYY-MM-DD, DD/MM/YYYY, today, or +30d`);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new Error(`Invalid ${what} "${s}"`);
  return iso;
}

// "38", "7.5", "7h30" -> 7.5
export function hoursOf(v, what = 'hours') {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const s = String(v).trim().toLowerCase();
  const hm = s.match(/^(\d+)h(\d{1,2})?$/);
  const n = hm ? Number(hm[1]) + Number(hm[2] || 0) / 60 : Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 200) throw new Error(`Invalid ${what} "${v}": use 38, 7.5 or 7h30`);
  return Math.round(n * 10) / 10;
}

function int(v, what, lo, hi) {
  if (v === undefined || v === null || v === '' || v === true) return null;
  if (!/^-?\d+$/.test(String(v))) throw new Error(`${what} must be a whole number`);
  const n = Number(v);
  if ((lo !== undefined && n < lo) || (hi !== undefined && n > hi)) throw new Error(`${what} must be between ${lo} and ${hi}`);
  return n;
}

function oneOf(v, allowed, what) {
  if (v === undefined || v === null || v === '' || v === true) return null;
  const s = String(v).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const alias = { nsi: 'needlestick', at_risk_of_failing: 'at_risk', aged: 'aged_care', gp: 'primary_care', passed: 'pass', failed: 'fail' }[s] || s;
  if (!allowed.includes(alias)) throw new Error(`${what} must be one of: ${allowed.join(', ')}`);
  return alias;
}

function need(flags, ...names) {
  for (const n of names) if (flags[n] === undefined || flags[n] === true || flags[n] === '') throw new Error(`Missing --${n}`);
}

const d = (v) => (v instanceof Date ? isoDate(v) : v ?? '');
const label = (s) => String(s || '').replace(/_/g, ' ');
const num = (v) => (v === null || v === undefined || v === '' ? '' : Number(v) % 1 ? Number(v).toFixed(1) : String(Number(v)));
const inDays = (n) => (n === null || n === undefined ? '' : n < 0 ? `${-n} ago` : n === 0 ? 'today' : `in ${n}`);

// ---------------------------------------------------------------- lookups

const SPEC = {
  student: { table: 'students', label: "code || '  ' || name", name: "name || ' ' || coalesce(student_number, '')" },
  programme: { table: 'programmes', label: "code || '  ' || name", name: 'name' },
  requirement: { table: 'requirements', label: "code || '  ' || name", name: 'name' },
  organisation: { table: 'organisations', label: "code || '  ' || name", name: 'name' },
  site: { table: 'sites', label: "code || '  ' || name", name: 'name' },
  supervisor: { table: 'supervisors', label: "code || '  ' || name", name: 'name' },
  round: { table: 'rounds', label: "code || '  ' || name || ' ' || starts_on::text", name: 'name' },
  placement: { table: 'placements', label: "code || '  ' || starts_on::text", name: 'note' },
  agreement: { table: 'agreements', label: "code || '  ' || status", name: 'note' },
  incident: { table: 'incidents', label: "code || '  ' || kind", name: 'detail' },
};

async function resolve(db, entity, term) {
  if (!term || term === true) throw new Error(`Name the ${entity}`);
  const spec = SPEC[entity];
  const t = String(term).trim();
  let rows = await db.query(`select id, ${spec.label} as label from ${spec.table} where lower(code) = lower($1)`, [t]);
  if (!rows.length && entity === 'student') rows = await db.query(`select id, ${spec.label} as label from students where lower(student_number) = lower($1)`, [t]);
  if (!rows.length && /^[0-9a-f-]{4,}$/i.test(t)) rows = await db.query(`select id, ${spec.label} as label from ${spec.table} where id::text like $1`, [`${t.toLowerCase()}%`]);
  if (!rows.length) rows = await db.query(`select id, ${spec.label} as label from ${spec.table} where ${spec.name} ilike $1 order by code`, [`%${t}%`]);
  if (!rows.length) throw new Error(`No ${entity} matches "${t}"`);
  if (rows.length > 1) {
    const err = new Error(`Ambiguous ${entity} "${t}": ${rows.map((r) => r.label).join('; ')}`);
    err.candidates = rows;
    throw err;
  }
  return rows[0].id;
}

const codeOf = async (db, table, id) => (await db.query(`select code from ${table} where id = $1`, [id]))[0].code;

async function nextCode(db, table, prefix, start, width = 0) {
  const [r] = await db.query(`select coalesce(max(nullif(regexp_replace(code, '^${prefix}-', ''), code)::int), $1) + 1 as n
                              from ${table} where code ~ '^${prefix}-[0-9]+$'`, [start]);
  return `${prefix}-${String(r.n).padStart(width, '0')}`;
}

async function audit(db, actor, action, entity, ref, detail = {}) {
  await db.query('insert into audit (actor, action, entity, ref, detail) values ($1, $2, $3, $4, $5)', [actor, action, entity, ref, JSON.stringify(detail)]);
}

function actor(flags) {
  if (!flags.by || flags.by === true) throw new Error('Writes need --by="Your Name" for the audit log');
  return String(flags.by);
}

async function policy(db) {
  const rows = await db.query('select key, value from policy');
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
}

async function tx(db, fn) {
  await db.exec('BEGIN');
  try {
    const out = await fn();
    await db.exec('COMMIT');
    return out;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

// ---------------------------------------------------------------- the compliance rules (docs/compliance.md)

export async function complianceChecks(db) {
  const p = await policy(db);
  const out = [];
  const add = (rule, source, items, dueItems = []) =>
    out.push({ rule, source, status: items.length ? 'breach' : dueItems.length ? 'due' : 'clean', breaches: items.length, due: dueItems.length, items: [...items, ...dueItems] });
  const soon = (r) => r.days_to_start <= p.readiness_days;

  const ready = await db.query('select code, student, site, starts_on, ends_on, days_to_start, requirement_name, problem, expires_on, source from v_readiness order by starts_on, student');
  const readyDetail = (r) => `${r.requirement_name} ${r.problem}${r.expires_on ? ` (${isoDate(r.expires_on)})` : ''}, placement ${isoDate(r.starts_on)} to ${isoDate(r.ends_on)} at ${r.site}`;
  add('Every pre-placement check the programme requires is current on every day of the placement',
    'NSW Health PD2026_004 (vaccination and TB); Child Protection (Working with Children) Act 2012 (NSW); NDIS worker screening; Children\'s Act 2014 (NZ) s 27 (safety re-check every three years); the host\'s own requirements',
    ready.filter(soon).map((r) => ({ ref: r.code, who: r.student, detail: readyDetail(r) })),
    ready.filter((r) => !soon(r)).map((r) => ({ ref: r.code, who: r.student, detail: readyDetail(r) })));

  const gaps = await db.query('select code, student, organisation, starts_on, days_to_start, problem from v_agreement_gaps order by starts_on');
  const ending = await db.query(`select code, organisation, expires_on, days_left, renewal from v_agreements where days_left between 0 and $1 order by expires_on`, [p.agreement_warn_days]);
  add('A signed agreement with the host covers every day of every placement',
    'Higher Education Standards Framework (Threshold Standards) 2021, Standard 5.4 (delivery with other parties: work-integrated learning and placements under a written agreement and quality assured)',
    gaps.filter(soon).map((r) => ({ ref: r.code, who: r.student, detail: `${r.organisation}: ${r.problem}, starts ${isoDate(r.starts_on)}` })),
    [...gaps.filter((r) => !soon(r)).map((r) => ({ ref: r.code, who: r.student, detail: `${r.organisation}: ${r.problem}, starts ${isoDate(r.starts_on)}` })),
      ...ending.filter((r) => !gaps.some((g) => g.organisation === r.organisation)).map((r) => ({ ref: r.code, who: '', detail: `${r.organisation} agreement ends ${isoDate(r.expires_on)}${r.renewal ? `, renewal ${r.renewal}` : ', no renewal started'}` }))]);

  const ins = await db.query('select code, organisation, insurance_expires_on, insurance_days_left, live_placements from v_agreements where insurance_expires_on is not null and insurance_days_left <= 30 order by insurance_expires_on');
  add('The host\'s insurance certificate is current while students are placed',
    'Your placement agreement (each party holds public liability and professional indemnity cover and shows a current certificate)',
    ins.filter((r) => r.insurance_days_left < 0).map((r) => ({ ref: r.code, who: '', detail: `${r.organisation} certificate ended ${isoDate(r.insurance_expires_on)}, ${r.live_placements} live placements` })),
    ins.filter((r) => r.insurance_days_left >= 0).map((r) => ({ ref: r.code, who: '', detail: `${r.organisation} certificate ends ${isoDate(r.insurance_expires_on)}` })));

  const sup = await db.query('select code, student, site, starts_on, days_to_start, problem, supervisor_trained_on from v_supervision_gaps order by starts_on');
  add(`A named supervisor, trained in the last ${p.supervisor_training_years} years, for every placement`,
    'Higher Education Standards Framework 2021, Standard 5.4.2 (quality of supervision of student activities assured); ANMAC accreditation standards (qualified supervision in professional experience)',
    sup.filter((r) => soon(r) && !r.supervisor_trained_on).map((r) => ({ ref: r.code, who: r.student, detail: `${r.problem} at ${r.site}, starts ${isoDate(r.starts_on)}` })),
    sup.filter((r) => !soon(r) || r.supervisor_trained_on).map((r) => ({ ref: r.code, who: r.student, detail: `${r.problem} at ${r.site}, starts ${isoDate(r.starts_on)}` })));

  const hrs = await db.query('select student_code, student, programme, required_hours, projected_hours, shortfall, hours_source from v_hours where year_level >= final_year and shortfall > 0 order by shortfall desc');
  add('Final-year students reach the programme\'s minimum placement hours',
    'ANMAC Registered Nurse Accreditation Standards 2019 (800 hours); ANMAC Enrolled Nurse standards (400 hours); Nursing Council of New Zealand education standards 2024 (1,000 hours); the unit\'s assessment requirements for VET placements',
    hrs.map((r) => ({ ref: r.student_code, who: r.student, detail: `${r.programme}: ${num(r.projected_hours)} of ${r.required_hours} hours on current plans, ${num(r.shortfall)} short` })));

  const inc = await db.query('select code, student, site, occurred_on, kind, days_to_report, reported_to_site_on from v_incidents where closed_on is null or reported_to_site_on is null order by occurred_on');
  add(`Incidents reported to the host within ${p.incident_report_days} day`,
    'Your placement agreement and the host\'s incident policy; Work Health and Safety Act 2011 (students are workers for the host\'s WHS duties)',
    inc.filter((r) => !r.reported_to_site_on && r.days_to_report > p.incident_report_days).map((r) => ({ ref: r.code, who: r.student, detail: `${r.kind} at ${r.site} on ${isoDate(r.occurred_on)}, not reported after ${r.days_to_report} days` })));

  const asm = await db.query('select code, student, site, due_on, days_late from v_assessments_due order by due_on');
  add(`The final assessment is back within ${p.assessment_days} days of the placement ending`, 'Your office standard (results released on time, appeals window protected)',
    asm.filter((r) => r.days_late > 0).map((r) => ({ ref: r.code, who: r.student, detail: `${r.site}, due ${isoDate(r.due_on)}, ${r.days_late} days late` })),
    asm.filter((r) => r.days_late <= 0).map((r) => ({ ref: r.code, who: r.student, detail: `${r.site}, due ${isoDate(r.due_on)}` })));

  const ts = await db.query('select code, student, site, week_ending, hours, days_waiting from v_unsigned_hours order by week_ending');
  add(`Hours signed off by the supervisor within ${p.signoff_days} days`, 'Your office standard (only signed hours count towards the programme minimum)',
    ts.filter((r) => r.days_waiting > p.signoff_days).map((r) => ({ ref: r.code, who: r.student, detail: `${num(r.hours)} hours for the week ending ${isoDate(r.week_ending)}, ${r.days_waiting} days unsigned` })),
    ts.filter((r) => r.days_waiting <= p.signoff_days).map((r) => ({ ref: r.code, who: r.student, detail: `${num(r.hours)} hours for the week ending ${isoDate(r.week_ending)}` })));
  return out;
}

// ---------------------------------------------------------------- commands

const C = {};
const cmd = (name, summary, fn, opts = {}) => (C[name] = { name, summary, fn, ...opts });

cmd('help', 'List every command', async () => Object.values(C).map((c) => ({ command: c.name, does: c.summary })),
  { cols: [{ key: 'command', label: 'command' }, { key: 'does', label: 'what it does' }] });

cmd('students', 'Students with programme, year, checks and next placement (--programme, --all)', async (db, pos, f) => {
  const params = [];
  const where = [f.all ? 'true' : "s.status = 'active'"];
  if (f.programme) { params.push(await resolve(db, 'programme', f.programme)); where.push(`s.programme_id = $${params.length}`); }
  return db.query(`
    select s.code, s.name, pg.code as programme, s.year_level, s.campus, s.status,
           (select count(*) from v_check_status c where c.student_id = s.id and c.state in ('missing', 'expired'))::int as checks_out,
           (select min(x.starts_on) from placements x where x.student_id = s.id and x.status in ('allocated', 'confirmed') and x.ends_on >= current_date) as next_placement,
           h.signed_hours, pg.required_hours
    from students s join programmes pg on pg.id = s.programme_id left join v_hours h on h.student_id = s.id
    where ${where.join(' and ')} order by s.code`, params);
}, { flags: ['programme', 'all'], cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'student' }, { key: 'programme', label: 'prog' }, { key: 'year_level', label: 'yr', align: 'right' },
  { key: 'campus', label: 'campus' }, { key: 'checks_out', label: 'checks out', align: 'right', format: (v) => (v ? v : '') },
  { key: 'next_placement', label: 'next placement', format: d }, { key: 'signed_hours', label: 'hours', align: 'right', format: (v, r) => (v === null || v === undefined ? '' : `${num(v)}/${r.required_hours}`) },
  { key: 'status', label: 'status', format: label }] });

cmd('show', 'One student: checks, placements, hours, incidents and notes', async (db, pos) => {
  const id = await resolve(db, 'student', pos.join(' '));
  const [student] = await db.query('select s.*, pg.code as programme, pg.name as programme_name, pg.required_hours, pg.final_year from students s join programmes pg on pg.id = s.programme_id where s.id = $1', [id]);
  return {
    student,
    checks: await db.query('select requirement, requirement_name, completed_on, expires_on, days_left, state from v_check_status where student_id = $1 order by requirement', [id]),
    placements: await db.query('select code, round, site, supervisor, starts_on, ends_on, planned_hours, status, stage, result, evaluation_score from v_placements where student_id = $1 order by starts_on desc', [id]),
    hours: (await db.query('select * from v_hours where student_id = $1', [id]))[0],
    incidents: await db.query('select code, occurred_on, kind, severity, reported_to_site_on, closed_on, plan from v_incidents where student_code = $1 order by occurred_on desc', [student.code]),
    notes: await db.query('select logged_on, channel, by_name, summary from contacts_log where student_id = $1 order by logged_on desc limit 5', [id]),
  };
}, { render: renderShow });

cmd('checks', 'Pre-placement checks that are missing, expired or running out (--expiring=30, --student, --all)', async (db, pos, f) => {
  const params = [];
  const where = [];
  if (f.student) { params.push(await resolve(db, 'student', f.student)); where.push(`student_id = $${params.length}`); }
  if (!f.all && !f.student) {
    const n = int(f.expiring === true || f.expiring === undefined ? (await policy(db)).check_warn_days : f.expiring, '--expiring', 0, 3650);
    params.push(n);
    where.push(`(state in ('missing', 'expired') or expires_on <= current_date + $${params.length}::int)`);
  }
  return db.query(`select student_code, student, programme, requirement, requirement_name, completed_on, expires_on, days_left, state from v_check_status
                   ${where.length ? `where ${where.join(' and ')}` : ''}
                   order by array_position(array['missing', 'expired', 'expiring', 'current'], state), expires_on nulls first, student`, params);
}, { flags: ['expiring', 'student', 'all'], cols: [
  { key: 'student', label: 'student' }, { key: 'programme', label: 'prog' }, { key: 'requirement_name', label: 'check' },
  { key: 'expires_on', label: 'expires', format: (v, r) => (r.state === 'missing' ? '' : v ? d(v) : 'no expiry') },
  { key: 'days_left', label: 'days', align: 'right', format: (v) => (v === null || v === undefined ? '' : v) }, { key: 'state', label: 'state', format: (v) => (v === 'current' ? v : v.toUpperCase()) }] });

cmd('readiness', 'Placements starting in the next --days=60 (or running now) with a check missing or running out before the last day', async (db, pos, f) => {
  const n = int(f.days ?? 60, '--days', 0, 3650);
  return db.query('select code, student, site, starts_on, ends_on, days_to_start, requirement_name, problem, expires_on from v_readiness where days_to_start <= $1 order by starts_on, student', [n]);
}, { flags: ['days'], cols: [
  { key: 'code', label: 'placement' }, { key: 'student', label: 'student' }, { key: 'site', label: 'site', format: (v) => truncate(v, 34) },
  { key: 'starts_on', label: 'starts', format: d }, { key: 'ends_on', label: 'ends', format: d }, { key: 'requirement_name', label: 'check' },
  { key: 'problem', label: 'problem' }, { key: 'expires_on', label: 'expires', format: d }] });

cmd('placements', 'Placements by round, site or student (--round, --site, --student, --live default, --all)', async (db, pos, f) => {
  const params = [];
  const where = [f.all ? 'true' : "status in ('allocated', 'confirmed') and (ends_on >= current_date or result is null)"];
  if (f.round) { params.push(await codeOf(db, 'rounds', await resolve(db, 'round', f.round))); where.push(`round_code = $${params.length}`); }
  if (f.site) { params.push(await codeOf(db, 'sites', await resolve(db, 'site', f.site))); where.push(`site_code = $${params.length}`); }
  if (f.student) { params.push(await codeOf(db, 'students', await resolve(db, 'student', f.student))); where.push(`student_code = $${params.length}`); }
  return db.query(`select code, student, programme, site, supervisor, starts_on, ends_on, planned_hours, status, stage, result from v_placements where ${where.join(' and ')} order by starts_on, student`, params);
}, { flags: ['round', 'site', 'student', 'all', 'live'], cols: [
  { key: 'code', label: 'placement' }, { key: 'student', label: 'student' }, { key: 'programme', label: 'prog' }, { key: 'site', label: 'site', format: (v) => truncate(v, 36) },
  { key: 'supervisor', label: 'supervisor', format: (v) => v || 'NONE' }, { key: 'starts_on', label: 'starts', format: d }, { key: 'ends_on', label: 'ends', format: d },
  { key: 'planned_hours', label: 'hours', align: 'right' }, { key: 'stage', label: 'stage' }, { key: 'result', label: 'result' }] });

cmd('rounds', 'Placement rounds that have not finished, with places offered, placed and waiting', async (db) =>
  db.query('select code, name, programme, year_level, starts_on, ends_on, days_to_start, places_offered, placed, waiting from v_capacity order by starts_on'), { cols: [
  { key: 'code', label: 'round' }, { key: 'name', label: 'name' }, { key: 'starts_on', label: 'starts', format: d }, { key: 'ends_on', label: 'ends', format: d },
  { key: 'days_to_start', label: 'starts', align: 'right', format: inDays }, { key: 'places_offered', label: 'offered', align: 'right' },
  { key: 'placed', label: 'placed', align: 'right' }, { key: 'waiting', label: 'waiting', align: 'right', format: (v) => (v ? `${v} WAITING` : '0') }] });

cmd('capacity', 'Students waiting for a placement next to the places still open, by round', async (db) => {
  const waiting = await db.query('select round_code, round, starts_on, student_code, student, programme, campus, history from v_unplaced order by starts_on, student');
  const open = await db.query('select code, round_code, round, starts_on, site_code, site, organisation, places, filled from v_open_places order by starts_on, site');
  return { waiting, open };
}, { render: (r) => [heading('Students waiting'), table(r.waiting, [{ key: 'round_code', label: 'round' }, { key: 'starts_on', label: 'starts', format: d },
  { key: 'student', label: 'student' }, { key: 'programme', label: 'prog' }, { key: 'campus', label: 'campus' }, { key: 'history', label: 'this round so far', format: (v) => v || '' }]),
  heading('Places still open'), table(r.open, [{ key: 'round_code', label: 'round' }, { key: 'starts_on', label: 'starts', format: d }, { key: 'site', label: 'site' },
    { key: 'organisation', label: 'host' }, { key: 'places', label: 'offered', align: 'right' }, { key: 'filled', label: 'filled', align: 'right' }])].join('\n') });

cmd('hours', 'Hours signed, unsigned and planned against the programme minimum (--short for final-year students who will not make it)', async (db, pos, f) =>
  db.query(`select student_code, student, programme, year_level, required_hours, signed_hours, unsigned_hours, planned_hours, projected_hours, shortfall from v_hours
            where ${f.short ? 'year_level >= final_year and shortfall > 0' : 'true'} order by programme, shortfall desc, student`), { flags: ['short'], cols: [
  { key: 'student', label: 'student' }, { key: 'programme', label: 'prog' }, { key: 'year_level', label: 'yr', align: 'right' },
  { key: 'signed_hours', label: 'signed', align: 'right', format: num }, { key: 'unsigned_hours', label: 'unsigned', align: 'right', format: num },
  { key: 'planned_hours', label: 'planned', align: 'right', format: num }, { key: 'projected_hours', label: 'projected', align: 'right', format: num },
  { key: 'required_hours', label: 'needed', align: 'right' }, { key: 'shortfall', label: 'short', align: 'right', format: (v) => (Number(v) ? num(v) : '') }] });

cmd('timesheets', 'Hours waiting for a supervisor to sign off, oldest first', async (db) =>
  db.query('select id, code, student, site, supervisor, week_ending, hours, days_waiting from v_unsigned_hours order by submitted_on'), { cols: [
  { key: 'code', label: 'placement' }, { key: 'student', label: 'student' }, { key: 'supervisor', label: 'supervisor' }, { key: 'week_ending', label: 'week ending', format: d },
  { key: 'hours', label: 'hours', align: 'right', format: num }, { key: 'days_waiting', label: 'waiting', align: 'right', format: (v) => `${v} days` }] });

cmd('agreements', 'Host agreements: when each ends, the insurance certificate, renewals and placements booked past the end (--ending=90)', async (db, pos, f) => {
  const n = f.ending === undefined ? null : int(f.ending === true ? (await policy(db)).agreement_warn_days : f.ending, '--ending', 0, 3650);
  return db.query(`select org_code, organisation, kind, code, expires_on, days_left, insurance_expires_on, insurance_days_left, renewal, live_placements, booked_past_end
                   from v_agreements where ($1::int is null or days_left is null or days_left <= $1) order by days_left nulls first`, [n]);
}, { flags: ['ending'], cols: [
  { key: 'organisation', label: 'host' }, { key: 'code', label: 'agreement', format: (v) => v || 'NONE' }, { key: 'expires_on', label: 'ends', format: d },
  { key: 'days_left', label: 'days', align: 'right', format: (v) => (v === null || v === undefined ? '' : v < 0 ? `ended ${-v} ago` : v) },
  { key: 'insurance_expires_on', label: 'insurance to', format: (v, r) => (v ? `${d(v)}${r.insurance_days_left < 0 ? ' LAPSED' : ''}` : 'none on file') },
  { key: 'renewal', label: 'renewal', format: (v) => v || '' }, { key: 'live_placements', label: 'live', align: 'right' },
  { key: 'booked_past_end', label: 'past end', align: 'right', format: (v) => (v ? `${v} AT RISK` : '') }] });

cmd('supervisors', 'Supervisors, their training and the students they have now (--gaps for placements with no trained supervisor)', async (db, pos, f) => {
  if (f.gaps) return db.query('select code, student, site, starts_on, ends_on, supervisor, problem from v_supervision_gaps order by starts_on');
  return db.query(`select sv.code, sv.name, si.name as site, sv.role, sv.trained_on,
                          (select count(*) from v_live_placements p where p.supervisor_code = sv.code)::int as students_now,
                          (select count(*) from placements x where x.supervisor_id = sv.id and x.status = 'completed')::int as supervised
                   from supervisors sv left join sites si on si.id = sv.site_id where sv.active order by sv.code`);
}, { flags: ['gaps'], cols: null });

cmd('assessments', 'Finished placements still waiting on the final assessment, most overdue first', async (db) =>
  db.query('select code, student, site, supervisor, ends_on, due_on, days_late from v_assessments_due order by due_on'), { cols: [
  { key: 'code', label: 'placement' }, { key: 'student', label: 'student' }, { key: 'site', label: 'site' }, { key: 'supervisor', label: 'from' },
  { key: 'ends_on', label: 'ended', format: d }, { key: 'due_on', label: 'due', format: d }, { key: 'days_late', label: 'status', align: 'right', format: (v) => (v > 0 ? `${v} late` : `in ${-v}`) }] });

cmd('incidents', 'Incidents and students at risk (--open, --by-site)', async (db, pos, f) => {
  if (f['by-site']) return db.query(`select organisation, site, count(*)::int as incidents, count(*) filter (where kind = 'at_risk')::int as at_risk,
                                            count(*) filter (where kind in ('needlestick', 'injury'))::int as injuries, max(occurred_on) as latest
                                     from v_incidents group by organisation, site order by incidents desc, site`);
  return db.query(`select code, student, site, occurred_on, kind, severity, reported_to_site_on, days_to_report, closed_on, plan from v_incidents
                   where ${f.open ? 'closed_on is null' : 'true'} order by closed_on nulls first, occurred_on desc`);
}, { flags: ['open', 'by-site'], render: (rows, f) => table(rows, f['by-site'] ? [
  { key: 'site', label: 'site', format: (v) => truncate(v, 44) }, { key: 'organisation', label: 'host' }, { key: 'incidents', label: 'incidents', align: 'right' },
  { key: 'at_risk', label: 'at risk', align: 'right' }, { key: 'injuries', label: 'injuries', align: 'right' }, { key: 'latest', label: 'latest', format: d }] : [
  { key: 'code', label: 'ref' }, { key: 'student', label: 'student' }, { key: 'site', label: 'site', format: (v) => truncate(v, 34) }, { key: 'occurred_on', label: 'date', format: d },
  { key: 'kind', label: 'kind', format: label }, { key: 'severity', label: 'severity' }, { key: 'reported_to_site_on', label: 'reported', format: (v) => (v ? d(v) : 'NOT REPORTED') },
  { key: 'closed_on', label: 'closed', format: (v) => (v ? d(v) : 'open') }, { key: 'plan', label: 'plan', format: (v) => truncate(v, 48) }]) });

cmd('sites', 'Host organisations: places offered in the last 12 months against the 12 before (--quiet for hosts that stopped)', async (db, pos, f) =>
  db.query(`select code, name, kind, places_last_12m, places_prior_12m, last_round_on from v_site_trend
            where ${f.quiet ? 'places_last_12m = 0 and places_prior_12m > 0' : 'true'} order by places_last_12m desc, places_prior_12m desc`), { flags: ['quiet'], cols: [
  { key: 'code', label: 'code' }, { key: 'name', label: 'host' }, { key: 'kind', label: 'kind', format: label }, { key: 'places_last_12m', label: 'last 12m', align: 'right' },
  { key: 'places_prior_12m', label: 'prior 12m', align: 'right' }, { key: 'last_round_on', label: 'last round', format: d }] });

cmd('outcomes', 'How placements turned out at each site: passed, not passed, withdrawn, incidents and student ratings', async (db) =>
  db.query('select site, organisation, completed, passed, not_passed, withdrawn, incidents, avg_evaluation from v_outcomes order by completed desc, site'), { cols: [
  { key: 'site', label: 'site', format: (v) => truncate(v, 40) }, { key: 'completed', label: 'done', align: 'right' }, { key: 'passed', label: 'passed', align: 'right' },
  { key: 'not_passed', label: 'not passed', align: 'right' }, { key: 'withdrawn', label: 'withdrew', align: 'right' }, { key: 'incidents', label: 'incidents', align: 'right' },
  { key: 'avg_evaluation', label: 'rating /5', align: 'right', format: (v) => (v === null || v === undefined ? '' : Number(v).toFixed(1)) }] });

cmd('compliance', 'Check the records against the rules in docs/compliance.md (--detail for every item)', async (db, pos, f) => {
  const rules = await complianceChecks(db);
  if (!f.detail) return rules.map(({ items, ...r }) => ({ ...r, example: items[0] ? `${items[0].who ? `${items[0].who}: ` : ''}${items[0].detail}` : '' }));
  return rules.flatMap((r) => r.items.map((i) => ({ rule: r.rule, status: r.status, ...i })));
}, { flags: ['detail'], cols: null, render: (rows, f) => (f.detail
  ? table(rows, [{ key: 'rule', label: 'rule', format: (v) => truncate(v, 44) }, { key: 'ref', label: 'ref' }, { key: 'who', label: 'who' }, { key: 'detail', label: 'detail', format: (v) => truncate(v, 80) }])
  : table(rows, [{ key: 'status', label: 'status', format: (v) => (v === 'clean' ? v : v.toUpperCase()) }, { key: 'rule', label: 'rule', format: (v) => truncate(v, 60) },
    { key: 'breaches', label: 'breach', align: 'right' }, { key: 'due', label: 'due', align: 'right' }, { key: 'example', label: 'worst example', format: (v) => truncate(v, 70) }])) });

cmd('attention', 'Everything that needs the placement office this week, worst first (--student)', async (db, pos, f) => {
  const code = f.student ? await codeOf(db, 'students', await resolve(db, 'student', f.student)) : null;
  return db.query('select severity, issue, student_code, student, about, on_date, detail from v_attention where ($1::text is null or student_code = $1) order by severity, on_date nulls first, issue', [code]);
}, { flags: ['student'], cols: [
  { key: 'severity', label: '!', format: (v) => '!'.repeat(4 - v) }, { key: 'issue', label: 'issue' }, { key: 'student', label: 'student', format: (v) => v || '' },
  { key: 'about', label: 'about', format: (v) => truncate(v, 34) }, { key: 'on_date', label: 'date', format: d }, { key: 'detail', label: 'detail', format: (v) => truncate(v, 70) }] });

// ---------------------------------------------------------------- writes

cmd('add-student', 'Add a student (--name --programme --year --campus --email --phone --number)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'name', 'programme');
  return tx(db, async () => {
    const prog = await resolve(db, 'programme', f.programme);
    const code = f.code || (await nextCode(db, 'students', 'ST', 1000));
    const [row] = await db.query(`insert into students (code, name, email, phone, programme_id, year_level, campus, student_number)
                                  values ($1, $2, $3, $4, $5, $6, $7, $8) returning code, name, year_level, campus`,
      [code, f.name, f.email || null, f.phone || null, prog, int(f.year ?? 1, '--year', 1, 8), f.campus || null, f.number || null]);
    await audit(db, by, 'add-student', 'student', row.code, row);
    return [row];
  });
}, { write: true, flags: ['name', 'programme', 'year', 'campus', 'email', 'phone', 'number', 'code'] });

cmd('add-check', 'Record a check a student has shown evidence for (<student> --check=WWCC --done=2026-03-01 --expires --evidence)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'check');
  return tx(db, async () => {
    const sid = await resolve(db, 'student', pos.join(' '));
    const rid = await resolve(db, 'requirement', f.check);
    const [q] = await db.query('select code, name, valid_months from requirements where id = $1', [rid]);
    const done = date(f.done, '--done') || isoDate(new Date());
    let expires = date(f.expires, '--expires');
    if (!expires && q.valid_months) expires = (await db.query(`select ($1::date + make_interval(months => $2::int))::date as e`, [done, q.valid_months]))[0].e;
    const [row] = await db.query(`insert into student_checks (student_id, requirement_id, completed_on, expires_on, evidence, verified_by, verified_on)
                                  values ($1, $2, $3, $4, $5, $6, current_date) returning completed_on, expires_on`, [sid, rid, done, expires, f.evidence || null, by]);
    const out = { student: await codeOf(db, 'students', sid), check: q.name, completed_on: d(row.completed_on), expires_on: d(row.expires_on) || 'no expiry' };
    await audit(db, by, 'add-check', 'student', out.student, out);
    return [out];
  });
}, { write: true, flags: ['check', 'done', 'expires', 'evidence'] });

cmd('add-host', 'Add a host organisation and its first site (--name --kind --region --contact --email --phone --site --discipline --suburb)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'name');
  return tx(db, async () => {
    const kind = oneOf(f.kind, ['hospital', 'aged_care', 'community', 'primary_care', 'disability', 'private_practice', 'school', 'other'], '--kind') || 'other';
    const code = await nextCode(db, 'organisations', 'ORG', 0, 2);
    const [org] = await db.query(`insert into organisations (code, name, kind, region, contact_name, contact_email, phone) values ($1, $2, $3, $4, $5, $6, $7) returning id, code, name`,
      [code, f.name, kind, f.region || null, f.contact || null, f.email || null, f.phone || null]);
    let site = null;
    if (f.site) {
      [site] = await db.query('insert into sites (code, organisation_id, name, discipline, suburb) values ($1, $2, $3, $4, $5) returning code, name',
        [f['site-code'] || (await nextCode(db, 'sites', 'SITE', 0, 2)), org.id, f.site, f.discipline || null, f.suburb || null]);
    }
    await audit(db, by, 'add-host', 'organisation', org.code, { name: org.name, site: site?.code });
    return [{ code: org.code, name: org.name, kind, site: site ? `${site.code} ${site.name}` : 'none yet' }];
  });
}, { write: true, flags: ['name', 'kind', 'region', 'contact', 'email', 'phone', 'site', 'site-code', 'discipline', 'suburb'] });

cmd('add-site', 'Add a site to a host (<host> --name --discipline --suburb)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'name');
  return tx(db, async () => {
    const org = await resolve(db, 'organisation', pos.join(' '));
    const [row] = await db.query('insert into sites (code, organisation_id, name, discipline, suburb) values ($1, $2, $3, $4, $5) returning code, name',
      [f.code || (await nextCode(db, 'sites', 'SITE', 0, 2)), org, f.name, f.discipline || null, f.suburb || null]);
    await audit(db, by, 'add-site', 'site', row.code, row);
    return [row];
  });
}, { write: true, flags: ['name', 'discipline', 'suburb', 'code'] });

cmd('agreement', 'Record an agreement with a host (<host> --status=signed|sent|draft --starts --expires --insurance --document). Signing completes a pending renewal', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const org = await resolve(db, 'organisation', pos.join(' '));
    const status = oneOf(f.status, ['draft', 'sent', 'signed', 'ended'], '--status') || 'signed';
    if (status === 'signed') need(f, 'expires');
    const vals = [status, date(f.sent, '--sent') || (status === 'sent' ? isoDate(new Date()) : null), date(f.starts, '--starts') || (status === 'signed' ? isoDate(new Date()) : null),
      date(f.expires, '--expires'), date(f.insurance, '--insurance'), f.document || null, f.note || null];
    const pending = status === 'signed' ? (await db.query("select id from agreements where organisation_id = $1 and status in ('draft', 'sent') order by created_at desc limit 1", [org]))[0] : null;
    const returning = 'returning code, status, starts_on, expires_on, insurance_expires_on';
    const [row] = pending
      ? await db.query(`update agreements set status = $2, sent_on = coalesce($3, sent_on), starts_on = $4, expires_on = $5, insurance_expires_on = $6, document_ref = coalesce($7, document_ref),
                        note = coalesce($8, note) where id = $1 ${returning}`, [pending.id, ...vals])
      : await db.query(`insert into agreements (code, organisation_id, status, sent_on, starts_on, expires_on, insurance_expires_on, document_ref, note)
                        values ($1, $2, $3, $4, $5, $6, $7, $8, $9) ${returning}`, [await nextCode(db, 'agreements', 'AG', 0, 2), org, ...vals]);
    await audit(db, by, 'agreement', 'agreement', row.code, { status, expires_on: d(row.expires_on) });
    return [{ ...row, host: await codeOf(db, 'organisations', org) }];
  });
}, { write: true, flags: ['status', 'sent', 'starts', 'expires', 'insurance', 'document', 'note'] });

cmd('insurance', 'Record a host\'s new insurance certificate (<host> --until=2027-06-30)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'until');
  return tx(db, async () => {
    const org = await resolve(db, 'organisation', pos.join(' '));
    const rows = await db.query(`update agreements set insurance_expires_on = $2 where id = (select id from agreements where organisation_id = $1 and status = 'signed' order by expires_on desc nulls last limit 1)
                                 returning code, insurance_expires_on`, [org, date(f.until, '--until')]);
    if (!rows.length) throw new Error('That host has no signed agreement to attach the certificate to');
    await audit(db, by, 'insurance', 'agreement', rows[0].code, { until: d(rows[0].insurance_expires_on) });
    return rows;
  });
}, { write: true, flags: ['until'] });

cmd('add-supervisor', 'Add a supervisor (--name --site --role --email --registration --trained)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'name', 'site');
  return tx(db, async () => {
    const site = await resolve(db, 'site', f.site);
    const [row] = await db.query(`insert into supervisors (code, name, site_id, role, email, registration_number, trained_on) values ($1, $2, $3, $4, $5, $6, $7)
                                  returning code, name, trained_on`, [f.code || (await nextCode(db, 'supervisors', 'SV', 0, 2)), f.name, site, f.role || null, f.email || null, f.registration || null, date(f.trained, '--trained')]);
    await audit(db, by, 'add-supervisor', 'supervisor', row.code, { name: row.name });
    return [row];
  });
}, { write: true, flags: ['name', 'site', 'role', 'email', 'registration', 'trained', 'code'] });

cmd('trained', 'Record a supervisor\'s preceptor training (<supervisor> --on=2026-10-01)', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const id = await resolve(db, 'supervisor', pos.join(' '));
    const [row] = await db.query('update supervisors set trained_on = $2 where id = $1 returning code, name, trained_on', [id, date(f.on || 'today', '--on')]);
    await audit(db, by, 'trained', 'supervisor', row.code, { on: d(row.trained_on) });
    return [row];
  });
}, { write: true, flags: ['on'] });

cmd('add-round', 'Add a placement round (--programme --year --name --starts --ends --hours)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'programme', 'year', 'starts', 'ends', 'hours');
  return tx(db, async () => {
    const prog = await resolve(db, 'programme', f.programme);
    const pc = await codeOf(db, 'programmes', prog);
    const year = int(f.year, '--year', 1, 8);
    const [row] = await db.query(`insert into rounds (code, programme_id, year_level, name, starts_on, ends_on, hours) values ($1, $2, $3, $4, $5, $6, $7) returning code, name, starts_on, ends_on, hours`,
      [f.code || `R-${pc}${year}-${Date.now().toString(36).slice(-4).toUpperCase()}`, prog, year, f.name || `${pc} year ${year} block`, date(f.starts, '--starts'), date(f.ends, '--ends'), int(f.hours, '--hours', 1, 2000)]);
    await audit(db, by, 'add-round', 'round', row.code, { name: row.name });
    return [row];
  });
}, { write: true, flags: ['programme', 'year', 'name', 'starts', 'ends', 'hours', 'code'] });

cmd('offer', 'Record places a site offers for a round (<site> --round --places=2, --withdraw)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'round');
  return tx(db, async () => {
    const site = await resolve(db, 'site', pos.join(' '));
    const round = await resolve(db, 'round', f.round);
    const existing = (await db.query('select id, code from offers where site_id = $1 and round_id = $2', [site, round]))[0];
    let row;
    if (existing) [row] = await db.query('update offers set places = coalesce($2, places), status = $3 where id = $1 returning code, places, status', [existing.id, int(f.places, '--places', 0, 200), f.withdraw ? 'withdrawn' : 'offered']);
    else {
      need(f, 'places');
      [row] = await db.query(`insert into offers (code, site_id, round_id, places, received_on, status) values ($1, $2, $3, $4, current_date, 'offered') returning code, places, status`,
        [await nextCode(db, 'offers', 'OF', 0, 2), site, round, int(f.places, '--places', 0, 200)]);
    }
    await audit(db, by, 'offer', 'offer', row.code, row);
    return [{ ...row, site: await codeOf(db, 'sites', site), round: await codeOf(db, 'rounds', round) }];
  });
}, { write: true, flags: ['round', 'places', 'withdraw'] });

cmd('allocate', 'Place a student at a site for a round (<student> --round --site --supervisor). Warns about checks, agreement and capacity', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'round', 'site');
  return tx(db, async () => {
    const sid = await resolve(db, 'student', pos.join(' '));
    const rid = await resolve(db, 'round', f.round);
    const site = await resolve(db, 'site', f.site);
    const sup = f.supervisor ? await resolve(db, 'supervisor', f.supervisor) : null;
    const [r] = await db.query('select r.*, s.programme_id as student_programme, s.status as student_status from rounds r, students s where r.id = $1 and s.id = $2', [rid, sid]);
    if (r.programme_id !== r.student_programme) throw new Error('That round is for a different programme');
    if (r.student_status !== 'active') throw new Error('That student is not active');
    if ((await db.query("select 1 from placements where student_id = $1 and round_id = $2 and status in ('allocated', 'confirmed', 'completed')", [sid, rid])).length) throw new Error('That student already has a placement in this round');
    const starts = date(f.starts, '--starts') || isoDate(r.starts_on);
    const ends = date(f.ends, '--ends') || isoDate(r.ends_on);
    const code = await nextCode(db, 'placements', 'PL', 0, 3);
    const [row] = await db.query(`insert into placements (code, student_id, round_id, site_id, supervisor_id, starts_on, ends_on, planned_hours, status)
                                  values ($1, $2, $3, $4, $5, $6, $7, $8, 'allocated') returning id, code, starts_on, ends_on, planned_hours`,
      [code, sid, rid, site, sup, starts, ends, int(f.hours ?? r.hours, '--hours', 0, 2000)]);
    const warnings = [
      ...(await db.query('select requirement_name, problem from v_readiness where code = $1', [code])).map((w) => `${w.requirement_name}: ${w.problem}`),
      ...(await db.query('select problem from v_agreement_gaps where code = $1', [code])).map((w) => w.problem),
      ...(await db.query('select problem from v_supervision_gaps where code = $1', [code])).map((w) => w.problem),
    ];
    const [cap] = await db.query(`select coalesce((select sum(places) from offers where site_id = $1 and round_id = $2 and status = 'offered'), 0)::int as places,
                                         (select count(*) from placements where site_id = $1 and round_id = $2 and status in ('allocated', 'confirmed', 'completed'))::int as filled`, [site, rid]);
    if (cap.filled > cap.places) warnings.push(`site offered ${cap.places} places for this round, this is number ${cap.filled}`);
    await audit(db, by, 'allocate', 'placement', code, { student: await codeOf(db, 'students', sid), site: await codeOf(db, 'sites', site), warnings });
    return [{ code, student: await codeOf(db, 'students', sid), site: await codeOf(db, 'sites', site), starts_on: d(row.starts_on), ends_on: d(row.ends_on), warnings: warnings.join('; ') || 'none' }];
  });
}, { write: true, flags: ['round', 'site', 'supervisor', 'starts', 'ends', 'hours'] });

cmd('confirm', 'Mark a placement confirmed by the host, optionally naming the supervisor (<placement> --supervisor)', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const sup = f.supervisor ? await resolve(db, 'supervisor', f.supervisor) : null;
    const [row] = await db.query(`update placements set status = 'confirmed', confirmed_on = current_date, supervisor_id = coalesce($2, supervisor_id)
                                  where id = $1 and status in ('allocated', 'confirmed') returning code, status, confirmed_on`, [id, sup]);
    if (!row) throw new Error('Only an allocated placement can be confirmed');
    await audit(db, by, 'confirm', 'placement', row.code, {});
    return [row];
  });
}, { write: true, flags: ['supervisor'] });

cmd('withdraw', 'Withdraw or cancel a placement (<placement> --reason, --cancel when the host pulled out)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'reason');
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const [row] = await db.query(`update placements set status = $2, note = trim(coalesce(note || '. ', '') || $3) where id = $1 and status in ('allocated', 'confirmed') returning code, status, note`,
      [id, f.cancel ? 'cancelled' : 'withdrawn', f.reason]);
    if (!row) throw new Error('Only an allocated or confirmed placement can be withdrawn');
    await audit(db, by, 'withdraw', 'placement', row.code, { reason: f.reason });
    return [row];
  });
}, { write: true, flags: ['reason', 'cancel'] });

cmd('log-hours', 'Log a week of hours on a placement (<placement> --week=2026-11-01 --hours=38)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'hours');
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const [row] = await db.query('insert into timesheets (placement_id, week_ending, hours) values ($1, $2, $3) returning week_ending, hours', [id, date(f.week || 'today', '--week'), hoursOf(f.hours, '--hours')]);
    const code = await codeOf(db, 'placements', id);
    await audit(db, by, 'log-hours', 'placement', code, { week: d(row.week_ending), hours: Number(row.hours) });
    return [{ placement: code, week_ending: d(row.week_ending), hours: num(row.hours) }];
  });
}, { write: true, flags: ['week', 'hours'] });

cmd('sign-off', 'Record the supervisor signing off hours (<placement> --supervisor-name, --week to sign one week, otherwise all unsigned)', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const [p] = await db.query('select sv.name from placements x left join supervisors sv on sv.id = x.supervisor_id where x.id = $1', [id]);
    const who = f['supervisor-name'] || p.name;
    if (!who) throw new Error('Name who signed with --supervisor-name');
    const rows = await db.query(`update timesheets set signed_off_by = $2, signed_off_on = current_date where placement_id = $1 and signed_off_on is null and ($3::date is null or week_ending = $3)
                                 returning week_ending, hours`, [id, who, date(f.week, '--week')]);
    if (!rows.length) throw new Error('No unsigned hours on that placement');
    await audit(db, by, 'sign-off', 'placement', await codeOf(db, 'placements', id), { weeks: rows.length, by: who });
    return rows.map((r) => ({ week_ending: d(r.week_ending), hours: num(r.hours), signed_by: who }));
  });
}, { write: true, flags: ['week', 'supervisor-name'] });

cmd('assess', 'Record the final assessment (<placement> --result=pass|fail|incomplete --on)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'result');
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const result = oneOf(f.result, ['pass', 'fail', 'incomplete'], '--result');
    const [row] = await db.query(`update placements set result = $2, assessed_on = $3, status = 'completed' where id = $1 and status in ('allocated', 'confirmed', 'completed')
                                  returning code, result, assessed_on, status`, [id, result, date(f.on || 'today', '--on')]);
    if (!row) throw new Error('A withdrawn or cancelled placement cannot be assessed');
    await audit(db, by, 'assess', 'placement', row.code, { result });
    return [row];
  });
}, { write: true, flags: ['result', 'on'] });

cmd('evaluate', 'Record the student\'s rating of the site (<placement> --score=1..5)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'score');
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const [row] = await db.query('update placements set evaluation_score = $2, evaluation_on = current_date where id = $1 returning code, evaluation_score', [id, int(f.score, '--score', 1, 5)]);
    await audit(db, by, 'evaluate', 'placement', row.code, { score: row.evaluation_score });
    return [row];
  });
}, { write: true, flags: ['score'] });

cmd('incident', 'Record an incident or a student at risk (<placement> --kind --severity --on --detail --reported --plan)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'kind', 'detail');
  return tx(db, async () => {
    const id = await resolve(db, 'placement', pos[0]);
    const code = await nextCode(db, 'incidents', 'INC', 0, 2);
    const [row] = await db.query(`insert into incidents (code, placement_id, occurred_on, kind, severity, reported_to_site_on, plan, detail)
                                  values ($1, $2, $3, $4, $5, $6, $7, $8) returning code, occurred_on, kind, severity, reported_to_site_on`,
      [code, id, date(f.on || 'today', '--on'), oneOf(f.kind, ['needlestick', 'injury', 'conduct', 'near_miss', 'at_risk', 'other'], '--kind'),
       oneOf(f.severity, ['low', 'medium', 'high'], '--severity') || 'medium', f.reported ? date(f.reported === true ? 'today' : f.reported, '--reported') : null, f.plan || null, f.detail]);
    await audit(db, by, 'incident', 'incident', code, { kind: row.kind });
    return [row];
  });
}, { write: true, flags: ['kind', 'severity', 'on', 'detail', 'reported', 'plan'] });

cmd('update-incident', 'Record an incident reported to the host, a plan, or closed (<incident> --reported --plan --close)', async (db, pos, f) => {
  const by = actor(f);
  return tx(db, async () => {
    const id = await resolve(db, 'incident', pos[0]);
    const [row] = await db.query(`update incidents set reported_to_site_on = coalesce($2, reported_to_site_on), plan = coalesce($3, plan), closed_on = coalesce($4, closed_on)
                                  where id = $1 returning code, reported_to_site_on, plan, closed_on`,
      [id, f.reported ? date(f.reported === true ? 'today' : f.reported, '--reported') : null, typeof f.plan === 'string' ? f.plan : null, f.close ? date(f.close === true ? 'today' : f.close, '--close') : null]);
    await audit(db, by, 'update-incident', 'incident', row.code, { reported: d(row.reported_to_site_on), closed: d(row.closed_on) });
    return [row];
  });
}, { write: true, flags: ['reported', 'plan', 'close'] });

cmd('log', 'Log a call, email, visit or note against a student or a host (<student> or --host, --channel --summary)', async (db, pos, f) => {
  const by = actor(f);
  need(f, 'summary');
  return tx(db, async () => {
    const sid = pos.length ? await resolve(db, 'student', pos.join(' ')) : null;
    const oid = f.host ? await resolve(db, 'organisation', f.host) : null;
    if (!sid && !oid) throw new Error('Name a student or --host');
    const [row] = await db.query(`insert into contacts_log (student_id, organisation_id, channel, by_name, summary) values ($1, $2, $3, $4, $5) returning logged_on, channel, summary`,
      [sid, oid, oneOf(f.channel, ['call', 'email', 'visit', 'meeting', 'sms', 'note'], '--channel') || 'note', by, f.summary]);
    await audit(db, by, 'log', sid ? 'student' : 'organisation', sid ? await codeOf(db, 'students', sid) : await codeOf(db, 'organisations', oid), { channel: row.channel });
    return [row];
  });
}, { write: true, flags: ['host', 'channel', 'summary'] });

// ---------------------------------------------------------------- import and export

cmd('import', 'Bring students, hosts and placements across from InPlace CSV reports (import inplace --students --placements --dry-run)', async (db, pos, f) => {
  const by = actor(f);
  if (pos[0] !== 'inplace') throw new Error('Usage: import inplace --students=students.csv --placements=placements.csv [--dry-run]');
  if (!f.students && !f.placements) throw new Error('Give --students and/or --placements');
  const read = (file) => parseCsv(readFileSync(path.resolve(String(file)), 'utf8').replace(/^﻿/, ''));
  const out = { students_new: 0, students_matched: 0, hosts_new: 0, sites_new: 0, placements_new: 0, placements_matched: 0, skipped: [] };
  const byRef = new Map();
  const progFor = async (name) => {
    const t = String(name || '').trim();
    const hit = t ? await db.query('select id from programmes where lower(code) = lower($1) or name ilike $2 order by code limit 1', [t, `%${t}%`]) : [];
    if (hit.length) return hit[0].id;
    const [row] = await db.query(`insert into programmes (code, name, discipline, final_year, required_hours) values ($1, $2, 'imported', 1, 0) returning id`,
      [await nextCode(db, 'programmes', 'PRG', 0, 2), t || 'Imported programme']);
    return row.id;
  };
  const hostFor = async (orgName, siteName) => {
    const oname = String(orgName || siteName).trim();
    let org = (await db.query('select id from organisations where lower(name) = lower($1)', [oname]))[0]?.id;
    if (!org) {
      org = (await db.query('insert into organisations (code, name, kind, source_ref) values ($1, $2, $3, $4) returning id',
        [await nextCode(db, 'organisations', 'ORG', 0, 2), oname, 'other', `inplace:${oname}`]))[0].id;
      out.hosts_new++;
    }
    const sname = String(siteName || orgName).trim();
    let site = (await db.query('select id from sites where organisation_id = $1 and lower(name) = lower($2)', [org, sname]))[0]?.id;
    if (!site) {
      site = (await db.query('insert into sites (code, organisation_id, name, source_ref) values ($1, $2, $3, $4) returning id',
        [await nextCode(db, 'sites', 'SITE', 0, 2), org, sname, `inplace:${oname}/${sname}`]))[0].id;
      out.sites_new++;
    }
    return site;
  };
  const run = async () => {
    for (const r of f.students ? read(f.students) : []) {
      const ref = pick(r, 'Student ID', 'StudentID', 'Student Number', 'ID');
      const name = pick(r, 'Student Name', 'Name', 'Full Name') || [pick(r, 'First Name', 'Given Name'), pick(r, 'Last Name', 'Surname', 'Family Name')].filter(Boolean).join(' ');
      if (!ref || !name) { out.skipped.push(`student ${ref || '(no id)'}: no id or name`); continue; }
      const found = (await db.query('select id from students where source_ref = $1 or lower(student_number) = lower($2)', [`inplace:${ref}`, ref]))[0];
      if (found) { byRef.set(ref, found.id); out.students_matched++; continue; }
      const yr = String(pick(r, 'Year Level', 'Year', 'Stage') || '1').match(/\d+/)?.[0] || '1';
      const [row] = await db.query(`insert into students (code, name, email, phone, programme_id, year_level, campus, student_number, source_ref)
                                    values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [await nextCode(db, 'students', 'ST', 1000), name, pick(r, 'Email', 'Student Email') || null, pick(r, 'Mobile', 'Phone') || null,
         await progFor(pick(r, 'Course', 'Programme', 'Program', 'Course Code')), int(yr, 'year level', 1, 8), pick(r, 'Campus') || null, ref, `inplace:${ref}`]);
      byRef.set(ref, row.id);
      out.students_new++;
    }
    for (const r of f.placements ? read(f.placements) : []) {
      const ref = pick(r, 'Placement ID', 'PlacementID', 'ID');
      const sref = pick(r, 'Student ID', 'StudentID', 'Student Number');
      const student = byRef.get(sref) || (await db.query('select id from students where source_ref = $1 or lower(student_number) = lower($2)', [`inplace:${sref}`, sref]))[0]?.id;
      if (!student) { out.skipped.push(`placement ${ref || '(no id)'}: student ${sref || '(blank)'} not imported`); continue; }
      if (ref && (await db.query('select 1 from placements where source_ref = $1', [`inplace:${ref}`])).length) { out.placements_matched++; continue; }
      const starts = date(pick(r, 'Start Date', 'Placement Start', 'From'), 'start date');
      const ends = date(pick(r, 'End Date', 'Placement End', 'To'), 'end date');
      const orgName = pick(r, 'Agency', 'Organisation', 'Organization', 'Host', 'Placement Provider');
      const siteName = pick(r, 'Site', 'Unit', 'Ward', 'Location');
      if (!starts || !ends || !(orgName || siteName)) { out.skipped.push(`placement ${ref || '(no id)'}: no dates or host`); continue; }
      const st = String(pick(r, 'Status', 'Placement Status') || '').toLowerCase();
      const status = /withdr/.test(st) ? 'withdrawn' : /cancel/.test(st) ? 'cancelled' : /complet|finish|pass|fail/.test(st) ? 'completed' : /confirm|accept/.test(st) ? 'confirmed' : 'allocated';
      const resultText = String(pick(r, 'Result', 'Outcome', 'Grade') || '').toLowerCase();
      const result = /pass|satisf|competent/.test(resultText) && !/not|un/.test(resultText) ? 'pass' : /fail|not|un/.test(resultText) ? 'fail' : null;
      const site = await hostFor(orgName, siteName);
      const supName = pick(r, 'Supervisor', 'Preceptor', 'Clinical Supervisor');
      let sup = null;
      if (supName) {
        sup = (await db.query('select id from supervisors where lower(name) = lower($1) and site_id = $2', [supName, site]))[0]?.id;
        if (!sup) sup = (await db.query('insert into supervisors (code, name, site_id) values ($1, $2, $3) returning id', [await nextCode(db, 'supervisors', 'SV', 0, 2), supName, site]))[0].id;
      }
      const planned = int(String(pick(r, 'Hours', 'Planned Hours', 'Required Hours') || '0').replace(/\..*$/, ''), 'hours', 0, 5000);
      const [row] = await db.query(`insert into placements (code, student_id, site_id, supervisor_id, starts_on, ends_on, planned_hours, status, result, assessed_on, source_ref)
                                    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
        [await nextCode(db, 'placements', 'PL', 0, 3), student, site, sup, starts, ends, planned, result && status !== 'withdrawn' ? 'completed' : status, result,
         result ? ends : null, ref ? `inplace:${ref}` : null]);
      const done = Number(String(pick(r, 'Hours Completed', 'Completed Hours', 'Logged Hours') || '').replace(/[^\d.]/g, '')) || 0;
      if (done > 0) await db.query('insert into timesheets (placement_id, week_ending, hours, submitted_on, signed_off_by, signed_off_on) values ($1, $2, $3, $2, $4, $2)',
        [row.id, ends < isoDate(new Date()) ? ends : isoDate(new Date()), done, 'Imported from InPlace']);
      out.placements_new++;
    }
    await audit(db, by, f['dry-run'] ? 'import-dry-run' : 'import', 'import', 'inplace', { ...out, skipped: out.skipped.length });
  };
  await db.exec('BEGIN');
  try {
    await run();
    await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return [{ mode: f['dry-run'] ? 'dry run, nothing saved' : 'imported', ...out, skipped: out.skipped.length, skipped_detail: out.skipped }];
}, { write: true, flags: ['students', 'placements', 'dry-run'], cols: [
  { key: 'mode', label: 'mode' }, { key: 'students_new', label: 'new students', align: 'right' }, { key: 'students_matched', label: 'already here', align: 'right' },
  { key: 'hosts_new', label: 'new hosts', align: 'right' }, { key: 'sites_new', label: 'new sites', align: 'right' },
  { key: 'placements_new', label: 'new placements', align: 'right' }, { key: 'skipped', label: 'skipped', align: 'right' }] });

const EXPORT_TABLES = ['programmes', 'requirements', 'programme_requirements', 'students', 'student_checks', 'organisations', 'sites', 'agreements', 'supervisors',
  'rounds', 'offers', 'placements', 'timesheets', 'incidents', 'contacts_log', 'policy', 'audit'];

cmd('export', 'Write every table to CSV (--out=exports/<date>)', async (db, pos, f) => {
  const dir = path.resolve(REPO_ROOT, typeof f.out === 'string' ? f.out : path.join('exports', isoDate(new Date())));
  mkdirSync(dir, { recursive: true });
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [];
  for (const t of EXPORT_TABLES) {
    const rows = await db.query(`select * from ${t}`);
    const cols = rows.length ? Object.keys(rows[0]) : (await db.query('select column_name from information_schema.columns where table_name = $1 order by ordinal_position', [t])).map((r) => r.column_name);
    writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n');
    out.push({ table: t, rows: rows.length, file: path.relative(REPO_ROOT, path.join(dir, `${t}.csv`)) });
  }
  return out;
}, { flags: ['out'] });

export const commands = Object.keys(C);

// ---------------------------------------------------------------- output

function renderShow(r) {
  const s = r.student;
  const h = r.hours;
  const lines = [heading(`${s.code}  ${s.name}`),
    `  ${s.programme_name}, year ${s.year_level}${s.campus ? `, ${s.campus} campus` : ''}. Student number ${s.student_number || 'not recorded'}. Status: ${label(s.status)}.`];
  if (h) lines.push(`  Hours: ${num(h.signed_hours)} signed, ${num(h.unsigned_hours)} waiting for sign-off, ${num(h.planned_hours)} still planned. ${num(h.projected_hours)} of ${h.required_hours} needed${Number(h.shortfall) ? `, ${num(h.shortfall)} SHORT` : ''}.`);
  if (s.notes) lines.push(`  ${s.notes}`);
  const block = (title, rows, cols) => { if (rows.length) lines.push(`\n${title}`, table(rows, cols)); };
  block('Checks', r.checks, [{ key: 'requirement_name', label: 'check' }, { key: 'completed_on', label: 'done', format: d },
    { key: 'expires_on', label: 'expires', format: (v, x) => (x.state === 'missing' ? '' : v ? d(v) : 'no expiry') }, { key: 'state', label: 'state', format: (v) => (v === 'current' ? v : v.toUpperCase()) }]);
  block('Placements', r.placements, [{ key: 'code', label: 'placement' }, { key: 'site', label: 'site', format: (v) => truncate(v, 38) }, { key: 'supervisor', label: 'supervisor', format: (v) => v || 'none' },
    { key: 'starts_on', label: 'starts', format: d }, { key: 'ends_on', label: 'ends', format: d }, { key: 'planned_hours', label: 'hours', align: 'right' },
    { key: 'stage', label: 'stage' }, { key: 'result', label: 'result', format: (v) => v || '' }]);
  block('Incidents', r.incidents, [{ key: 'code', label: 'ref' }, { key: 'occurred_on', label: 'date', format: d }, { key: 'kind', label: 'kind', format: label },
    { key: 'reported_to_site_on', label: 'reported', format: (v) => (v ? d(v) : 'NOT REPORTED') }, { key: 'closed_on', label: 'closed', format: (v) => (v ? d(v) : 'open') }, { key: 'plan', label: 'plan', format: (v) => truncate(v, 50) }]);
  block('Latest notes', r.notes, [{ key: 'logged_on', label: 'date', format: d }, { key: 'channel', label: 'how' }, { key: 'summary', label: 'note', format: (v) => truncate(v, 90) }]);
  return lines.join('\n');
}

export function format(name, result, flags = {}) {
  const c = C[name];
  if (c.render) return c.render(result, flags);
  const cols = c.cols || (result[0] ? Object.keys(result[0]).filter((k) => k !== 'id' && (typeof result[0][k] !== 'object' || result[0][k] === null || result[0][k] instanceof Date)).map((k) => ({ key: k, label: label(k) })) : []);
  const dated = cols.map((col) => (col.format ? col : { ...col, format: (v) => (v instanceof Date ? isoDate(v) : v) }));
  return table(result, dated);
}

export async function run(db, argv) {
  const { pos, flags } = parseArgs(argv);
  const name = pos.shift();
  if (!name) throw new Error('Name a command. Try: help');
  const c = C[name];
  if (!c) throw new Error(`Unknown command "${name}". Try: help`);
  const allowed = new Set([...(c.flags || []), 'json', ...(c.write ? ['by'] : [])]);
  for (const k of Object.keys(flags)) if (!allowed.has(k)) throw new Error(`Unknown flag --${k} for ${name}`);
  return c.fn(db, pos, flags);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const { pos, flags } = parseArgs(argv);
  const db = await getDb();
  try {
    const result = await run(db, argv);
    if (flags.json) console.log(JSON.stringify(result, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
    else console.log(format(pos[0], result, flags));
  } catch (e) {
    console.error(e.message);
    if (e.candidates) for (const c of e.candidates) console.error(`  ${c.label}`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
