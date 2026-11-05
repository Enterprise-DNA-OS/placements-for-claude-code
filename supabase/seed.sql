-- Demo placement office for a nursing and care college in Sydney. Synthetic names throughout.
-- Dates are relative to today, so there is always a check running out, an agreement ending,
-- a student short of hours, an assessment late and an incident nobody has reported.
-- Idempotent: runs once, then does nothing if the demo programme already exists.
do $$
begin
  if exists (select 1 from programmes where code = 'BN') then
    return;
  end if;

  insert into programmes (code, name, discipline, qualification, final_year, required_hours, hours_source) values
    ('BN', 'Bachelor of Nursing', 'nursing', 'Registered nurse', 3, 800, 'ANMAC Registered Nurse Accreditation Standards 2019: at least 800 hours of professional experience placement, simulation excluded'),
    ('DIPN', 'Diploma of Nursing', 'nursing', 'Enrolled nurse', 2, 400, 'ANMAC Enrolled Nurse Accreditation Standards: at least 400 hours of professional experience placement'),
    ('C3IS', 'Certificate III in Individual Support', 'aged and disability care', 'Support worker', 1, 120, 'CHC33021 assessment requirements: at least 120 hours of work in a care setting');

  insert into requirements (code, name, valid_months, source) values
    ('POLICE', 'National police check', 36, 'Host health service requirement; validity set by the host (change it with /customise)'),
    ('WWCC', 'Working with children check', 60, 'Child Protection (Working with Children) Act 2012 (NSW): a clearance lasts five years'),
    ('VAX', 'Vaccination evidence (Category A)', null, 'NSW Health PD2026_004, Occupational Assessment, Screening and Vaccination Against Specified Infectious Diseases'),
    ('TB', 'TB assessment', null, 'NSW Health PD2026_004 (TB assessment before the first clinical placement)'),
    ('FLU', 'Influenza vaccination, this season', 12, 'Host health service requirement for the current flu season'),
    ('CPR', 'CPR certificate', 12, 'Host requirement; Australian Resuscitation Council guidance is to refresh CPR every year'),
    ('CODE', 'NSW Health code of conduct agreement', null, 'HETI student compliance: signed code of conduct before placement'),
    ('NDIS', 'NDIS worker screening clearance', 60, 'NDIS (Practice Standards: Worker Screening) Rules 2018: a clearance lasts five years');

  insert into programme_requirements (programme_id, requirement_id)
  select p.id, q.id from programmes p join requirements q on q.code in ('POLICE', 'WWCC', 'VAX', 'TB', 'FLU', 'CPR', 'CODE') where p.code in ('BN', 'DIPN')
  union all
  select p.id, q.id from programmes p join requirements q on q.code in ('POLICE', 'WWCC', 'VAX', 'FLU', 'CPR', 'NDIS') where p.code = 'C3IS';

  insert into students (code, name, email, phone, programme_id, year_level, campus, student_number, notes)
  select v.code, v.name, v.email, v.phone, p.id, v.yr, v.campus, v.num, v.notes
  from (values
    ('ST-1001', 'Chloe Nguyen', 'chloe.nguyen@example.invalid', '0400 100 001', 'BN', 3, 'Sydney', 'SCH24001', 'Missed two weeks of her last block with glandular fever.'),
    ('ST-1002', 'Liam O''Brien', 'liam.obrien@example.invalid', '0400 100 002', 'BN', 3, 'Sydney', 'SCH24002', null),
    ('ST-1003', 'Priya Raman', 'priya.raman@example.invalid', '0400 100 003', 'BN', 3, 'Parramatta', 'SCH24003', 'Asked for a placement close to Parramatta: carer for a parent.'),
    ('ST-1004', 'Mateo Silva', 'mateo.silva@example.invalid', '0400 100 004', 'BN', 3, 'Sydney', 'SCH24004', null),
    ('ST-1005', 'Grace Kim', 'grace.kim@example.invalid', '0400 100 005', 'BN', 2, 'Sydney', 'SCH25005', null),
    ('ST-1006', 'Noah Williams', 'noah.williams@example.invalid', '0400 100 006', 'BN', 2, 'Sydney', 'SCH25006', null),
    ('ST-1007', 'Isla Thompson', 'isla.thompson@example.invalid', '0400 100 007', 'BN', 2, 'Sydney', 'SCH25007', null),
    ('ST-1008', 'Ethan Patel', 'ethan.patel@example.invalid', '0400 100 008', 'BN', 2, 'Parramatta', 'SCH25008', 'Withdrew from the emergency placement in week one; wants a ward placement.'),
    ('ST-1009', 'Mia Robinson', 'mia.robinson@example.invalid', '0400 100 009', 'DIPN', 2, 'Sydney', 'SCH25009', null),
    ('ST-1010', 'Jack Henderson', 'jack.henderson@example.invalid', '0400 100 010', 'DIPN', 2, 'Sydney', 'SCH25010', null),
    ('ST-1011', 'Zara Ahmed', 'zara.ahmed@example.invalid', '0400 100 011', 'DIPN', 2, 'Parramatta', 'SCH25011', null),
    ('ST-1012', 'Oliver Brown', 'oliver.brown@example.invalid', '0400 100 012', 'C3IS', 1, 'Sydney', 'SCH26012', null),
    ('ST-1013', 'Ruby Wilson', 'ruby.wilson@example.invalid', '0400 100 013', 'C3IS', 1, 'Sydney', 'SCH26013', null),
    ('ST-1014', 'Lucas Martin', 'lucas.martin@example.invalid', '0400 100 014', 'C3IS', 1, 'Sydney', 'SCH26014', null)
  ) v(code, name, email, phone, prog, yr, campus, num, notes)
  join programmes p on p.code = v.prog;

  -- Every student starts with every check current, then the exceptions below.
  insert into student_checks (student_id, requirement_id, completed_on, expires_on, evidence, verified_by, verified_on)
  select s.id, q.id, current_date - 200,
         case when q.valid_months is null then null else (current_date - 200 + make_interval(months => q.valid_months))::date end,
         'Uploaded to the student file', 'Hannah Lee', current_date - 195
  from students s join programme_requirements pr on pr.programme_id = s.programme_id join requirements q on q.id = pr.requirement_id;

  update student_checks set expires_on = current_date - 20, completed_on = current_date - 385
  where student_id = (select id from students where code = 'ST-1002') and requirement_id = (select id from requirements where code = 'FLU');
  update student_checks set expires_on = current_date + 35, completed_on = current_date - 1790
  where student_id = (select id from students where code = 'ST-1004') and requirement_id = (select id from requirements where code = 'WWCC');
  delete from student_checks
  where student_id = (select id from students where code = 'ST-1009') and requirement_id = (select id from requirements where code = 'POLICE');
  update student_checks set expires_on = current_date + 10, completed_on = current_date - 355
  where student_id = (select id from students where code = 'ST-1011') and requirement_id = (select id from requirements where code = 'CPR');
  update student_checks set expires_on = current_date + 12, completed_on = current_date - 353
  where student_id = (select id from students where code = 'ST-1005') and requirement_id = (select id from requirements where code = 'CPR');

  insert into organisations (code, name, kind, region, contact_name, contact_email, phone) values
    ('ORG-01', 'Northern Harbour Local Health District', 'hospital', 'North Sydney', 'Sandra Collins, Clinical Placement Coordinator', 'placements@nhlhd.example.invalid', '02 5550 4100'),
    ('ORG-02', 'Wattle Grove Aged Care', 'aged_care', 'Lane Cove', 'Peter Nash, Care Manager', 'peter.nash@wattlegrove.example.invalid', '02 5550 4200'),
    ('ORG-03', 'Bayside Community Health', 'community', 'Rockdale', 'Meera Shah, Nurse Unit Manager', 'meera.shah@bayside.example.invalid', '02 5550 4300'),
    ('ORG-04', 'Coastal Disability Services', 'disability', 'Dee Why', 'Josh Reid, Service Manager', 'josh.reid@coastalds.example.invalid', '02 5550 4400'),
    ('ORG-05', 'St Columba Private Hospital', 'hospital', 'Randwick', 'Fiona Burke, Nurse Educator', 'fiona.burke@stcolumba.example.invalid', '02 5550 4500'),
    ('ORG-06', 'Eastside Family Practice', 'primary_care', 'Parramatta', 'Dr Alan Wu, Practice Principal', 'alan.wu@eastside.example.invalid', '02 5550 4600');

  insert into sites (code, organisation_id, name, discipline, suburb)
  select v.code, o.id, v.name, v.disc, v.suburb from (values
    ('SITE-7B', 'ORG-01', 'Royal Harbour Hospital, Ward 7B Surgical', 'nursing', 'St Leonards'),
    ('SITE-9A', 'ORG-01', 'Royal Harbour Hospital, Ward 9A Medical', 'nursing', 'St Leonards'),
    ('SITE-ED', 'ORG-01', 'Royal Harbour Hospital, Emergency Department', 'nursing', 'St Leonards'),
    ('SITE-WG', 'ORG-02', 'Wattle Grove, Lane Cove home', 'nursing', 'Lane Cove'),
    ('SITE-BCN', 'ORG-03', 'Bayside Community Nursing', 'nursing', 'Rockdale'),
    ('SITE-CSL', 'ORG-04', 'Coastal Supported Living, Dee Why', 'aged and disability care', 'Dee Why'),
    ('SITE-SCM', 'ORG-05', 'St Columba, Medical Ward', 'nursing', 'Randwick'),
    ('SITE-EFP', 'ORG-06', 'Eastside Family Practice, treatment room', 'nursing', 'Parramatta')
  ) v(code, org, name, disc, suburb) join organisations o on o.code = v.org;

  insert into agreements (code, organisation_id, status, sent_on, starts_on, expires_on, insurance_expires_on, document_ref, note)
  select v.code, o.id, v.status, v.sent, v.starts, v.expires, v.ins, v.doc, v.note from (values
    ('AG-01', 'ORG-01', 'signed', current_date - 720, current_date - 700, current_date + 400, current_date + 200, 'Agreements/NHLHD-2025.pdf', null),
    ('AG-02', 'ORG-02', 'signed', current_date - 1100, current_date - 1080, current_date + 20, current_date + 100, 'Agreements/WattleGrove-2023.pdf', null),
    ('AG-03', 'ORG-03', 'signed', current_date - 1150, current_date - 1135, current_date - 40, current_date + 60, 'Agreements/Bayside-2023.pdf', null),
    ('AG-07', 'ORG-03', 'sent', current_date - 50, null, null, null, null, 'Renewal sent to Meera Shah; with their legal team'),
    ('AG-04', 'ORG-04', 'signed', current_date - 320, current_date - 300, current_date + 765, current_date - 10, 'Agreements/Coastal-2026.pdf', null),
    ('AG-05', 'ORG-05', 'signed', current_date - 920, current_date - 900, current_date + 195, current_date + 150, 'Agreements/StColumba-2024.pdf', null),
    ('AG-06', 'ORG-06', 'signed', current_date - 70, current_date - 60, current_date + 1035, current_date + 300, 'Agreements/Eastside-2026.pdf', null)
  ) v(code, org, status, sent, starts, expires, ins, doc, note) join organisations o on o.code = v.org;

  insert into supervisors (code, name, site_id, role, email, registration_number, trained_on)
  select v.code, v.name, s.id, v.role, v.email, v.reg, v.trained from (values
    ('SV-01', 'Karen Mitchell', 'SITE-7B', 'Clinical nurse specialist', 'karen.mitchell@nhlhd.example.invalid', 'NMW0001110001', current_date - 400),
    ('SV-02', 'Daniel Fraser', 'SITE-ED', 'Clinical nurse educator', 'daniel.fraser@nhlhd.example.invalid', 'NMW0001110002', current_date - 200),
    ('SV-03', 'Linh Tran', 'SITE-WG', 'Registered nurse', 'linh.tran@wattlegrove.example.invalid', 'NMW0001110003', null),
    ('SV-04', 'Michael Osei', 'SITE-BCN', 'Community nurse', 'michael.osei@bayside.example.invalid', 'NMW0001110004', current_date - 300),
    ('SV-05', 'Rebecca Hall', 'SITE-9A', 'Registered nurse', 'rebecca.hall@nhlhd.example.invalid', 'NMW0001110005', current_date - 1500),
    ('SV-06', 'Tom Gallagher', 'SITE-CSL', 'Team leader', 'tom.gallagher@coastalds.example.invalid', null, current_date - 100),
    ('SV-07', 'Anna Kowalski', 'SITE-SCM', 'Nurse educator', 'anna.kowalski@stcolumba.example.invalid', 'NMW0001110007', current_date - 700),
    ('SV-08', 'Sione Taufa', 'SITE-EFP', 'Practice nurse', 'sione.taufa@eastside.example.invalid', 'NMW0001110008', current_date - 60)
  ) v(code, name, site, role, email, reg, trained) join sites s on s.code = v.site;

  insert into rounds (code, programme_id, year_level, name, starts_on, ends_on, hours)
  select v.code, p.id, v.yr, v.name, v.starts, v.ends, v.hours from (values
    ('R-BN1-A', 'BN', 1, 'BN year 1 block', current_date - 520, current_date - 478, 240),
    ('R-BN2-A', 'BN', 2, 'BN year 2 first block', current_date - 400, current_date - 373, 160),
    ('R-BN2-B', 'BN', 2, 'BN year 2 second block', current_date - 200, current_date - 159, 240),
    ('R-BN2-C', 'BN', 2, 'BN year 2 block', current_date - 10, current_date + 17, 152),
    ('R-BN3-A', 'BN', 3, 'BN year 3 block', current_date + 21, current_date + 48, 160),
    ('R-DN1-A', 'DIPN', 1, 'Diploma year 1 block', current_date - 300, current_date - 252, 280),
    ('R-DN2-A', 'DIPN', 2, 'Diploma year 2 block', current_date + 12, current_date + 33, 120),
    ('R-C3-A', 'C3IS', 1, 'Certificate III work placement', current_date - 48, current_date - 20, 120)
  ) v(code, prog, yr, name, starts, ends, hours) join programmes p on p.code = v.prog;

  insert into offers (code, site_id, round_id, places, received_on, status)
  select v.code, s.id, r.id, v.places, r.starts_on - 60, 'offered' from (values
    ('OF-01', 'SITE-SCM', 'R-BN1-A', 4), ('OF-02', 'SITE-7B', 'R-BN1-A', 2),
    ('OF-03', 'SITE-SCM', 'R-BN2-A', 4),
    ('OF-04', 'SITE-7B', 'R-BN2-B', 2), ('OF-05', 'SITE-9A', 'R-BN2-B', 2),
    ('OF-06', 'SITE-7B', 'R-BN2-C', 1), ('OF-07', 'SITE-ED', 'R-BN2-C', 2), ('OF-08', 'SITE-WG', 'R-BN2-C', 1),
    ('OF-09', 'SITE-7B', 'R-BN3-A', 2), ('OF-10', 'SITE-BCN', 'R-BN3-A', 1),
    ('OF-11', 'SITE-9A', 'R-DN1-A', 3),
    ('OF-12', 'SITE-WG', 'R-DN2-A', 1), ('OF-13', 'SITE-9A', 'R-DN2-A', 1), ('OF-14', 'SITE-EFP', 'R-DN2-A', 1),
    ('OF-15', 'SITE-CSL', 'R-C3-A', 3)
  ) v(code, site, rnd, places) join sites s on s.code = v.site join rounds r on r.code = v.rnd;

  -- Placements: history for the final-year students, the blocks running now, and the next ones.
  insert into placements (code, student_id, round_id, site_id, supervisor_id, starts_on, ends_on, planned_hours, status, confirmed_on, result, assessed_on, evaluation_score, evaluation_on, note)
  select v.code, st.id, r.id, si.id, sv.id, r.starts_on, r.ends_on, r.hours, v.status,
         case when v.status <> 'allocated' then r.starts_on - 21 end,
         v.result, case when v.result is not null then r.ends_on + 9 end,
         v.eval, case when v.eval is not null then r.ends_on + 3 end, v.note
  from (values
    ('PL-001', 'ST-1001', 'R-BN1-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 3, null),
    ('PL-002', 'ST-1002', 'R-BN1-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 3, null),
    ('PL-003', 'ST-1003', 'R-BN1-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 2, null),
    ('PL-004', 'ST-1004', 'R-BN1-A', 'SITE-7B', 'SV-01', 'completed', 'pass', 5, null),
    ('PL-005', 'ST-1001', 'R-BN2-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 3, null),
    ('PL-006', 'ST-1002', 'R-BN2-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 3, null),
    ('PL-007', 'ST-1003', 'R-BN2-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 3, null),
    ('PL-008', 'ST-1004', 'R-BN2-A', 'SITE-SCM', 'SV-07', 'completed', 'pass', 4, null),
    ('PL-009', 'ST-1001', 'R-BN2-B', 'SITE-7B', 'SV-01', 'completed', 'pass', 5, 'Two weeks sick leave; 160 of 240 hours'),
    ('PL-010', 'ST-1002', 'R-BN2-B', 'SITE-7B', 'SV-01', 'completed', 'pass', 5, null),
    ('PL-011', 'ST-1003', 'R-BN2-B', 'SITE-9A', 'SV-05', 'completed', 'pass', 4, null),
    ('PL-012', 'ST-1004', 'R-BN2-B', 'SITE-9A', 'SV-05', 'completed', 'pass', 4, null),
    ('PL-013', 'ST-1009', 'R-DN1-A', 'SITE-9A', 'SV-05', 'completed', 'pass', 4, null),
    ('PL-014', 'ST-1010', 'R-DN1-A', 'SITE-9A', 'SV-05', 'completed', 'pass', 4, null),
    ('PL-015', 'ST-1011', 'R-DN1-A', 'SITE-9A', 'SV-05', 'completed', 'pass', 5, null),
    ('PL-016', 'ST-1012', 'R-C3-A', 'SITE-CSL', 'SV-06', 'confirmed', null, null, null),
    ('PL-017', 'ST-1013', 'R-C3-A', 'SITE-CSL', 'SV-06', 'completed', 'pass', 4, null),
    ('PL-018', 'ST-1014', 'R-C3-A', 'SITE-CSL', 'SV-06', 'completed', 'fail', 2, 'Did not meet the conduct standard; 80 of 120 hours'),
    ('PL-019', 'ST-1005', 'R-BN2-C', 'SITE-7B', 'SV-01', 'confirmed', null, null, null),
    ('PL-020', 'ST-1006', 'R-BN2-C', 'SITE-WG', 'SV-03', 'confirmed', null, null, null),
    ('PL-021', 'ST-1007', 'R-BN2-C', 'SITE-ED', 'SV-02', 'confirmed', null, null, null),
    ('PL-022', 'ST-1008', 'R-BN2-C', 'SITE-ED', 'SV-02', 'withdrawn', null, null, 'Withdrew in week one'),
    ('PL-023', 'ST-1001', 'R-BN3-A', 'SITE-7B', 'SV-01', 'confirmed', null, null, null),
    ('PL-024', 'ST-1002', 'R-BN3-A', 'SITE-7B', 'SV-01', 'confirmed', null, null, null),
    ('PL-025', 'ST-1004', 'R-BN3-A', 'SITE-BCN', 'SV-04', 'allocated', null, null, null),
    ('PL-026', 'ST-1009', 'R-DN2-A', 'SITE-WG', null, 'allocated', null, null, null),
    ('PL-027', 'ST-1010', 'R-DN2-A', 'SITE-9A', 'SV-05', 'confirmed', null, null, null)
  ) v(code, stu, rnd, site, sup, status, result, eval, note)
  join students st on st.code = v.stu join rounds r on r.code = v.rnd join sites si on si.code = v.site
  left join supervisors sv on sv.code = v.sup;

  -- Finished blocks: one signed timesheet for the block. Chloe and Lucas logged less than planned.
  insert into timesheets (placement_id, week_ending, hours, submitted_on, signed_off_by, signed_off_on)
  select x.id, x.ends_on,
         case x.code when 'PL-009' then 160 when 'PL-018' then 80 else x.planned_hours end,
         x.ends_on, coalesce(sv.name, 'Site supervisor'), x.ends_on + 2
  from placements x left join supervisors sv on sv.id = x.supervisor_id
  where x.status = 'completed' or x.code = 'PL-016';

  -- The blocks running now, a week at a time.
  insert into timesheets (placement_id, week_ending, hours, submitted_on, signed_off_by, signed_off_on)
  select x.id, current_date + v.we, v.hours, current_date + v.sub, v.who, case when v.signed is not null then current_date + v.signed end
  from (values
    ('PL-019', -4, 38.0, -3, 'Karen Mitchell', -2),
    ('PL-020', -4, 38.0, -3, 'Linh Tran', -3),
    ('PL-021', -11, 36.0, -11, null, null),
    ('PL-021', -4, 38.0, -4, null, null)
  ) v(pl, we, hours, sub, who, signed) join placements x on x.code = v.pl;

  insert into incidents (code, placement_id, occurred_on, kind, severity, reported_to_site_on, plan, closed_on, detail)
  select v.code, x.id, current_date + v.occ, v.kind, v.sev, case when v.rep is not null then current_date + v.rep end, v.plan,
         case when v.closed is not null then current_date + v.closed end, v.detail
  from (values
    ('INC-01', 'PL-021', -3, 'needlestick', 'high', null, null, null, 'Needlestick from a used cannula while clearing a tray. First aid given; told her facilitator by phone.'),
    ('INC-02', 'PL-020', -6, 'at_risk', 'medium', -6, 'Learning plan agreed with Linh Tran: medication rounds supervised daily, review at end of week 3.', null, 'Medication calculation errors on two rounds.'),
    ('INC-03', 'PL-018', -30, 'conduct', 'medium', -30, 'Met with Tom Gallagher and the trainer; placement ended early.', -22, 'Repeated late arrival and phone use during personal care.')
  ) v(code, pl, occ, kind, sev, rep, plan, closed, detail) join placements x on x.code = v.pl;

  insert into contacts_log (student_id, organisation_id, logged_on, channel, by_name, summary)
  select st.id, o.id, current_date + v.on_day, v.ch, 'Hannah Lee', v.summary from (values
    ('ST-1003', null, -9, 'call', 'Priya can do any site within 30 minutes of Parramatta. Waiting on Westmead and Eastside.'),
    (null, 'ORG-03', -12, 'email', 'Chased Meera Shah about the renewed agreement. Legal still reviewing the insurance clause.'),
    ('ST-1008', null, -5, 'meeting', 'Ethan withdrew from ED after week one. Wants a ward placement next round; no concerns about conduct.'),
    (null, 'ORG-05', -60, 'call', 'Fiona Burke says St Columba is taking university students only this year. Asked to be kept in mind for 2027.')
  ) v(stu, org, on_day, ch, summary)
  left join students st on st.code = v.stu left join organisations o on o.code = v.org;
end
$$;
