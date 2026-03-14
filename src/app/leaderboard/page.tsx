'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Flame, Shield, Sparkles, Trophy } from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type PlayerDirectoryEntry = {
  id: string
  name: string
  avatar_url: string | null
  team?: {
    name?: string | null
  } | null
}

type BallLeaderboardRow = {
  match_id: string
  innings_id: string
  over_number: number
  ball_number: number
  runs: number
  event_type: 'run' | 'wide' | 'no_ball' | 'wicket'
  batsman_id: string | null
  bowler_id: string | null
  created_at?: string
}

type BowlingMatchSummary = {
  wickets: number
  runs_conceded: number
}

type PlayerAccumulator = PlayerDirectoryEntry & {
  matches: Set<string>
  total_runs: number
  total_balls_faced: number
  batting_runs_by_match: Map<string, number>
  total_wickets: number
  total_runs_conceded: number
  total_legal_balls_bowled: number
  total_boundaries: number
  bowling_by_match: Map<string, BowlingMatchSummary>
}

type LeaderboardPlayer = {
  id: string
  name: string
  avatar_url: string | null
  team?: {
    name?: string | null
  } | null
  matches_played: number
  total_runs: number
  highest_score: number
  strike_rate: number
  total_wickets: number
  economy_rate: number
  total_boundaries: number
  runs_conceded: number
  overs_bowled_display: string
  impact_score: number
  best_bowling: string
}

type LeaderboardResult = {
  runScorers: LeaderboardPlayer[]
  wicketTakers: LeaderboardPlayer[]
  topImpactPlayer: LeaderboardPlayer | null
  totalRankedPlayers: number
}

function createAccumulator(player: PlayerDirectoryEntry): PlayerAccumulator {
  return {
    ...player,
    matches: new Set<string>(),
    total_runs: 0,
    total_balls_faced: 0,
    batting_runs_by_match: new Map<string, number>(),
    total_wickets: 0,
    total_runs_conceded: 0,
    total_legal_balls_bowled: 0,
    total_boundaries: 0,
    bowling_by_match: new Map<string, BowlingMatchSummary>(),
  }
}

function normalizeBallEvents(balls: BallLeaderboardRow[]) {
  const groupedBalls = new Map<string, BallLeaderboardRow[]>()

  for (const ball of balls) {
    const key = `${ball.innings_id}|${ball.over_number}|${ball.ball_number}`
    const group = groupedBalls.get(key) || []
    group.push(ball)
    groupedBalls.set(key, group)
  }

  const normalizedBalls: BallLeaderboardRow[] = []

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

function formatOversFromBalls(totalBalls: number) {
  const overs = Math.floor(totalBalls / 6)
  const balls = totalBalls % 6
  return `${overs}.${balls}`
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

async function fetchLeaderboard(): Promise<LeaderboardResult> {
  const [playersRes, ballsRes] = await Promise.all([
    supabase.from('players').select('id, name, avatar_url, team:teams(name)').order('name'),
    supabase
      .from('balls')
      .select('match_id, innings_id, over_number, ball_number, runs, event_type, batsman_id, bowler_id, created_at')
      .order('match_id')
      .order('innings_id')
      .order('over_number')
      .order('ball_number')
      .order('created_at'),
  ])

  if (playersRes.error) {
    console.error('[leaderboard] Failed to load players', playersRes.error)
    throw playersRes.error
  }

  if (ballsRes.error) {
    console.error('[leaderboard] Failed to load balls', ballsRes.error)
    throw ballsRes.error
  }

  const players = (playersRes.data || []) as PlayerDirectoryEntry[]
  const normalizedBalls = normalizeBallEvents((ballsRes.data || []) as BallLeaderboardRow[])
  const accumulators = new Map(players.map(player => [player.id, createAccumulator(player)]))
  const dismissalKeys = new Set<string>()

  for (const ball of normalizedBalls) {
    if (ball.batsman_id && accumulators.has(ball.batsman_id)) {
      const batter = accumulators.get(ball.batsman_id)!
      batter.matches.add(ball.match_id)

      if (ball.event_type !== 'wide') {
        batter.total_runs += Number(ball.runs || 0)
        batter.batting_runs_by_match.set(
          ball.match_id,
          Number(batter.batting_runs_by_match.get(ball.match_id) || 0) + Number(ball.runs || 0)
        )
      }

      if (ball.event_type !== 'wide' && ball.event_type !== 'no_ball') {
        batter.total_balls_faced += 1
      }

      if (ball.event_type !== 'wide' && (ball.runs === 4 || ball.runs === 6)) {
        batter.total_boundaries += 1
      }
    }

    if (ball.bowler_id && accumulators.has(ball.bowler_id)) {
      const bowler = accumulators.get(ball.bowler_id)!
      bowler.matches.add(ball.match_id)
      bowler.total_runs_conceded += Number(ball.runs || 0)

      const bowlingEntry = bowler.bowling_by_match.get(ball.match_id) || {
        wickets: 0,
        runs_conceded: 0,
      }

      bowlingEntry.runs_conceded += Number(ball.runs || 0)

      if (ball.event_type !== 'wide' && ball.event_type !== 'no_ball') {
        bowler.total_legal_balls_bowled += 1
      }

      if (ball.event_type === 'wicket' && ball.batsman_id) {
        const dismissalKey = `${ball.innings_id}:${ball.batsman_id}`
        if (!dismissalKeys.has(dismissalKey)) {
          dismissalKeys.add(dismissalKey)
          bowler.total_wickets += 1
          bowlingEntry.wickets += 1
        }
      }

      bowler.bowling_by_match.set(ball.match_id, bowlingEntry)
    }
  }

  const leaderboardPlayers = Array.from(accumulators.values())
    .filter(player => player.matches.size > 0 || player.total_runs > 0 || player.total_wickets > 0)
    .map(player => {
      const highestScore = Math.max(
        0,
        ...Array.from(player.batting_runs_by_match.values(), score => Number(score || 0))
      )
      const strikeRate = player.total_balls_faced > 0
        ? Number(((player.total_runs / player.total_balls_faced) * 100).toFixed(2))
        : 0
      const bestBowlingEntry = Array.from(player.bowling_by_match.values()).reduce<{
        wickets: number
        runs_conceded: number
      }>((best, current) => {
        if (
          current.wickets > best.wickets ||
          (current.wickets === best.wickets && current.runs_conceded < best.runs_conceded)
        ) {
          return current
        }

        return best
      }, { wickets: 0, runs_conceded: 0 })

      return {
        id: player.id,
        name: player.name,
        avatar_url: player.avatar_url,
        team: player.team,
        matches_played: player.matches.size,
        total_runs: player.total_runs,
        highest_score: highestScore,
        strike_rate: strikeRate,
        total_wickets: player.total_wickets,
        economy_rate: player.total_legal_balls_bowled > 0
          ? Number(((player.total_runs_conceded * 6) / player.total_legal_balls_bowled).toFixed(2))
          : 0,
        total_boundaries: player.total_boundaries,
        runs_conceded: player.total_runs_conceded,
        overs_bowled_display: formatOversFromBalls(player.total_legal_balls_bowled),
        impact_score: Number((
          (player.total_runs * 0.6) +
          (strikeRate * 0.2) +
          (player.total_boundaries * 0.2)
        ).toFixed(1)),
        best_bowling: bestBowlingEntry.wickets > 0
          ? `${bestBowlingEntry.wickets}/${bestBowlingEntry.runs_conceded}`
          : '0/0',
      }
    })

  const runScorers = [...leaderboardPlayers]
    .sort((a, b) => (
      b.total_runs - a.total_runs ||
      b.highest_score - a.highest_score ||
      b.strike_rate - a.strike_rate ||
      b.impact_score - a.impact_score ||
      a.name.localeCompare(b.name)
    ))
    .slice(0, 30)

  const wicketTakers = [...leaderboardPlayers]
    .filter(player => player.total_wickets > 0)
    .sort((a, b) => (
      b.total_wickets - a.total_wickets ||
      a.economy_rate - b.economy_rate ||
      b.impact_score - a.impact_score ||
      a.name.localeCompare(b.name)
    ))
    .slice(0, 30)

  const topImpactPlayer = [...leaderboardPlayers]
    .sort((a, b) => (
      b.impact_score - a.impact_score ||
      b.total_runs - a.total_runs ||
      b.total_wickets - a.total_wickets
    ))[0] || null

  return {
    runScorers,
    wicketTakers,
    topImpactPlayer,
    totalRankedPlayers: leaderboardPlayers.length,
  }
}

function RankBadge({ rank }: { rank: number }) {
  const label = rank <= 3 ? `#${rank}` : `${rank}`
  const styles = rank === 1
    ? 'border-yellow-500/40 bg-yellow-500/20 text-yellow-100 shadow-[0_0_30px_rgba(250,204,21,0.18)]'
    : rank === 2
      ? 'border-slate-400/30 bg-slate-400/20 text-slate-100'
      : rank === 3
        ? 'border-orange-500/30 bg-orange-500/20 text-orange-100'
        : 'border-white/10 bg-white/5 text-muted-foreground'

  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${styles}`}>
      {label}
    </div>
  )
}

function OverviewCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-[1.85rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 text-left shadow-xl">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-amber-200">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
    </div>
  )
}

function StatPill({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'accent' | 'warm'
}) {
  const toneClass = tone === 'accent'
    ? 'border-teal-400/20 bg-teal-400/10 text-teal-100'
    : tone === 'warm'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
      : 'border-white/10 bg-white/[0.04] text-white'

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

function LeaderboardRow({
  player,
  rank,
  variant,
}: {
  player: LeaderboardPlayer
  rank: number
  variant: 'batting' | 'bowling'
}) {
  const primaryLabel = variant === 'batting' ? 'Runs' : 'Wickets'
  const primaryValue = variant === 'batting' ? player.total_runs : player.total_wickets
  const primaryTone = variant === 'batting' ? 'text-amber-300' : 'text-teal-300'
  const rowHighlight = rank === 1
    ? 'border-yellow-500/30 shadow-[0_24px_70px_rgba(245,158,11,0.12)]'
    : rank === 2
      ? 'border-slate-400/20'
      : rank === 3
        ? 'border-orange-500/20'
        : 'border-white/10'

  const statPills = variant === 'batting'
    ? [
      { label: 'Matches', value: player.matches_played },
      { label: 'HS', value: player.highest_score, tone: 'warm' as const },
      { label: 'SR', value: player.strike_rate.toFixed(1), tone: 'accent' as const },
      { label: 'Boundaries', value: player.total_boundaries },
    ]
    : [
      { label: 'Matches', value: player.matches_played },
      { label: 'Best', value: player.best_bowling, tone: 'warm' as const },
      { label: 'Econ', value: player.economy_rate.toFixed(2), tone: 'accent' as const },
      { label: 'Overs', value: player.overs_bowled_display },
    ]

  return (
    <Link href={`/player/${player.id}`} className="block">
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className={`rounded-[1.9rem] border bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-xl transition-all hover:border-white/20 sm:p-5 ${rowHighlight}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <RankBadge rank={rank} />
            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-white/10 sm:h-14 sm:w-14">
              <AvatarImage src={player.avatar_url || undefined} alt={player.name} />
              <AvatarFallback className="bg-primary/20 font-black text-primary">
                {getInitials(player.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="truncate text-lg font-black">{player.name}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {player.team?.name || 'Independent Player'}
              </p>
              <div className="mt-2 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-muted-foreground">
                Impact {player.impact_score}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{primaryLabel}</p>
            <p className={`mt-1 text-4xl font-black tracking-tight ${primaryTone}`}>{primaryValue}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {statPills.map(stat => (
            <StatPill key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
          ))}
        </div>
      </motion.div>
    </Link>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[1.9rem] border border-white/10 bg-white/[0.03] p-4 shadow-xl sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10" />
              <div className="h-12 w-12 rounded-full bg-white/10 sm:h-14 sm:w-14" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded-full bg-white/10" />
                <div className="h-3 w-24 rounded-full bg-white/10" />
                <div className="h-6 w-20 rounded-full bg-white/10" />
              </div>
            </div>
            <div className="h-16 w-28 rounded-2xl bg-white/10" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((__, statIndex) => (
              <div key={statIndex} className="h-14 rounded-2xl bg-white/10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LeaderboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
    refetchInterval: 60000,
    staleTime: 60000,
    gcTime: 60000,
  })

  const topBatter = data?.runScorers[0] || null
  const topBowler = data?.wicketTakers[0] || null

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pb-24 pt-20 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center">
          <section className="w-full max-w-3xl text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-yellow-500/20 bg-[linear-gradient(135deg,rgba(250,204,21,0.18),rgba(16,185,129,0.12))] text-yellow-100 shadow-2xl shadow-yellow-500/10">
              <Trophy size={34} />
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Player Leaderboard</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Cricbuzz-style rankings for your gully stars, driven by live match scoring and refreshed performance stats.
            </p>
          </section>

          <section className="mt-8 grid w-full gap-4 md:grid-cols-3">
            <OverviewCard
              icon={<Flame size={20} />}
              label="Top Run Scorer"
              value={topBatter ? topBatter.name : 'Waiting for stats'}
              helper={topBatter ? `${topBatter.total_runs} runs | SR ${topBatter.strike_rate.toFixed(1)}` : 'Once matches are scored, batting rankings appear here.'}
            />
            <OverviewCard
              icon={<Shield size={20} />}
              label="Top Wicket Taker"
              value={topBowler ? topBowler.name : 'Waiting for stats'}
              helper={topBowler ? `${topBowler.total_wickets} wickets | Econ ${topBowler.economy_rate.toFixed(2)}` : 'Bowling leaders update automatically from live scores.'}
            />
            <OverviewCard
              icon={<Sparkles size={20} />}
              label="Top Impact"
              value={data?.topImpactPlayer ? data.topImpactPlayer.name : 'No impact leader yet'}
              helper={data?.topImpactPlayer ? `${data.topImpactPlayer.impact_score} impact points across ${data.topImpactPlayer.matches_played} matches` : `${data?.totalRankedPlayers || 0} ranked players so far`}
            />
          </section>

          <section className="mt-8 w-full">
            <Tabs defaultValue="runs" className="flex-col w-full">
              <div className="flex justify-center">
                <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-xl">
                  <TabsTrigger
                    value="runs"
                    className="rounded-xl py-3 text-xs font-black uppercase tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Top Batters
                  </TabsTrigger>
                  <TabsTrigger
                    value="wickets"
                    className="rounded-xl py-3 text-xs font-black uppercase tracking-[0.2em] data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    Top Bowlers
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="runs" className="mt-6">
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-2xl sm:p-5"
                >
                  <div className="mb-4 flex flex-col gap-2 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300/80">Batting Rankings</p>
                      <h2 className="mt-2 text-2xl font-black">Top Scorers</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">Runs, strike rate, matches, boundaries, and highest score</p>
                  </div>

                  <div className="space-y-3">
                    {isLoading ? (
                      <LeaderboardSkeleton />
                    ) : error ? (
                      <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 px-5 py-10 text-center text-sm text-red-300">
                        {error instanceof Error ? error.message : 'Failed to load leaderboard'}
                      </div>
                    ) : data?.runScorers.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-muted-foreground">
                        No batting rankings yet
                      </div>
                    ) : (
                      (data?.runScorers || []).map((player, index) => (
                        <LeaderboardRow key={player.id} player={player} rank={index + 1} variant="batting" />
                      ))
                    )}
                  </div>
                </motion.section>
              </TabsContent>

              <TabsContent value="wickets" className="mt-6">
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-2xl sm:p-5"
                >
                  <div className="mb-4 flex flex-col gap-2 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-300/80">Bowling Rankings</p>
                      <h2 className="mt-2 text-2xl font-black">Top Wicket Takers</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">Wickets, economy, matches, best bowling, and overs</p>
                  </div>

                  <div className="space-y-3">
                    {isLoading ? (
                      <LeaderboardSkeleton />
                    ) : error ? (
                      <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 px-5 py-10 text-center text-sm text-red-300">
                        {error instanceof Error ? error.message : 'Failed to load leaderboard'}
                      </div>
                    ) : data?.wicketTakers.length === 0 ? (
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-sm text-muted-foreground">
                        No bowling rankings yet
                      </div>
                    ) : (
                      (data?.wicketTakers || []).map((player, index) => (
                        <LeaderboardRow key={player.id} player={player} rank={index + 1} variant="bowling" />
                      ))
                    )}
                  </div>
                </motion.section>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </main>
    </>
  )
}
