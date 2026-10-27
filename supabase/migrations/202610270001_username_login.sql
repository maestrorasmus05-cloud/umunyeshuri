-- Username sign-in support for NEXUS EDU / umunyeshuri.
-- Run this in Supabase SQL Editor before deploying the Edge Function.
create table if not exists public.auth_username_lookup (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  created_at timestamptz not null default now(),
  constraint auth_username_lookup_username_format
    check (username ~ '^[a-zA-Z0-9_\.]{3,24}$')
);
create unique index if not exists auth_username_lookup_username_lower_uq
  on public.auth_username_lookup (lower(username));
alter table public.auth_username_lookup enable row level security;
-- Intentionally no client-facing policies. Only the Edge Function's service key can read this table.

create or replace function public.sync_auth_username_lookup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  requested_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  if requested_username is not null then
    insert into public.auth_username_lookup(user_id, username, email)
    values (new.id, requested_username, lower(new.email))
    on conflict (user_id) do update
      set username = excluded.username, email = excluded.email;
  else
    insert into public.auth_username_lookup(user_id, username, email)
    values (new.id, 'user_' || replace(new.id::text, '-', ''), lower(new.email))
    on conflict (user_id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_auth_username_lookup on auth.users;
create trigger sync_auth_username_lookup
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_username_lookup();

-- Backfill existing users. Existing accounts receive a fallback username until they set one.
insert into public.auth_username_lookup(user_id, username, email)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data ->> 'username'), ''),
                'user_' || replace(u.id::text, '-', '')),
       lower(u.email)
from auth.users u
where u.email is not null
on conflict (user_id) do update set email = excluded.email;
