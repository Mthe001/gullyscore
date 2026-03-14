-- GullyScore Pro - explicit admin/moderator RLS policies
-- Run this in the Supabase SQL Editor for existing projects

-- Teams
drop policy if exists "Admins can insert teams" on public.teams;
create policy "Admins can insert teams"
on public.teams
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can update teams" on public.teams;
create policy "Admins can update teams"
on public.teams
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can delete teams" on public.teams;
create policy "Admins can delete teams"
on public.teams
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- Players
drop policy if exists "Admins can insert players" on public.players;
create policy "Admins can insert players"
on public.players
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can update players" on public.players;
create policy "Admins can update players"
on public.players
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can delete players" on public.players;
create policy "Admins can delete players"
on public.players
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- Tournaments
drop policy if exists "Admins can insert tournaments" on public.tournaments;
create policy "Admins can insert tournaments"
on public.tournaments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can update tournaments" on public.tournaments;
create policy "Admins can update tournaments"
on public.tournaments
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can delete tournaments" on public.tournaments;
create policy "Admins can delete tournaments"
on public.tournaments
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- Matches
drop policy if exists "Admins can insert matches" on public.matches;
create policy "Admins can insert matches"
on public.matches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can update matches" on public.matches;
create policy "Admins can update matches"
on public.matches
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "Admins can delete matches" on public.matches;
create policy "Admins can delete matches"
on public.matches
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role = 'admin'
  )
);

-- Innings
drop policy if exists "Moderators can insert innings" on public.innings;
create policy "Moderators can insert innings"
on public.innings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

drop policy if exists "Moderators can update innings" on public.innings;
create policy "Moderators can update innings"
on public.innings
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

-- Balls
drop policy if exists "Moderators can insert balls" on public.balls;
create policy "Moderators can insert balls"
on public.balls
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

drop policy if exists "Moderators can update balls" on public.balls;
create policy "Moderators can update balls"
on public.balls
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

drop policy if exists "Moderators can delete balls" on public.balls;
create policy "Moderators can delete balls"
on public.balls
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

-- Player match stats
drop policy if exists "Moderators can insert player stats" on public.player_match_stats;
create policy "Moderators can insert player stats"
on public.player_match_stats
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);

drop policy if exists "Moderators can update player stats" on public.player_match_stats;
create policy "Moderators can update player stats"
on public.player_match_stats
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
)
with check (
  exists (
    select 1
    from public.users
    where id = auth.uid() and role in ('admin', 'moderator')
  )
);
