---
description: Host organisations: places offered this year against last, which hosts have gone quiet, and how placements turned out at each site.
---

```sh
npm run placements -- sites
npm run placements -- sites --quiet
npm run placements -- outcomes
npm run placements -- add-host --name="Kingsway Rehabilitation" --kind=hospital --contact="Jo Park" --site="Rehab Ward 2" --by="Hannah Lee"
npm run placements -- add-site <host> --name="Hydrotherapy" --by="Hannah Lee"
```

When a host has gone quiet, read its notes (`log` entries) before suggesting what to say. In `outcomes`, a site with low student ratings or several incidents is worth a conversation with its contact.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
