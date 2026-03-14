'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type ScorecardInnings = {
  id: string
  score: number
  wickets: number
  balls_bowled: number
}

type ScorecardBall = {
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

type ScorecardStat = {
  player_id?: string
  player?: {
    id: string
    name: string
  } | null
}

type BattingRow = {
  id: string
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  status: 'Out' | 'Not Out'
  order: number
}

function normalizeInningsBalls(inningsBalls: ScorecardBall[]) {
  const groupedBalls = new Map<string, ScorecardBall[]>()

  for (const ball of inningsBalls) {
    const key = `${ball.over_number}|${ball.ball_number}`
    const currentGroup = groupedBalls.get(key) || []
    currentGroup.push(ball)
    groupedBalls.set(key, currentGroup)
  }

  const normalizedBalls: ScorecardBall[] = []

  for (const groupBalls of groupedBalls.values()) {
    const extras = groupBalls.filter(ball => ball.event_type === 'wide' || ball.event_type === 'no_ball')
    const legalBalls = groupBalls.filter(ball => ball.event_type !== 'wide' && ball.event_type !== 'no_ball')

    normalizedBalls.push(...extras)

    if (legalBalls.length > 0) {
      normalizedBalls.push(legalBalls[legalBalls.length - 1])
    }
  }

  return normalizedBalls
}

type BowlingRow = {
  id: string
  name: string
  legalBalls: number
  runsConceded: number
  wickets: number
  order: number
}

interface ScorecardTableProps {
  innings: ScorecardInnings[]
  balls: ScorecardBall[]
  stats: ScorecardStat[]
  match: unknown
}

function formatOversFromBalls(totalBalls: number) {
  const overs = Math.floor(totalBalls / 6)
  const balls = totalBalls % 6
  return `${overs}.${balls}`
}

function calculateStrikeRate(runs: number, balls: number) {
  if (balls === 0) return '0.0'
  return ((runs / balls) * 100).toFixed(1)
}

function calculateEconomy(runsConceded: number, legalBalls: number) {
  if (legalBalls === 0) return '0.00'
  return ((runsConceded * 6) / legalBalls).toFixed(2)
}

export function ScorecardTable({ innings, balls, stats }: ScorecardTableProps) {
  const [activeInningsTab, setActiveInningsTab] = useState(0)

  const playerNames = useMemo(() => {
    const names = new Map<string, string>()

    for (const stat of stats) {
      if (stat.player?.id && stat.player?.name) {
        names.set(stat.player.id, stat.player.name)
      }
    }

    for (const ball of balls) {
      if (ball.batsman?.id && ball.batsman?.name) {
        names.set(ball.batsman.id, ball.batsman.name)
      }
      if (ball.bowler?.id && ball.bowler?.name) {
        names.set(ball.bowler.id, ball.bowler.name)
      }
    }

    return names
  }, [balls, stats])

  const inningsScorecards = useMemo(() => {
    return innings.map(currentInnings => {
      const inningsBalls = normalizeInningsBalls(
        balls.filter(ball => ball.innings_id === currentInnings.id)
      )
      const battingMap = new Map<string, BattingRow>()
      const bowlingMap = new Map<string, BowlingRow>()
      const dismissedBatters = new Set<string>()

      function getPlayerName(playerId: string | null | undefined, fallbackName?: string | null) {
        if (!playerId) {
          return fallbackName || 'Unknown Player'
        }

        return fallbackName || playerNames.get(playerId) || 'Unknown Player'
      }

      for (const ball of inningsBalls) {
        const batsmanId = ball.batsman_id
        const isNewDismissal =
          ball.event_type === 'wicket' &&
          Boolean(batsmanId) &&
          !dismissedBatters.has(batsmanId as string)

        if (batsmanId) {
          const battingRow = battingMap.get(batsmanId) || {
            id: batsmanId,
            name: getPlayerName(batsmanId, ball.batsman?.name),
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            status: 'Not Out' as const,
            order: battingMap.size,
          }

          if (ball.event_type !== 'wide') {
            battingRow.runs += ball.runs
          }

          if (ball.event_type !== 'wide' && ball.event_type !== 'no_ball') {
            battingRow.balls += 1
          }

          if (ball.event_type !== 'wide' && ball.runs === 4) {
            battingRow.fours += 1
          }

          if (ball.event_type !== 'wide' && ball.runs === 6) {
            battingRow.sixes += 1
          }

          if (isNewDismissal) {
            battingRow.status = 'Out'
            dismissedBatters.add(batsmanId)
          }

          battingMap.set(batsmanId, battingRow)
        }

        if (ball.bowler_id) {
          const bowlingRow = bowlingMap.get(ball.bowler_id) || {
            id: ball.bowler_id,
            name: getPlayerName(ball.bowler_id, ball.bowler?.name),
            legalBalls: 0,
            runsConceded: 0,
            wickets: 0,
            order: bowlingMap.size,
          }

          bowlingRow.runsConceded += ball.runs

          if (ball.event_type !== 'wide' && ball.event_type !== 'no_ball') {
            bowlingRow.legalBalls += 1
          }

          if (isNewDismissal) {
            bowlingRow.wickets += 1
          }

          bowlingMap.set(ball.bowler_id, bowlingRow)
        }
      }

      const battingRows = Array.from(battingMap.values())
        .filter(row => row.runs > 0 || row.balls > 0 || row.status === 'Out')
        .sort((a, b) => a.order - b.order)

      const bowlingRows = Array.from(bowlingMap.values())
        .filter(row => row.legalBalls > 0 || row.runsConceded > 0 || row.wickets > 0)
        .sort((a, b) => a.order - b.order)

      return {
        inningsId: currentInnings.id,
        battingRows,
        bowlingRows,
      }
    })
  }, [balls, innings, playerNames])

  if (!innings || innings.length === 0) return null

  const currentInnings = innings[activeInningsTab]
  if (!currentInnings) return null

  const currentScorecard = inningsScorecards[activeInningsTab]
  const battingRows = currentScorecard?.battingRows || []
  const bowlingRows = currentScorecard?.bowlingRows || []
  const battingRunsTotal = battingRows.reduce((total, row) => total + row.runs, 0)
  const extrasRuns = Math.max(0, currentInnings.score - battingRunsTotal)

  return (
    <div className="space-y-6">
      {innings.length > 1 && (
        <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/5 w-fit mx-auto sm:mx-0">
          {innings.map((inn, idx) => (
            <button
              key={inn.id}
              onClick={() => setActiveInningsTab(idx)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeInningsTab === idx
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Innings {idx + 1}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentInnings.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          <div className="glass-card rounded-[2rem] overflow-hidden shadow-2xl border border-white/5">
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Batting</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">
                {currentInnings.score}/{currentInnings.wickets}
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent border-none">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-6">Batsman</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">R</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">B</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">4s</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">6s</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground pr-6">SR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {battingRows.length > 0 ? battingRows.map(row => (
                  <TableRow key={row.id} className="border-white/5 group hover:bg-white/5 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <p className="font-bold text-sm group-hover:text-primary transition-colors">{row.name}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter opacity-70">
                        {row.status}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-black text-sm px-4">{row.runs}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">{row.balls}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">{row.fours}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">{row.sixes}</TableCell>
                    <TableCell className="text-right font-black text-xs text-primary pr-6">
                      {calculateStrikeRate(row.runs, row.balls)}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-20">
                      No batting data
                    </TableCell>
                  </TableRow>
                )}
                {extrasRuns > 0 && (
                  <TableRow className="border-white/5 bg-white/[0.02]">
                    <TableCell className="pl-6 py-4 font-bold text-sm text-muted-foreground">Extras</TableCell>
                    <TableCell className="text-right font-black text-sm px-4">{extrasRuns}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">-</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">-</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">-</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs pr-6">-</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="glass-card rounded-[2rem] overflow-hidden shadow-2xl border border-white/5">
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent">Bowling</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">
                {formatOversFromBalls(currentInnings.balls_bowled)} Overs
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-6">Bowler</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">O</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">R</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4">W</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground pr-6">Econ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bowlingRows.length > 0 ? bowlingRows.map(row => (
                  <TableRow key={row.id} className="border-white/5 group hover:bg-white/5 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <p className="font-bold text-sm group-hover:text-accent transition-colors">{row.name}</p>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">{formatOversFromBalls(row.legalBalls)}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs px-4">{row.runsConceded}</TableCell>
                    <TableCell className="text-right font-black text-sm text-accent px-4">{row.wickets}</TableCell>
                    <TableCell className="text-right font-black text-xs text-muted-foreground pr-6">
                      {calculateEconomy(row.runsConceded, row.legalBalls)}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-20">
                      No bowling data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
