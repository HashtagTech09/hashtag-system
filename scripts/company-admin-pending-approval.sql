-- NOT A MIGRATION. Run only after explicit approval, against cughejedfefvblxyodtm.
-- Links the existing confirmed Auth account; never creates or resets an Auth user.
begin;
lock table public.users, public.user_roles in share row exclusive mode;
do $$
declare
  expected_auth_id constant uuid := 'f8a3b995-db66-4fbe-98ca-e706e489bd2d';
  staff_id bigint;
  admin_role_id bigint;
begin
  if not exists (select 1 from auth.users where id = expected_auth_id
    and lower(email) = 'tech@hashtag.dance' and email_confirmed_at is not null
    and (banned_until is null or banned_until < now())) then
    raise exception 'Expected confirmed company Auth user not found; stop and verify the project';
  end if;
  if not exists (select 1 from public.organizations where id = 1 and name = 'Hashtag Dance Company') then
    raise exception 'Expected company organization not found';
  end if;
  select id into strict admin_role_id from public.roles where name = 'admin' and type = 'organization';
  if exists (select 1 from public.users where
    (lower(email) = 'tech@hashtag.dance' and auth_id is distinct from expected_auth_id)
    or (auth_id = expected_auth_id and (organization_id <> 1 or lower(email) is distinct from 'tech@hashtag.dance'))) then
    raise exception 'Conflicting staff linkage; manual review required';
  end if;
  if not exists (select 1 from public.users where auth_id = expected_auth_id) then
    insert into public.users (organization_id, name, email, auth_id, scope_restricted)
    values (1, 'Hashtag Company Administrator', 'tech@hashtag.dance', expected_auth_id, false);
  end if;
  select id into strict staff_id from public.users where auth_id = expected_auth_id;
  update public.users set scope_restricted = false where id = staff_id;
  if not exists (select 1 from public.user_roles where user_id = staff_id
    and role_id = admin_role_id and organization_id = 1) then
    insert into public.user_roles (user_id, role_id, organization_id, is_primary)
    values (staff_id, admin_role_id, 1,
      not exists (select 1 from public.user_roles where user_id = staff_id and is_primary));
  end if;
end $$;
commit;
