-- Username sign-in support for NEXUS EDU / umunyeshuri.
-- Run this migration in Supabase SQL Editor before deploying the Edge Function.

create table if not exists public.auth_username_lookup (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Generated fallback usernames contain the full UUID (37 characters).
-- User-entered usernames are still validated as 3-24 characters by the app/function.
alter table public.auth_username_lookup
  drop constraint if exists auth_username_lookup_username_format;
alter table public.auth_username_lookup
  add constraint auth_username_lookup_username_format
  check (username ~ '^[a-z0-9_.]{3,40}$');

create unique index if not exists auth_username_lookup_username_lower_uq
  on public.auth_username_lookup (lower(username));

alter table public.auth_username_lookup enable row level security;
-- Intentionally no client-facing policies. Only trusted server-side service-role code
-- should read this table.

create or replace function public.sync_auth_username_lookup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
begin
  -- This lookup is for email-based Supabase Auth accounts.
  if new.email is null then
    delete from public.auth_username_lookup where user_id = new.id;
    return new;
  end if;

  requested_username := lower(nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), ''));

  if requested_username is not null then
    insert into public.auth_username_lookup(user_id, username, email)
    values (new.id, requested_username, lower(new.email))
    on conflict (user_id) do update
      set username = excluded.username, email = excluded.email;
  else
    insert into public.auth_username_lookup(user_id, username, email)
    values (new.id, 'user_' || replace(new.id::text, '-', ''), lower(new.email))
    on conflict (user_id) do update
      set email = excluded.email;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_auth_username_lookup on auth.users;
create trigger sync_auth_username_lookup
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_username_lookup();

-- Backfill existing email accounts with deterministic fallback usernames.
insert into public.auth_username_lookup(user_id, username, email)
select u.id, 'user_' || replace(u.id::text, '-', ''), lower(u.email)
from auth.users as u
where u.email is not null
on conflict (user_id) do update
set email = excluded.email;
