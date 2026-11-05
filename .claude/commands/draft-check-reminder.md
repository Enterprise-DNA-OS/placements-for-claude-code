---
description: Draft a reminder to a student whose pre-placement check is missing or running out, in drafts/.
---

1. `npm run placements -- checks --student=<student>` and `npm run placements -- readiness`.
2. Write `drafts/check-reminder-<student code>.md`: which check, why it matters for their placement (the site and the date), the date it must be renewed by, and how to send the evidence. One paragraph. Friendly and firm.
3. If several students need the same check, offer one draft per student, never one email with everyone in To.
4. Never send.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
