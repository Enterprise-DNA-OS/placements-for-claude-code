---
description: Everything that needs the placement office this week, worst first: checks not ready, placements without agreement cover or a trained supervisor, unreported incidents, students short of hours or unplaced, late assessments and unsigned hours.
---

```sh
npm run placements -- attention                    # the whole office
npm run placements -- attention --student=thompson
```

Present it as one table grouped by severity. Lead with the three-mark items (check not ready, no agreement cover, incident not reported, supervision gap): each one can stop a student on day one or put the college in breach of an agreement. For each, add one line on the next action and the command that records it (`add-check`, `agreement`, `update-incident --reported`, `trained` or `confirm --supervisor`). Then the two-mark items, then a count per issue for the rest.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
