---
description: Host agreements: when each one ends, the insurance certificate, renewals in progress, and placements booked past the end.
---

```sh
npm run placements -- agreements
npm run placements -- agreements --ending=90
npm run placements -- agreement <host> --status=sent --by="Hannah Lee"                                  # renewal sent
npm run placements -- agreement <host> --status=signed --starts=2026-12-01 --expires=2029-11-30 --insurance=2027-06-30 --by="Hannah Lee"
npm run placements -- insurance <host> --until=2027-06-30 --by="Hannah Lee"
```

Lead with any host where `past end` shows placements at risk: those students cannot start or finish without a signed renewal. Signing completes a pending renewal rather than adding a second row. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
