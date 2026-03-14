'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { processBall } from '@/lib/scoring-engine'
import type { EventType } from '@/lib/types'
import { toast } from 'sonner'
import { ChevronLeft, RotateCcw, SkipForward } from 'lucide-react'
import Link from 'next/link'

type ScoringView = 'selectBattingTeam' | 'main' | 'selectBatsman' | 'selectBowler' | 'dismissal' | 'bowlerChangeReason'
type StatDelta = {
  runs?: number
  balls?: number
  fours?: number
  sixes?: number
  wickets?: number
  overs_bowled?: number
  runs_conceded?: number
}

type MatchState = {
  id: string
  team_a: string
  team_b: string
  overs: number
  team_a_data?: { id: string; name: string }
  team_b_data?: { id: string; name: string }
}

type InningsState = {
  id: string
  match_id: string
  innings_number: number
  batting_team: string
  bowling_team: string
  score: number
  wickets: number
  balls_bowled: number
  overs: number
  target?: number | null
  is_complete: boolean
}

type PlayerState = {
  id: string
  name: string
  team_id: string | null
}

type BallState = {
  id: string
  over_number: number
  ball_number: number
  runs: number
  event_type: EventType
  bowler_id?: string | null
}

type StoredSelection = {
  strikerId: string | null
  bowlerId: string | null
}

type DismissalStatus = 'out' | 'retired'

type StoredDismissals = {
  statuses: Record<string, DismissalStatus>
  history: Array<{
    playerId: string
    status: DismissalStatus
    ballId?: string
  }>
}

type StoredMatchSquads = {
  teamAPlayerIds?: string[]
  teamBPlayerIds?: string[]
}

type BowlerChangeReason = 'injury' | 'unavailable' | 'strategic' | 'other'

function oversToBalls(oversValue: number | null | undefined) {
  const safeOvers = Number(oversValue || 0)
  const wholeOvers = Math.floor(safeOvers)
  const extraBalls = Math.round((safeOvers - wholeOvers) * 10)
  return (wholeOvers * 6) + extraBalls
}

function ballsToOvers(totalBalls: number) {
  const wholeOvers = Math.floor(totalBalls / 6)
  const extraBalls = totalBalls % 6
  return Number(`${wholeOvers}.${extraBalls}`)
}

function orderPlayersByIds(allPlayers: PlayerState[], playerIds: string[]) {
  const playerById = new Map(allPlayers.map(player => [player.id, player]))

  return playerIds
    .map(playerId => playerById.get(playerId))
    .filter((player): player is PlayerState => Boolean(player))
}

function getStoredTeamPlayerIds(
  currentMatch: MatchState | null,
  storedSquads: StoredMatchSquads | null,
  teamId: string | null | undefined
) {
  if (!currentMatch || !storedSquads || !teamId) {
    return []
  }

  if (teamId === currentMatch.team_a) {
    return storedSquads.teamAPlayerIds || []
  }

  if (teamId === currentMatch.team_b) {
    return storedSquads.teamBPlayerIds || []
  }

  return []
}

function getWicketLimitForTeam(
  teamPlayers: PlayerState[],
  fallbackPlayers: PlayerState[]
) {
  return Math.max(1, teamPlayers.length || fallbackPlayers.length || 10)
}

function formatBowlerChangeReason(reason: BowlerChangeReason) {
  switch (reason) {
    case 'injury':
      return 'Injury'
    case 'unavailable':
      return 'Player unavailable'
    case 'strategic':
      return 'Strategic change'
    case 'other':
      return 'Other'
  }
}

function ActivePlayerBadge({
  role,
  playerName,
  tone,
}: {
  role: 'Batsman' | 'Bowler'
  playerName: string
  tone: 'batting' | 'bowling'
}) {
  const toneClasses = tone === 'batting'
    ? 'border-primary/25 bg-primary/10 text-primary'
    : 'border-accent/25 bg-accent/10 text-accent'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses}`}>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
          {role}
        </p>
        <p className="mt-1 truncate text-sm font-black">
          {playerName}
        </p>
      </div>
    </div>
  )
}

export default function ScoringPage() {
  const { matchId } = useParams()
  const router = useRouter()
  const { isModerator } = useAuth()

  const [match, setMatch] = useState<MatchState | null>(null)
  const [innings, setInnings] = useState<InningsState | null>(null)
  const [players, setPlayers] = useState<PlayerState[]>([])
  const [striker, setStriker] = useState<PlayerState | null>(null)
  const [bowler, setBowler] = useState<PlayerState | null>(null)
  const [view, setView] = useState<ScoringView>('main')
  const [lastBalls, setLastBalls] = useState<BallState[]>([])
  const [dismissals, setDismissals] = useState<Record<string, DismissalStatus>>({})
  const [matchSquads, setMatchSquads] = useState<StoredMatchSquads | null>(null)
  const [pendingBowlerChangeReason, setPendingBowlerChangeReason] = useState<BowlerChangeReason | null>(null)
  const [loading, setLoading] = useState(true)

  const safeMatchId = typeof matchId === 'string' ? matchId : ''
  const selectionStorageKey = useMemo(
    () => (safeMatchId ? `gullyscore:score-selection:${safeMatchId}` : null),
    [safeMatchId]
  )

  function readStoredSelection(): StoredSelection {
    if (!selectionStorageKey || typeof window === 'undefined') {
      return { strikerId: null, bowlerId: null }
    }

    try {
      const raw = window.localStorage.getItem(selectionStorageKey)
      if (!raw) {
        return { strikerId: null, bowlerId: null }
      }

      const parsed = JSON.parse(raw) as StoredSelection
      return {
        strikerId: parsed?.strikerId || null,
        bowlerId: parsed?.bowlerId || null,
      }
    } catch {
      return { strikerId: null, bowlerId: null }
    }
  }

  function writeStoredSelection(next: StoredSelection) {
    if (!selectionStorageKey || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(selectionStorageKey, JSON.stringify(next))
  }

  function clearStoredSelection() {
    if (!selectionStorageKey || typeof window === 'undefined') {
      return
    }

    window.localStorage.removeItem(selectionStorageKey)
  }

  function updateStoredSelection(next: Partial<StoredSelection>) {
    const current = readStoredSelection()
    writeStoredSelection({
      strikerId: next.strikerId !== undefined ? next.strikerId : current.strikerId,
      bowlerId: next.bowlerId !== undefined ? next.bowlerId : current.bowlerId,
    })
  }

  function readStoredMatchSquads(): StoredMatchSquads | null {
    if (!safeMatchId || typeof window === 'undefined') {
      return null
    }

    try {
      const raw = window.localStorage.getItem(`gullyscore:match-squads:${safeMatchId}`)
      if (!raw) {
        return null
      }

      return JSON.parse(raw) as StoredMatchSquads
    } catch {
      return null
    }
  }

  function readStoredDismissals(inningsId: string | null | undefined): StoredDismissals {
    if (!inningsId || typeof window === 'undefined') {
      return { statuses: {}, history: [] }
    }

    try {
      const raw = window.localStorage.getItem(`gullyscore:innings-dismissals:${inningsId}`)
      if (!raw) {
        return { statuses: {}, history: [] }
      }

      const parsed = JSON.parse(raw) as StoredDismissals

      return {
        statuses: parsed?.statuses || {},
        history: Array.isArray(parsed?.history) ? parsed.history : [],
      }
    } catch {
      return { statuses: {}, history: [] }
    }
  }

  function writeStoredDismissals(inningsId: string, next: StoredDismissals) {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(`gullyscore:innings-dismissals:${inningsId}`, JSON.stringify(next))
  }

  function clearStoredDismissals(inningsId: string | null | undefined) {
    if (!inningsId || typeof window === 'undefined') {
      return
    }

    window.localStorage.removeItem(`gullyscore:innings-dismissals:${inningsId}`)
  }

  function saveDismissal(
    inningsId: string,
    playerId: string,
    status: DismissalStatus,
    ballId?: string
  ) {
    const current = readStoredDismissals(inningsId)
    const next: StoredDismissals = {
      statuses: {
        ...current.statuses,
        [playerId]: status,
      },
      history: [...current.history, { playerId, status, ballId }],
    }

    writeStoredDismissals(inningsId, next)
    setDismissals(next.statuses)
    return next.statuses
  }

  function clearDismissalStatus(inningsId: string, playerId: string) {
    const current = readStoredDismissals(inningsId)

    if (!current.statuses[playerId]) {
      return current.statuses
    }

    const nextHistory = current.history.filter(entry => entry.playerId !== playerId)
    const nextStatuses: Record<string, DismissalStatus> = {}

    for (const entry of nextHistory) {
      nextStatuses[entry.playerId] = entry.status
    }

    writeStoredDismissals(inningsId, {
      statuses: nextStatuses,
      history: nextHistory,
    })

    setDismissals(nextStatuses)
    return nextStatuses
  }

  function removeDismissalByBallId(inningsId: string, ballId: string) {
    const current = readStoredDismissals(inningsId)

    if (!current.history.length) {
      return null
    }

    const nextHistory = [...current.history]
    let removedEntry: StoredDismissals['history'][number] | null = null

    for (let index = nextHistory.length - 1; index >= 0; index -= 1) {
      if (nextHistory[index]?.ballId === ballId) {
        removedEntry = nextHistory[index]
        nextHistory.splice(index, 1)
        break
      }
    }

    if (!removedEntry) {
      return null
    }

    const nextStatuses: Record<string, DismissalStatus> = {}

    for (const entry of nextHistory) {
      nextStatuses[entry.playerId] = entry.status
    }

    writeStoredDismissals(inningsId, {
      statuses: nextStatuses,
      history: nextHistory,
    })

    setDismissals(nextStatuses)

    return removedEntry
  }

  async function updatePlayerMatchStats(playerId: string, delta: StatDelta) {
    const { data: existingStats, error: existingStatsError } = await supabase
      .from('player_match_stats')
      .select('player_id, match_id, runs, balls, fours, sixes, wickets, overs_bowled, runs_conceded')
      .eq('player_id', playerId)
      .eq('match_id', safeMatchId)
      .maybeSingle()

    if (existingStatsError) {
      throw new Error(existingStatsError.message)
    }

    const totalBowlingBalls =
      oversToBalls(existingStats?.overs_bowled) + oversToBalls(delta.overs_bowled)

    const { error: upsertError } = await supabase
      .from('player_match_stats')
      .upsert({
        player_id: playerId,
        match_id: safeMatchId,
        runs: Number(existingStats?.runs || 0) + Number(delta.runs || 0),
        balls: Number(existingStats?.balls || 0) + Number(delta.balls || 0),
        fours: Number(existingStats?.fours || 0) + Number(delta.fours || 0),
        sixes: Number(existingStats?.sixes || 0) + Number(delta.sixes || 0),
        wickets: Number(existingStats?.wickets || 0) + Number(delta.wickets || 0),
        overs_bowled: ballsToOvers(totalBowlingBalls),
        runs_conceded: Number(existingStats?.runs_conceded || 0) + Number(delta.runs_conceded || 0),
      }, { onConflict: 'player_id,match_id', ignoreDuplicates: false })

    if (upsertError) {
      throw new Error(upsertError.message)
    }
  }

  async function loadData() {
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*, team_a_data:teams!matches_team_a_fkey(id, name), team_b_data:teams!matches_team_b_fkey(id, name)')
      .eq('id', safeMatchId)
      .single()

    if (matchError || !matchData) {
      console.error('[score] Failed to load match', matchError)
      toast.error(matchError?.message || 'Failed to load match')
      setLoading(false)
      return
    }

    const currentMatch = matchData as MatchState
    setMatch(currentMatch)

    const { data: inningsData, error: inningsError } = await supabase
      .from('innings')
      .select('*')
      .eq('match_id', safeMatchId)
      .eq('is_complete', false)
      .maybeSingle()

    if (inningsError) {
      console.error('[score] Failed to load innings', inningsError)
      toast.error(inningsError.message || 'Failed to load innings')
      setLoading(false)
      return
    }

    const { data: teamPlayers, error: teamPlayersError } = await supabase
      .from('players')
      .select('id, name, team_id')
      .in('team_id', [currentMatch.team_a, currentMatch.team_b])

    if (teamPlayersError) {
      console.error('[score] Failed to load players', teamPlayersError)
      toast.error(teamPlayersError.message)
    }

    const allPlayers = (teamPlayers || []) as PlayerState[]
    const storedSquads = readStoredMatchSquads()
    setPlayers(allPlayers)
    setMatchSquads(storedSquads)

    if (!inningsData) {
      clearStoredSelection()
      setInnings(null)
      setDismissals({})
      setLastBalls([])
      setPendingBowlerChangeReason(null)
      setStriker(null)
      setBowler(null)
      setView('selectBattingTeam')
      setLoading(false)
      return
    }

    let activeInnings = inningsData as InningsState

    async function getTeamPlayersForInnings(targetInnings: InningsState) {
      const battingSquadIds = getStoredTeamPlayerIds(currentMatch, storedSquads, targetInnings.batting_team)
      const bowlingSquadIds = getStoredTeamPlayerIds(currentMatch, storedSquads, targetInnings.bowling_team)
      const fallbackBattingPlayers = allPlayers.filter(player => player.team_id === targetInnings.batting_team)
      const fallbackBowlingPlayers = allPlayers.filter(player => player.team_id === targetInnings.bowling_team)

      return {
        battingTeamPlayers: battingSquadIds.length > 0
          ? orderPlayersByIds(allPlayers, battingSquadIds)
          : fallbackBattingPlayers,
        bowlingTeamPlayers: bowlingSquadIds.length > 0
          ? orderPlayersByIds(allPlayers, bowlingSquadIds)
          : fallbackBowlingPlayers,
        fallbackBattingPlayers,
      }
    }

    const { data: recentBallsData, error: recentBallsError } = await supabase
      .from('balls')
      .select('id, over_number, ball_number, runs, event_type, bowler_id')
      .eq('innings_id', activeInnings.id)
      .order('over_number', { ascending: false })
      .order('ball_number', { ascending: false })
      .limit(24)

    if (recentBallsError) {
      console.error('[score] Failed to load recent balls', recentBallsError)
      toast.error(recentBallsError.message)
    }

    const recentBalls = (recentBallsData || []) as BallState[]
    let { battingTeamPlayers, bowlingTeamPlayers, fallbackBattingPlayers } = await getTeamPlayersForInnings(activeInnings)

    const wicketLimit = getWicketLimitForTeam(battingTeamPlayers, fallbackBattingPlayers)
    const oversCompleted = activeInnings.balls_bowled >= ((currentMatch.overs || 0) * 6)
    const chaseCompleted =
      activeInnings.innings_number === 2 &&
      activeInnings.score >= (activeInnings.target || Number.MAX_SAFE_INTEGER)
    const shouldRecoverCompletedInnings =
      activeInnings.wickets >= wicketLimit ||
      oversCompleted ||
      chaseCompleted

    if (shouldRecoverCompletedInnings) {
      console.info('[score] Recovering stale innings state', {
        inningsId: activeInnings.id,
        wickets: activeInnings.wickets,
        wicketLimit,
        ballsBowled: activeInnings.balls_bowled,
        oversCompleted,
        chaseCompleted,
      })

      const recoveredWickets = Math.min(activeInnings.wickets, wicketLimit)

      const { error: completeInningsError } = await supabase
        .from('innings')
        .update({
          score: activeInnings.score,
          wickets: recoveredWickets,
          balls_bowled: activeInnings.balls_bowled,
          overs: Math.floor(activeInnings.balls_bowled / 6),
          is_complete: true,
        })
        .eq('id', activeInnings.id)

      if (completeInningsError) {
        console.error('[score] Failed to recover innings completion', completeInningsError)
        toast.error(completeInningsError.message || 'Failed to recover innings state')
        setLoading(false)
        return
      }

      if (activeInnings.innings_number === 1) {
        const { data: existingSecondInnings, error: existingSecondInningsError } = await supabase
          .from('innings')
          .select('*')
          .eq('match_id', safeMatchId)
          .eq('innings_number', 2)
          .limit(1)
          .maybeSingle()

        if (existingSecondInningsError) {
          console.error('[score] Failed to check second innings', existingSecondInningsError)
          toast.error(existingSecondInningsError.message || 'Failed to recover next innings')
          setLoading(false)
          return
        }

        if (existingSecondInnings) {
          activeInnings = existingSecondInnings as InningsState
        } else {
          const { data: secondInnings, error: secondInningsError } = await supabase
            .from('innings')
            .insert({
              match_id: safeMatchId,
              innings_number: 2,
              batting_team: activeInnings.bowling_team,
              bowling_team: activeInnings.batting_team,
              score: 0,
              wickets: 0,
              balls_bowled: 0,
              overs: 0,
              target: activeInnings.score + 1,
              is_complete: false,
            })
            .select('*')
            .single()

          if (secondInningsError || !secondInnings) {
            console.error('[score] Failed to recover second innings', secondInningsError)
            toast.error(secondInningsError?.message || 'Failed to recover next innings')
            setLoading(false)
            return
          }

          activeInnings = secondInnings as InningsState
        }

        clearStoredSelection()
        clearStoredDismissals(activeInnings.id)
        setDismissals({})
        setLastBalls([])
        setPendingBowlerChangeReason(null)
        setStriker(null)
        setBowler(null)
        setView('selectBatsman')
        ;({ battingTeamPlayers, bowlingTeamPlayers, fallbackBattingPlayers } = await getTeamPlayersForInnings(activeInnings))
      } else {
        const winner = activeInnings.score >= (activeInnings.target || Number.MAX_SAFE_INTEGER)
          ? activeInnings.batting_team
          : activeInnings.bowling_team

        const { error: matchUpdateError } = await supabase
          .from('matches')
          .update({ status: 'completed', winner })
          .eq('id', safeMatchId)

        if (matchUpdateError) {
          console.error('[score] Failed to recover completed match', matchUpdateError)
          toast.error(matchUpdateError.message || 'Failed to recover match state')
          setLoading(false)
          return
        }

        clearStoredSelection()
        toast.success('Match complete!')
        router.push(`/match/${safeMatchId}`)
        setLoading(false)
        return
      }
    }

    const storedSelection = readStoredSelection()
    const storedDismissals = readStoredDismissals(activeInnings.id)

    const restoredStriker =
      battingTeamPlayers.find(
        player => player.id === storedSelection.strikerId && storedDismissals.statuses[player.id] !== 'out'
      ) || null
    const restoredBowler =
      bowlingTeamPlayers.find(player => player.id === storedSelection.bowlerId) || null

    const isPreMatchSetup =
      activeInnings.innings_number === 1 &&
      activeInnings.score === 0 &&
      activeInnings.wickets === 0 &&
      activeInnings.balls_bowled === 0 &&
      recentBalls.length === 0

    setInnings(activeInnings)
    setStriker(restoredStriker)
    setBowler(restoredBowler)
    setDismissals(storedDismissals.statuses)
    setLastBalls(recentBalls.reverse())

    if (!restoredStriker) {
      updateStoredSelection({ strikerId: null })
    }

    if (!restoredBowler) {
      updateStoredSelection({ bowlerId: null })
    }

    if (isPreMatchSetup && !restoredStriker) {
      setView('selectBattingTeam')
    } else if (!restoredStriker) {
      setView('selectBatsman')
    } else if (!restoredBowler) {
      setView('selectBowler')
    } else {
      setView('main')
    }

    setLoading(false)
  }

  async function selectBattingTeam(teamId: string) {
    if (!match) {
      toast.error('Match not loaded yet')
      return
    }

    if (teamId !== match.team_a && teamId !== match.team_b) {
      toast.error('Invalid team selected')
      return
    }

    const bowlingTeamId = teamId === match.team_a ? match.team_b : match.team_a
    setLoading(true)

    try {
      let activeInnings = innings

      if (!activeInnings) {
        const { data: createdInnings, error: createInningsError } = await supabase
          .from('innings')
          .insert({
            match_id: safeMatchId,
            innings_number: 1,
            batting_team: teamId,
            bowling_team: bowlingTeamId,
            score: 0,
            wickets: 0,
            balls_bowled: 0,
            overs: 0,
            is_complete: false,
          })
          .select('*')
          .single()

        if (createInningsError || !createdInnings) {
          throw new Error(createInningsError?.message || 'Failed to start innings')
        }

        activeInnings = createdInnings as InningsState
      } else {
        const { data: updatedInnings, error: updateInningsError } = await supabase
          .from('innings')
          .update({
            batting_team: teamId,
            bowling_team: bowlingTeamId,
            score: 0,
            wickets: 0,
            balls_bowled: 0,
            overs: 0,
            target: null,
            is_complete: false,
          })
          .eq('id', activeInnings.id)
          .select('*')
          .single()

        if (updateInningsError || !updatedInnings) {
          throw new Error(updateInningsError?.message || 'Failed to set batting team')
        }

        activeInnings = updatedInnings as InningsState
      }

      const { error: matchStatusError } = await supabase
        .from('matches')
        .update({ status: 'live' })
        .eq('id', safeMatchId)

      if (matchStatusError) {
        throw new Error(matchStatusError.message || 'Failed to update match status')
      }

      clearStoredSelection()
      clearStoredDismissals(activeInnings.id)
      setInnings(activeInnings)
      setDismissals({})
      setLastBalls([])
      setStriker(null)
      setBowler(null)
      setPendingBowlerChangeReason(null)
      setView('selectBatsman')
      toast.success('Batting team selected. Pick your opening striker.')
    } catch (error) {
      console.error('[score] Failed to set batting team', error)
      toast.error(error instanceof Error ? error.message : 'Failed to set batting team')
    } finally {
      setLoading(false)
      await loadData()
    }
  }

  async function finishInnings(finalScore: number, finalWickets: number, finalBallsBowled: number) {
    if (!innings) {
      return
    }

    const { error: inningsCompleteError } = await supabase
      .from('innings')
      .update({
        score: finalScore,
        wickets: finalWickets,
        balls_bowled: finalBallsBowled,
        overs: Math.floor(finalBallsBowled / 6),
        is_complete: true,
      })
      .eq('id', innings.id)

    if (inningsCompleteError) {
      console.error('[score] Failed to complete innings', inningsCompleteError)
      throw new Error(inningsCompleteError.message || 'Failed to complete innings')
    }

    if (innings.innings_number === 1) {
      const { data: secondInnings, error: secondInningsError } = await supabase
        .from('innings')
        .insert({
          match_id: safeMatchId,
          innings_number: 2,
          batting_team: innings.bowling_team,
          bowling_team: innings.batting_team,
          score: 0,
          wickets: 0,
          balls_bowled: 0,
          overs: 0,
          target: finalScore + 1,
          is_complete: false,
        })
        .select('*')
        .single()

      if (secondInningsError || !secondInnings) {
        console.error('[score] Failed to create second innings', secondInningsError)
        throw new Error(secondInningsError?.message || 'Failed to start second innings')
      }

      clearStoredSelection()
      setInnings(secondInnings as InningsState)
      setDismissals({})
      setLastBalls([])
      setPendingBowlerChangeReason(null)
      setStriker(null)
      setBowler(null)
      setView('selectBatsman')
      toast.success(`1st innings complete! Target: ${finalScore + 1}`)
      return
    }

    const winner = finalScore > ((innings.target || 0) - 1) ? innings.batting_team : innings.bowling_team
    const { error: matchUpdateError } = await supabase
      .from('matches')
      .update({ status: 'completed', winner })
      .eq('id', safeMatchId)

    if (matchUpdateError) {
      console.error('[score] Failed to complete match', matchUpdateError)
      throw new Error(matchUpdateError.message || 'Failed to complete match')
    }

    clearStoredSelection()
    setStriker(null)
    setBowler(null)
    toast.success('Match complete!')
    router.push(`/match/${safeMatchId}`)
  }

  useEffect(() => {
    if (!isModerator) {
      router.push('/')
      return
    }

    let isMounted = true

    void Promise.resolve().then(async () => {
      if (!isMounted) {
        return
      }
      await loadData()
    })

    return () => {
      isMounted = false
    }
  }, [isModerator, router, safeMatchId])

  const battingTeamPlayers = innings
    ? (() => {
      const battingSquadIds = getStoredTeamPlayerIds(match, matchSquads, innings.batting_team)
      return battingSquadIds.length > 0
        ? orderPlayersByIds(players, battingSquadIds)
        : players.filter(player => player.team_id === innings.batting_team)
    })()
    : []
  const bowlingTeamPlayers = innings
    ? (() => {
      const bowlingSquadIds = getStoredTeamPlayerIds(match, matchSquads, innings.bowling_team)
      return bowlingSquadIds.length > 0
        ? orderPlayersByIds(players, bowlingSquadIds)
        : players.filter(player => player.team_id === innings.bowling_team)
    })()
    : []
  const wicketLimit = Math.max(1, battingTeamPlayers.length || 10)
  const displayedWickets = innings ? Math.min(innings.wickets, wicketLimit) : 0
  const availableBattingPlayers = battingTeamPlayers.filter(player => dismissals[player.id] !== 'out')

  async function recordBall(eventType: EventType, runs: number, dismissalStatus?: DismissalStatus) {
    if (!innings || !striker || !bowler) {
      toast.error('Please select striker and bowler first')
      return
    }

    if (innings.wickets >= wicketLimit) {
      toast.info('Recovering innings transition...')
      await loadData()
      return
    }

    if (eventType === 'wicket' && dismissals[striker.id]) {
      toast.error(`${striker.name} is already ${dismissals[striker.id]}`)
      return
    }

    const currentOver = Math.floor(innings.balls_bowled / 6)
    const currentBall = innings.balls_bowled % 6
    const result = processBall(eventType, runs, currentBall, match?.overs || 0, currentOver)

    try {
      const { data: createdBall, error: ballError } = await supabase
        .from('balls')
        .insert({
          match_id: safeMatchId,
          innings_id: innings.id,
          over_number: currentOver,
          ball_number: currentBall,
          runs: result.runs,
          event_type: eventType,
          batsman_id: striker.id,
          bowler_id: bowler.id,
        })
        .select('id')
        .single()

      if (ballError) {
        console.error('[score] Failed to record ball', ballError)
        toast.error(ballError.message || 'Failed to record ball')
        return
      }

      const newScore = innings.score + result.runs
      const newWickets = eventType === 'wicket'
        ? Math.min(wicketLimit, innings.wickets + 1)
        : innings.wickets
      const newBallsBowled = result.ballCounted ? innings.balls_bowled + 1 : innings.balls_bowled
      const matchEnded =
        newWickets >= wicketLimit ||
        (innings.innings_number === 2 && newScore > (innings.target || 9999))
      const oversCompleted = result.ballCounted && newBallsBowled >= ((match?.overs || 0) * 6)
      const isComplete = matchEnded || oversCompleted

      if (!isComplete) {
        const { error: inningsUpdateError } = await supabase
          .from('innings')
          .update({
            score: newScore,
            wickets: newWickets,
            balls_bowled: newBallsBowled,
            overs: Math.floor(newBallsBowled / 6),
            is_complete: false,
          })
          .eq('id', innings.id)

        if (inningsUpdateError) {
          console.error('[score] Failed to update innings', inningsUpdateError)
          toast.error(inningsUpdateError.message || 'Failed to update innings')
          return
        }
      }

      if (eventType === 'wicket' && dismissalStatus === 'out') {
        saveDismissal(innings.id, striker.id, 'out', createdBall?.id)
      }

      const batRuns = eventType !== 'wide' ? result.runs : 0
      const batBalls = eventType !== 'wide' && eventType !== 'no_ball' ? 1 : 0
      const fours = result.runs === 4 ? 1 : 0
      const sixes = result.runs === 6 ? 1 : 0

      await updatePlayerMatchStats(striker.id, {
        runs: batRuns,
        balls: batBalls,
        fours,
        sixes,
      })

      await updatePlayerMatchStats(bowler.id, {
        wickets: eventType === 'wicket' ? 1 : 0,
        runs_conceded: result.runs,
        overs_bowled: result.ballCounted ? 0.1 : 0,
      })

      if (isComplete) {
        await finishInnings(newScore, newWickets, newBallsBowled)
        return
      }

      if (result.overEnded) {
        setBowler(null)
        setPendingBowlerChangeReason(null)
        updateStoredSelection({ bowlerId: null })
        toast.info(`Over ${currentOver + 1} complete!`)
        setView('selectBowler')
      }

      if (eventType === 'wicket') {
        setStriker(null)
        updateStoredSelection({ strikerId: null })
        setView('selectBatsman')
      }

      await loadData()
    } catch (error) {
      console.error('[score] Failed to update scoring state', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update match state')
    }
  }

  async function handleRetired() {
    if (!innings || !striker) {
      toast.error('Please select a striker first')
      return
    }

    if (dismissals[striker.id]) {
      toast.error(`${striker.name} is already ${dismissals[striker.id]}`)
      return
    }

    const nextDismissals = saveDismissal(innings.id, striker.id, 'retired')
    const remainingBatters = battingTeamPlayers.filter(
      player => player.id !== striker.id && nextDismissals[player.id] !== 'out'
    )

    setStriker(null)
    updateStoredSelection({ strikerId: null })

    if (remainingBatters.length === 0) {
      toast.info('Retired batter moved to the bench and can return later.')
      setView('selectBatsman')
      return
    }

    toast.success(`${striker.name} marked as retired and kept available on the bench`)
    setView('selectBatsman')
  }

  async function undoLastBall() {
    if (!lastBalls.length || !innings) {
      toast.error('No balls to undo')
      return
    }

    const lastBall = lastBalls[lastBalls.length - 1]
    const isCounted = lastBall.event_type !== 'wide' && lastBall.event_type !== 'no_ball'
    const removedDismissal = removeDismissalByBallId(innings.id, lastBall.id)

    await supabase.from('balls').delete().eq('id', lastBall.id)
    await supabase.from('innings').update({
      score: Math.max(0, innings.score - lastBall.runs),
      wickets: Math.max(0, lastBall.event_type === 'wicket' ? innings.wickets - 1 : innings.wickets),
      balls_bowled: Math.max(0, isCounted ? innings.balls_bowled - 1 : innings.balls_bowled),
    }).eq('id', innings.id)

    if (removedDismissal) {
      updateStoredSelection({ strikerId: removedDismissal.playerId })
    }

    toast.success('Last ball undone')
    await loadData()
  }
  const currentOverBalls = innings
    ? lastBalls.filter(ball => ball.over_number === Math.floor(innings.balls_bowled / 6))
    : []
  const isBetweenOvers = Boolean(innings && innings.balls_bowled > 0 && innings.balls_bowled % 6 === 0)
  const blockedNextOverBowlerId = (() => {
    if (!innings || !isBetweenOvers) {
      return null
    }

    const previousOverNumber = Math.floor(innings.balls_bowled / 6) - 1
    for (let i = lastBalls.length - 1; i >= 0; i -= 1) {
      const ball = lastBalls[i]
      if (ball.over_number === previousOverNumber && ball.bowler_id) {
        return ball.bowler_id
      }
    }

    return null
  })()
  const crr = innings && innings.balls_bowled > 0
    ? ((innings.score / innings.balls_bowled) * 6).toFixed(2)
    : '0.00'

  if (!isModerator) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading scoring interface...</p>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Match data not found.</p>
          <Link href={`/match/${safeMatchId}`}>
            <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
              Back to Match
            </button>
          </Link>
        </div>
      </div>
    )
  }

  if (view === 'selectBattingTeam') {
    const teamAName = match.team_a_data?.name || 'Team A'
    const teamBName = match.team_b_data?.name || 'Team B'

    return (
      <main className="min-h-screen bg-background pb-6">
        <div className="glass-card border-none px-4 py-4 flex items-center gap-4 sticky top-0 z-50 rounded-b-3xl shadow-2xl">
          <Link href={`/match/${safeMatchId}`}>
            <button className="p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground transition-all">
              <ChevronLeft size={24} />
            </button>
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-0.5">Match Setup</p>
            <p className="font-bold text-base truncate">{teamAName} vs {teamBName}</p>
          </div>
        </div>

        <div className="px-4 pt-6">
          <div className="glass-card rounded-3xl border border-white/10 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Gully Cricket Setup</p>
            <h2 className="mt-3 text-2xl font-black">Select Batting Team</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This scorer uses one active striker at a time. Choose who bats first, then pick striker and bowler.
            </p>

            <div className="mt-5 grid gap-3">
              <button
                onClick={() => { void selectBattingTeam(match.team_a) }}
                className="w-full rounded-2xl border border-primary/35 bg-primary/15 px-4 py-4 text-left transition hover:border-primary/50 hover:bg-primary/20"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/90">Bat First</p>
                <p className="mt-1 text-lg font-black">{teamAName}</p>
              </button>

              <button
                onClick={() => { void selectBattingTeam(match.team_b) }}
                className="w-full rounded-2xl border border-accent/35 bg-accent/15 px-4 py-4 text-left transition hover:border-accent/50 hover:bg-accent/20"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-accent/90">Bat First</p>
                <p className="mt-1 text-lg font-black">{teamBName}</p>
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!innings) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">No active innings found.</p>
          <button
            onClick={() => setView('selectBattingTeam')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}
          >
            Set Batting Team
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background pb-4">
      <div className="glass-card border-none px-4 py-4 flex items-center gap-4 sticky top-0 z-50 rounded-b-3xl shadow-2xl">
        <Link href={`/match/${safeMatchId}`}>
          <button className="p-2.5 rounded-xl hover:bg-white/5 text-muted-foreground transition-all">
            <ChevronLeft size={24} />
          </button>
        </Link>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest font-black text-primary mb-0.5">Live Scoring</p>
          <p className="font-bold text-base truncate">{match.team_a_data?.name} vs {match.team_b_data?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums gradient-text">{innings.score}/{displayedWickets}</p>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            {Math.floor(innings.balls_bowled / 6)}.{innings.balls_bowled % 6} ov | CRR {crr} | Cap {wicketLimit}
          </p>
        </div>
      </div>

      {view === 'selectBatsman' && (
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold text-sm">Select Striker</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {availableBattingPlayers.length} left
            </p>
          </div>
          <div className="space-y-2">
            {battingTeamPlayers.map(player => (
              (() => {
                const dismissalStatus = dismissals[player.id]
                const isUnavailable = dismissalStatus === 'out'

                return (
              <button
                key={player.id}
                disabled={isUnavailable}
                onClick={() => {
                  if (innings && dismissalStatus === 'retired') {
                    clearDismissalStatus(innings.id, player.id)
                  }
                  setStriker(player)
                  updateStoredSelection({ strikerId: player.id })
                  setView(bowler ? 'main' : 'selectBowler')
                }}
                className={`w-full text-left glass rounded-xl px-4 py-3 text-sm font-medium border transition-colors ${
                  isUnavailable
                    ? 'border-red-500/20 bg-red-500/10 text-white/45 cursor-not-allowed'
                    : dismissalStatus === 'retired'
                      ? 'border-amber-500/20 bg-amber-500/10 hover:border-amber-400/40'
                      : 'border-transparent hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{player.name}</span>
                  {dismissalStatus && (
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                      dismissalStatus === 'out'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {dismissalStatus}
                    </span>
                  )}
                </div>
              </button>
                )
              })()
            ))}
          </div>
        </div>
      )}

      {view === 'selectBowler' && (
        <div className="px-6 py-6 animate-in slide-in-from-bottom duration-300">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-primary">Select Bowler</h3>
              {pendingBowlerChangeReason && (
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                  Reason: {formatBowlerChangeReason(pendingBowlerChangeReason)}
                </p>
              )}
              {!pendingBowlerChangeReason && isBetweenOvers && blockedNextOverBowlerId && (
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                  Previous-over bowler is disabled for this over.
                </p>
              )}
            </div>
            {pendingBowlerChangeReason && bowler && (
              <button
                onClick={() => {
                  setPendingBowlerChangeReason(null)
                  setView('main')
                }}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="space-y-3">
            {bowlingTeamPlayers.map(player => {
              const isCurrentBowlerLocked = Boolean(pendingBowlerChangeReason && bowler?.id === player.id)
              const isPreviousOverBowlerLocked = Boolean(
                !pendingBowlerChangeReason &&
                isBetweenOvers &&
                blockedNextOverBowlerId &&
                blockedNextOverBowlerId === player.id
              )
              const isDisabled = isCurrentBowlerLocked || isPreviousOverBowlerLocked

              return (
                <button
                  key={player.id}
                  disabled={isDisabled}
                  onClick={() => {
                    setBowler(player)
                    updateStoredSelection({ bowlerId: player.id })
                    if (pendingBowlerChangeReason) {
                      toast.success(`Bowler changed: ${formatBowlerChangeReason(pendingBowlerChangeReason)}`)
                      setPendingBowlerChangeReason(null)
                    }
                    setView(striker ? 'main' : 'selectBatsman')
                  }}
                  className={`w-full text-left glass-card rounded-2xl px-5 py-4 text-sm font-bold transition-all active:scale-95 ${
                    isDisabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>{player.name}</span>
                    {isCurrentBowlerLocked && (
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Current
                      </span>
                    )}
                    {isPreviousOverBowlerLocked && (
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        Prev over
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {view === 'bowlerChangeReason' && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 px-4 pb-4 pt-12 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-background p-5 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent/80">Change Bowler</p>
            <h3 className="mt-2 text-xl font-black">{bowler?.name || 'Current Bowler'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Select a reason before replacing the bowler. This also works mid-over if the current delivery cannot be completed.
            </p>

            <div className="mt-5 grid gap-3">
              {(['injury', 'unavailable', 'strategic', 'other'] as BowlerChangeReason[]).map(reason => (
                <button
                  key={reason}
                  onClick={() => {
                    setPendingBowlerChangeReason(reason)
                    setView('selectBowler')
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left text-white transition hover:bg-white/[0.08]"
                >
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-accent">
                    {formatBowlerChangeReason(reason)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reason === 'injury' && 'Use this when the bowler cannot continue due to injury.'}
                    {reason === 'unavailable' && 'Use this when the bowler is unavailable to continue the over.'}
                    {reason === 'strategic' && 'Use this for a tactical mid-over or between-ball bowling change.'}
                    {reason === 'other' && 'Use this when the change does not fit the standard reasons.'}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setView('main')}
              className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(view === 'main' || view === 'dismissal') && (
        <>
          <div className="px-4 py-4 space-y-3">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-3 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">
                  Current Players
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  Live Roles
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ActivePlayerBadge
                  role="Batsman"
                  playerName={striker?.name || 'Select Batsman'}
                  tone="batting"
                />

                <ActivePlayerBadge
                  role="Bowler"
                  playerName={bowler?.name || 'Select Bowler'}
                  tone="bowling"
                />
              </div>
            </div>
          </div>

          {(!striker || !bowler) && (
            <div className="px-4 pb-3 space-y-2">
              {!striker && (
                <button
                  onClick={() => setView('selectBatsman')}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}
                >
                  Select Batsman
                </button>
              )}
              {!bowler && (
                <button
                  onClick={() => setView('selectBowler')}
                  className="w-full py-3 rounded-xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #00d4aa, #009980)', color: '#000' }}
                >
                  Select Bowler
                </button>
              )}
            </div>
          )}

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3">
              <span className="text-xs text-muted-foreground font-medium">Over {Math.floor(innings.balls_bowled / 6) + 1}:</span>
              <div className="flex gap-1 flex-wrap">
                {currentOverBalls.length > 0 ? currentOverBalls.map(ball => {
                  let label = ball.runs.toString()
                  let cls = 'bg-white/10 text-white'

                  if (ball.event_type === 'wide') {
                    label = 'Wd'
                    cls = 'bg-green-500/20 text-green-400'
                  } else if (ball.event_type === 'no_ball') {
                    label = 'NB'
                    cls = 'bg-yellow-500/20 text-yellow-400'
                  } else if (ball.event_type === 'wicket') {
                    label = 'W'
                    cls = 'bg-red-500/30 text-red-400'
                  } else if (ball.runs === 4) {
                    cls = 'bg-blue-500/20 text-blue-400'
                  } else if (ball.runs === 6) {
                    cls = 'bg-purple-500/20 text-purple-400'
                  }

                  return (
                    <span key={ball.id} className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${cls}`}>
                      {label}
                    </span>
                  )
                }) : (
                  <span className="text-xs text-muted-foreground italic">No balls bowled</span>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 6].map(runValue => (
                <motion.button
                  key={runValue}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => recordBall('run', runValue)}
                  className={`score-btn h-20 text-2xl ${runValue === 4 || runValue === 6 ? 'score-primary' : 'text-white'}`}
                >
                  {runValue}
                </motion.button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => recordBall('wide', 1)}
                className="score-accent h-24"
              >
                <div className="flex flex-col items-center">
                  <span className="text-xl font-black">WD</span>
                  <span className="text-[10px] uppercase font-bold opacity-60">+1 Run</span>
                </div>
              </motion.button>

              <div className="flex flex-col gap-2">
                {[0, 4, 6].map(runValue => (
                  <motion.button
                    key={runValue}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => recordBall('no_ball', runValue)}
                    className="score-accent h-12 text-sm font-black"
                  >
                    NB+{runValue}
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (!striker) {
                    toast.error('Select striker first')
                    return
                  }
                  setView('dismissal')
                }}
                className="score-danger h-24"
              >
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-1">W</span>
                  <span className="text-xs font-black uppercase tracking-widest">Wicket</span>
                </div>
              </motion.button>
            </div>
          </div>

          <div className="px-4 mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={undoLastBall}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold glass border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
            >
              <RotateCcw size={14} /> Undo
            </button>
            <button
              onClick={() => {
                if (!bowler) {
                  toast.error('Select bowler first')
                  return
                }
                setView('bowlerChangeReason')
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold glass border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
            >
              Change Bowler
            </button>
            <button
              onClick={() => {
                const currentBall = innings.balls_bowled % 6
                if (currentBall !== 0) {
                  toast.error('Can only end over after 6 legal balls')
                  return
                }
                setBowler(null)
                updateStoredSelection({ bowlerId: null })
                setView('selectBowler')
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold glass border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <SkipForward size={14} /> End Over
            </button>
          </div>

          {view === 'dismissal' && striker && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 px-4 pb-4 pt-12 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-background p-5 shadow-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300/80">Dismissal</p>
                <h3 className="mt-2 text-xl font-black">{striker.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose how this batter leaves the innings. Out adds a wicket. Retired removes the batter without increasing the wicket count.
                </p>

                <div className="mt-5 grid gap-3">
                  <button
                    onClick={() => recordBall('wicket', 0, 'out')}
                    className="w-full rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-4 text-left text-white transition hover:bg-red-500/20"
                  >
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">Out</p>
                    <p className="mt-1 text-xs text-red-100/80">Counts as a wicket and locks this batter from being selected again.</p>
                  </button>

                  <button
                    onClick={handleRetired}
                    className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/15 px-4 py-4 text-left text-white transition hover:bg-amber-500/20"
                  >
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-100">Retired</p>
                    <p className="mt-1 text-xs text-amber-50/80">Does not add a wicket, but this batter will be marked retired and removed from the strike list.</p>
                  </button>
                </div>

                <button
                  onClick={() => setView('main')}
                  className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
