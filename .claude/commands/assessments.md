---
description: Finished placements still waiting on the final assessment, most overdue first, and recording results and the student's rating of the site.
---

```sh
npm run placements -- assessments
npm run placements -- assess <placement> --result=pass --by="Hannah Lee"        # pass, fail or incomplete
npm run placements -- evaluate <placement> --score=4 --by="Hannah Lee"          # the student's rating of the site, 1 to 5
```

For each overdue one, name the supervisor to chase. Only record a result the operator has in front of them. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
