'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Radio,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { getTeamInnings, sortInnings } from '@/lib/match-helpers'

type HomeStats = {
  liveMatches: number
  totalMatches: number
  totalPlayers: number
}

type TeamLite = {
  id?: string
  name?: string | null
  logo_url?: string | null
}

type InningsLite = {
  id: string
  batting_team: string
  bowling_team: string
  score: number
  wickets: number
  balls_bowled: number
}

type HomeMatch = {
  id: string
  overs: number
  status?: 'upcoming' | 'live' | 'completed'
  winner?: string | null
  created_at?: string | null
  team_a: string
  team_b: string
  innings?: InningsLite[]
  team_a_data?: TeamLite | null
  team_b_data?: TeamLite | null
  team_a_players?: string[]
  team_b_players?: string[]
}

type HomeTournament = {
  id: string
  name: string
  format?: string | null
  start_date?: string | null
  status?: string | null
}

type HomePlayer = {
  id: string
  name: string
  avatar_url?: string | null
  matches_played: number
  total_runs: number
  highest_score: number
  strike_rate: number
  team?: Array<{
    name?: string | null
  }> | null
}

async function fetchLiveMatches(): Promise<HomeMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team_a_data:teams!matches_team_a_fkey(id, name, logo_url),
      team_b_data:teams!matches_team_b_fkey(id, name, logo_url),
      innings(*)
    `)
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    console.error('[home] Failed to load live matches', error)
    return []
  }

  return (data || []).map(match => ({
    ...match,
    innings: sortInnings(match.innings || []),
  }))
}

async function fetchRecentMatches(): Promise<HomeMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team_a_data:teams!matches_team_a_fkey(id, name, logo_url),
      team_b_data:teams!matches_team_b_fkey(id, name, logo_url),
      innings(*)
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(4)

  if (error) {
    console.error('[home] Failed to load recent matches', error)
    return []
  }

  return (data || []).map(match => ({
    ...match,
    innings: sortInnings(match.innings || []),
  }))
}

async function fetchUpcomingMatches(): Promise<HomeMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team_a_data:teams!matches_team_a_fkey(id, name, logo_url),
      team_b_data:teams!matches_team_b_fkey(id, name, logo_url)
    `)
    .eq('status', 'upcoming')
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    console.error('[home] Failed to load upcoming matches', error)
    return []
  }

  const matches = data || []
  const teamIds = Array.from(new Set(
    matches.flatMap(match => [match.team_a, match.team_b]).filter(Boolean)
  ))

  if (!teamIds.length) {
    return matches
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, name, team_id')
    .in('team_id', teamIds)

  if (playersError) {
    console.error('[home] Failed to load upcoming match players', playersError)
    return matches
  }

  const playersByTeam = new Map<string, string[]>()
  for (const player of players || []) {
    if (!player.team_id) continue
    const list = playersByTeam.get(player.team_id) || []
    list.push(player.name)
    playersByTeam.set(player.team_id, list)
  }

  return matches.map(match => ({
    ...match,
    team_a_players: playersByTeam.get(match.team_a) || [],
    team_b_players: playersByTeam.get(match.team_b) || [],
  }))
}

async function fetchTournaments(): Promise<HomeTournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(3)

  if (error) {
    console.error('[home] Failed to load tournaments', error)
    return []
  }

  return data || []
}

async function fetchTopPlayers(): Promise<HomePlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      id,
      name,
      avatar_url,
      matches_played,
      total_runs,
      highest_score,
      strike_rate,
      team:teams(name)
    `)
    .order('total_runs', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[home] Failed to load top players', error)
    return []
  }

  return data || []
}

async function fetchHomeStats(): Promise<HomeStats> {
  const [liveMatchesRes, matchesRes, playersRes] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('matches').select('*', { count: 'exact', head: true }),
    supabase.from('players').select('*', { count: 'exact', head: true }),
  ])

  if (liveMatchesRes.error) {
    console.error('[home-stats] Failed to load live match count', liveMatchesRes.error)
  }

  if (matchesRes.error) {
    console.error('[home-stats] Failed to load total match count', matchesRes.error)
  }

  if (playersRes.error) {
    console.error('[home-stats] Failed to load player count', playersRes.error)
  }

  return {
    liveMatches: liveMatchesRes.count || 0,
    totalMatches: matchesRes.count || 0,
    totalPlayers: playersRes.count || 0,
  }
}

function formatOvers(totalBalls: number) {
  return `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`
}

function formatDate(date?: string | null) {
  if (!date) {
    return 'Schedule pending'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

function getUpcomingStatus(match: HomeMatch) {
  if (!match.created_at) return 'Match Pending'
  const createdAt = new Date(match.created_at).getTime()
  const diffHours = (Date.now() - createdAt) / (1000 * 60 * 60)
  if (diffHours < 4) return 'Starting Soon'
  if (diffHours < 24) return 'Waiting for Toss'
  return 'Match Pending'
}

function getWinnerLabel(match?: HomeMatch | null) {
  if (!match?.winner) return 'Winner determined'

  const winner = match.winner.trim()
  if (!winner) return 'Winner determined'

  const teamAName = match.team_a_data?.name || 'Team A'
  const teamBName = match.team_b_data?.name || 'Team B'

  if (winner === match.team_a) return `${teamAName} won`
  if (winner === match.team_b) return `${teamBName} won`
  if (winner.toLowerCase() === teamAName.toLowerCase()) return `${teamAName} won`
  if (winner.toLowerCase() === teamBName.toLowerCase()) return `${teamBName} won`

  // If winner contains an internal UUID-like value, hide it from UI.
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(winner)
  return looksLikeUuid ? 'Winner determined' : winner
}

function getInitial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || '?'
}

function getStatusLabel(status?: HomeMatch['status']) {
  if (status === 'live') return 'LIVE'
  if (status === 'completed') return 'COMPLETED'
  return 'UPCOMING'
}

function getStatusClasses(status?: HomeMatch['status']) {
  if (status === 'live') {
    return 'border-rose-500/30 bg-rose-500/12 text-rose-300 shadow-[0_0_30px_-18px_rgba(244,63,94,0.9)]'
  }

  if (status === 'completed') {
    return 'border-amber-400/30 bg-amber-400/12 text-amber-300 shadow-[0_0_30px_-18px_rgba(251,191,36,0.75)]'
  }

  return 'border-slate-400/20 bg-slate-400/10 text-slate-300'
}

function TeamAvatar({
  team,
  fallbackClass,
}: {
  team?: TeamLite | null
  fallbackClass: string
}) {
  if (team?.logo_url) {
    return (
      <img
        src={team.logo_url}
        alt={team.name || 'Team logo'}
        className="h-12 w-12 rounded-full border border-white/10 object-cover shadow-[0_12px_35px_-25px_rgba(148,163,184,0.9)]"
      />
    )
  }

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/10 text-sm font-black ${fallbackClass}`}>
      {getInitial(team?.name)}
    </div>
  )
}

function StatusBadge({ status }: { status?: HomeMatch['status'] }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] ${getStatusClasses(status)}`}>
      {status === 'live' ? <span className="live-glow h-2 w-2 rounded-full" /> : null}
      {getStatusLabel(status)}
    </span>
  )
}

function FeaturedTeamRow({
  team,
  innings,
  status,
  players,
  fallbackClass,
  emptyLabel,
}: {
  team?: TeamLite | null
  innings?: InningsLite | null
  status?: HomeMatch['status']
  players?: string[]
  fallbackClass: string
  emptyLabel: string
}) {
  const isUpcoming = status === 'upcoming'
  const hasScore = typeof innings?.score === 'number'
  const lineupPreview = players?.slice(0, 3).join(' · ')

  return (
    <div className="rounded-[22px] border border-white/8   bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeamAvatar team={team} fallbackClass={fallbackClass} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{team?.name || emptyLabel}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {isUpcoming ? 'Squad update' : hasScore ? 'Current innings' : 'Yet to bat'}
            </p>
            {isUpcoming ? (
              <p className="mt-1 truncate text-xs text-slate-400">
                {lineupPreview || 'Lineup will appear after squad setup'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="text-right">
          {isUpcoming ? (
            <>
              <p className="text-sm font-bold text-white">{players?.length || 0} ready</p>
              <p className="text-xs font-medium text-slate-400">
                {players?.length ? 'Players loaded' : 'Awaiting squad'}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-white">
                {hasScore ? `${innings.score}/${innings.wickets}` : '--'}
              </p>
              <p className="text-xs font-medium text-slate-400">
                {hasScore ? `${formatOvers(innings?.balls_bowled || 0)} ov` : 'Yet to bat'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FeaturedMatchCard({ match }: { match: HomeMatch }) {
  const innings = sortInnings(match.innings || [])
  const teamAInnings = getTeamInnings(innings, match.team_a)
  const teamBInnings = getTeamInnings(innings, match.team_b)
  const teamAName = match.team_a_data?.name || 'Team A'
  const teamBName = match.team_b_data?.name || 'Team B'
  const isLive = match.status === 'live'
  const isCompleted = match.status === 'completed'
  const isUpcoming = match.status === 'upcoming'
  const headline = isCompleted
    ? getWinnerLabel(match)
    : isLive
      ? 'Live score building over by over'
      : getUpcomingStatus(match)
  const summary = isCompleted
    ? 'Final score locked in. Open the full scorecard for batting and bowling details.'
    : isLive
      ? `${match.overs} over match in progress. Tap in for ball-by-ball scoring.`
      : `Status: ${getUpcomingStatus(match)}`

  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300">Featured Match</p>
          <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{teamAName} vs {teamBName}</p>
        </div>
        <StatusBadge status={match.status} />
      </div>

      <div className="space-y-3">
        <FeaturedTeamRow
          team={match.team_a_data}
          innings={teamAInnings}
          status={match.status}
          players={match.team_a_players}
          fallbackClass="bg-cyan-400/10 text-cyan-300"
          emptyLabel="Team A"
        />
        <FeaturedTeamRow
          team={match.team_b_data}
          innings={teamBInnings}
          status={match.status}
          players={match.team_b_players}
          fallbackClass="bg-indigo-400/10 text-indigo-300"
          emptyLabel="Team B"
        />
      </div>

      <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
        <div className="flex flex-col gap-4 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
          <div>
            <p className={`text-sm font-bold ${isCompleted ? 'text-amber-300' : isLive ? 'text-rose-300' : 'text-slate-200'}`}>
              {headline}
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">{summary}</p>
          </div>
          <Link
            href={`/match/${match.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/35 hover:bg-cyan-400/15 hover:text-white"
          >
            {isUpcoming ? 'View match' : 'Open scorecard'}
          </Link>
        </div>
      </div>
    </div>
  )
}

function FeaturedMatchCarousel({ matches }: { matches: HomeMatch[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const safeActiveIndex = matches.length ? Math.min(activeIndex, matches.length - 1) : 0

  useEffect(() => {
    if (matches.length <= 1) return

    const interval = window.setInterval(() => {
      setActiveIndex(current => (current + 1) % matches.length)
    }, 5000)

    return () => window.clearInterval(interval)
  }, [matches.length])

  const goToPrevious = () => {
    setActiveIndex(current => (current - 1 + matches.length) % matches.length)
  }

  const goToNext = () => {
    setActiveIndex(current => (current + 1) % matches.length)
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX || null)
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || matches.length <= 1) return

    const swipeDistance = (event.changedTouches[0]?.clientX || 0) - touchStartX
    setTouchStartX(null)

    if (Math.abs(swipeDistance) < 45) return

    if (swipeDistance < 0) {
      goToNext()
      return
    }

    goToPrevious()
  }

  const activeMatch = matches[safeActiveIndex]

  if (!activeMatch) {
    return (
      <div className="rounded-[30px] border border-dashed border-white/10 bg-white/4 px-5 py-10 text-center text-slate-400">
        Create a match to light up this dashboard.
      </div>
    )
  }

  return (
    //  card carousel  body here--------------->>>>
    <div className=" lg:w-[90%] w-full"  onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="overflow-hidden">
        <motion.div
          className="flex"
          animate={{ x: `-${safeActiveIndex * 100}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {matches.map(match => (
            <div key={match.id} className="w-full shrink-0">
              <FeaturedMatchCard match={match} />
            </div>
          ))}
        </motion.div>
      </div>

      {matches.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-slate-200 backdrop-blur transition hover:border-cyan-300/35 hover:text-white min-[430px]:inline-flex"
            aria-label="Previous featured match"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-slate-200 backdrop-blur transition hover:border-cyan-300/35 hover:text-white min-[430px]:inline-flex"
            aria-label="Next featured match"
          >
            <ChevronRight size={16} />
          </button>

          <div className="mt-4 flex items-center justify-center gap-2">
            {matches.map((match, index) => (
              <button
                key={match.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${index === safeActiveIndex ? 'w-8 bg-cyan-300' : 'w-2.5 bg-white/20 hover:bg-white/35'}`}
                aria-label={`Show featured match ${index + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function SectionHeader({
  title,
  href,
  cta,
  icon,
}: {
  title: string
  href: string
  cta: string
  icon: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
        {icon}
        {title}
      </h2>
      <Link href={href} className="flex items-center gap-1 text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
        {cta}
        <ChevronRight size={14} />
      </Link>
    </div>
  )
}

function ScoreRow({
  teamName,
  score,
  wickets,
  ballsBowled,
  accentClass,
}: {
  teamName?: string | null
  score?: number
  wickets?: number
  ballsBowled?: number
  accentClass: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-sm font-black ${accentClass}`}>
          {getInitial(teamName)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{teamName || 'TBD Team'}</p>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current innings</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-black text-white">
          {typeof score === 'number' ? `${score}/${wickets || 0}` : '--'}
        </p>
        <p className="text-xs font-medium text-slate-400">
          {typeof ballsBowled === 'number' ? `${formatOvers(ballsBowled)} ov` : 'Yet to bat'}
        </p>
      </div>
    </div>
  )
}

function LiveMatchCard({ match }: { match: HomeMatch }) {
  const teamAInnings = getTeamInnings(match.innings, match.team_a)
  const teamBInnings = getTeamInnings(match.innings, match.team_b)

  return (
    <Link href={`/match/${match.id}`} className="block min-w-[86vw] max-w-[86vw] snap-start sm:min-w-0 sm:max-w-none">
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="h-full rounded-[26px] border border-cyan-500/15 bg-[linear-gradient(160deg,rgba(14,24,39,0.98),rgba(4,13,27,0.92))] p-4 shadow-[0_20px_80px_-30px_rgba(34,211,238,0.28)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-rose-300">
            <span className="live-glow h-2 w-2 rounded-full" />
            Live
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{match.overs} overs</span>
        </div>

        <div className="space-y-3">
          <ScoreRow
            teamName={match.team_a_data?.name}
            score={teamAInnings?.score}
            wickets={teamAInnings?.wickets}
            ballsBowled={teamAInnings?.balls_bowled}
            accentClass="bg-cyan-400/10 text-cyan-300"
          />
          <ScoreRow
            teamName={match.team_b_data?.name}
            score={teamBInnings?.score}
            wickets={teamBInnings?.wickets}
            ballsBowled={teamBInnings?.balls_bowled}
            accentClass="bg-indigo-400/10 text-indigo-300"
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4">
          <p className="text-sm text-slate-300">Track the live over-by-over flow.</p>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-300">
            Open
            <ArrowUpRight size={14} />
          </span>
        </div>
      </motion.div>
    </Link>
  )
}

function TournamentCard({ tournament }: { tournament: HomeTournament }) {
  const dateParts = formatDate(tournament.start_date).split(' ')

  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,20,32,0.98),rgba(8,12,23,0.92))] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-white">{tournament.name}</p>
          <p className="mt-1 text-sm text-slate-400">{formatDate(tournament.start_date)}</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
          {tournament.status || tournament.format || 'Series'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-white/4 px-3 py-3">
          <p className="text-xl font-black text-white">{tournament.format?.toUpperCase() || 'T20'}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">Format</p>
        </div>
        <div className="rounded-2xl bg-white/4 px-3 py-3">
          <p className="text-xl font-black text-cyan-300">{dateParts[0] || '--'}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">Month</p>
        </div>
        <div className="rounded-2xl bg-white/4 px-3 py-3">
          <p className="text-xl font-black text-indigo-300">{dateParts[1] || '--'}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">Day</p>
        </div>
      </div>
    </div>
  )
}

function UpcomingMatchCard({ match }: { match: HomeMatch }) {
  const teamAPlayers = match.team_a_players || []
  const teamBPlayers = match.team_b_players || []
  const statusLabel = getUpcomingStatus(match)

  return (
    <Link href={`/match/${match.id}`} className="block min-w-[86vw] max-w-[86vw] snap-start sm:min-w-0 sm:max-w-none">
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        className="h-full rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,32,0.98),rgba(9,15,26,0.92))] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
            Upcoming
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{match.overs} overs</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-sm font-black text-cyan-300">
              {getInitial(match.team_a_data?.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{match.team_a_data?.name || 'Team A'}</p>
              <p className="text-xs text-slate-500">Players ready</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/10 text-sm font-black text-indigo-300">
              {getInitial(match.team_b_data?.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{match.team_b_data?.name || 'Team B'}</p>
              <p className="text-xs text-slate-500">Lineup pending</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-white/8 bg-white/4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Match Status</p>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
              {statusLabel}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/6 bg-black/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                {match.team_a_data?.name || 'Team A'} Players
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {teamAPlayers.length > 0 ? (
                  teamAPlayers.slice(0, 3).map(player => (
                    <p key={player} className="truncate">- {player}</p>
                  ))
                ) : (
                  <p className="text-slate-500">No players yet</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/6 bg-black/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                {match.team_b_data?.name || 'Team B'} Players
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {teamBPlayers.length > 0 ? (
                  teamBPlayers.slice(0, 3).map(player => (
                    <p key={player} className="truncate">- {player}</p>
                  ))
                ) : (
                  <p className="text-slate-500">No players yet</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 pt-3 text-xs text-slate-400">
            <span>{formatDate(match.created_at)}</span>
            <span className="uppercase tracking-[0.22em]">Match day</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function HomePage() {
  const queryClient = useQueryClient()

  const { data: liveMatches } = useQuery({ queryKey: ['live-matches'], queryFn: fetchLiveMatches, refetchInterval: 5000 })
  const { data: recentMatches } = useQuery({ queryKey: ['recent-matches'], queryFn: fetchRecentMatches, refetchInterval: 10000 })
  const { data: upcomingMatches } = useQuery({ queryKey: ['upcoming-matches'], queryFn: fetchUpcomingMatches, refetchInterval: 10000 })
  const { data: tournaments } = useQuery({ queryKey: ['home-tournaments'], queryFn: fetchTournaments, refetchInterval: 30000 })
  const { data: topPlayers } = useQuery({ queryKey: ['top-players'], queryFn: fetchTopPlayers, refetchInterval: 10000 })
  const { data: homeStats } = useQuery({ queryKey: ['home-stats'], queryFn: fetchHomeStats, refetchInterval: 5000 })

  useEffect(() => {
    const channel = supabase
      .channel('home-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-stats'] })
        queryClient.invalidateQueries({ queryKey: ['live-matches'] })
        queryClient.invalidateQueries({ queryKey: ['recent-matches'] })
        queryClient.invalidateQueries({ queryKey: ['upcoming-matches'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-stats'] })
        queryClient.invalidateQueries({ queryKey: ['top-players'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['home-tournaments'] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const featuredMatches = useMemo(() => {
    const priority: Record<string, number> = {
      live: 0,
      upcoming: 1,
      completed: 2,
    }

    const uniqueMatches = new Map<string, HomeMatch>()
    const mergedMatches = [
      ...(liveMatches || []),
      ...(upcomingMatches || []),
      ...(recentMatches || []),
    ]

    for (const match of mergedMatches) {
      if (!match?.id || uniqueMatches.has(match.id)) continue
      uniqueMatches.set(match.id, match)
    }

    return Array.from(uniqueMatches.values())
      .sort((a, b) => {
        const priorityDifference = (priority[a.status || 'upcoming'] ?? 99) - (priority[b.status || 'upcoming'] ?? 99)
        if (priorityDifference !== 0) return priorityDifference

        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 5)
  }, [liveMatches, recentMatches, upcomingMatches])

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-24 pt-20 md:pt-24">
        <section className=" overflow-hidden px-4 pt-6 md:pt-10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_86%_4%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(180deg,rgba(3,8,20,0.98),rgba(2,7,17,1))]" />
          <div className="absolute inset-0 -z-10 opacity-[0.16] bg-[linear-gradient(120deg,transparent_0%,transparent_46%,rgba(125,211,252,0.22)_49%,transparent_52%,transparent_100%),repeating-linear-gradient(90deg,rgba(148,163,184,0.16)_0px,rgba(148,163,184,0.16)_1px,transparent_1px,transparent_68px)]" />
          <div className="mx-auto lg:max-w-[76%] lg:pb-[10%]   w-full ">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="flex flex-col rounded-xl w-full   bg-[radial-gradient(circle_at_15%_0%,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_86%_4%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(180deg,rgba(3,8,20,0.98),rgba(2,7,17,1))] shadow-[0_30px_120px_-50px_rgba(34,211,238,0.45)]"
            >
              <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 right-8 h-44 w-44 rounded-full bg-cyan-400/20 blur-3xl" />
              <div className="flex flex-col gap-8 p-4 min-[430px]:p-5 md:grid-cols-[1.02fr_0.98fr] md:p-8 xl:p-10">

                <div className='relative'>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 shadow-[0_12px_45px_-28px_rgba(34,211,238,0.9)]">
                    <Zap size={14} />
                    Live Gully Command Center
                  </div>

                  <div className="mt-5 w-auto">
                    <h1 className="text-[2.6rem] font-black leading-[0.95] tracking-tight text-white min-[430px]:text-5xl md:text-6xl">
                      Score every over,
                      <span className="block bg-[linear-gradient(135deg,#67e8f9,#93c5fd,#818cf8)] bg-clip-text text-transparent">
                        own every moment
                      </span>
                    </h1>
                    <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300 min-[430px]:text-base md:text-lg">
                      A professional live scoring cockpit built for tennis-ball gully cricket. Track featured games, run rate pressure, and player momentum with one mobile-first dashboard.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2.5 min-[430px]:gap-3">
                    {[
                      { label: 'Live', value: homeStats?.liveMatches ?? 0, active: true },
                      { label: 'Completed', value: recentMatches?.length ?? 0, active: false },
                      { label: 'Upcoming', value: upcomingMatches?.length ?? 0, active: false },
                    ].map(tab => (
                      <div
                        key={tab.label}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                          tab.active
                            ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100 shadow-[0_10px_40px_-20px_rgba(34,211,238,0.8)]'
                            : 'border-white/8 bg-white/5 text-slate-300'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs text-slate-200">{tab.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-3 min-[430px]:grid-cols-3">
                    {[
                      { label: 'Live', value: homeStats?.liveMatches ?? 0, tone: 'text-cyan-300' },
                      { label: 'Matches', value: homeStats?.totalMatches ?? 0, tone: 'text-indigo-300' },
                      { label: 'Players', value: homeStats?.totalPlayers ?? 0, tone: 'text-emerald-300' },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 text-center">
                        <p className={`text-3xl font-black ${stat.tone}`}>{stat.value}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-3 min-[430px]:grid-cols-2">
                    <Link href="/matches" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0891b2,#4f46e5)] px-6 py-3 text-sm font-bold text-white shadow-[0_20px_60px_-25px_rgba(56,189,248,0.6)] transition hover:translate-y-[-1px] hover:brightness-110">
                      Explore Matches
                    </Link>
                    <Link href="/leaderboard" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:text-white">
                      Leaderboard
                    </Link>
                  </div>
                </div> 

                     
                  <div className="flex  h-full items-center justify-center">
                  <FeaturedMatchCarousel matches={featuredMatches} />
                </div>
                

               
              </div>
            </motion.div>
          </div>
        </section>

        <div className="mx-auto mt-8 max-w-6xl space-y-8 px-4">
          <section>
            <SectionHeader title="Live Centre" icon={<Radio size={18} className="text-rose-300" />} href="/matches" cta="See all" />
            {liveMatches && liveMatches.length > 0 ? (
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3 [&::-webkit-scrollbar]:hidden">
                {liveMatches.map(match => (
                  <LiveMatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-white/4 px-6 py-10 text-center text-slate-400">
                No live matches at the moment.
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Ongoing Series" icon={<Trophy size={18} className="text-cyan-300" />} href="/tournaments" cta="All series" />
            {tournaments && tournaments.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tournaments.map(tournament => (
                  <TournamentCard key={tournament.id} tournament={tournament} />
                ))}
              </div>
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-white/4 px-6 py-10 text-center text-slate-400">
                No tournament data yet.
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Upcoming Matches" icon={<CalendarDays size={18} className="text-emerald-300" />} href="/matches" cta="Fixture list" />
            {upcomingMatches && upcomingMatches.length > 0 ? (
              <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3 [&::-webkit-scrollbar]:hidden">
                {upcomingMatches.map(match => (
                  <UpcomingMatchCard key={match.id} match={match} />
                ))}
              </div>
            ) : (
              <div className="rounded-[26px] border border-dashed border-white/10 bg-white/4 px-6 py-10 text-center text-slate-400">
                No upcoming matches scheduled yet.
              </div>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionHeader title="Top Run Scorers" icon={<Sparkles size={18} className="text-amber-300" />} href="/leaderboard" cta="Full board" />
              <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,20,32,0.98),rgba(8,12,22,0.92))]">
                {topPlayers && topPlayers.length > 0 ? (
                  <div className="divide-y divide-white/6">
                    {topPlayers.map((player, index) => {
                      const strikeRate = Number(player.strike_rate || 0).toFixed(1)

                      return (
                        <Link key={player.id} href={`/player/${player.id}`} className="block">
                          <motion.div whileHover={{ x: 4 }} className="flex flex-col items-start gap-4 px-4 py-4 transition hover:bg-white/4 md:flex-row md:items-center md:px-5">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-black ${
                              index === 0
                                ? 'bg-amber-400/15 text-amber-300'
                                : index === 1
                                  ? 'bg-slate-300/10 text-slate-300'
                                  : index === 2
                                    ? 'bg-orange-400/15 text-orange-300'
                                    : 'bg-white/6 text-slate-400'
                            }`}>
                              #{index + 1}
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(99,102,241,0.2))] text-sm font-black text-cyan-200">
                              {getInitial(player.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white md:text-base">{player.name}</p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {player.team?.[0]?.name || 'Independent'} · {player.matches_played} matches
                              </p>
                            </div>
                            <div className="grid w-full grid-cols-3 gap-3 text-left text-xs text-slate-400 min-[430px]:text-right md:w-auto md:min-w-[220px]">
                              <div>
                                <p className="text-lg font-black text-white">{player.total_runs}</p>
                                <p>Runs</p>
                              </div>
                              <div>
                                <p className="text-lg font-black text-cyan-300">{player.highest_score}</p>
                                <p>HS</p>
                              </div>
                              <div>
                                <p className="text-lg font-black text-emerald-300">{strikeRate}</p>
                                <p>SR</p>
                              </div>
                            </div>
                          </motion.div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-12 text-center text-slate-400">No player stats available yet.</div>
                )}
              </div>
            </div>

            <div>
              <SectionHeader title="Recent Results" icon={<Activity size={18} className="text-indigo-300" />} href="/matches" cta="Match archive" />
              <div className="space-y-4">
                {recentMatches && recentMatches.length > 0 ? recentMatches.map(match => (
                  <Link key={match.id} href={`/match/${match.id}`} className="block">
                    <motion.div whileHover={{ y: -3 }} className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,32,0.98),rgba(8,13,25,0.92))] p-4 min-[430px]:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-white">
                            {match.team_a_data?.name || 'Team A'} vs {match.team_b_data?.name || 'Team B'}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">{getWinnerLabel(match)}</p>
                        </div>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">
                          Done
                        </span>
                      </div>

                      <div className="mt-5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Users size={15} className="text-cyan-300" />
                          Final summary
                        </div>
                        <span className="font-semibold text-cyan-300">Open scorecard</span>
                      </div>
                    </motion.div>
                  </Link>
                )) : (
                  <div className="rounded-[26px] border border-dashed border-white/10 bg-white/4 px-6 py-10 text-center text-slate-400">
                    No finished matches yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
