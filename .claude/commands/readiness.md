---
description: Placements starting soon, or running now, where a check is missing or runs out before the last day. The list to clear before anyone starts.
---

```sh
npm run placements -- readiness              # starting in the next 60 days, and running now
npm run placements -- readiness --days=14
```

Order by start date. For each row: the student, the site, the check and what is wrong. A check that runs out during the placement needs renewing before the day it ends, not before the first day. When the evidence arrives, record it with `add-check` and run this again to show the row has gone.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
