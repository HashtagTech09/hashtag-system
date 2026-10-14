begin;

create schema if not exists crm_private;
revoke all on schema crm_private from public, anon, authenticated;
grant usage on schema crm_private to authenticated, service_role;

-- Explicit, independently provisioned CRM access. Existing broad staff policies
-- must not allow someone to grant themselves CRM access.
create table crm_private.staff_access (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id),
  organization_id bigint not null,
  studio_id bigint references public.studios(id),
  role text not null check (role in ('admin', 'manager')),
  active boolean not null default true,
  check ((role = 'admin' and studio_id is null) or (role = 'manager' and studio_id is not null)),
  unique nulls not distinct (auth_user_id, organization_id, studio_id)
);
alter table crm_private.staff_access enable row level security;

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null,
  studio_id bigint not null references public.studios(id),
  meta_lead_id text not null unique check (meta_lead_id ~ '^[1-9][0-9]{0,29}$'),
  name text not null check (length(name) between 1 and 200),
  email text check (length(email) <= 320),
  phone text check (length(phone) <= 40),
  style text check (length(style) <= 100),
  stage text not null default 'Intake' check (stage in ('Intake', 'In-Progress', 'Qualified', 'Converted', 'Lost')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  change_note text check (length(change_note) <= 2000),
  is_correction boolean not null default false
);
create index crm_leads_scope_stage on public.crm_leads (organization_id, studio_id, stage, changed_at desc);
alter table public.crm_leads enable row level security;

create table public.crm_lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id),
  organization_id bigint not null,
  studio_id bigint not null,
  version integer not null,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null,
  actor_id uuid,
  note text,
  is_correction boolean not null,
  delivery_status text not null check (delivery_status in ('queued', 'sending', 'retry', 'delivered', 'failed', 'expired', 'held')),
  delivery_code text,
  attempts integer not null default 0,
  unique (lead_id, version)
);
create index crm_history_scope on public.crm_lead_history (organization_id, studio_id);
alter table public.crm_lead_history enable row level security;

-- Immutable event snapshots keep retries independent of later contact/stage edits.
create table crm_private.outbox (
  event_id uuid primary key references public.crm_lead_history(id),
  lead_id uuid not null references public.crm_leads(id),
  version integer not null,
  stage text not null,
  occurred_at timestamptz not null,
  meta_lead_id text not null,
  email text,
  phone text,
  status text not null,
  attempts integer not null default 0,
  due_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  unique (lead_id, version)
);
create index crm_outbox_due on crm_private.outbox (due_at) where status in ('queued', 'retry', 'sending');
alter table crm_private.outbox enable row level security;

create function crm_private.can_access(p_org bigint, p_studio bigint, p_admin boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from crm_private.staff_access a
    where a.auth_user_id = auth.uid() and a.active and a.organization_id = p_org
      and (a.role = 'admin' or (not p_admin and a.studio_id = p_studio))
  );
$$;
revoke all on function crm_private.can_access(bigint, bigint, boolean) from public, anon;
grant execute on function crm_private.can_access(bigint, bigint, boolean) to authenticated;

create policy crm_leads_read on public.crm_leads for select to authenticated
  using (crm_private.can_access(organization_id, studio_id));
create policy crm_history_read on public.crm_lead_history for select to authenticated
  using (crm_private.can_access(organization_id, studio_id));
revoke all on public.crm_leads, public.crm_lead_history from public, anon, authenticated;
grant select on public.crm_leads, public.crm_lead_history to authenticated;
revoke all on crm_private.staff_access, crm_private.outbox from public, anon, authenticated;
grant all on public.crm_leads, public.crm_lead_history, crm_private.staff_access, crm_private.outbox to service_role;

create function crm_private.record_stage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_status text;
begin
  if tg_op = 'UPDATE' and new.stage = old.stage then return new; end if;
  v_status := case when new.is_correction then 'held' else 'queued' end;
  insert into public.crm_lead_history
    (lead_id, organization_id, studio_id, version, from_stage, to_stage, changed_at, actor_id, note, is_correction, delivery_status)
  values (new.id, new.organization_id, new.studio_id, new.version,
    case when tg_op = 'UPDATE' then old.stage else null end,
    new.stage, new.changed_at, new.actor_id, new.change_note, new.is_correction, v_status)
  returning id into v_event;
  insert into crm_private.outbox (event_id, lead_id, version, stage, occurred_at, meta_lead_id, email, phone, status)
  values (v_event, new.id, new.version, new.stage, new.changed_at, new.meta_lead_id, new.email, new.phone, v_status);
  return new;
end;
$$;
revoke all on function crm_private.record_stage() from public, anon, authenticated;
create trigger crm_record_stage after insert or update of stage on public.crm_leads
for each row execute function crm_private.record_stage();

create function crm_private.change_stage(p_lead uuid, p_version integer, p_stage text, p_note text, p_correction boolean)
returns public.crm_leads language plpgsql security definer set search_path = '' as $$
declare v_lead public.crm_leads; v_admin boolean;
begin
  if auth.uid() is null then raise exception 'CRM_AUTH_REQUIRED' using errcode = '42501'; end if;
  select * into v_lead from public.crm_leads where id = p_lead;
  if not found or not crm_private.can_access(v_lead.organization_id, v_lead.studio_id) then
    raise exception 'CRM_ACCESS_DENIED' using errcode = '42501';
  end if;
  -- Check scope before locking; then re-read under the lock for optimistic concurrency.
  select * into v_lead from public.crm_leads where id = p_lead for update;
  if not crm_private.can_access(v_lead.organization_id, v_lead.studio_id) then
    raise exception 'CRM_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_version is distinct from v_lead.version then raise exception 'CRM_VERSION_CONFLICT'; end if;
  if p_stage is null or p_stage not in ('Intake', 'In-Progress', 'Qualified', 'Converted', 'Lost') then
    raise exception 'CRM_INVALID_STAGE';
  end if;
  if length(p_note) > 2000 then raise exception 'CRM_NOTE_TOO_LONG'; end if;
  if p_stage = v_lead.stage then return v_lead; end if;
  -- Conversion requires a separately reviewed verified-payment integration.
  if p_stage = 'Converted' then raise exception 'CRM_VERIFIED_PAYMENT_REQUIRED'; end if;
  v_admin := crm_private.can_access(v_lead.organization_id, v_lead.studio_id, true);
  if coalesce(p_correction, false) then
    if not v_admin then raise exception 'CRM_ADMIN_REQUIRED' using errcode = '42501'; end if;
    if nullif(btrim(p_note), '') is null then raise exception 'CRM_CORRECTION_REASON_REQUIRED'; end if;
  elsif not ((v_lead.stage = 'Intake' and p_stage = 'In-Progress')
      or (v_lead.stage = 'In-Progress' and p_stage = 'Qualified')
      or (v_lead.stage in ('Intake', 'In-Progress', 'Qualified') and p_stage = 'Lost')) then
    raise exception 'CRM_INVALID_TRANSITION';
  end if;
  update public.crm_leads set stage = p_stage, version = version + 1,
    changed_at = clock_timestamp(), actor_id = auth.uid(),
    change_note = nullif(btrim(p_note), ''), is_correction = coalesce(p_correction, false)
  where id = p_lead returning * into v_lead;
  return v_lead;
end;
$$;
revoke all on function crm_private.change_stage(uuid, integer, text, text, boolean) from public, anon;
grant execute on function crm_private.change_stage(uuid, integer, text, text, boolean) to authenticated;

create function public.crm_change_stage(p_lead uuid, p_version integer, p_stage text, p_note text default null, p_correction boolean default false)
returns public.crm_leads language sql security invoker set search_path = '' as $$
  select crm_private.change_stage(p_lead, p_version, p_stage, p_note, p_correction);
$$;
revoke all on function public.crm_change_stage(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.crm_change_stage(uuid, integer, text, text, boolean) to authenticated;

create function crm_private.my_scope()
returns table (studio_id bigint, studio_name text, organization_id bigint, is_admin boolean)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name::text, s.organization_id,
    crm_private.can_access(s.organization_id, s.id, true)
  from public.studios s where crm_private.can_access(s.organization_id, s.id);
$$;
revoke all on function crm_private.my_scope() from public, anon;
grant execute on function crm_private.my_scope() to authenticated;
create function public.crm_my_scope()
returns table (studio_id bigint, studio_name text, organization_id bigint, is_admin boolean)
language sql stable security invoker set search_path = '' as $$ select * from crm_private.my_scope(); $$;
revoke all on function public.crm_my_scope() from public, anon;
grant execute on function public.crm_my_scope() to authenticated;

-- Service-only intake contract. The caller must authenticate Meta's webhook and
-- retrieve the genuine lead before calling. Duplicate deliveries never reset stages.
create function public.crm_ingest_lead(p_org bigint, p_studio bigint, p_meta_lead_id text,
  p_name text, p_email text, p_phone text, p_style text, p_created_at timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.studios where id = p_studio and organization_id = p_org) then
    raise exception 'CRM_INVALID_STUDIO';
  end if;
  if p_created_at is null or p_created_at > now() + interval '5 minutes' then raise exception 'CRM_INVALID_TIME'; end if;
  insert into public.crm_leads (organization_id, studio_id, meta_lead_id, name, email, phone, style, created_at, changed_at)
  values (p_org, p_studio, p_meta_lead_id, p_name, p_email, p_phone, p_style, p_created_at, p_created_at)
  on conflict (meta_lead_id) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.crm_leads where meta_lead_id = p_meta_lead_id and organization_id = p_org and studio_id = p_studio;
    if v_id is null then raise exception 'CRM_LEAD_SCOPE_CONFLICT'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.crm_ingest_lead(bigint, bigint, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.crm_ingest_lead(bigint, bigint, text, text, text, text, text, timestamptz) to service_role;

create function public.crm_claim_events(p_limit integer default 10)
returns setof crm_private.outbox language plpgsql security invoker set search_path = '' as $$
begin
  return query
  with candidates as (
    select o.event_id from crm_private.outbox o
    where ((o.status in ('queued', 'retry') and o.due_at <= now()) or (o.status = 'sending' and o.lease_until < now()))
      and not exists (select 1 from crm_private.outbox earlier
        where earlier.lead_id = o.lead_id and earlier.version < o.version and earlier.status <> 'delivered')
    order by o.due_at, o.event_id for update of o skip locked limit greatest(1, least(coalesce(p_limit, 10), 20))
  ), claimed as (
    update crm_private.outbox o set status = 'sending', attempts = o.attempts + 1,
      lease_id = gen_random_uuid(), lease_until = now() + interval '5 minutes'
    from candidates c where o.event_id = c.event_id returning o.*
  ), history as (
    update public.crm_lead_history h set delivery_status = 'sending', attempts = c.attempts
    from claimed c where h.id = c.event_id
  ) select * from claimed;
end;
$$;
revoke all on function public.crm_claim_events(integer) from public, anon, authenticated;
grant execute on function public.crm_claim_events(integer) to service_role;

create function public.crm_finish_event(p_event uuid, p_lease uuid, p_status text, p_code text default null, p_delay_seconds integer default 60)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_status is null or p_status not in ('delivered', 'retry', 'failed', 'expired') then raise exception 'CRM_INVALID_DELIVERY_STATUS'; end if;
  if p_code is not null and p_code !~ '^[A-Z0-9_]{1,80}$' then raise exception 'CRM_INVALID_DELIVERY_CODE'; end if;
  update crm_private.outbox set status = p_status, lease_id = null, lease_until = null,
    due_at = now() + make_interval(secs => greatest(30, least(coalesce(p_delay_seconds, 60), 86400)))
  where event_id = p_event and lease_id = p_lease and status = 'sending' and lease_until > now()
  returning event_id into v_id;
  if v_id is null then return false; end if;
  update public.crm_lead_history set delivery_status = p_status, delivery_code = p_code where id = v_id;
  return true;
end;
$$;
revoke all on function public.crm_finish_event(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.crm_finish_event(uuid, uuid, text, text, integer) to service_role;

commit;
