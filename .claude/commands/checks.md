---
description: Pre-placement checks that are missing, expired or running out: police checks, working with children, vaccinations, TB, flu, CPR, code of conduct, NDIS screening.
---

```sh
npm run placements -- checks                       # missing, expired, or ending in the next 30 days
npm run placements -- checks --expiring=60
npm run placements -- checks --student=robinson   # every check for one student
npm run placements -- checks --all                 # the whole register
```

Group by student. For each one say whether a placement is affected (run `readiness` if unsure). Offer to draft a reminder with `/draft-check-reminder`. The source of each requirement is in `requirements.source` and `docs/compliance.md`.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
