---
description: Record a check a student has shown evidence for. The expiry is worked out from the requirement unless the certificate says otherwise.
---

```sh
npm run placements -- add-check <student> --check=WWCC --done=2026-10-01 --evidence="WWC1234567E sighted" --by="Hannah Lee"
npm run placements -- add-check <student> --check=flu --done=today --by="Hannah Lee"
npm run placements -- add-check <student> --check=POLICE --done=2026-09-14 --expires=2029-09-14 --by="Hannah Lee"
```

Check codes: POLICE, WWCC, VAX, TB, FLU, CPR, CODE, NDIS (or any part of the name). Only record a check when the operator says the evidence has been sighted. Never mark a check done on a guess. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
