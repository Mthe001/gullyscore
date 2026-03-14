'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Trophy } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { getScoreText, getTeamInnings, sortInnings } from '@/lib/match-helpers'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

async function fetchMatches(filter: string) {
  let query = supabase
    .from('matches')
    .select(`
      *,
      team_a_data:teams!matches_team_a_fkey(id, name, logo_url),
      team_b_data:teams!matches_team_b_fkey(id, name, logo_url),
      innings(id, score, wickets, balls_bowled, batting_team, innings_number, is_complete, created_at)
    `)
    .order('created_at', { ascending: false })

  if (filter !== 'all') query = query.eq('status', filter)

  const { data, error } = await query
  if (error) return []

  return (data || []).map(match => ({
    ...match,
    innings: sortInnings(match.innings),
  }))
}

function MatchCard({ match }: { match: any }) {
  const teamAInnings = getTeamInnings(match.innings, match.team_a)
  const teamBInnings = getTeamInnings(match.innings, match.team_b)

  const statusColor: Record<string, string> = {
    live: 'text-red-400 bg-red-400/10',
    completed: 'text-green-400 bg-green-400/10',
    upcoming: 'text-amber-400 bg-amber-400/10',
  }

  const teamAInitials = match.team_a_data?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join('')

  const teamBInitials = match.team_b_data?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join('')

  return (
    <Link href={`/match/${match.id}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="glass-card relative cursor-pointer overflow-hidden rounded-2xl p-4 group"
      >
        {match.status === 'live' && (
          <div className="absolute left-0 right-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))' }} />
        )}

        <div className="mb-3 flex items-center justify-between">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${statusColor[match.status]}`}>
            {match.status === 'live' && <span className="live-dot" style={{ width: 6, height: 6 }} />}
            {match.status}
          </span>
          <span className="text-xs text-muted-foreground">{match.overs} overs</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 ring-1 ring-purple-400/30">
                <AvatarImage src={match.team_a_data?.logo_url || undefined} alt={match.team_a_data?.name || 'Team A'} />
                <AvatarFallback className="bg-purple-500/20 text-xs font-bold text-purple-300">
                  {teamAInitials || 'A'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">{match.team_a_data?.name}</span>
              {match.winner === match.team_a && <span className="text-xs text-amber-400">Winner</span>}
            </div>
            <span className="font-black tabular-nums">{getScoreText(teamAInnings)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 ring-1 ring-teal-400/30">
                <AvatarImage src={match.team_b_data?.logo_url || undefined} alt={match.team_b_data?.name || 'Team B'} />
                <AvatarFallback className="bg-teal-500/20 text-xs font-bold text-teal-300">
                  {teamBInitials || 'B'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">{match.team_b_data?.name}</span>
              {match.winner === match.team_b && <span className="text-xs text-amber-400">Winner</span>}
            </div>
            <span className="font-black tabular-nums">{getScoreText(teamBInnings)}</span>
          </div>
        </div>

        <div className="mt-3 border-t border-white/5 pt-3 text-xs text-muted-foreground">
          {match.status === 'upcoming' && 'Scheduled. Team A is set to bat first when the match starts.'}
          {match.status === 'live' && 'Live scoring in progress'}
          {match.status === 'completed' && (match.winner ? 'Result recorded' : 'Match completed')}
        </div>
      </motion.div>
    </Link>
  )
}

export default function MatchesPage() {
  const [filter, setFilter] = useState('all')
  const { isAdmin } = useAuth()
  const { data: matches } = useQuery({
    queryKey: ['matches', filter],
    queryFn: () => fetchMatches(filter),
    refetchInterval: 10000,
  })

  const filters = ['all', 'live', 'upcoming', 'completed']

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-3xl mx-auto px-4 pb-24 pt-24">
        <div className="mt-4 mb-10 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black gradient-text md:text-5xl">Matches</h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-50">Live & Recent Games</p>
          </div>
          {isAdmin && (
            <Link href="/admin/matches/new">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
              >
                <Plus size={16} /> New Match
              </motion.button>
            </Link>
          )}
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {filters.map(currentFilter => (
            <button
              key={currentFilter}
              onClick={() => setFilter(currentFilter)}
              className={`flex-shrink-0 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                filter === currentFilter
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'glass-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {currentFilter}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {matches && matches.length > 0 ? (
            matches.map(match => <MatchCard key={match.id} match={match} />)
          ) : (
            <div className="glass rounded-2xl p-12 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No matches found</p>
              {isAdmin && (
                <Link href="/admin/matches/new">
                  <button className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
                    Create First Match
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
