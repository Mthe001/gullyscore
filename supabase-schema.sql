-- GullyScore Pro Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'moderator', 'client')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players
CREATE TABLE IF NOT EXISTS public.players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  matches_played INT DEFAULT 0,
  total_runs INT DEFAULT 0,
  highest_score INT DEFAULT 0,
  strike_rate NUMERIC(10,2) DEFAULT 0,
  total_wickets INT DEFAULT 0,
  best_bowling TEXT DEFAULT '0/0',
  economy_rate NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'league',
  start_date DATE,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  team_a UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  team_b UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  overs INT DEFAULT 10,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  winner UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  toss_winner UUID REFERENCES public.teams(id),
  toss_decision TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Innings
CREATE TABLE IF NOT EXISTS public.innings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  innings_number INT DEFAULT 1,
  batting_team UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  bowling_team UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  score INT DEFAULT 0,
  wickets INT DEFAULT 0,
  overs INT DEFAULT 0,
  balls_bowled INT DEFAULT 0,
  extras INT DEFAULT 0,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Balls
CREATE TABLE IF NOT EXISTS public.balls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  innings_id UUID REFERENCES public.innings(id) ON DELETE CASCADE NOT NULL,
  over_number INT NOT NULL DEFAULT 0,
  ball_number INT NOT NULL DEFAULT 0,
  runs INT NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL CHECK (event_type IN ('run', 'wide', 'no_ball', 'wicket')),
  batsman_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  bowler_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  fielder_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Player match stats
CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  runs INT DEFAULT 0,
  balls INT DEFAULT 0,
  fours INT DEFAULT 0,
  sixes INT DEFAULT 0,
  wickets INT DEFAULT 0,
  overs_bowled NUMERIC(4,1) DEFAULT 0,
  runs_conceded INT DEFAULT 0,
  catches INT DEFAULT 0,
  UNIQUE(player_id, match_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS "Public read teams" ON public.teams;
CREATE POLICY "Public read teams" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read players" ON public.players;
CREATE POLICY "Public read players" ON public.players FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read tournaments" ON public.tournaments;
CREATE POLICY "Public read tournaments" ON public.tournaments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read matches" ON public.matches;
CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read innings" ON public.innings;
CREATE POLICY "Public read innings" ON public.innings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read balls" ON public.balls;
CREATE POLICY "Public read balls" ON public.balls FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read player_match_stats" ON public.player_match_stats;
CREATE POLICY "Public read player_match_stats" ON public.player_match_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can see their own info" ON public.users;
CREATE POLICY "Users can see their own info" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admin/moderator write policies
DROP POLICY IF EXISTS "Admin can do all on teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can insert teams" ON public.teams;
CREATE POLICY "Admins can insert teams" ON public.teams
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update teams" ON public.teams;
CREATE POLICY "Admins can update teams" ON public.teams
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete teams" ON public.teams;
CREATE POLICY "Admins can delete teams" ON public.teams
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin can do all on players" ON public.players;
DROP POLICY IF EXISTS "Admins can insert players" ON public.players;
CREATE POLICY "Admins can insert players" ON public.players
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update players" ON public.players;
CREATE POLICY "Admins can update players" ON public.players
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete players" ON public.players;
CREATE POLICY "Admins can delete players" ON public.players
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin can do all on tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can insert tournaments" ON public.tournaments;
CREATE POLICY "Admins can insert tournaments" ON public.tournaments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update tournaments" ON public.tournaments;
CREATE POLICY "Admins can update tournaments" ON public.tournaments
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete tournaments" ON public.tournaments;
CREATE POLICY "Admins can delete tournaments" ON public.tournaments
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin can do all on matches" ON public.matches;
DROP POLICY IF EXISTS "Admins can insert matches" ON public.matches;
CREATE POLICY "Admins can insert matches" ON public.matches
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can update matches" ON public.matches;
CREATE POLICY "Admins can update matches" ON public.matches
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins can delete matches" ON public.matches;
CREATE POLICY "Admins can delete matches" ON public.matches
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Moderator can update innings" ON public.innings;
DROP POLICY IF EXISTS "Moderators can insert innings" ON public.innings;
CREATE POLICY "Moderators can insert innings" ON public.innings
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can update innings" ON public.innings;
CREATE POLICY "Moderators can update innings" ON public.innings
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

DROP POLICY IF EXISTS "Moderator can insert balls" ON public.balls;
DROP POLICY IF EXISTS "Moderators can insert balls" ON public.balls;
CREATE POLICY "Moderators can insert balls" ON public.balls
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can update balls" ON public.balls;
CREATE POLICY "Moderators can update balls" ON public.balls
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can delete balls" ON public.balls;
CREATE POLICY "Moderators can delete balls" ON public.balls
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

DROP POLICY IF EXISTS "Moderator can update stats" ON public.player_match_stats;
DROP POLICY IF EXISTS "Moderators can insert player stats" ON public.player_match_stats;
CREATE POLICY "Moderators can insert player stats" ON public.player_match_stats
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);
DROP POLICY IF EXISTS "Moderators can update player stats" ON public.player_match_stats;
CREATE POLICY "Moderators can update player stats" ON public.player_match_stats
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'moderator'))
);

-- Auto insert new user into users table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, 'client')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime on key tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'balls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.balls;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'innings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.innings;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
END $$;
