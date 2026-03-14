'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { RunWormChart } from '@/components/RunWormChart'
import { WinProbabilityChart } from '@/components/WinProbabilityChart'
import { ScorecardTable } from '@/components/ScorecardTable'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Share2, ExternalLink, RefreshCw, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { toAbsoluteUrl } from '@/lib/site-url'

type MatchBall = {
  id: string
  innings_id: string
  over_number: number
  ball_number: number
  runs: number
  event_type: 'run' | 'wide' | 'no_ball' | 'wicket'
  batsman_id: string | null
  bowler_id: string | null
  created_at?: string
  batsman?: {
    id: string
    name: string
  } | null
  bowler?: {
    id: string
    name: string
  } | null
}

type MatchStat = {
  player_id: string
  player?: {
    id: string
    name: string
    avatar_url?: string | null
    team?: {
      name?: string | null
    } | null
  } | null
}

type ManOfTheMatch = {
  id: string
  name: string
  avatar_url: string | null
  teamName: string | null
  runs: number
  balls: number
  fours: number
  sixes: number
  wickets: number
  legalBallsBowled: number
  runsConceded: number
  strikeRate: number
  economyRate: number
  impactPoints: number
}

function normalizeMatchBalls(balls: MatchBall[]) {
  const groupedBalls = new Map<string, MatchBall[]>()

  for (const ball of balls) {
    const key = `${ball.innings_id}|${ball.over_number}|${ball.ball_number}`
    const group = groupedBalls.get(key) || []
    group.push(ball)
    groupedBalls.set(key, group)
  }

  const normalizedBalls: MatchBall[] = []

  for (const group of groupedBalls.values()) {
    const extras = group.filter(ball => ball.event_type === 'wide' || ball.event_type === 'no_ball')
    const legalBalls = group.filter(ball => ball.event_type !== 'wide' && ball.event_type !== 'no_ball')

    normalizedBalls.push(...extras)

    if (legalBalls.length > 0) {
      normalizedBalls.push(legalBalls[legalBalls.length - 1])
    }
  }

  return normalizedBalls
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

function formatOversFromBalls(totalBalls: number) {
  const overs = Math.floor(totalBalls / 6)
  const balls = totalBalls % 6
  return `${overs}.${balls}`
}

// Match Detail Page with Realtime Updates
export default function MatchPage() {
  const { id } = useParams()
  const { isModerator } = useAuth()
  const [match, setMatch] = useState<any>(null)
  const [innings, setInnings] = useState<any[]>([])
  const [balls, setBalls] = useState<any[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'scorecard' | 'worm' | 'probability'>('scorecard')
  const [loading, setLoading] = useState(true)

  async function fetchMatchData() {
    const [matchRes, inningsRes, ballsRes, statsRes] = await Promise.all([
      supabase.from('matches').select(`
        *,
        team_a_data:teams!matches_team_a_fkey(id, name, logo_url),
        team_b_data:teams!matches_team_b_fkey(id, name, logo_url),
        tournament:tournaments(name, format)
      `).eq('id', id as string).single(),

      supabase.from('innings').select('*').eq('match_id', id as string).order('innings_number'),

      supabase.from('balls').select(`
        *,
        batsman:players!balls_batsman_id_fkey(id, name),
        bowler:players!balls_bowler_id_fkey(id, name)
      `).eq('match_id', id as string).order('over_number').order('ball_number').order('created_at'),

      supabase.from('player_match_stats').select(`
        *,
        player:players(id, name, avatar_url, team:teams(name))
      `).eq('match_id', id as string),
    ])

    if (matchRes.error) {
      console.error('[match] Failed to load match', matchRes.error)
    }

    if (inningsRes.error) {
      console.error('[match] Failed to load innings', inningsRes.error)
    }

    if (ballsRes.error) {
      console.error('[match] Failed to load balls', ballsRes.error)
    }

    if (statsRes.error) {
      console.error('[match] Failed to load player_match_stats', statsRes.error)
    }

    if (matchRes.data) setMatch(matchRes.data)
    if (inningsRes.data) setInnings(inningsRes.data)
    if (ballsRes.data) setBalls(ballsRes.data)
    if (statsRes.data) setStats(statsRes.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchMatchData()

    // Realtime subscription for balls
    const channel = supabase.channel(`match-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'balls', filter: `match_id=eq.${id}` }, () => {
        fetchMatchData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'innings', filter: `match_id=eq.${id}` }, () => {
        fetchMatchData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, () => {
        fetchMatchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  function shareMatch() {
    const url = toAbsoluteUrl(`/match/${id as string}`)
    if (navigator.share) {
      navigator.share({ title: `${match?.team_a_data?.name} vs ${match?.team_b_data?.name}`, url })
    } else {
      navigator.clipboard?.writeText(url)
      toast.success('Match link copied!')
    }
  }

  const normalizedBalls = useMemo(
    () => normalizeMatchBalls((balls || []) as MatchBall[]),
    [balls]
  )

  const manOfTheMatch = useMemo<ManOfTheMatch | null>(() => {
    const playerDirectory = new Map<string, MatchStat['player']>()

    for (const stat of (stats || []) as MatchStat[]) {
      if (stat.player?.id) {
        playerDirectory.set(stat.player.id, stat.player)
      }
    }

    const summaries = new Map<string, ManOfTheMatch>()
    const dismissalKeys = new Set<string>()

    function ensureSummary(playerId: string, fallbackName?: string | null) {
      const existing = summaries.get(playerId)
      if (existing) {
        return existing
      }

      const playerProfile = playerDirectory.get(playerId)
      const summary: ManOfTheMatch = {
        id: playerId,
        name: playerProfile?.name || fallbackName || 'Unknown Player',
        avatar_url: playerProfile?.avatar_url || null,
        teamName: playerProfile?.team?.name || null,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        legalBallsBowled: 0,
        runsConceded: 0,
        strikeRate: 0,
        economyRate: 0,
        impactPoints: 0,
      }

      summaries.set(playerId, summary)
      return summary
    }

    for (const ball of normalizedBalls) {
      if (ball.batsman_id) {
        const batter = ensureSummary(ball.batsman_id, ball.batsman?.name)

        if (ball.event_type !== 'wide') {
          batter.runs += Number(ball.runs || 0)
        }

        if (ball.event_type !== 'wide' && ball.event_type !== 'no_ball') {
          batter.balls += 1
        }

        if (ball.event_type !== 'wide' && ball.runs === 4) {
          batter.fours += 1
        }

        if (ball.event_type !== 'wide' && ball.runs === 6) {
          batter.sixes += 1
        }
      }

      if (ball.bowler_id) {
        const bowler = ensureSummary(ball.bowler_id, ball.bowler?.name)
        bowler.runsConceded += Number(ball.runs || 0)

        if (ball.event_type !== 'wide' && ball.event_type !== 'no_ball') {
          bowler.legalBallsBowled += 1
        }

        if (ball.event_type === 'wicket' && ball.batsman_id) {
          const dismissalKey = `${ball.innings_id}:${ball.batsman_id}`
          if (!dismissalKeys.has(dismissalKey)) {
            dismissalKeys.add(dismissalKey)
            bowler.wickets += 1
          }
        }
      }
    }

    const rankedPlayers = Array.from(summaries.values())
      .map(player => {
        const boundaries = player.fours + player.sixes
        const strikeRate = player.balls > 0
          ? Number(((player.runs / player.balls) * 100).toFixed(1))
          : 0
        const economyRate = player.legalBallsBowled > 0
          ? Number(((player.runsConceded * 6) / player.legalBallsBowled).toFixed(2))
          : 0
        const impactPoints = player.runs + (player.wickets * 20) + (boundaries * 2)

        return {
          ...player,
          strikeRate,
          economyRate,
          impactPoints,
        }
      })
      .sort((a, b) => (
        b.impactPoints - a.impactPoints ||
        b.runs - a.runs ||
        b.wickets - a.wickets ||
        b.strikeRate - a.strikeRate
      ))

    return rankedPlayers[0] || null
  }, [normalizedBalls, stats])

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="pt-16 pb-24 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <RefreshCw size={32} className="mx-auto mb-3 text-purple-400 animate-spin" />
            <p className="text-muted-foreground text-sm">Loading match...</p>
          </div>
        </main>
      </>
    )
  }

  if (!match) return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Match not found</p>
      </main>
    </>
  )

  const inn1 = innings[0]
  const inn2 = innings[1]
  const currentInnings = innings.find(i => !i.is_complete)

  // Build worm data
  const wormData: any[] = []
  if (inn1) {
    const inn1Balls = normalizedBalls.filter(b => b.innings_id === inn1.id)
    let r = 0
    let overNum = -1
    for (const b of inn1Balls) {
      r += b.runs
      if (b.over_number !== overNum && b.event_type !== 'wide' && b.event_type !== 'no_ball') {
        overNum = b.over_number
        const existing = wormData.find(w => w.over === overNum + 1)
        if (existing) existing.teamA = r
        else wormData.push({ over: overNum + 1, teamA: r, teamB: inn2 ? undefined : undefined })
      }
    }
  }
  if (inn2) {
    const inn2Balls = normalizedBalls.filter(b => b.innings_id === inn2.id)
    let r = 0
    let overNum = -1
    for (const b of inn2Balls) {
      r += b.runs
      if (b.over_number !== overNum && b.event_type !== 'wide' && b.event_type !== 'no_ball') {
        overNum = b.over_number
        const existing = wormData.find(w => w.over === overNum + 1)
        if (existing) existing.teamB = r
        else wormData.push({ over: overNum + 1, teamA: undefined, teamB: r })
      }
    }
  }

  return (
    <>
      <Navbar />
      <main className="pt-20 pb-24 min-h-screen">
        {/* Match header */}
        <div className="px-4 pt-12 pb-8 relative overflow-hidden">
          {/* Animated Background Blobs */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px]" />
          </div>
          
          {match.status === 'live' && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="live-glow w-2 h-2 rounded-full" />
              <span className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">Live Now</span>
            </div>
          )}
          {match.status === 'completed' && (
            <div className="text-center mb-4">
              <span className="text-[10px] text-accent font-black uppercase tracking-[0.2em] opacity-80">Match Concluded</span>
            </div>
          )}

          <div className="flex items-center justify-between max-w-lg mx-auto gap-4">
            <div className="text-center flex-1">
              <Avatar className="mx-auto mb-3 h-16 w-16 rounded-[2rem] glass-card shadow-xl ring-1 ring-primary/30">
                <AvatarImage src={match.team_a_data?.logo_url || undefined} alt={match.team_a_data?.name || 'Team A'} />
                <AvatarFallback className="rounded-[2rem] bg-primary/15 text-2xl font-black text-primary">
                  {getInitials(match.team_a_data?.name || 'Team A')}
                </AvatarFallback>
              </Avatar>
              <p className="font-black text-xs uppercase tracking-tight opacity-70 mb-1">{match.team_a_data?.name}</p>
              {inn1 && (
                <div className="space-y-0.5">
                  <p className="text-3xl font-black tabular-nums tracking-tighter">{inn1.score}/{inn1.wickets}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {Math.floor(inn1.balls_bowled / 6)}.{inn1.balls_bowled % 6} Overs
                  </p>
                </div>
              )}
            </div>

            <div className="px-2 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full glass-card flex items-center justify-center border-white/5 shadow-inner">
                <span className="text-muted-foreground font-black text-xs uppercase">VS</span>
              </div>
            </div>

            <div className="text-center flex-1">
              <Avatar className="mx-auto mb-3 h-16 w-16 rounded-[2rem] glass-card shadow-xl ring-1 ring-accent/30">
                <AvatarImage src={match.team_b_data?.logo_url || undefined} alt={match.team_b_data?.name || 'Team B'} />
                <AvatarFallback className="rounded-[2rem] bg-accent/15 text-2xl font-black text-accent">
                  {getInitials(match.team_b_data?.name || 'Team B')}
                </AvatarFallback>
              </Avatar>
              <p className="font-black text-xs uppercase tracking-tight opacity-70 mb-1">{match.team_b_data?.name}</p>
              {inn2 && (
                <div className="space-y-0.5">
                  <p className="text-3xl font-black tabular-nums tracking-tighter">{inn2.score}/{inn2.wickets}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">
                    {Math.floor(inn2.balls_bowled / 6)}.{inn2.balls_bowled % 6} Overs
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Match info */}
          {inn1 && inn2 && inn2.is_complete && (
            <div className="text-center mt-6">
              {match.winner ? (
                <div className="inline-block px-6 py-2 rounded-2xl glass-card border-amber-500/20">
                  <p className="text-sm font-black text-amber-400 uppercase tracking-widest">
                    🏆 {match.winner === match.team_a ? match.team_a_data?.name : match.team_b_data?.name} Won
                  </p>
                </div>
              ) : (
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">Match Drawn</p>
              )}
            </div>
          )}

          {/* CRR / Target */}
          {currentInnings && inn1 && !inn1.is_complete && (
            <div className="flex justify-center gap-4 mt-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">CRR</p>
                <p className="font-bold text-sm text-teal-400">
                  {inn1.balls_bowled > 0 ? ((inn1.score / inn1.balls_bowled) * 6).toFixed(1) : '0.0'}
                </p>
              </div>
            </div>
          )}
          {currentInnings && inn1 && inn1.is_complete && inn2 && !inn2.is_complete && (
            <div className="flex justify-center gap-6 mt-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="font-bold text-amber-400">{inn1.score + 1}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Need</p>
                <p className="font-bold text-red-400">{inn1.score + 1 - inn2.score}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">RRR</p>
                <p className="font-bold text-orange-400">
                  {inn2.balls_bowled < match.overs * 6 
                    ? (((inn1.score + 1 - inn2.score) / ((match.overs * 6 - inn2.balls_bowled) / 6))).toFixed(1) 
                    : 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={shareMatch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold glass border border-white/10 hover:border-purple-500/40 transition-colors"
            >
              <Share2 size={14} /> Share Match
            </button>
            {isModerator && match.status === 'live' && (
              <a
                href={`/score/${id}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}
              >
                <ExternalLink size={14} /> Score Board
              </a>
            )}
          </div>
        </div>

        {match.status === 'completed' && manOfTheMatch && (
          <section className="max-w-2xl mx-auto px-4 mt-2">
            <div className="rounded-[2rem] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(108,99,255,0.08))] p-5 shadow-2xl shadow-amber-500/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                    <Trophy size={24} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 ring-2 ring-amber-400/20">
                      <AvatarImage src={manOfTheMatch.avatar_url || undefined} alt={manOfTheMatch.name} />
                      <AvatarFallback className="bg-amber-400/15 font-black text-amber-200">
                        {getInitials(manOfTheMatch.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300/80">Man of the Match</p>
                      <h2 className="mt-1 text-xl font-black">{manOfTheMatch.name}</h2>
                      <p className="text-sm text-muted-foreground">{manOfTheMatch.teamName || 'Independent Player'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-left sm:text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/80">Impact</p>
                  <p className="mt-1 text-3xl font-black text-amber-300">{manOfTheMatch.impactPoints}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Runs</p>
                  <p className="mt-1 text-lg font-black text-amber-300">
                    {manOfTheMatch.runs}
                    <span className="ml-1 text-xs text-muted-foreground">({manOfTheMatch.balls})</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Boundaries</p>
                  <p className="mt-1 text-lg font-black">{manOfTheMatch.fours + manOfTheMatch.sixes}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Strike Rate</p>
                  <p className="mt-1 text-lg font-black text-primary">{manOfTheMatch.strikeRate.toFixed(1)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Wickets</p>
                  <p className="mt-1 text-lg font-black text-accent">{manOfTheMatch.wickets}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Economy</p>
                  <p className="mt-1 text-lg font-black">
                    {manOfTheMatch.legalBallsBowled > 0 ? manOfTheMatch.economyRate.toFixed(2) : '0.00'}
                  </p>
                  {manOfTheMatch.legalBallsBowled > 0 && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatOversFromBalls(manOfTheMatch.legalBallsBowled)} ov
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-white/5 max-w-2xl mx-auto px-4 sticky top-14 glass z-40 backdrop-blur-xl">
          {(['scorecard', 'worm', 'probability'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {tab === 'probability' ? 'Win Prob.' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-4">
          <AnimatePresence mode="wait">
            {activeTab === 'scorecard' && (
              <motion.div key="scorecard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ScorecardTable innings={innings} balls={balls} stats={stats} match={match} />
              </motion.div>
            )}
            {activeTab === 'worm' && (
              <motion.div key="worm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <RunWormChart data={wormData} teamAName={match.team_a_data?.name} teamBName={match.team_b_data?.name} />
              </motion.div>
            )}
            {activeTab === 'probability' && (
              <motion.div key="probability" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <WinProbabilityChart
                  innings={innings}
                  balls={balls}
                  match={match}
                  teamAName={match.team_a_data?.name}
                  teamBName={match.team_b_data?.name}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  )
}
