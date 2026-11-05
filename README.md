<h1 align="center">Placements for Claude Code</h1>

<p align="center">
  <strong>The open-source student placement system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your InPlace data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=inplace">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/inplace?utm_source=github&utm_medium=readme&utm_campaign=inplace">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-inplace">Instead of InPlace</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Placements for Claude Code does the job you pay InPlace for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the InPlace dashboard cannot.

QuantumIT does not publish a price for InPlace. Its pricing page says InPlace "is for universities and higher education providers" and "supports an enterprise model for managing student placement programs" ([inplacesoftware.com/pricing](https://inplacesoftware.com/pricing), checked 5 November 2026), and university members of CAUDIT buy it through a pricing offer negotiated for the group. Sonia, its closest rival, is also quote only. You pay an enterprise licence for what is, underneath, a register of students, checks, hosts and dates.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=inplace).

It is the placement office of a college, training provider or school of nursing: students and the pre-placement checks each programme requires (police check, working with children, vaccinations, TB, flu, CPR, NDIS screening) with the day each runs out, host organisations and their wards and sites, the agreement and insurance certificate behind each host, supervisors and their training, placement rounds, the places hosts offer against the students still waiting, hours logged and signed off against the programme minimum, final assessments, students' ratings of each site, and incidents. It is built for placement teams of two to ten people running nursing, allied health, aged care, disability and community services programmes, and it checks the office against the NSW Health vaccination directive, working with children and NDIS screening rules, the Higher Education Standards Framework, and the ANMAC and Nursing Council of New Zealand minimum hours out of the box.

### Ten questions InPlace's reports never answered

Each is one command on the demo college today.

1. Which students start in the next 30 days with a check missing or running out before their last day? `readiness --days=30`
2. Which final-year students will not reach the programme's minimum hours on what is booked? `hours --short`
3. Which hosts offered places last year and none this year? `sites --quiet`
4. How many students are waiting against how many places are still open, round by round? `capacity`
5. Which agreements end before placements already booked under them? `agreements`
6. Which students are with a supervisor who has no training on record, or training out of date? `supervisors --gaps`
7. Which hours have waited longest for a supervisor's signature? `timesheets`
8. Which final assessments are late, and from whom? `assessments`
9. Which sites have the most incidents and students at risk? `incidents --by-site`
10. Which sites do students rate lowest, and where do they fail or withdraw most? `outcomes`

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/placements-for-claude-code.git
cd placements-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. It lists everything on the demo college that needs the placement office this week: a needlestick injury three days old that nobody has reported to the hospital, a student starting in twelve days with no police check and no supervisor at a host whose agreement ends halfway through her placement, a renewal stuck with another host's lawyers while a student is booked there, two final-year nursing students who will finish short of their 800 hours, a supervisor with no training on record, and a private hospital that offered eight places the year before and none this year.

From the terminal the same thing is `npm run placements -- attention`. `npm run view` writes the week, places and students, and compliance as HTML pages; `npm run docs` writes placement confirmations, student compliance records, hours statements and host schedules in your brand (`brand.json`).

### Your first hour: ten things to ask for

1. "What needs attention this week?"
2. "Who starts placement in the next fortnight, and is everyone ready?"
3. "Show me Chloe Nguyen."
4. "Which final-year students will not make their hours, and what would fix it?"
5. "Pair the students still waiting with the places still open."
6. "Draft a reminder to Mia Robinson about her police check."
7. "Run the compliance check and explain each breach."
8. "Which hosts have gone quiet, and what do our notes say about them?"
9. "We want hours signed off within 5 days, not 7, change it." (`/customise`)
10. "Add a mask fit test as a check for the Bachelor of Nursing." (`/customise`)

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/add-check` | Record a check a student has shown evidence for. The expiry is worked out from the requirement unless the certificate says otherwise. |
| `/add-student` | Add a student, a placement round, or places a host has offered. |
| `/agreements` | Host agreements: when each one ends, the insurance certificate, renewals in progress, and placements booked past the end. |
| `/allocate` | Place a student at a site for a round. Warns straight away about checks, the host agreement, the supervisor and going over the places offered. |
| `/assessments` | Finished placements still waiting on the final assessment, most overdue first, and recording results and the student's rating of the site. |
| `/attention` | Everything that needs the placement office this week, worst first: checks not ready, placements without agreement cover or a trained supervisor, unreported incidents, students short of hours or unplaced, late assessments and unsigned hours. |
| `/capacity` | Students still waiting for a placement next to the places hosts have offered and nobody has filled, round by round. |
| `/checks` | Pre-placement checks that are missing, expired or running out: police checks, working with children, vaccinations, TB, flu, CPR, code of conduct, NDIS screening. |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/draft-check-reminder` | Draft a reminder to a student whose pre-placement check is missing or running out, in drafts/. |
| `/draft-confirmation` | Draft the placement confirmation to a student, and the matching note to the host, in drafts/. |
| `/draft-host-request` | Draft a request to a host for places in a coming round, in drafts/. |
| `/export` | Write every table to CSV files you can open anywhere. |
| `/help` | Every CLI command and what it does. |
| `/hosts` | Host organisations: places offered this year against last, which hosts have gone quiet, and how placements turned out at each site. |
| `/hours` | Hours signed off, waiting for sign-off and still planned for each student, against the programme minimum. `--short` lists final-year students who will not make it on current plans. |
| `/import` | Bring students, hosts, sites, supervisors and placements across from InPlace report exports. Dry run first. |
| `/incidents` | Incidents and students at risk: needlestick injuries, falls, conduct concerns and learning plans, whether the host has been told, and closing them. |
| `/insights` | The ten questions InPlace's reports never answered, run against your placement office. |
| `/log` | Log a call, email, visit or note against a student or a host. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/placements` | Placements by round, site or student: who is where, with which supervisor, and what stage each is at. |
| `/readiness` | Placements starting soon, or running now, where a check is missing or runs out before the last day. The list to clear before anyone starts. |
| `/student` | One student on one page: programme and year, every pre-placement check and when it runs out, placements past and booked, hours against the programme minimum, incidents and the latest notes. |
| `/supervisors` | Supervisors, their preceptor training and how many students each has; `--gaps` lists placements with no supervisor or one whose training is missing or out of date. |
| `/timesheets` | Hours waiting for a supervisor to sign them off, oldest first, and recording the sign-off. |
| `/weekly-review` | The Monday review for the placement coordinator, written from attention, capacity and hours into drafts/. |

## Instead of InPlace

Export the student report and the placement report from InPlace as CSV, then:

```bash
npm run placements -- import inplace --students=imports/students.csv --placements=imports/placements.csv --dry-run --by="Your Name"
npm run placements -- import inplace --students=imports/students.csv --placements=imports/placements.csv --by="Your Name"
```

The dry run saves nothing and lists every row it would skip. Students, courses, host organisations, sites, supervisors and placements come across, with hours completed and results; checks, agreement dates and programme minimum hours are set once by asking. The full guide, including what does not carry over, is [docs/replace-inplace.md](docs/replace-inplace.md).

## Architecture

```
placements-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Placements for Claude Code for your business, migrates your InPlace data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=inplace)
- Read more: [enterprisedna.co/omni/instead-of/inplace](https://enterprisedna.co/omni/instead-of/inplace?utm_source=github&utm_medium=readme&utm_campaign=inplace)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
