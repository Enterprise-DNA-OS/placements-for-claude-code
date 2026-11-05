---
description: One student on one page: programme and year, every pre-placement check and when it runs out, placements past and booked, hours against the programme minimum, incidents and the latest notes.
---

```sh
npm run placements -- show <name, code or student number>
```

Lead with anything that would stop the next placement: a check missing or running out before the last day, hours short of the minimum, an open incident or learning plan. Then the placements table. If the student has notes about where they can travel or what they need, mention them when talking about the next placement.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
