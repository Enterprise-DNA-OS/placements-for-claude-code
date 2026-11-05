---
description: Add a student, a placement round, or places a host has offered.
---

```sh
npm run placements -- add-student --name="Tama Rangi" --programme=BN --year=2 --campus=Sydney --number=SCH26201 --email=... --by="Hannah Lee"
npm run placements -- add-round --programme=BN --year=3 --name="BN year 3 block" --starts=2027-03-01 --ends=2027-03-26 --hours=160 --by="Hannah Lee"
npm run placements -- offer <site> --round=<round> --places=2 --by="Hannah Lee"
```

A new student starts with every check missing. Say so and offer `/checks` next. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
