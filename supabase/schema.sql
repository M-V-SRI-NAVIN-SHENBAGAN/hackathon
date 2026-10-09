-- MediVault relational schema + RLS baseline for a Supabase deployment.
-- The React app currently runs in browser-only DEMO MODE; this file is not
-- automatically applied and no production database is claimed to be connected.
-- Apply only after review in a separate Supabase project with proper clinical,
-- privacy, retention, and incident-response controls.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('patient', 'doctor');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.record_category as enum ('prescription','blood_test','imaging','discharge_summary','diagnosis','vaccination','allergy','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.share_scope as enum ('all','categories','records');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.grant_status as enum ('active','revoked');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'patient',
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.patient_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  patient_id text not null unique,
  date_of_birth date,
  gender text,
  phone text,
  blood_group text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  created_at timestamptz not null default now()
);

create table if not exists public.doctor_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  specialization text not null,
  organization text not null,
  registration_number text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Minimal identity index for an already-authorized doctor. It deliberately
-- contains no DOB, phone, emergency contact, or general patient directory.
create table if not exists public.patient_directory_index (
  profile_id uuid primary key references public.patient_profiles(profile_id) on delete cascade,
  patient_id text not null unique,
  display_name text not null
);
create or replace function public.sync_patient_directory_index()
returns trigger language plpgsql security definer set search_path = public as $$
declare _name text;
begin
  select full_name into _name from public.profiles where id=new.profile_id;
  insert into public.patient_directory_index(profile_id,patient_id,display_name)
    values(new.profile_id,new.patient_id,coalesce(_name,'Patient'))
    on conflict(profile_id) do update set patient_id=excluded.patient_id,display_name=excluded.display_name;
  return new;
end;
$$;
drop trigger if exists sync_patient_directory_index_medivault on public.patient_profiles;
create trigger sync_patient_directory_index_medivault after insert or update of patient_id on public.patient_profiles
  for each row execute procedure public.sync_patient_directory_index();

create table if not exists public.sharing_grants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  scope_type public.share_scope not null,
  categories public.record_category[] not null default '{}',
  record_ids uuid[] not null default '{}',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint valid_grant_expiry check (expires_at > granted_at),
  constraint valid_scope_payload check (
    (scope_type = 'all') or
    (scope_type = 'categories' and cardinality(categories) > 0) or
    (scope_type = 'records' and cardinality(record_ids) > 0)
  )
);
create index if not exists sharing_grants_patient_doctor_active_idx
  on public.sharing_grants(patient_id, doctor_id, expires_at) where revoked_at is null;

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  title text not null,
  category public.record_category not null,
  report_date date,
  provider text not null,
  notes text,
  tags text[] not null default '{}',
  storage_path text unique,
  mime_type text,
  lab_results jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medical_records_patient_date_idx on public.medical_records(patient_id, report_date desc);

create table if not exists public.medical_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  record_id uuid references public.medical_records(id) on delete set null,
  event_type text not null,
  event_date date,
  provider text,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  condition text not null,
  diagnosed_on date,
  clinician_confirmed boolean not null default false,
  author_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  name text not null,
  dose text,
  frequency text,
  start_date date,
  end_date date,
  prescribing_doctor text,
  status text not null check (status in ('active','discontinued')),
  instructions text,
  author_id uuid references public.profiles(id),
  patient_reported boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_reviews (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  outcome text not null check (outcome in ('reviewed','continued','changed','discontinued')),
  note text,
  reviewed_at timestamptz not null default now(),
  unique (medication_id, doctor_id)
);

create table if not exists public.allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  allergen text not null,
  reaction text,
  severity text check (severity in ('mild','moderate','severe')),
  clinician_confirmed boolean not null default false,
  recorded_by uuid references public.profiles(id),
  recorded_at timestamptz not null default now()
);

create table if not exists public.surgeries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  procedure text not null,
  procedure_date date,
  provider text,
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  record_id uuid not null references public.medical_records(id) on delete cascade,
  test_name text not null,
  value_text text,
  value_numeric numeric,
  unit text,
  reference_range text,
  source_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  scheduled_at timestamptz not null,
  organization text,
  status text not null check (status in ('proposed','accepted','rejected','completed','cancelled')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.consultation_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  visit_date date not null,
  chief_complaint text not null,
  observations text,
  assessment text,
  plan text,
  follow_up_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.prescription_drafts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  medicine text not null,
  dose text,
  frequency text,
  instructions text,
  created_at timestamptz not null default now(),
  status text not null default 'draft' check (status = 'draft')
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_patient_id uuid references public.patient_profiles(profile_id) on delete set null,
  action text not null,
  detail text not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_target_created_idx on public.audit_logs(target_patient_id, created_at desc);

create table if not exists public.emergency_access_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patient_profiles(profile_id) on delete cascade,
  doctor_id uuid not null references public.doctor_profiles(profile_id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','authorized','rejected','expired','revoked')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  authorized_by uuid references public.profiles(id),
  authorized_at timestamptz
);

-- Auth profile provisioning defaults to least privilege. A trusted operator must
-- verify a clinician and set role='doctor' plus the doctor_profiles row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, role, full_name, email)
  values (new.id, 'patient', coalesce(new.raw_user_meta_data->>'full_name','New patient'), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_medivault on auth.users;
create trigger on_auth_user_created_medivault after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.has_active_patient_grant(_patient_id uuid, _full_summary boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sharing_grants g
    where g.patient_id = _patient_id and g.doctor_id = auth.uid()
      and g.revoked_at is null and g.expires_at > now()
      and (not _full_summary or g.scope_type = 'all')
  )
$$;

create or replace function public.can_read_record(_patient_id uuid, _record_id uuid, _category public.record_category)
returns boolean language sql stable security definer set search_path = public as $$
  select (
    (auth.uid() = _patient_id and public.current_app_role() = 'patient')
    or (public.current_app_role() = 'doctor' and exists (
      select 1 from public.sharing_grants g
      where g.patient_id = _patient_id and g.doctor_id = auth.uid()
        and g.revoked_at is null and g.expires_at > now()
        and (g.scope_type = 'all'
          or (g.scope_type = 'categories' and _category = any(g.categories))
          or (g.scope_type = 'records' and _record_id = any(g.record_ids)))
    ))
  )
$$;

create or replace function public.can_read_storage_object(_object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.medical_records r
    where r.storage_path = _object_name
      and public.can_read_record(r.patient_id, r.id, r.category)
  )
$$;

create or replace function public.create_sharing_grant(
  _doctor_id uuid,
  _scope_type public.share_scope,
  _categories public.record_category[],
  _record_ids uuid[],
  _expires_at timestamptz,
  _request_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare _grant_id uuid;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'patient' then
    raise exception 'Only an authenticated patient can grant access';
  end if;
  if not exists (select 1 from public.doctor_profiles d join public.profiles p on p.id=d.profile_id where d.profile_id=_doctor_id and p.role='doctor') then
    raise exception 'Registered clinician not found';
  end if;
  if _expires_at <= now() then raise exception 'Expiry must be in the future'; end if;
  if _scope_type = 'categories' and coalesce(cardinality(_categories),0)=0 then raise exception 'Select at least one category'; end if;
  if _scope_type = 'records' and coalesce(cardinality(_record_ids),0)=0 then raise exception 'Select at least one record'; end if;
  if _scope_type = 'records' and exists (
    select 1 from unnest(_record_ids) chosen(id)
    where not exists (select 1 from public.medical_records r where r.id=chosen.id and r.patient_id=auth.uid())
  ) then raise exception 'A selected record does not belong to this patient'; end if;
  insert into public.sharing_grants(patient_id,doctor_id,scope_type,categories,record_ids,expires_at)
  values (auth.uid(),_doctor_id,_scope_type,coalesce(_categories,'{}'),coalesce(_record_ids,'{}'),_expires_at)
  returning id into _grant_id;
  if _request_id is not null then
    update public.access_requests set status='approved', responded_at=now()
      where id=_request_id and patient_id=auth.uid() and doctor_id=_doctor_id and status='pending';
  end if;
  insert into public.audit_logs(actor_id,target_patient_id,action,detail)
  values(auth.uid(),auth.uid(),'grant_created','Patient granted time-limited, scoped record access.');
  return _grant_id;
end;
$$;

create or replace function public.revoke_sharing_grant(_grant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _patient_id uuid;
begin
  select patient_id into _patient_id from public.sharing_grants where id=_grant_id;
  if _patient_id is null or _patient_id <> auth.uid() or public.current_app_role() is distinct from 'patient' then
    raise exception 'Grant not found or permission denied';
  end if;
  update public.sharing_grants set revoked_at=now() where id=_grant_id and revoked_at is null;
  insert into public.audit_logs(actor_id,target_patient_id,action,detail)
  values(auth.uid(),auth.uid(),'grant_revoked','Patient revoked a sharing grant.');
end;
$$;

create or replace function public.respond_to_access_request(
  _request_id uuid,
  _approve boolean,
  _scope_type public.share_scope default null,
  _categories public.record_category[] default '{}',
  _record_ids uuid[] default '{}',
  _expires_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare _req public.access_requests%rowtype; _grant_id uuid;
begin
  select * into _req from public.access_requests where id=_request_id and patient_id=auth.uid() and status='pending';
  if not found or public.current_app_role() is distinct from 'patient' then raise exception 'Request not found or permission denied'; end if;
  if _approve then
    if _scope_type is null or _expires_at is null then raise exception 'Consent scope and expiry are required'; end if;
    _grant_id := public.create_sharing_grant(_req.doctor_id,_scope_type,_categories,_record_ids,_expires_at,null);
    update public.access_requests set status='approved',responded_at=now() where id=_request_id;
  else
    update public.access_requests set status='rejected',responded_at=now() where id=_request_id;
  end if;
  insert into public.audit_logs(actor_id,target_patient_id,action,detail)
  values(auth.uid(),auth.uid(),'request_responded',case when _approve then 'Patient approved a scoped access request.' else 'Patient declined an access request.' end);
  return _grant_id;
end;
$$;

create or replace function public.authorize_emergency_request(_request_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _patient_id uuid;
begin
  select patient_id into _patient_id from public.emergency_access_requests
    where id=_request_id and patient_id=auth.uid() and status='pending';
  if _patient_id is null or public.current_app_role() is distinct from 'patient' then raise exception 'Request not found or permission denied'; end if;
  update public.emergency_access_requests
    set status=case when _approve then 'authorized' else 'rejected' end,
        authorized_by=case when _approve then auth.uid() else null end,
        authorized_at=case when _approve then now() else null end,
        expires_at=case when _approve then now()+interval '30 minutes' else expires_at end
    where id=_request_id;
  insert into public.audit_logs(actor_id,target_patient_id,action,detail)
  values(auth.uid(),auth.uid(),'emergency_access',case when _approve then 'Patient approved a temporary emergency essential-information request.' else 'Patient declined an emergency request.' end);
end;
$$;

create or replace function public.revoke_emergency_access(_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _patient_id uuid;
begin
  select patient_id into _patient_id from public.emergency_access_requests
    where id=_request_id and patient_id=auth.uid() and status='authorized';
  if _patient_id is null or public.current_app_role() is distinct from 'patient' then raise exception 'Request not found or permission denied'; end if;
  update public.emergency_access_requests set status='revoked', expires_at=now()
    where id=_request_id and patient_id=auth.uid();
  insert into public.audit_logs(actor_id,target_patient_id,action,detail)
    values(auth.uid(),auth.uid(),'emergency_access','Patient revoked temporary emergency access.');
end;
$$;

-- This RPC is the only doctor-facing emergency data path. It returns the
-- essential card only, after explicit patient approval, and never medical files.
create or replace function public.get_essential_emergency_summary(_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _request public.emergency_access_requests%rowtype; _result jsonb;
begin
  if public.current_app_role() is distinct from 'doctor' then raise exception 'Doctor role required'; end if;
  select * into _request from public.emergency_access_requests
    where id=_request_id and doctor_id=auth.uid() and status='authorized' and expires_at>now();
  if not found then raise exception 'Emergency access denied, expired, or revoked'; end if;
  select jsonb_build_object(
    'patient_id', pii.patient_id,
    'display_name', pii.display_name,
    'critical_allergies', coalesce((select jsonb_agg(jsonb_build_object('allergen',a.allergen,'reaction',a.reaction,'severity',a.severity,'confirmed',a.clinician_confirmed)) from public.allergies a where a.patient_id=_request.patient_id), '[]'::jsonb),
    'current_medications', coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'dose',m.dose,'status',m.status)) from public.medications m where m.patient_id=_request.patient_id and m.status='active'), '[]'::jsonb),
    'recorded_conditions', coalesce((select jsonb_agg(jsonb_build_object('condition',d.condition,'confirmed',d.clinician_confirmed)) from public.diagnoses d where d.patient_id=_request.patient_id), '[]'::jsonb),
    'emergency_contact', jsonb_build_object('name',pp.emergency_contact_name,'phone',pp.emergency_contact_phone,'relation',pp.emergency_contact_relation),
    'reason', _request.reason,
    'expires_at', _request.expires_at
  ) into _result
  from public.patient_directory_index pii
  join public.patient_profiles pp on pp.profile_id=pii.profile_id
  where pii.profile_id=_request.patient_id;
  insert into public.audit_logs(actor_id,target_patient_id,action,detail)
    values(auth.uid(),_request.patient_id,'emergency_access','Clinician retrieved patient-approved essential emergency information.');
  return _result;
end;
$$;

-- Lock down callable RPCs to logged-in users; functions re-check role/ownership.
revoke all on function public.create_sharing_grant(uuid,public.share_scope,public.record_category[],uuid[],timestamptz,uuid) from public;
revoke all on function public.revoke_sharing_grant(uuid) from public;
revoke all on function public.respond_to_access_request(uuid,boolean,public.share_scope,public.record_category[],uuid[],timestamptz) from public;
revoke all on function public.authorize_emergency_request(uuid,boolean) from public;
revoke all on function public.revoke_emergency_access(uuid) from public;
revoke all on function public.get_essential_emergency_summary(uuid) from public;
grant execute on function public.create_sharing_grant(uuid,public.share_scope,public.record_category[],uuid[],timestamptz,uuid) to authenticated;
grant execute on function public.revoke_sharing_grant(uuid) to authenticated;
grant execute on function public.respond_to_access_request(uuid,boolean,public.share_scope,public.record_category[],uuid[],timestamptz) to authenticated;
grant execute on function public.authorize_emergency_request(uuid,boolean) to authenticated;
grant execute on function public.revoke_emergency_access(uuid) to authenticated;
grant execute on function public.get_essential_emergency_summary(uuid) to authenticated;

-- Enable RLS on every sensitive relation.
alter table public.profiles enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.patient_directory_index enable row level security;
alter table public.doctor_profiles enable row level security;
alter table public.sharing_grants enable row level security;
alter table public.medical_records enable row level security;
alter table public.medical_events enable row level security;
alter table public.diagnoses enable row level security;
alter table public.medications enable row level security;
alter table public.medication_reviews enable row level security;
alter table public.allergies enable row level security;
alter table public.surgeries enable row level security;
alter table public.lab_results enable row level security;
alter table public.appointments enable row level security;
alter table public.access_requests enable row level security;
alter table public.consultation_notes enable row level security;
alter table public.prescription_drafts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.emergency_access_requests enable row level security;

-- Profiles expose doctor directory entries to authenticated patients only;
-- patient profiles remain hidden from doctors unless a full-summary grant exists.
drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles for select to authenticated
  using (id=auth.uid() or (role='doctor' and public.current_app_role()='patient'));
drop policy if exists patient_profiles_owner on public.patient_profiles;
create policy patient_profiles_owner on public.patient_profiles for all to authenticated
  using (profile_id=auth.uid()) with check (profile_id=auth.uid());
drop policy if exists patient_profiles_doctor_full on public.patient_profiles;
create policy patient_profiles_doctor_full on public.patient_profiles for select to authenticated
  using (public.current_app_role()='doctor' and public.has_active_patient_grant(profile_id,true));
drop policy if exists patient_directory_owner on public.patient_directory_index;
create policy patient_directory_owner on public.patient_directory_index for all to authenticated
  using (profile_id=auth.uid() and public.current_app_role()='patient')
  with check (profile_id=auth.uid() and public.current_app_role()='patient');
drop policy if exists patient_directory_authorized_doctor on public.patient_directory_index;
create policy patient_directory_authorized_doctor on public.patient_directory_index for select to authenticated
  using (public.current_app_role()='doctor' and public.has_active_patient_grant(profile_id,false));
drop policy if exists doctor_profiles_directory on public.doctor_profiles;
create policy doctor_profiles_directory on public.doctor_profiles for select to authenticated
  using (profile_id=auth.uid() or public.current_app_role()='patient');
drop policy if exists doctor_profiles_self_insert on public.doctor_profiles;
create policy doctor_profiles_self_insert on public.doctor_profiles for insert to authenticated
  with check (profile_id=auth.uid() and public.current_app_role()='doctor');
drop policy if exists doctor_profiles_self_update on public.doctor_profiles;
create policy doctor_profiles_self_update on public.doctor_profiles for update to authenticated
  using (profile_id=auth.uid() and public.current_app_role()='doctor')
  with check (profile_id=auth.uid() and public.current_app_role()='doctor');

-- A doctor can read a record only when a non-expired, non-revoked grant covers
-- that exact record, its category, or the all-records scope.
drop policy if exists sharing_grants_participant_read on public.sharing_grants;
create policy sharing_grants_participant_read on public.sharing_grants for select to authenticated
  using (patient_id=auth.uid() or doctor_id=auth.uid());
drop policy if exists sharing_grants_patient_insert on public.sharing_grants;
create policy sharing_grants_patient_insert on public.sharing_grants for insert to authenticated
  with check (patient_id=auth.uid() and public.current_app_role()='patient');
drop policy if exists medical_records_patient_manage on public.medical_records;
create policy medical_records_patient_manage on public.medical_records for all to authenticated
  using (patient_id=auth.uid() and public.current_app_role()='patient')
  with check (patient_id=auth.uid() and uploaded_by=auth.uid());
drop policy if exists medical_records_doctor_scoped_select on public.medical_records;
create policy medical_records_doctor_scoped_select on public.medical_records for select to authenticated
  using (public.current_app_role()='doctor' and public.can_read_record(patient_id,id,category));

drop policy if exists medical_events_patient_manage on public.medical_events;
create policy medical_events_patient_manage on public.medical_events for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists medical_events_doctor_scoped_read on public.medical_events;
create policy medical_events_doctor_scoped_read on public.medical_events for select to authenticated
  using (public.current_app_role()='doctor' and (
    public.has_active_patient_grant(patient_id,true) or
    (record_id is not null and exists (select 1 from public.medical_records r where r.id=record_id and public.can_read_record(r.patient_id,r.id,r.category)))
  ));

-- Structured profile facts are visible to doctors only in the all-summary scope.
drop policy if exists diagnoses_patient_manage on public.diagnoses;
create policy diagnoses_patient_manage on public.diagnoses for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists diagnoses_doctor_read on public.diagnoses;
create policy diagnoses_doctor_read on public.diagnoses for select to authenticated
  using (public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,true));
drop policy if exists diagnoses_doctor_insert on public.diagnoses;
create policy diagnoses_doctor_insert on public.diagnoses for insert to authenticated
  with check (author_id=auth.uid() and public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,true));
drop policy if exists diagnoses_author_update on public.diagnoses;
create policy diagnoses_author_update on public.diagnoses for update to authenticated
  using (author_id=auth.uid() and public.has_active_patient_grant(patient_id,true))
  with check (author_id=auth.uid() and public.has_active_patient_grant(patient_id,true));

-- Patient enters their own medication/allergy/surgery data. Doctor-originated
-- medication rows must be clinician-authored and within a full-summary grant.
drop policy if exists medications_patient_manage on public.medications;
create policy medications_patient_manage on public.medications for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists medications_doctor_full_select on public.medications;
create policy medications_doctor_full_select on public.medications for select to authenticated
  using (public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,true));
drop policy if exists medications_doctor_insert on public.medications;
create policy medications_doctor_insert on public.medications for insert to authenticated
  with check (author_id=auth.uid() and public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,true));
drop policy if exists medications_author_update on public.medications;
create policy medications_author_update on public.medications for update to authenticated
  using (author_id=auth.uid() and public.has_active_patient_grant(patient_id,true))
  with check (author_id=auth.uid() and public.has_active_patient_grant(patient_id,true));

drop policy if exists medication_reviews_doctor_own on public.medication_reviews;
create policy medication_reviews_doctor_own on public.medication_reviews for all to authenticated
  using (doctor_id=auth.uid() and public.has_active_patient_grant(patient_id,true))
  with check (doctor_id=auth.uid() and public.has_active_patient_grant(patient_id,true));
drop policy if exists medication_reviews_patient_read on public.medication_reviews;
create policy medication_reviews_patient_read on public.medication_reviews for select to authenticated
  using (patient_id=auth.uid());

drop policy if exists allergies_patient_manage on public.allergies;
create policy allergies_patient_manage on public.allergies for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists allergies_doctor_read on public.allergies;
create policy allergies_doctor_read on public.allergies for select to authenticated
  using (public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,true));
drop policy if exists surgeries_patient_manage on public.surgeries;
create policy surgeries_patient_manage on public.surgeries for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists surgeries_doctor_read on public.surgeries;
create policy surgeries_doctor_read on public.surgeries for select to authenticated
  using (public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,true));

drop policy if exists lab_results_patient_manage on public.lab_results;
create policy lab_results_patient_manage on public.lab_results for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists lab_results_doctor_scoped_read on public.lab_results;
create policy lab_results_doctor_scoped_read on public.lab_results for select to authenticated
  using (public.current_app_role()='doctor' and public.can_read_record(patient_id,record_id,'blood_test'));

-- Requests are initiated by a doctor and responded to only by the patient.
drop policy if exists access_requests_participant_read on public.access_requests;
create policy access_requests_participant_read on public.access_requests for select to authenticated
  using (doctor_id=auth.uid() or patient_id=auth.uid());
drop policy if exists access_requests_doctor_create on public.access_requests;
create policy access_requests_doctor_create on public.access_requests for insert to authenticated
  with check (doctor_id=auth.uid() and public.current_app_role()='doctor');
-- No direct UPDATE policy: respond_to_access_request() validates ownership and scope.

drop policy if exists appointments_patient_read_update on public.appointments;
create policy appointments_patient_read_update on public.appointments for all to authenticated
  using (patient_id=auth.uid()) with check (patient_id=auth.uid());
drop policy if exists appointments_doctor_assigned_read on public.appointments;
create policy appointments_doctor_assigned_read on public.appointments for select to authenticated
  using (doctor_id=auth.uid());
drop policy if exists appointments_doctor_create on public.appointments;
create policy appointments_doctor_create on public.appointments for insert to authenticated
  with check (doctor_id=auth.uid() and created_by=auth.uid() and public.has_active_patient_grant(patient_id,false));
drop policy if exists appointments_doctor_update_own on public.appointments;
create policy appointments_doctor_update_own on public.appointments for update to authenticated
  using (doctor_id=auth.uid() and created_by=auth.uid())
  with check (doctor_id=auth.uid() and created_by=auth.uid());

drop policy if exists consultation_notes_patient_read on public.consultation_notes;
create policy consultation_notes_patient_read on public.consultation_notes for select to authenticated
  using (patient_id=auth.uid());
drop policy if exists consultation_notes_doctor_own on public.consultation_notes;
create policy consultation_notes_doctor_own on public.consultation_notes for select to authenticated
  using (doctor_id=auth.uid() and public.has_active_patient_grant(patient_id,false));
drop policy if exists consultation_notes_doctor_insert on public.consultation_notes;
create policy consultation_notes_doctor_insert on public.consultation_notes for insert to authenticated
  with check (doctor_id=auth.uid() and public.current_app_role()='doctor' and public.has_active_patient_grant(patient_id,false));
drop policy if exists consultation_notes_doctor_update on public.consultation_notes;
create policy consultation_notes_doctor_update on public.consultation_notes for update to authenticated
  using (doctor_id=auth.uid() and public.has_active_patient_grant(patient_id,false))
  with check (doctor_id=auth.uid() and public.has_active_patient_grant(patient_id,false));

drop policy if exists prescription_drafts_patient_read on public.prescription_drafts;
create policy prescription_drafts_patient_read on public.prescription_drafts for select to authenticated
  using (patient_id=auth.uid());
drop policy if exists prescription_drafts_doctor_own on public.prescription_drafts;
create policy prescription_drafts_doctor_own on public.prescription_drafts for all to authenticated
  using (doctor_id=auth.uid() and public.has_active_patient_grant(patient_id,false))
  with check (doctor_id=auth.uid() and public.current_app_role()='doctor' and status='draft' and public.has_active_patient_grant(patient_id,false));

drop policy if exists audit_logs_patient_read on public.audit_logs;
create policy audit_logs_patient_read on public.audit_logs for select to authenticated
  using (target_patient_id=auth.uid());
drop policy if exists audit_logs_actor_read on public.audit_logs;
create policy audit_logs_actor_read on public.audit_logs for select to authenticated
  using (actor_id=auth.uid());
drop policy if exists audit_logs_insert_self on public.audit_logs;
create policy audit_logs_insert_self on public.audit_logs for insert to authenticated
  with check (actor_id=auth.uid());

drop policy if exists emergency_requests_participant_read on public.emergency_access_requests;
create policy emergency_requests_participant_read on public.emergency_access_requests for select to authenticated
  using (patient_id=auth.uid() or doctor_id=auth.uid());
drop policy if exists emergency_requests_doctor_insert on public.emergency_access_requests;
create policy emergency_requests_doctor_insert on public.emergency_access_requests for insert to authenticated
  with check (doctor_id=auth.uid() and public.current_app_role()='doctor' and length(trim(reason))>0 and expires_at>now() and expires_at<=now()+interval '30 minutes');
-- Patient approval is handled by authorize_emergency_request; there is no bypass policy.

-- Private bucket: users never receive a public object URL. Use authenticated
-- Supabase downloads and RLS on both storage.objects and medical_records.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('medical-records','medical-records',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists medical_files_owner_read on storage.objects;
create policy medical_files_owner_read on storage.objects for select to authenticated
  using (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists medical_files_shared_doctor_read on storage.objects;
create policy medical_files_shared_doctor_read on storage.objects for select to authenticated
  using (bucket_id='medical-records' and public.current_app_role()='doctor' and public.can_read_storage_object(name));
drop policy if exists medical_files_owner_insert on storage.objects;
create policy medical_files_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text
    and exists (select 1 from public.medical_records r where r.storage_path=name and r.patient_id=auth.uid())
  );
drop policy if exists medical_files_owner_update on storage.objects;
create policy medical_files_owner_update on storage.objects for update to authenticated
  using (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists medical_files_owner_delete on storage.objects;
create policy medical_files_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='medical-records' and (storage.foldername(name))[1]=auth.uid()::text);

comment on table public.medical_records is 'Private patient-owned metadata; row access is checked by RLS on every request.';
comment on table public.sharing_grants is 'Patient-controlled scope and expiry; doctors cannot create, expand, or revoke grants.';
comment on table public.audit_logs is 'Do not place passwords, tokens, or document contents in audit detail.';
