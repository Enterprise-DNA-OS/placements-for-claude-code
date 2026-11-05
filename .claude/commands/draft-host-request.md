---
description: Draft a request to a host for places in a coming round, in drafts/.
---

1. `npm run placements -- capacity`, `npm run placements -- sites` and `npm run placements -- outcomes` for that host. Read its `log` notes.
2. Write `drafts/host-request-<org code>.md` to the host contact: the round, the dates, the programme and year level, how many students, the hours each needs, and one specific line about how past students went at their site (from `outcomes`).
3. If the agreement or insurance is ending (`agreements`), add one line asking for the renewal or the new certificate.
4. Never send.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
