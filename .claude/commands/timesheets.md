---
description: Hours waiting for a supervisor to sign them off, oldest first, and recording the sign-off.
---

```sh
npm run placements -- timesheets
npm run placements -- sign-off <placement> --by="Hannah Lee"                                  # every unsigned week
npm run placements -- sign-off <placement> --week=2026-11-01 --supervisor-name="Daniel Fraser" --by="Hannah Lee"
```

Group by supervisor so one message can cover several students. Only record a sign-off when the operator confirms the supervisor has signed. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
