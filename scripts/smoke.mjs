#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, then every command, every write rule and the import.
// Set TEST_DATABASE_URL to run the same checks against an empty, disposable Postgres.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const temp = mkdtempSync(path.join(os.tmpdir(), 'placements-'));
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
// Blank on purpose: stops .env or .env.local loading a live connection into the test.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';

const { getDb, REPO_ROOT } = await import('./lib/db.mjs');
const { migrate } = await import('./migrate.mjs');
const { seed } = await import('./seed.mjs');
const { run, commands, format, date, hoursOf, complianceChecks } = await import('./placements.mjs');

let checks = 0;
const seen = new Set();
const ok = (v, m) => { assert.ok(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const rejects = async (fn, re) => { await assert.rejects(fn, re); checks++; };
const BY = { by: 'Test Coordinator' };
const argv = (c, pos, flags) => [c, ...pos, ...Object.entries(flags).map(([k, v]) => (v === true ? `--${k}` : `--${k}=${v}`))];
let db;
const call = async (c, pos = [], flags = {}) => { seen.add(c); const out = await run(db, argv(c, pos, flags)); format(c, out, flags); return out; };
const write = (c, pos = [], flags = {}) => call(c, pos, { ...BY, ...flags });
const child = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(r.status, 0, r.stderr || r.stdout);
  return r.stdout;
};
const plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

try {
  db = await getDb();
  eq(db.mode, process.env.TEST_DATABASE_URL ? 'postgres' : 'pglite', 'tests never use an operational connection');
  if (process.env.TEST_DATABASE_URL) {
    const tables = await db.query("select tablename from pg_tables where schemaname = 'public'");
    if (tables.length) throw new Error('TEST_DATABASE_URL must point at an empty, disposable database');
  }

  // Migrate is repeatable; seed is idempotent.
  eq((await migrate(db)).ran.length, readdirSync(path.join(REPO_ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).length);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  const count = async (t) => (await db.query(`select count(*)::int as n from ${t}`))[0].n;
  const before = await count('placements');
  await seed(db);
  eq(await count('placements'), before, 'seed runs once');
  eq(await count('students'), 14);

  // Input parsing.
  eq(date('31/03/2026'), '2026-03-31'); eq(hoursOf('7h30'), 7.5); eq(hoursOf('38'), 38);
  await rejects(async () => date('2026-02-30'), /Invalid/);
  await rejects(async () => hoursOf('lots'), /Invalid/);
  await rejects(() => call('nonsense'), /Unknown command/);
  await rejects(() => call('hours', [], { banana: 1 }), /Unknown flag/);

  // Reads, each with something to say on the demo office.
  eq((await call('help')).length, commands.length);
  for (const c of ['students', 'checks', 'readiness', 'placements', 'rounds', 'hours', 'timesheets', 'agreements', 'supervisors', 'assessments',
    'incidents', 'sites', 'outcomes', 'attention'])
    ok((await call(c)).length > 0, `${c} has demo rows`);

  eq((await call('readiness')).map((r) => [r.code, r.problem]), [
    ['PL-019', 'runs out during placement'], ['PL-026', 'missing'], ['PL-024', 'expired'], ['PL-025', 'runs out during placement']]);
  eq((await call('checks')).map((r) => r.state), ['missing', 'expired', 'expiring', 'expiring']);
  eq((await call('checks', [], { student: 'mateo' })).length, 7);
  eq((await call('hours', [], { short: true })).map((r) => [r.student_code, Number(r.shortfall)]), [['ST-1003', 160], ['ST-1001', 80], ['ST-1014', 40], ['ST-1011', 120]]);
  eq((await call('rounds')).map((r) => r.waiting), [1, 1, 1]);
  const cap = await call('capacity');
  eq(cap.waiting.map((r) => r.student), ['Ethan Patel', 'Zara Ahmed', 'Priya Raman']);
  eq(cap.open.map((r) => r.site_code), ['SITE-ED', 'SITE-EFP']);
  eq((await call('timesheets')).map((r) => Number(r.hours)), [36, 38]);
  const ag = await call('agreements');
  eq(ag[0].org_code, 'ORG-03', 'an ended agreement sorts first');
  eq(ag.filter((r) => r.booked_past_end > 0).map((r) => r.org_code), ['ORG-03', 'ORG-02']);
  eq((await call('agreements', [], { ending: 90 })).map((r) => r.org_code), ['ORG-03', 'ORG-02']);
  eq((await call('supervisors', [], { gaps: true })).map((r) => r.code), ['PL-020', 'PL-026', 'PL-027']);
  eq((await call('assessments')).map((r) => [r.code, r.days_late]), [['PL-016', 6]]);
  eq((await call('incidents', [], { open: true })).length, 2);
  eq((await call('incidents', [], { 'by-site': true })).length, 3);
  eq((await call('sites', [], { quiet: true })).map((r) => r.code), ['ORG-05'], 'St Columba stopped offering places');
  eq((await call('outcomes'))[0].site, 'St Columba, Medical Ward');
  eq((await call('placements', [], { round: 'R-BN3-A' })).length, 3);
  eq((await call('placements', [], { site: 'SITE-WG' })).length, 2);
  eq((await call('placements', [], { student: 'nguyen', all: true })).length, 4);
  eq((await call('students', [], { programme: 'DIPN' })).length, 3);

  const attention = await call('attention');
  for (const issue of ['check not ready', 'no agreement cover', 'incident not reported', 'supervision gap', 'host insurance lapsed', 'short of hours',
    'student unplaced', 'assessment overdue', 'hours not signed off', 'student at risk', 'agreement ending', 'open place', 'supervisor training due', 'check expiring', 'host gone quiet'])
    ok(attention.some((a) => a.issue === issue), `attention shows ${issue}`);
  ok((await call('attention', [], { student: 'thompson' })).every((a) => a.student === 'Isla Thompson'));

  // Compliance: the demo office has one of each problem.
  const comp = await call('compliance');
  const rule = (rows, re) => rows.find((r) => re.test(r.rule));
  eq([rule(comp, /pre-placement check/).breaches, rule(comp, /signed agreement/).breaches, rule(comp, /insurance/).breaches], [4, 2, 1]);
  eq([rule(comp, /supervisor, trained/).breaches, rule(comp, /supervisor, trained/).due], [2, 1]);
  eq([rule(comp, /minimum placement hours/).breaches, rule(comp, /reported to the host/).breaches, rule(comp, /final assessment/).breaches], [4, 1, 1]);
  eq([rule(comp, /signed off/).breaches, rule(comp, /signed off/).due], [1, 1]);
  ok((await call('compliance', [], { detail: true })).length >= 17);

  // Student lookup: code, student number, name fragment, ambiguity.
  eq((await call('show', ['nguyen'])).student.code, 'ST-1001');
  eq((await call('show', ['SCH24003'])).student.name, 'Priya Raman');
  const chloe = await call('show', ['st-1001']);
  eq([Number(chloe.hours.signed_hours), Number(chloe.hours.shortfall)], [560, 80]);
  eq(chloe.placements.length, 4);
  await rejects(() => call('show', ['an']), /Ambiguous student "an"/);
  await rejects(() => call('show', ['nobody']), /No student matches/);

  // Writes need a name for the audit log.
  await rejects(() => call('log', ['ST-1003'], { summary: 'x' }), /--by/);
  await write('log', ['ST-1003'], { channel: 'call', summary: 'Offered Eastside or Royal Harbour; prefers Eastside' });
  await write('log', [], { host: 'columba', channel: 'email', summary: 'Asked Fiona Burke for two places next year' });

  // Checks: record the missing police check and the new flu shot, and readiness clears.
  await write('add-check', ['Mia Robinson'], { check: 'POLICE', done: '-3d', evidence: 'Certificate sighted' });
  const flu = await write('add-check', ['O\'Brien'], { check: 'flu', done: '-1d' });
  ok(flu[0].expires_on > plus(300), 'a flu shot lasts 12 months');
  await write('add-check', ['Mateo'], { check: 'WWCC', done: 'today' });
  await write('add-check', ['Grace'], { check: 'CPR', done: 'today' });
  eq((await call('readiness')).length, 0, 'every live placement is ready');
  await rejects(() => write('add-check', ['Mia Robinson'], { check: 'BANANA' }), /No requirement matches/);

  // Agreements and insurance: sign the Bayside renewal, extend Wattle Grove, the gaps close.
  await write('agreement', ['Bayside'], { status: 'signed', starts: '-1d', expires: '+1095d', insurance: '+300d' });
  eq((await db.query("select status from agreements where code = 'AG-07'"))[0].status, 'signed', 'signing completes the pending renewal');
  await write('agreement', ['Wattle Grove'], { status: 'sent' });
  await write('agreement', ['Wattle Grove'], { status: 'signed', starts: 'today', expires: '+730d' });
  eq((await call('placements', [], { site: 'SITE-WG' })).length, 2);
  eq((await db.query('select count(*)::int as n from v_agreement_gaps'))[0].n, 0);
  await rejects(() => write('agreement', ['Coastal'], { status: 'signed' }), /--expires/);
  await write('insurance', ['Coastal'], { until: '+365d' });
  eq(rule(await complianceChecks(db), /insurance/).status, 'clean');

  // Supervisors: train Linh, name one for Mia, record Rebecca's refresher.
  await write('trained', ['Linh Tran'], { on: '-2d' });
  await write('add-supervisor', [], { name: 'Grace Tuilagi', site: 'SITE-WG', role: 'Registered nurse', trained: '-30d' });
  await write('confirm', ['PL-026'], { supervisor: 'Tuilagi' });
  await write('trained', ['Rebecca Hall'], {});
  eq((await call('supervisors', [], { gaps: true })).length, 0);
  ok((await call('supervisors')).some((r) => r.name === 'Grace Tuilagi'));
  await rejects(() => write('confirm', ['PL-001']), /Only an allocated placement/);

  // Places: Eastside's open place goes to Zara; Priya needs a new offer first.
  const z = await write('allocate', ['Zara'], { round: 'R-DN2-A', site: 'SITE-EFP', supervisor: 'SV-08' });
  eq(z[0].warnings, 'CPR certificate: expired', 'allocate warns that her CPR runs out before she starts');
  await write('add-check', ['Zara'], { check: 'CPR', done: 'today' });
  await rejects(() => write('allocate', ['Zara'], { round: 'R-DN2-A', site: 'SITE-EFP' }), /already has a placement/);
  await rejects(() => write('allocate', ['Zara'], { round: 'R-BN3-A', site: 'SITE-7B' }), /different programme/);
  const over = await write('allocate', ['Priya'], { round: 'R-BN3-A', site: 'SITE-7B', supervisor: 'karen' });
  ok(/offered 2 places/.test(over[0].warnings), 'allocating past the offer warns');
  await write('withdraw', [over[0].code], { reason: 'Over the site offer; moved to Eastside' });
  await rejects(() => write('withdraw', [over[0].code], { reason: 'again' }), /Only an allocated or confirmed/);
  await write('offer', ['SITE-EFP'], { round: 'R-BN3-A', places: 1 });
  await write('allocate', ['Priya'], { round: 'R-BN3-A', site: 'SITE-EFP', supervisor: 'SV-08' });
  await write('offer', ['SITE-ED'], { round: 'R-BN2-C', places: 1 });
  eq((await call('capacity')).open.length, 0, 'no places left open');
  eq((await call('capacity')).waiting.map((r) => r.student), ['Ethan Patel']);

  // Hours: sign Isla's weeks, log a new one, and the short list shrinks.
  await write('sign-off', ['PL-021'], { week: plus(-11) });
  await write('sign-off', ['PL-021'], {});
  await rejects(() => write('sign-off', ['PL-021']), /No unsigned hours/);
  await write('log-hours', ['PL-019'], { week: 'today', hours: '37.5' });
  eq((await call('timesheets')).map((r) => r.code), ['PL-019']);
  eq((await call('hours', [], { short: true })).map((r) => r.student_code), ['ST-1001', 'ST-1014'], 'Priya and Zara are on track once placed');
  const r2 = await write('add-round', [], { programme: 'BN', year: 3, name: 'BN year 3 catch-up block', starts: '+60d', ends: '+74d', hours: 80, code: 'R-BN3-X' });
  eq(r2[0].code, 'R-BN3-X');
  await write('offer', ['SITE-9A'], { round: 'R-BN3-X', places: 1 });
  await write('allocate', ['Chloe'], { round: 'R-BN3-X', site: 'SITE-9A', supervisor: 'SV-05' });
  eq((await call('hours', [], { short: true })).map((r) => r.student_code), ['ST-1014']);

  // Assessments, evaluations and incidents.
  await write('assess', ['PL-016'], { result: 'pass', on: '-1d' });
  await write('evaluate', ['PL-016'], { score: 4 });
  eq((await call('assessments')).length, 0);
  await rejects(() => write('assess', [over[0].code], { result: 'pass' }), /cannot be assessed/);
  await rejects(() => write('evaluate', ['PL-016'], { score: 9 }), /between 1 and 5/);
  await write('update-incident', ['INC-01'], { reported: true, plan: 'Bloods taken at ED; follow up at 6 weeks' });
  const inc = await write('incident', ['PL-019'], { kind: 'near miss', severity: 'low', detail: 'Nearly gave a double dose; stopped by the second check', reported: true });
  await write('update-incident', [inc[0].code], { close: true });
  await write('update-incident', ['INC-02'], { close: '+0d' });
  eq(rule(await complianceChecks(db), /reported to the host/).status, 'clean');

  // New students and hosts.
  await write('add-student', [], { name: 'Tama Rangi', programme: 'BN', year: 2, campus: 'Sydney', number: 'SCH26201' });
  ok((await call('show', ['SCH26201'])).checks.every((c) => c.state === 'missing'), 'a new student has every check to do');
  await write('add-host', [], { name: 'Kingsway Rehabilitation', kind: 'hospital', contact: 'Jo Park', site: 'Rehab Ward 2', discipline: 'nursing' });
  await write('add-site', ['Kingsway'], { name: 'Hydrotherapy', discipline: 'nursing' });
  eq((await db.query("select count(*)::int as n from sites s join organisations o on o.id = s.organisation_id where o.name = 'Kingsway Rehabilitation'"))[0].n, 2);
  await write('withdraw', ['PL-027'], { reason: 'Host pulled out', cancel: true });
  eq((await db.query("select status from placements where code = 'PL-027'"))[0].status, 'cancelled');
  ok((await db.query("select count(*)::int as n from audit where action = 'allocate'"))[0].n === 4, 'every write is audited');

  // Import from InPlace report exports.
  const fx = (f) => path.join(REPO_ROOT, 'test', 'fixtures', f);
  const students = await count('students');
  const dry = await write('import', ['inplace'], { students: fx('inplace-students.csv'), placements: fx('inplace-placements.csv'), 'dry-run': true });
  eq(dry[0].students_new, 2); eq(await count('students'), students, 'dry run saves nothing');
  const imp = await write('import', ['inplace'], { students: fx('inplace-students.csv'), placements: fx('inplace-placements.csv') });
  eq([imp[0].students_new, imp[0].students_matched, imp[0].hosts_new, imp[0].sites_new, imp[0].placements_new, imp[0].skipped], [2, 1, 1, 1, 3, 2]);
  const again = await write('import', ['inplace'], { students: fx('inplace-students.csv'), placements: fx('inplace-placements.csv') });
  eq([again[0].students_new, again[0].students_matched, again[0].placements_new, again[0].placements_matched], [0, 3, 0, 3], 'import is repeatable');
  const hamish = (await call('show', ['Hamish Cole']));
  eq([hamish.student.year_level, hamish.student.campus, Number(hamish.hours.signed_hours)], [2, 'Parramatta', 152]);
  eq(hamish.placements.map((p) => p.stage), ['upcoming', 'completed']);
  eq((await db.query("select x.result, si.name from placements x join sites si on si.id = x.site_id where x.source_ref = 'inplace:IP-9001'"))[0], { result: 'pass', name: 'Royal Harbour Hospital, Ward 7B Surgical' }, 'existing sites are matched by name');
  await rejects(() => write('import', ['sonia'], { students: fx('inplace-students.csv') }), /Usage: import inplace/);

  // Export every table.
  const exp = await call('export', [], { out: path.relative(REPO_ROOT, path.join(temp, 'export')) });
  eq(exp.length, 17);
  ok(readFileSync(path.join(temp, 'export', 'students.csv'), 'utf8').includes('Hamish Cole'));

  for (const c of commands) ok(seen.has(c), `smoke covers ${c}`);
  await db.close();
  db = null;

  // The documents, views and CLI run as their own processes.
  ok(child(['scripts/placements.mjs', 'attention']).includes('short of hours'), 'CLI runs as a process');
  const docsOut = child(['scripts/docs.mjs']);
  ok(/document\(s\) rendered/.test(docsOut) && !/^0 document/m.test(docsOut), 'documents render');
  ok(child(['scripts/view.mjs']).includes('view:'), 'views render');
  const bad = spawnSync(process.execPath, ['scripts/placements.mjs', 'show', 'an'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(bad.status, 1); ok(/Ambiguous/.test(bad.stderr));
  console.log(`PASS  ${checks} checks, ${commands.length} CLI commands (${process.env.TEST_DATABASE_URL ? 'postgres' : 'pglite'})`);
} finally {
  if (db) await db.close();
  rmSync(temp, { recursive: true, force: true });
}
