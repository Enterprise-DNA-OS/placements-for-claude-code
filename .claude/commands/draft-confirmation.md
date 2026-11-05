---
description: Draft the placement confirmation to a student, and the matching note to the host, in drafts/.
---

1. `npm run placements -- show <student>` and `npm run placements -- placements --student=<student>`.
2. `npm run docs -- placement-confirmation` writes the branded confirmation for every live placement into `docs-out/placement-confirmation/`. Point the operator at the student's file.
3. Write `drafts/confirmation-<placement>.md`: a short email to the student (site, address, first and last day, hours, supervisor, the site contact, anything marked ACTION NEEDED) and a second short email to the host contact (who is coming, when, the student's year, that their checks have been sighted or which are to follow).
4. Plain, warm, no jargon. Never send. Never include health details beyond whether a check is ready.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
