---
description: Supervisors, their preceptor training and how many students each has; `--gaps` lists placements with no supervisor or one whose training is missing or out of date.
---

```sh
npm run placements -- supervisors
npm run placements -- supervisors --gaps
npm run placements -- add-supervisor --name="Grace Tuilagi" --site=SITE-WG --role="Registered nurse" --trained=2026-09-01 --by="Hannah Lee"
npm run placements -- trained <supervisor> --on=2026-10-01 --by="Hannah Lee"
```

How long training counts is `supervisor_training_years` in the policy table. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
