---
description: Hours signed off, waiting for sign-off and still planned for each student, against the programme minimum. `--short` lists final-year students who will not make it on current plans.
---

```sh
npm run placements -- hours --short
npm run placements -- hours
npm run placements -- log-hours <placement> --week=2026-11-08 --hours=38 --by="Hannah Lee"
```

For each student short of hours, say by how much and what would close the gap: an open place in a current round (`capacity`), a catch-up round (`add-round`), or hours waiting for sign-off (`timesheets`). The minimum and its source are on the programme (`hours_source`).

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
