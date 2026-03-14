-- GULLYSCORE PRO - DATABASE SCHEMA
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. TABLES

-- Users extended profile
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('admin', 'moderator', 'client')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players
CREATE TABLE IF NOT EXISTS public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  avatar_url TEXT,
  matches_played INTEGER DEFAULT 0,
  total_runs INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  strike_rate DECIMAL(10,2) DEFAULT 0,
  total_wickets INTEGER DEFAULT 0,
  best_bowling TEXT DEFAULT '0/0',
  economy_rate DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT DEFAULT 'league', -- league, knockout
  start_date DATE,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  team_a UUID REFERENCES public.teams(id) NOT NULL,
  team_b UUID REFERENCES public.teams(id) NOT NULL,
  overs INTEGER DEFAULT 10,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  winner UUID REFERENCES public.teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Innings
CREATE TABLE IF NOT EXISTS public.innings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  innings_number INTEGER NOT NULL, -- 1 or 2
  batting_team UUID REFERENCES public.teams(id) NOT NULL,
  bowling_team UUID REFERENCES public.teams(id) NOT NULL,
  score INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  balls_bowled INTEGER DEFAULT 0,
  overs INTEGER DEFAULT 0,
  target INTEGER, -- only for 2nd innings
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Balls (Log)
CREATE TABLE IF NOT EXISTS public.balls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE NOT NULL,
  over_number INTEGER NOT NULL,
  ball_number INTEGER NOT NULL,
  runs INTEGER DEFAULT 0,
  event_type TEXT DEFAULT 'run' CHECK (event_type IN ('run', 'wide', 'no_ball', 'wicket')),
  batsman_id UUID REFERENCES public.players(id),
  bowler_id UUID REFERENCES public.players(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Match Statistics
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  runs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  overs_bowled DECIMAL(10,1) DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  UNIQUE(player_id, match_id)
);

-- 2. ENABLE REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'balls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.balls;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'innings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.innings;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
END $$;

-- 3. RLS POLICIES

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ
DROP POLICY IF EXISTS "Public Read" ON public.teams;
CREATE POLICY "Public Read" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Read" ON public.players;
CREATE POLICY "Public Read" ON public.players FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Read" ON public.tournaments;
CREATE POLICY "Public Read" ON public.tournaments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Read" ON public.matches;
CREATE POLICY "Public Read" ON public.matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Read" ON public.innings;
CREATE POLICY "Public Read" ON public.innings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Read" ON public.balls;
CREATE POLICY "Public Read" ON public.balls FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Read" ON public.player_match_stats;
CREATE POLICY "Public Read" ON public.player_match_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
CREATE POLICY "Users can view profiles" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ADMIN/MODERATOR WRITE
DROP POLICY IF EXISTS "Admin All" ON public.teams;
DROP POLICY IF EXISTS "Admins can insert teams" ON public.teams;
CREATE POLICY "Admins can insert teams" ON public.teams
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update teams" ON public.teams;
CREATE POLICY "Admins can update teams" ON public.teams
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;
CREATE POLICY "Admins can delete teams" ON public.teams
FOR DELETE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

DROP POLICY IF EXISTS "Admin All" ON public.players;
DROP POLICY IF EXISTS "Admins can insert players" ON public.players;
CREATE POLICY "Admins can insert players" ON public.players
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update players" ON public.players;
CREATE POLICY "Admins can update players" ON public.players
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete players" ON public.players;
CREATE POLICY "Admins can delete players" ON public.players
FOR DELETE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

DROP POLICY IF EXISTS "Admin All" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can insert tournaments" ON public.tournaments;
CREATE POLICY "Admins can insert tournaments" ON public.tournaments
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update tournaments" ON public.tournaments;
CREATE POLICY "Admins can update tournaments" ON public.tournaments
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete tournaments" ON public.tournaments;
CREATE POLICY "Admins can delete tournaments" ON public.tournaments
FOR DELETE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

DROP POLICY IF EXISTS "Admin All" ON public.matches;
DROP POLICY IF EXISTS "Admins can insert matches" ON public.matches;
CREATE POLICY "Admins can insert matches" ON public.matches
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update matches" ON public.matches;
CREATE POLICY "Admins can update matches" ON public.matches
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete matches" ON public.matches;
CREATE POLICY "Admins can delete matches" ON public.matches
FOR DELETE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

DROP POLICY IF EXISTS "Moderator All" ON public.innings;
DROP POLICY IF EXISTS "Moderators can insert innings" ON public.innings;
CREATE POLICY "Moderators can insert innings" ON public.innings
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can update innings" ON public.innings;
CREATE POLICY "Moderators can update innings" ON public.innings
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);

DROP POLICY IF EXISTS "Moderator All" ON public.balls;
DROP POLICY IF EXISTS "Moderators can insert balls" ON public.balls;
CREATE POLICY "Moderators can insert balls" ON public.balls
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can update balls" ON public.balls;
CREATE POLICY "Moderators can update balls" ON public.balls
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can delete balls" ON public.balls;
CREATE POLICY "Moderators can delete balls" ON public.balls
FOR DELETE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);

DROP POLICY IF EXISTS "Moderator All" ON public.player_match_stats;
DROP POLICY IF EXISTS "Moderators can insert player stats" ON public.player_match_stats;
CREATE POLICY "Moderators can insert player stats" ON public.player_match_stats
FOR INSERT TO authenticated
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can update player stats" ON public.player_match_stats;
CREATE POLICY "Moderators can update player stats" ON public.player_match_stats
FOR UPDATE TO authenticated
USING (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
)
WITH CHECK (
  exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'moderator'))
);

-- 4. TRIGGERS

-- Trigger to create public.users profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', 'client');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update aggregated player stats (Simplified example)
CREATE OR REPLACE FUNCTION public.update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.players
  SET 
    total_runs = (SELECT SUM(runs) FROM public.player_match_stats WHERE player_id = NEW.player_id),
    total_wickets = (SELECT SUM(wickets) FROM public.player_match_stats WHERE player_id = NEW.player_id),
    matches_played = (SELECT COUNT(*) FROM public.player_match_stats WHERE player_id = NEW.player_id)
  WHERE id = NEW.player_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_stats_update ON public.player_match_stats;
CREATE TRIGGER on_stats_update
  AFTER INSERT OR UPDATE ON public.player_match_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_player_stats();
