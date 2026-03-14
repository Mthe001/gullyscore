import { createClient } from '@supabase/supabase-js'

// Use fallback URLs during build time to prevent errors
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          role: 'admin' | 'moderator' | 'client'
          avatar_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      players: {
        Row: {
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
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          logo_url: string | null
        }
      }
      tournaments: {
        Row: {
          id: string
          name: string
          format: string
          start_date: string
          status: 'upcoming' | 'active' | 'completed'
        }
      }
      matches: {
        Row: {
          id: string
          tournament_id: string | null
          team_a: string
          team_b: string
          overs: number
          status: 'upcoming' | 'live' | 'completed'
          winner: string | null
          created_at: string
        }
      }
      innings: {
        Row: {
          id: string
          match_id: string
          batting_team: string
          bowling_team: string
          score: number
          wickets: number
          overs: number
        }
      }
      balls: {
        Row: {
          id: string
          match_id: string
          innings_id: string
          over_number: number
          ball_number: number
          runs: number
          event_type: 'run' | 'wide' | 'no_ball' | 'wicket'
          batsman_id: string | null
          bowler_id: string | null
          fielder_id: string | null
          timestamp: string
        }
      }
      player_match_stats: {
        Row: {
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
        }
      }
    }
  }
}
