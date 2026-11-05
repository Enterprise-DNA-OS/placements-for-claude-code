# Compliance rules this placement office checks

`npm run placements -- compliance` checks the records against the rules below. Each rule says where it comes from, what a breach looks like in the data, and which check finds it. The periods live in the `policy` table and the checks each programme needs live in `programme_requirements`, so a college in another state, or in New Zealand, changes a number or a row, not the code.

This is not legal advice. Confirm which rules apply to your programmes and your hosts, then keep this page and the checks in step. If a rule here is out of date, say so and stop: `/compliance` will not guess at law.

## Before a student starts

| # | Rule | What the source says | Breach in the data | Check |
|---|---|---|---|---|
| 1 | Every check the programme requires is current on every day of the placement | **NSW Health PD2026_004**, *Occupational Assessment, Screening and Vaccination Against Specified Infectious Diseases* (www1.health.nsw.gov.au/pds/ActivePDSDocuments/PD2026_004.pdf): students must show evidence of protection against the specified diseases and complete a TB assessment before clinical placement in NSW Health; compliance is recorded in ClinConnect. **Child Protection (Working with Children) Act 2012 (NSW)**: a working with children clearance lasts five years. **NDIS (Practice Standards: Worker Screening) Rules 2018**: a worker screening clearance lasts five years. **Children's Act 2014 (NZ), s 27**: children's workers are safety checked again every three years. Police checks, flu and CPR: the host sets the rule. | A placement starting within `readiness_days` (30), or running now, where a required check is missing, has expired, or runs out before the last day. Due: the same, starting later. | `v_check_status`, `v_readiness`, rule 1 |

Which checks each programme needs, and how long each lasts, are rows in `requirements` and `programme_requirements`, with the source in `requirements.source`. Add a host's own requirement (a mask fit test, a code of conduct form) with `/customise`.

## The host

| # | Rule | Source | Breach in the data | Check |
|---|---|---|---|---|
| 2 | A signed agreement covers every day of every placement | **Higher Education Standards Framework (Threshold Standards) 2021, Standard 5.4**, *Delivery with Other Parties*: where any part of a course, including work-integrated learning and placements, is delivered with another party, there is a written agreement and the arrangement is quality assured. RTOs: the Standards for RTOs require the same of third-party arrangements. | A live placement with no signed agreement, or one that ends before the placement does. Two back-to-back agreements (the old one and its renewal) count as cover. Due: an agreement ending within `agreement_warn_days` (90). | `v_agreements`, `v_agreement_gaps`, rule 2 |
| 3 | The host's insurance certificate is current while students are placed | Your placement agreement: each party holds public liability and professional indemnity cover and gives the other a current certificate. | A certificate end date in the past. Due: ending within 30 days. | `v_agreements`, rule 3 |
| 4 | A named supervisor, trained in the last `supervisor_training_years` (3), for every placement | **HESF 2021, Standard 5.4.2**: the quality of supervision of student activities is assured. **ANMAC accreditation standards** (anmac.org.au): professional experience is supervised by qualified, registered staff. | A placement starting within `readiness_days`, or running, with no supervisor or a supervisor with no training on record. Due: training older than the policy allows. | `v_supervision_gaps`, rule 4 |

## Hours

| # | Rule | Source | Breach in the data | Check |
|---|---|---|---|---|
| 5 | Final-year students reach the programme's minimum placement hours | **ANMAC Registered Nurse Accreditation Standards 2019**: at least 800 hours of professional experience placement, simulation excluded. **ANMAC Enrolled Nurse Accreditation Standards**: at least 400 hours. **Nursing Council of New Zealand**, education standards confirmed in 2024: at least 1,000 clinical hours for a registered nurse programme, 700 for enrolled nurses. **CHC33021 Certificate III in Individual Support** assessment requirements: at least 120 hours of work. The number and its source live on each programme (`required_hours`, `hours_source`). | A student in the programme's final year whose signed hours, unsigned hours and hours still planned add up to less than the minimum. | `v_hours`, rule 5 |
| 6 | Hours signed off within `signoff_days` (7) | Your office standard: only signed hours count, and a supervisor remembers a week, not a term. | A week of hours unsigned for longer than the policy allows. Due: unsigned, still inside it. | `v_unsigned_hours`, rule 6 |

## During and after

| # | Rule | Source | Breach in the data | Check |
|---|---|---|---|---|
| 7 | Incidents reported to the host within `incident_report_days` (1) | Your placement agreement and the host's incident policy. **Work Health and Safety Act 2011**: a student on placement is a worker for the host's WHS duties, so the host needs to know the same day. | An incident with no `reported_to_site_on` after more than the policy allows. | `v_incidents`, rule 7 |
| 8 | The final assessment is back within `assessment_days` (14) of the placement ending | Your office standard: results are released on time and the appeal window is protected. | A finished placement with no result after the due date. Due: inside it. | `v_assessments_due`, rule 8 |

## Records

Placement records, checks and incidents are personal information. Keep them in this database and this folder. Australian Privacy Principle 11 and New Zealand Information Privacy Principle 9 say not to keep personal information longer than it is needed: set your retention period with `/customise` if your college has one. Nothing here deletes a record.
