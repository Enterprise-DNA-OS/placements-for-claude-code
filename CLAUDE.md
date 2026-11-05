# Placements for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing this week | `/attention` |
| One student | `/student` |
| Checks missing, expired or running out | `/checks` |
| Who is not ready to start | `/readiness` |
| Record a check sighted | `/add-check` |
| Who is where, by round, site or student | `/placements` |
| Students waiting and places open | `/capacity` |
| Place a student, record places offered, confirm | `/allocate` |
| Hours against the programme minimum | `/hours` |
| Hours waiting for a supervisor | `/timesheets` |
| Host agreements, renewals, insurance | `/agreements` |
| Supervisors and their training | `/supervisors` |
| Final assessments and site ratings | `/assessments` |
| Incidents and students at risk | `/incidents` |
| Hosts: who offers places, who went quiet, how sites went | `/hosts` |
| Confirm a placement to a student and host | `/draft-confirmation` |
| Remind a student about a check | `/draft-check-reminder` |
| Ask a host for places | `/draft-host-request` |
| Log a call, email or visit | `/log` |
| Add a student, a round or places | `/add-student` |
| Check the rules | `/compliance` |
| The Monday review | `/weekly-review` |
| Questions the old reports never answered | `/insights` |
| Bring data across from InPlace | `/import` |
| Get everything out as CSV | `/export` |
| Change a field, a check or a rule | `/customise` |
| A new read-only dashboard | `/new-view` |
| Every command | `/help` |

If an ask fits nothing here, run the CLI directly (`npm run placements -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## House rules for a placement office

- Student and incident details stay in this database and this folder. Never paste a student's health, police or incident details into anything outside it.
- Never record a check, a sign-off or a result on a guess. Only when the operator says the evidence or the signed form is in front of them.
- A host is told about an incident the same day. If one is unreported, say so first, every time.
- Drafts to students go one per student. Never one email with several students in To.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off InPlace.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/inplace
