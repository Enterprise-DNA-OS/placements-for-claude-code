---
description: Place a student at a site for a round. Warns straight away about checks, the host agreement, the supervisor and going over the places offered.
---

```sh
npm run placements -- allocate <student> --round=R-BN3-A --site=SITE-EFP --supervisor=SV-08 --by="Hannah Lee"
npm run placements -- offer <site> --round=R-BN3-A --places=2 --by="Hannah Lee"      # record places a host offered
npm run placements -- confirm <placement> --supervisor=<name> --by="Hannah Lee"      # the host has confirmed
```

Read the `warnings` column back to the operator in plain words and offer the fix for each. A placement over the offered places is allowed but say so: the host has to agree. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
