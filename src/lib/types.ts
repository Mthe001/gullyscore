export type Role = 'admin' | 'moderator' | 'client'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar_url: string | null
  created_at: string
}

export interface Player {
  id: string
  name: string
  avatar_url: string | null
  team_id: string | null
  matches_played: number
  total_runs: number
  highest_score: number
  strike_rate: number
  total_wickets: number
  best_bowling: string
  economy_rate: number
  team?: Team
}

export interface Team {
  id: string
  name: string
  logo_url: string | null
}

export interface Tournament {
  id: string
  name: string
  format: string
  start_date: string
  status: 'upcoming' | 'active' | 'completed'
}

export interface Match {
  id: string
  tournament_id: string | null
  team_a: string
  team_b: string
  overs: number
  status: 'upcoming' | 'live' | 'completed'
  winner: string | null
  created_at: string
  team_a_data?: Team
  team_b_data?: Team
  tournament?: Tournament
}

export interface Innings {
  id: string
  match_id: string
  batting_team: string
  bowling_team: string
  score: number
  wickets: number
  overs: number
}

export type EventType = 'run' | 'wide' | 'no_ball' | 'wicket'

export interface Ball {
  id: string
  match_id: string
  innings_id: string
  over_number: number
  ball_number: number
  runs: number
  event_type: EventType
  batsman_id: string | null
  bowler_id: string | null
  fielder_id: string | null
  timestamp: string
}

export interface PlayerMatchStats {
  id: string
  player_id: string
  match_id: string
  runs: number
  balls: number
  fours: number
  sixes: number
  wickets: number
  overs_bowled: number
  runs_conceded: number
  catches?: number
  player?: Player
}

export interface ScoringState {
  match: Match
  innings: Innings
  currentOver: number
  currentBall: number
  striker: Player | null
  nonStriker: Player | null
  bowler: Player | null
  balls: Ball[]
  playerStats: Record<string, PlayerMatchStats>
}

export interface WormPoint {
  over: number
  teamA: number
  teamB: number
}

export interface WinProbabilityPoint {
  over: number
  probability: number
}

export interface LeaderboardEntry {
  rank: number
  player: Player
  stat: number
}
