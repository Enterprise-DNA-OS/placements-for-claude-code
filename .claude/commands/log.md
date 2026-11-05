---
description: Log a call, email, visit or note against a student or a host.
---

```sh
npm run placements -- log <student> --channel=call --summary="..." --by="Hannah Lee"
npm run placements -- log --host=<host> --channel=email --summary="..." --by="Hannah Lee"
```

Channels: call, email, visit, meeting, sms, note. Keep it to what was agreed and what happens next. Every write needs `--by="<operator's name>"` for the audit log.

Every command takes `--json`. Students match on code, student number, id prefix or part of the name; if the CLI lists several candidates, show them and ask which one. Never answer about a student or a host from memory.
