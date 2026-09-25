-- 19: Lock the booking database to signed-in admins (Keith). 25/09/2026.
-- Replaces the old "public" (anyone with the anon key) policies. No data is changed or deleted.

-- 1) Functions: fixed search_path, no privilege escalation via sign-up metadata
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and coalesce(status, 'active') <> 'disabled'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- New accounts always start as plain 'user'. Admin rights are granted only by an existing
  -- admin (admin page) — never from sign-up metadata, which anyone can set.
  insert into public.profiles (id, email, role, status)
  values (new.id, coalesce(new.email, ''), 'user', 'active')
  on conflict (id) do update set email = excluded.email;
  return new;
exception when others then
  raise log 'handle_new_user failed for %: % (SQLSTATE: %)', new.id, sqlerrm, sqlstate;
  return new;
end;
$$;

alter function public.update_updated_at() set search_path = '';
alter function public.set_planner_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 2) Drop the old open policies
drop policy if exists "Allow public delete" on public.bookings;
drop policy if exists "Allow public insert" on public.bookings;
drop policy if exists "Allow public read" on public.bookings;
drop policy if exists "Allow public update" on public.bookings;
drop policy if exists "Public read/write for booking_expenses" on public.booking_expenses;
drop policy if exists "Public read/write for booking_hotels" on public.booking_hotels;
drop policy if exists "Public read/write for flights" on public.flights;
drop policy if exists "Public read/write for members" on public.members;
drop policy if exists "Allow public delete planner_people" on public.planner_people;
drop policy if exists "Allow public insert planner_people" on public.planner_people;
drop policy if exists "Allow public read planner_people" on public.planner_people;
drop policy if exists "Allow public update planner_people" on public.planner_people;
drop policy if exists "Allow public delete planner_places" on public.planner_places;
drop policy if exists "Allow public insert planner_places" on public.planner_places;
drop policy if exists "Allow public read planner_places" on public.planner_places;
drop policy if exists "Allow public update planner_places" on public.planner_places;
drop policy if exists "Allow public delete planner_plans" on public.planner_plans;
drop policy if exists "Allow public insert planner_plans" on public.planner_plans;
drop policy if exists "Allow public read planner_plans" on public.planner_plans;
drop policy if exists "Allow public update planner_plans" on public.planner_plans;
drop policy if exists "Allow admin full access" on public.hotels;
drop policy if exists "Allow read for all authenticated users" on public.hotels;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

-- 3) Signed-in admins only
do $$
declare t text;
begin
  foreach t in array array['bookings','booking_expenses','booking_hotels','flights','members',
                           'planner_plans','planner_places','planner_people','hotels']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Signed-in admins full access" on public.%I for all to authenticated '
      'using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

create policy "Admins can read all profiles" on public.profiles for select to authenticated using ((select public.is_admin()));
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Admins can update profiles" on public.profiles for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins can delete profiles" on public.profiles for delete to authenticated using ((select public.is_admin()));
revoke all on table public.profiles from anon;
revoke all on table public._fm_note_chunks from anon, authenticated;

-- 4) Keep-alive: one harmless row the anon key may read (nothing else)
create table if not exists public.keep_alive (
  id smallint primary key,
  note text not null
);
insert into public.keep_alive (id, note) values (1, 'ok') on conflict (id) do nothing;
alter table public.keep_alive enable row level security;
revoke all on table public.keep_alive from anon, authenticated;
grant select on table public.keep_alive to anon, authenticated;
drop policy if exists "Anyone can read keep_alive" on public.keep_alive;
create policy "Anyone can read keep_alive" on public.keep_alive for select to anon, authenticated using (true);
