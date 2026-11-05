---
description: Placements by round, site or student: who is where, with which supervisor, and what stage each is at.
---

```sh
npm run placements -- placements                     # live: upcoming, on placement, or waiting on an assessment
npm run placements -- placements --round=R-BN3-A
npm run placements -- placements --site=SITE-7B
npm run placements -- placements --student=nguyen --all
npm run placements -- rounds                         # rounds with places offered, placed and waiting
```

Flag any placement with no supervisor. Writes: `confirm <placement> --supervisor=<name>`, `withdraw <placement> --reason="..."` (add `--cancel` when the host pulled out).

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
