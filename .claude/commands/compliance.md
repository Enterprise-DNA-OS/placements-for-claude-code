---
description: Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited.
---

1. Read `docs/compliance.md`. Each rule has a name, the source it comes from, what a breach looks like in the data, and the check that finds it.
2. Run `npm run placements -- compliance` for the summary and `npm run placements -- compliance --detail` for every item. Every rule in the doc has a check in `complianceChecks` in `scripts/placements.mjs`.
3. Report as a table: rule, count, the worst example (student or host and date), the source. Order by severity: breached first, then due soon, then clean.
4. For anything breached, draft the fix the operator can approve: the record to update (`add-check`, `agreement`, `insurance`, `trained`, `confirm --supervisor`, `update-incident --reported`, `sign-off`, `assess`), the reminder or request to draft (to `drafts/`, never sent), or who it is waiting on.
5. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law or at a host's requirements. The operator confirms the rule, then you update the doc and the check together.

Nothing here is legal advice. The doc records the rules the college has told the system to enforce, with sources, and this command checks the data against them.
