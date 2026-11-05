---
description: Bring students, hosts, sites, supervisors and placements across from InPlace report exports. Dry run first.
---

Read `docs/replace-inplace.md` first.

```sh
npm run placements -- import inplace --students=imports/students.csv --placements=imports/placements.csv --dry-run --by="Hannah Lee"
npm run placements -- import inplace --students=imports/students.csv --placements=imports/placements.csv --by="Hannah Lee"
```

Show the dry-run counts and every skipped row with its reason before running it for real. Running it twice changes nothing: rows already imported are matched. Afterwards, run `checks --all` and `agreements`: InPlace compliance items and agreement dates are set by asking, not imported. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
