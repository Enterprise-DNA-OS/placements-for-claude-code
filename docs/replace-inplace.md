# Moving off InPlace

Most placement offices can move in a day: export two reports, do a test run, import, then set the checks and agreement dates by asking.

## 1. Export from InPlace

InPlace reports can be exported to CSV or Excel (save Excel as CSV). Every college configures InPlace differently, so the report names vary. You need two:

- **Students**: one row per student. Columns the import reads (any one name per item is enough): `Student ID` / `Student Number`, `Student Name` or `First Name` + `Last Name`, `Email`, `Mobile`, `Course` / `Programme`, `Year Level`, `Campus`.
- **Placements**: one row per placement. Columns: `Placement ID`, `Student ID`, `Agency` / `Organisation` / `Placement Provider`, `Site` / `Unit` / `Ward`, `Supervisor` / `Preceptor`, `Start Date`, `End Date`, `Hours`, `Hours Completed`, `Status`, `Result` / `Outcome`.

Dates in `31/03/2026` or `2026-03-31` both work. Put the files in `imports/` (it is in `.gitignore`).

If your reports use other column names, ask Claude Code to map them: "our placement report calls the host 'Facility' and the dates 'Commence' and 'Conclude'". It adds the names to the import and its test.

## 2. Test run

```sh
npm run placements -- import inplace --students=imports/students.csv --placements=imports/placements.csv --dry-run --by="Your Name"
```

Nothing is saved. It shows how many students, hosts, sites and placements it would add, and lists every row it would skip and why (no id, no dates, a student not in the students file).

## 3. Import

```sh
npm run placements -- import inplace --students=imports/students.csv --placements=imports/placements.csv --by="Your Name"
```

Running it again changes nothing: rows already imported are matched on their InPlace id.

## What comes across

| InPlace | Here |
|---|---|
| Student, number, course, year, campus | `students` (a course that does not exist yet becomes a programme to finish setting up) |
| Agency / organisation | `organisations`, matched by name |
| Site, unit or ward | `sites`, matched by name within the organisation |
| Supervisor or preceptor | `supervisors` at that site |
| Placement dates, hours, status | `placements` (withdrawn, cancelled, confirmed, completed, allocated) |
| Result or outcome | `placements.result` (pass or fail), and the placement is marked completed |
| Hours completed | one signed timesheet row, marked "Imported from InPlace" |

## What does not come across, and how to set it

- **Pre-placement checks.** InPlace stores compliance items in its own document store. Export the compliance report if you have one and ask Claude Code to import it, or record each check with `/add-check` as you sight it. Until then every check shows as missing, which is the safe default.
- **Agreements and insurance.** Record each host's agreement end date and certificate with `/agreements`. The dates are usually in your agreements register or contract system.
- **Programme minimum hours.** Set each programme's `required_hours` and `hours_source` once (`/customise`, "the Bachelor of Nursing needs 800 hours").
- **Rounds and offers.** Past placements arrive without a round. Add the coming rounds with `/add-student` (add-round) and record the places hosts offer with `offer`.
- **Documents and uploaded files.** Certificates, signed agreements and assessment forms stay where they are. Keep a reference to the file in `evidence` or `document_ref`.
- **Student and supervisor logins.** There is no portal: students send evidence to the office and supervisors sign hours by email or on paper. Enterprise DNA builds a portal into your version if you want one.
