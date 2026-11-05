---
description: Students still waiting for a placement next to the places hosts have offered and nobody has filled, round by round.
---

```sh
npm run placements -- capacity
npm run placements -- rounds
npm run placements -- sites --quiet      # hosts that offered places last year and none this year
```

Pair them up: for each waiting student, suggest the open places in the same round that suit their campus and any notes on their record (`show <student>`). Do not allocate until the operator says which pairing; then use `/allocate`. If there are more students than places, list the hosts to ask (`/draft-host-request`), quiet hosts first.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
