-- Placements for Claude Code: the placement office of a college, training provider or school of nursing.
-- Programmes and the hours each must reach, the pre-placement checks each programme needs,
-- students and the checks they hold, host organisations and their sites, the agreements behind them,
-- supervisors, placement rounds, places offered, placements, hours, assessments, site evaluations
-- and incidents. Plain Postgres. Runs the same on PGlite.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- Office rules the views read. Change a value here, every view and check follows.
create table policy (
  key text primary key,
  value integer not null,
  note text not null
);

insert into policy (key, value, note) values
  ('readiness_days', 30, 'A placement starting within this many days must have every check, the agreement and a supervisor in place'),
  ('check_warn_days', 30, 'Warn when a check runs out within this many days'),
  ('agreement_warn_days', 90, 'Warn when a host agreement ends within this many days'),
  ('assessment_days', 14, 'The final assessment is due this many days after a placement ends'),
  ('signoff_days', 7, 'A supervisor signs off a week of hours within this many days'),
  ('incident_report_days', 1, 'An incident is reported to the host within this many days'),
  ('supervisor_training_years', 3, 'Supervisor (preceptor) training counts for this many years');

create table programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  discipline text not null,
  qualification text,
  final_year integer not null default 3,
  required_hours integer not null default 0,
  hours_source text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The checks a student must hold before placement: police check, working with children, vaccinations, CPR.
create table requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  valid_months integer,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table programme_requirements (
  programme_id uuid not null references programmes(id),
  requirement_id uuid not null references requirements(id),
  primary key (programme_id, requirement_id)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text,
  phone text,
  programme_id uuid not null references programmes(id),
  year_level integer not null default 1,
  campus text,
  status text not null default 'active' check (status in ('active', 'on_hold', 'withdrawn', 'graduated')),
  student_number text,
  source_ref text unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every check a student has shown evidence for. The latest one per requirement counts.
create table student_checks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  requirement_id uuid not null references requirements(id),
  completed_on date not null,
  expires_on date,
  evidence text,
  verified_by text,
  verified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organisations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'hospital' check (kind in ('hospital', 'aged_care', 'community', 'primary_care', 'disability', 'private_practice', 'school', 'other')),
  region text,
  contact_name text,
  contact_email text,
  phone text,
  active boolean not null default true,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A ward, unit, clinic or team inside a host organisation that takes students.
create table sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  organisation_id uuid not null references organisations(id),
  name text not null,
  discipline text,
  suburb text,
  active boolean not null default true,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The written agreement with a host organisation, and the insurance certificate it asks for.
create table agreements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  organisation_id uuid not null references organisations(id),
  status text not null default 'signed' check (status in ('draft', 'sent', 'signed', 'ended')),
  sent_on date,
  starts_on date,
  expires_on date,
  insurance_expires_on date,
  document_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table supervisors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  site_id uuid references sites(id),
  role text,
  email text,
  registration_number text,
  trained_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A placement block for one programme and year level.
create table rounds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  programme_id uuid not null references programmes(id),
  year_level integer not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  hours integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- Places a site has offered for a round.
create table offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  site_id uuid not null references sites(id),
  round_id uuid not null references rounds(id),
  places integer not null check (places >= 0),
  received_on date,
  status text not null default 'offered' check (status in ('requested', 'offered', 'withdrawn')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table placements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_id uuid not null references students(id),
  round_id uuid references rounds(id),
  site_id uuid not null references sites(id),
  supervisor_id uuid references supervisors(id),
  starts_on date not null,
  ends_on date not null,
  planned_hours integer not null default 0,
  status text not null default 'allocated' check (status in ('allocated', 'confirmed', 'completed', 'withdrawn', 'cancelled')),
  confirmed_on date,
  result text check (result in ('pass', 'fail', 'incomplete')),
  assessed_on date,
  evaluation_score integer check (evaluation_score between 1 and 5),
  evaluation_on date,
  source_ref text unique,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- Hours a student logged, usually a week at a time, and the supervisor's sign-off.
create table timesheets (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references placements(id),
  week_ending date not null,
  hours numeric(6, 1) not null check (hours >= 0),
  submitted_on date not null default current_date,
  signed_off_by text,
  signed_off_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Needlestick injuries, falls, conduct concerns and students at risk of not passing.
create table incidents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  placement_id uuid not null references placements(id),
  occurred_on date not null,
  kind text not null check (kind in ('needlestick', 'injury', 'conduct', 'near_miss', 'at_risk', 'other')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  reported_to_site_on date,
  plan text,
  closed_on date,
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  organisation_id uuid references organisations(id),
  logged_on date not null default current_date,
  channel text not null default 'note' check (channel in ('call', 'email', 'visit', 'meeting', 'sms', 'note')),
  by_name text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table audit (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity text not null,
  ref text,
  detail jsonb
);

create trigger touch_programmes before update on programmes for each row execute function touch_updated_at();
create trigger touch_requirements before update on requirements for each row execute function touch_updated_at();
create trigger touch_students before update on students for each row execute function touch_updated_at();
create trigger touch_student_checks before update on student_checks for each row execute function touch_updated_at();
create trigger touch_organisations before update on organisations for each row execute function touch_updated_at();
create trigger touch_sites before update on sites for each row execute function touch_updated_at();
create trigger touch_agreements before update on agreements for each row execute function touch_updated_at();
create trigger touch_supervisors before update on supervisors for each row execute function touch_updated_at();
create trigger touch_rounds before update on rounds for each row execute function touch_updated_at();
create trigger touch_offers before update on offers for each row execute function touch_updated_at();
create trigger touch_placements before update on placements for each row execute function touch_updated_at();
create trigger touch_timesheets before update on timesheets for each row execute function touch_updated_at();
create trigger touch_incidents before update on incidents for each row execute function touch_updated_at();

create index on student_checks (student_id, requirement_id, completed_on desc);
create index on placements (student_id);
create index on placements (site_id, starts_on);
create index on timesheets (placement_id);

-- ---------------------------------------------------------------- views

-- Placements with names, and where each one is today.
create view v_placements as
select x.id, x.code, s.id as student_id, s.code as student_code, s.name as student, pg.code as programme, s.year_level,
       r.code as round_code, r.name as round, si.code as site_code, si.name as site, o.id as organisation_id, o.code as org_code, o.name as organisation,
       sv.code as supervisor_code, sv.name as supervisor, sv.trained_on as supervisor_trained_on,
       x.starts_on, x.ends_on, x.planned_hours, x.status, x.confirmed_on, x.result, x.assessed_on, x.evaluation_score,
       case
         when x.status in ('withdrawn', 'cancelled') then x.status
         when x.status = 'completed' then 'completed'
         when x.starts_on > current_date then 'upcoming'
         when x.ends_on >= current_date then 'on placement'
         else 'finished, not assessed'
       end as stage,
       (x.starts_on - current_date) as days_to_start
from placements x
join students s on s.id = x.student_id
join programmes pg on pg.id = s.programme_id
join sites si on si.id = x.site_id
join organisations o on o.id = si.organisation_id
left join rounds r on r.id = x.round_id
left join supervisors sv on sv.id = x.supervisor_id;

-- Placements still to run or running: the ones every check, agreement and supervisor rule applies to.
create view v_live_placements as
select * from v_placements where status in ('allocated', 'confirmed') and ends_on >= current_date;

-- Every check every active student's programme requires, and where it stands.
create view v_check_status as
select s.id as student_id, s.code as student_code, s.name as student, pg.code as programme, q.code as requirement, q.name as requirement_name, q.source,
       c.completed_on, c.expires_on, (c.expires_on - current_date) as days_left,
       case
         when c.id is null then 'missing'
         when c.expires_on is not null and c.expires_on < current_date then 'expired'
         when c.expires_on is not null and c.expires_on <= current_date + (select value from policy where key = 'check_warn_days') then 'expiring'
         else 'current'
       end as state
from students s
join programmes pg on pg.id = s.programme_id
join programme_requirements pr on pr.programme_id = pg.id
join requirements q on q.id = pr.requirement_id
left join lateral (
  select * from student_checks c where c.student_id = s.id and c.requirement_id = q.id order by c.completed_on desc limit 1
) c on true
where s.status = 'active';

-- A live placement with a check that is missing, already expired, or runs out before the last day.
create view v_readiness as
select p.code, p.student_code, p.student, p.site, p.organisation, p.starts_on, p.ends_on, p.days_to_start, p.stage,
       c.requirement, c.requirement_name, c.source, c.expires_on,
       case
         when c.state = 'missing' then 'missing'
         when c.expires_on < greatest(p.starts_on, current_date) then 'expired'
         else 'runs out during placement'
       end as problem
from v_live_placements p
join v_check_status c on c.student_id = p.student_id
where c.state = 'missing' or (c.expires_on is not null and c.expires_on < p.ends_on);

-- Hours each student has, signed and unsigned, what is still planned, and the gap to the programme minimum.
create view v_hours as
with logged as (
  select x.student_id,
         sum(t.hours) filter (where t.signed_off_on is not null and x.status not in ('withdrawn', 'cancelled')) as signed,
         sum(t.hours) filter (where t.signed_off_on is null and x.status not in ('withdrawn', 'cancelled')) as unsigned
  from timesheets t join placements x on x.id = t.placement_id group by x.student_id
), still_to_come as (
  select x.student_id, sum(greatest(x.planned_hours - coalesce((select sum(t.hours) from timesheets t where t.placement_id = x.id), 0), 0)) as planned
  from placements x where x.status in ('allocated', 'confirmed') and x.ends_on >= current_date group by x.student_id
)
select s.id as student_id, s.code as student_code, s.name as student, pg.code as programme, s.year_level, pg.final_year, pg.required_hours, pg.hours_source,
       coalesce(l.signed, 0)::numeric as signed_hours, coalesce(l.unsigned, 0)::numeric as unsigned_hours, coalesce(c.planned, 0)::numeric as planned_hours,
       (coalesce(l.signed, 0) + coalesce(l.unsigned, 0) + coalesce(c.planned, 0))::numeric as projected_hours,
       greatest(pg.required_hours - (coalesce(l.signed, 0) + coalesce(l.unsigned, 0) + coalesce(c.planned, 0)), 0)::numeric as shortfall
from students s
join programmes pg on pg.id = s.programme_id
left join logged l on l.student_id = s.id
left join still_to_come c on c.student_id = s.id
where s.status = 'active';

-- Rounds that have not finished: places offered against students placed and students waiting.
create view v_capacity as
select r.id as round_id, r.code, r.name, pg.code as programme, r.year_level, r.starts_on, r.ends_on, (r.starts_on - current_date) as days_to_start,
       coalesce((select sum(o.places) from offers o where o.round_id = r.id and o.status = 'offered'), 0)::int as places_offered,
       (select count(*) from placements x where x.round_id = r.id and x.status in ('allocated', 'confirmed', 'completed'))::int as placed,
       (select count(*) from students s where s.programme_id = r.programme_id and s.year_level = r.year_level and s.status = 'active'
          and not exists (select 1 from placements x where x.round_id = r.id and x.student_id = s.id and x.status in ('allocated', 'confirmed', 'completed')))::int as waiting
from rounds r join programmes pg on pg.id = r.programme_id
where r.ends_on >= current_date;

create view v_unplaced as
select r.code as round_code, r.name as round, r.starts_on, (r.starts_on - current_date) as days_to_start, s.id as student_id, s.code as student_code, s.name as student,
       pg.code as programme, s.campus,
       (select string_agg(x.status || ' at ' || si.name, '; ') from placements x join sites si on si.id = x.site_id where x.round_id = r.id and x.student_id = s.id) as history
from rounds r
join programmes pg on pg.id = r.programme_id
join students s on s.programme_id = r.programme_id and s.year_level = r.year_level and s.status = 'active'
where r.ends_on >= current_date
  and not exists (select 1 from placements x where x.round_id = r.id and x.student_id = s.id and x.status in ('allocated', 'confirmed', 'completed'));

-- Offers with places nobody has been allocated to yet.
create view v_open_places as
select o.code, r.code as round_code, r.name as round, r.starts_on, si.code as site_code, si.name as site, org.name as organisation, o.places,
       (select count(*) from placements x where x.round_id = r.id and x.site_id = si.id and x.status in ('allocated', 'confirmed', 'completed'))::int as filled
from offers o join rounds r on r.id = o.round_id join sites si on si.id = o.site_id join organisations org on org.id = si.organisation_id
where o.status = 'offered' and r.ends_on >= current_date
  and o.places > (select count(*) from placements x where x.round_id = r.id and x.site_id = si.id and x.status in ('allocated', 'confirmed', 'completed'));

-- The current signed agreement per organisation, and what is booked past its end.
create view v_agreements as
select o.id as organisation_id, o.code as org_code, o.name as organisation, o.kind, a.code, a.status, a.starts_on, a.expires_on, (a.expires_on - current_date) as days_left,
       a.insurance_expires_on, (a.insurance_expires_on - current_date) as insurance_days_left,
       (select r.code || ' ' || r.status || coalesce(' ' || r.sent_on::text, '') from agreements r where r.organisation_id = o.id and r.status in ('draft', 'sent') order by r.created_at desc limit 1) as renewal,
       (select count(*) from v_live_placements p where p.organisation_id = o.id)::int as live_placements,
       (select count(*) from v_live_placements p where p.organisation_id = o.id and (a.expires_on is null or p.ends_on > a.expires_on))::int as booked_past_end
from organisations o
left join lateral (
  select * from agreements a where a.organisation_id = o.id and a.status = 'signed' order by a.expires_on desc nulls last limit 1
) a on true
where o.active;

-- A live placement with no signed agreement covering its first to last day.
-- Two back-to-back agreements (the old one and its renewal) count as cover.
create view v_agreement_gaps as
select p.code, p.student_code, p.student, p.site, p.organisation, p.org_code, p.starts_on, p.ends_on, p.days_to_start, a.code as agreement, a.expires_on,
       case when a.code is null then 'no signed agreement'
            when a.expires_on < p.starts_on then 'agreement ended ' || a.expires_on::text
            when a.starts_on > p.starts_on then 'agreement only starts ' || a.starts_on::text || ', placement starts ' || p.starts_on::text
            else 'agreement ends ' || a.expires_on::text || ', placement runs to ' || p.ends_on::text end as problem
from v_live_placements p
left join v_agreements a on a.organisation_id = p.organisation_id
where not exists (
  select 1 from agreements a1 join agreements a2 on a2.organisation_id = a1.organisation_id
  where a1.organisation_id = p.organisation_id and a1.status = 'signed' and a2.status = 'signed'
    and coalesce(a1.starts_on, '-infinity'::date) <= p.starts_on and a1.expires_on >= p.starts_on
    and coalesce(a2.starts_on, '-infinity'::date) <= p.ends_on and a2.expires_on >= p.ends_on
    and (a1.id = a2.id or a1.expires_on + 1 >= a2.starts_on)
);

-- A live placement with no supervisor, or one whose training is missing or out of date.
create view v_supervision_gaps as
select p.code, p.student_code, p.student, p.site, p.starts_on, p.ends_on, p.days_to_start, p.supervisor, p.supervisor_trained_on,
       case when p.supervisor is null then 'no supervisor named'
            when p.supervisor_trained_on is null then 'supervisor has no training on record'
            else 'supervisor training from ' || p.supervisor_trained_on::text || ' is out of date' end as problem
from v_live_placements p
where p.supervisor is null or p.supervisor_trained_on is null
   or p.supervisor_trained_on < current_date - make_interval(years => (select value from policy where key = 'supervisor_training_years'));

-- Finished placements still waiting on the final assessment.
create view v_assessments_due as
select p.code, p.student_code, p.student, p.site, p.supervisor, p.ends_on,
       p.ends_on + (select value from policy where key = 'assessment_days') as due_on,
       current_date - (p.ends_on + (select value from policy where key = 'assessment_days')) as days_late
from v_placements p
where p.status in ('allocated', 'confirmed') and p.ends_on < current_date;

create view v_unsigned_hours as
select t.id, p.code, p.student_code, p.student, p.site, p.supervisor, t.week_ending, t.hours, t.submitted_on, (current_date - t.submitted_on) as days_waiting
from timesheets t join v_placements p on p.id = t.placement_id
where t.signed_off_on is null and p.status not in ('withdrawn', 'cancelled');

create view v_incidents as
select i.id, i.code, p.code as placement, p.student_code, p.student, p.site, p.organisation, i.occurred_on, i.kind, i.severity, i.reported_to_site_on,
       (coalesce(i.reported_to_site_on, current_date) - i.occurred_on) as days_to_report, i.plan, i.closed_on, i.detail
from incidents i join v_placements p on p.id = i.placement_id;

-- Places offered per organisation: the last 12 months against the 12 before.
create view v_site_trend as
select o.id, o.code, o.name, o.kind,
       coalesce(sum(f.places) filter (where r.starts_on > current_date - 365), 0)::int as places_last_12m,
       coalesce(sum(f.places) filter (where r.starts_on <= current_date - 365 and r.starts_on > current_date - 730), 0)::int as places_prior_12m,
       max(r.starts_on) as last_round_on
from organisations o
left join sites si on si.organisation_id = o.id
left join offers f on f.site_id = si.id and f.status = 'offered'
left join rounds r on r.id = f.round_id
where o.active
group by o.id, o.code, o.name, o.kind;

-- How placements at each site turned out.
create view v_outcomes as
select p.site_code, p.site, p.organisation,
       count(*) filter (where p.status = 'completed')::int as completed,
       count(*) filter (where p.result = 'pass')::int as passed,
       count(*) filter (where p.result in ('fail', 'incomplete'))::int as not_passed,
       count(*) filter (where p.status = 'withdrawn')::int as withdrawn,
       (select count(*) from incidents i join placements x on x.id = i.placement_id where x.site_id = (select id from sites where code = p.site_code))::int as incidents,
       round(avg(p.evaluation_score), 1) as avg_evaluation
from v_placements p
group by p.site_code, p.site, p.organisation;

-- Everything that needs the placement office this week. Severity 1 is worst.
create view v_attention as
select 1 as severity, 'check not ready' as issue, r.student_code, r.student, r.site as about, r.starts_on as on_date,
       r.requirement_name || ': ' || r.problem || coalesce(' (' || r.expires_on::text || ')', '') as detail
from v_readiness r where r.days_to_start <= (select value from policy where key = 'readiness_days')
union all
select 1, 'no agreement cover', g.student_code, g.student, g.organisation, g.starts_on, g.problem
from v_agreement_gaps g where g.days_to_start <= (select value from policy where key = 'readiness_days')
union all
select 1, 'incident not reported', i.student_code, i.student, i.site, i.occurred_on, i.kind || ', ' || i.severity || ', ' || i.days_to_report || ' days and not reported to the host'
from v_incidents i where i.reported_to_site_on is null and i.days_to_report > (select value from policy where key = 'incident_report_days')
union all
select 1, 'supervision gap', s.student_code, s.student, s.site, s.starts_on, s.problem
from v_supervision_gaps s where s.days_to_start <= (select value from policy where key = 'readiness_days') and s.supervisor_trained_on is null
union all
select 2, 'host insurance lapsed', null, null, a.organisation, a.insurance_expires_on, 'certificate ended ' || a.insurance_expires_on::text || ', ' || a.live_placements || ' live placements'
from v_agreements a where a.insurance_expires_on < current_date
union all
select 2, 'short of hours', h.student_code, h.student, h.programme, null::date,
       trim_scale(h.projected_hours) || ' of ' || h.required_hours || ' hours on current plans, ' || trim_scale(h.shortfall) || ' short'
from v_hours h where h.year_level >= h.final_year and h.shortfall > 0
union all
select 2, 'student unplaced', u.student_code, u.student, u.round, u.starts_on, 'no placement for ' || u.round || case when u.days_to_start < 0 then ', started ' || -u.days_to_start || ' days ago' else ', starts in ' || u.days_to_start || ' days' end
from v_unplaced u where u.days_to_start <= 45
union all
select 2, 'assessment overdue', a.student_code, a.student, a.site, a.due_on, 'due ' || a.due_on::text || ' from ' || coalesce(a.supervisor, 'the site') || ', ' || a.days_late || ' days late'
from v_assessments_due a where a.days_late > 0
union all
select 2, 'hours not signed off', u.student_code, u.student, u.site, u.week_ending, trim_scale(u.hours) || ' hours, ' || u.days_waiting || ' days with ' || coalesce(u.supervisor, 'the site')
from v_unsigned_hours u where u.days_waiting > (select value from policy where key = 'signoff_days')
union all
select 2, 'student at risk', i.student_code, i.student, i.site, i.occurred_on, coalesce(i.plan, 'no learning plan recorded')
from v_incidents i where i.kind = 'at_risk' and i.closed_on is null
union all
select 2, 'agreement ending', null, null, a.organisation, a.expires_on, a.code || ' ends in ' || a.days_left || ' days' || coalesce(', renewal ' || a.renewal, ', no renewal started')
from v_agreements a where a.days_left between 0 and (select value from policy where key = 'agreement_warn_days')
union all
select 3, 'open place', null, null, o.site, o.starts_on, (o.places - o.filled) || ' of ' || o.places || ' places unfilled for ' || o.round
from v_open_places o
union all
select 3, 'supervisor training due', s.student_code, s.student, s.site, s.starts_on, s.problem
from v_supervision_gaps s where s.supervisor_trained_on is not null
union all
select 3, 'check expiring', c.student_code, c.student, c.requirement_name, c.expires_on, c.days_left || ' days left'
from v_check_status c where c.state = 'expiring'
union all
select 3, 'host gone quiet', null, null, t.name, t.last_round_on, t.places_prior_12m || ' places the year before, none in the last 12 months'
from v_site_trend t where t.places_last_12m = 0 and t.places_prior_12m > 0;

-- Lock every table to the service role when this runs on a hosted database.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end
$$;
