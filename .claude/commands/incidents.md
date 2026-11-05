---
description: Incidents and students at risk: needlestick injuries, falls, conduct concerns and learning plans, whether the host has been told, and closing them.
---

```sh
npm run placements -- incidents --open
npm run placements -- incidents --by-site
npm run placements -- incident <placement> --kind=needlestick --severity=high --on=today --detail="..." --by="Hannah Lee"
npm run placements -- incident <placement> --kind=at_risk --detail="..." --plan="Learning plan: ..." --reported --by="Hannah Lee"
npm run placements -- update-incident <INC-xx> --reported --plan="..." --close --by="Hannah Lee"
```

An incident not yet reported to the host comes first, always. Keep clinical and personal detail out of anything that leaves this folder. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
