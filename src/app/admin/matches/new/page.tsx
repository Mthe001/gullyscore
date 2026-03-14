'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CalendarDays, CircleDot, Flag, Sparkles, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Team, Tournament } from '@/lib/types'

type MatchStatus = 'upcoming' | 'live'
const DB_STEP_TIMEOUT_MS = 12000

interface MatchFormState {
  teamAId: string
  teamBId: string
  teamAName: string
  teamBName: string
  teamAPlayers: string
  teamBPlayers: string
  overs: string
  tournamentName: string
  status: MatchStatus
}

type MatchSquadPlayer = {
  id: string
  name: string
}

const initialForm: MatchFormState = {
  teamAId: '',
  teamBId: '',
  teamAName: '',
  teamBName: '',
  teamAPlayers: '',
  teamBPlayers: '',
  overs: '10',
  tournamentName: '',
  status: 'upcoming',
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function parsePlayerNames(value: string) {
  const seen = new Set<string>()

  return value
    .split(/[\r\n,]+/)
    .map(name => normalizeName(name))
    .filter(name => {
      const key = name.toLowerCase()
      if (!name || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

async function withTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = DB_STEP_TIMEOUT_MS) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out. Check your internet or Supabase connection and try again.`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function getAdminWriteErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Failed to create match'

  if (error.message.toLowerCase().includes('row-level security')) {
    return 'Supabase RLS is blocking match creation. Make sure your public.users role is admin, then run supabase-admin-policies.sql in the SQL Editor.'
  }

  return error.message
}

export default function NewMatchPage() {
  const router = useRouter()
  const { isAdmin, loading: authLoading } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [form, setForm] = useState<MatchFormState>(initialForm)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
      return
    }

    if (authLoading || !isAdmin) {
      return
    }

    async function loadOptions() {
      const [teamsRes, tournamentsRes] = await Promise.all([
        supabase.from('teams').select('id, name, logo_url').order('name'),
        supabase.from('tournaments').select('id, name, format, start_date, status').order('name'),
      ])

      if (teamsRes.error) {
        toast.error(teamsRes.error.message)
      } else {
        setTeams(teamsRes.data || [])
      }

      if (tournamentsRes.error) {
        toast.error(tournamentsRes.error.message)
      } else {
        setTournaments(tournamentsRes.data || [])
      }
    }

    loadOptions()
  }, [authLoading, isAdmin, router])

  async function resolveTeamId(teamName: string) {
    const normalized = normalizeName(teamName)

    console.info('[create-match] Resolving team', { teamName: normalized })

    const { data: existingTeam, error: existingTeamError } = await withTimeout(
      supabase
        .from('teams')
        .select('id, name')
        .ilike('name', normalized)
        .limit(1)
        .maybeSingle(),
      `Looking up team "${normalized}"`
    )

    if (existingTeamError) {
      throw new Error(existingTeamError.message)
    }

    if (existingTeam) {
      return existingTeam.id
    }

    console.info('[create-match] Creating team', { teamName: normalized })

    const { data: createdTeam, error: createTeamError } = await withTimeout(
      supabase
        .from('teams')
        .insert({ name: normalized })
        .select('id')
        .single(),
      `Creating team "${normalized}"`
    )

    if (createTeamError || !createdTeam) {
      throw new Error(createTeamError?.message || `Failed to create team ${normalized}`)
    }

    return createdTeam.id
  }

  async function loadPlayersForTeam(teamId: string, teamLabel: string) {
    const { data, error } = await withTimeout(
      supabase
        .from('players')
        .select('name')
        .eq('team_id', teamId)
        .order('name'),
      `Loading players for ${teamLabel}`
    )

    if (error) {
      throw new Error(error.message)
    }

    return (data || []).map(player => player.name).join('\n')
  }

  async function handleExistingTeamSelect(teamKey: 'A' | 'B', teamId: string) {
    if (!teamId) {
      setForm(current => (
        teamKey === 'A'
          ? { ...current, teamAId: '' }
          : { ...current, teamBId: '' }
      ))
      return
    }

    const selectedTeam = teams.find(team => team.id === teamId)
    if (!selectedTeam) return

    try {
      const playerList = await loadPlayersForTeam(teamId, selectedTeam.name)

      setForm(current => (
        teamKey === 'A'
          ? {
              ...current,
              teamAId: teamId,
              teamAName: selectedTeam.name,
              teamAPlayers: playerList,
            }
          : {
              ...current,
              teamBId: teamId,
              teamBName: selectedTeam.name,
              teamBPlayers: playerList,
            }
      ))
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to load ${selectedTeam.name} players`
      toast.error(message)
    }
  }

  async function resolveTournamentId() {
    const normalized = normalizeName(form.tournamentName)
    if (!normalized) return null

    console.info('[create-match] Resolving tournament', { tournamentName: normalized })

    const { data: existingTournament, error: existingTournamentError } = await withTimeout(
      supabase
        .from('tournaments')
        .select('id')
        .ilike('name', normalized)
        .limit(1)
        .maybeSingle(),
      `Looking up tournament "${normalized}"`
    )

    if (existingTournamentError) {
      throw new Error(existingTournamentError.message)
    }

    return existingTournament?.id ?? null
  }

  async function ensurePlayersForTeam(teamId: string, rawPlayers: string, teamLabel: string): Promise<MatchSquadPlayer[]> {
    const playerNames = parsePlayerNames(rawPlayers)

    if (playerNames.length === 0) {
      return []
    }

    console.info('[create-match] Resolving squad players', {
      teamId,
      teamLabel,
      count: playerNames.length,
      playerNames,
    })

    const { data: existingPlayers, error: existingPlayersError } = await withTimeout(
      supabase
        .from('players')
        .select('id, name, team_id')
        .eq('team_id', teamId),
      `Loading existing players for ${teamLabel}`
    )

    if (existingPlayersError) {
      throw new Error(existingPlayersError.message)
    }

    const existingByName = new Map(
      (existingPlayers || []).map(player => [normalizeName(player.name).toLowerCase(), player])
    )

    const missingPlayers = playerNames.filter(name => !existingByName.has(name.toLowerCase()))

    if (missingPlayers.length > 0) {
      console.info('[create-match] Creating squad players', {
        teamId,
        teamLabel,
        missingPlayers,
      })

      const { error: createPlayersError } = await withTimeout(
        supabase.from('players').insert(
          missingPlayers.map(name => ({
            name,
            team_id: teamId,
          }))
        ),
        `Creating players for ${teamLabel}`
      )

      if (createPlayersError) {
        throw new Error(createPlayersError.message)
      }
    }

    const { data: finalPlayers, error: finalPlayersError } = await withTimeout(
      supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId),
      `Reloading players for ${teamLabel}`
    )

    if (finalPlayersError) {
      throw new Error(finalPlayersError.message)
    }

    const playersByName = new Map(
      (finalPlayers || []).map(player => [normalizeName(player.name).toLowerCase(), player])
    )

    return playerNames
      .map(name => playersByName.get(name.toLowerCase()))
      .filter((player): player is MatchSquadPlayer => Boolean(player))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!isAdmin) {
      toast.error('Admin access is required to create matches')
      return
    }

    const selectedTeamA = teams.find(team => team.id === form.teamAId)
    const selectedTeamB = teams.find(team => team.id === form.teamBId)
    const teamAName = normalizeName(selectedTeamA?.name || form.teamAName)
    const teamBName = normalizeName(selectedTeamB?.name || form.teamBName)
    const overs = Number(form.overs)
    const teamAPlayers = parsePlayerNames(form.teamAPlayers)
    const teamBPlayers = parsePlayerNames(form.teamBPlayers)

    if (!teamAName || !teamBName) {
      toast.error('Please enter both team names')
      return
    }

    if (teamAName.toLowerCase() === teamBName.toLowerCase()) {
      toast.error('Team A and Team B cannot be the same')
      return
    }

    if (!Number.isInteger(overs) || overs <= 0 || overs > 50) {
      toast.error('Overs must be a whole number between 1 and 50')
      return
    }

    if (teamAPlayers.length > 0 && teamAPlayers.length < 2) {
      toast.error('Add at least 2 players for Team A, or leave the squad blank for now')
      return
    }

    if (teamBPlayers.length > 0 && teamBPlayers.length < 2) {
      toast.error('Add at least 2 players for Team B, or leave the squad blank for now')
      return
    }

    setLoading(true)
    setSetupError(null)
    let shouldNavigate = false

    try {
      console.info('[create-match] Starting match creation', {
        teamAName,
        teamBName,
        teamAPlayers,
        teamBPlayers,
        overs,
        tournamentName: normalizeName(form.tournamentName) || null,
        status: form.status,
      })

      const [teamAId, teamBId, tournamentId] = await Promise.all([
        form.teamAId ? Promise.resolve(form.teamAId) : resolveTeamId(teamAName),
        form.teamBId ? Promise.resolve(form.teamBId) : resolveTeamId(teamBName),
        resolveTournamentId(),
      ])

      if (teamAId === teamBId) {
        toast.error('Team A and Team B resolved to the same team')
        return
      }

      const [teamASquad, teamBSquad] = await Promise.all([
        ensurePlayersForTeam(teamAId, form.teamAPlayers, `${teamAName} squad`),
        ensurePlayersForTeam(teamBId, form.teamBPlayers, `${teamBName} squad`),
      ])

      console.info('[create-match] Creating match row', {
        teamAId,
        teamBId,
        tournamentId,
        overs,
        status: form.status,
      })

      const { data: match, error: matchError } = await withTimeout(
        supabase
          .from('matches')
          .insert({
            team_a: teamAId,
            team_b: teamBId,
            overs,
            tournament_id: tournamentId,
            status: form.status,
          })
          .select()
          .single(),
        'Creating match'
      )

      if (matchError || !match) {
        throw new Error(matchError?.message || 'Failed to create match')
      }

      console.info('[create-match] Match row created', { matchId: match.id })

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          `gullyscore:match-squads:${match.id}`,
          JSON.stringify({
            teamAPlayerIds: teamASquad.map(player => player.id),
            teamBPlayerIds: teamBSquad.map(player => player.id),
            teamAPlayerNames: teamASquad.map(player => player.name),
            teamBPlayerNames: teamBSquad.map(player => player.name),
          })
        )
      }

      if (normalizeName(form.tournamentName) && !tournamentId) {
        toast.info('Tournament not found, so the match was created without attaching a tournament.')
      }

      if (form.status === 'live') {
        console.info('[create-match] Creating opening innings', { matchId: match.id })

        const { error: inningsError } = await withTimeout(
          supabase.from('innings').insert({
            match_id: match.id,
            innings_number: 1,
            batting_team: teamAId,
            bowling_team: teamBId,
            score: 0,
            wickets: 0,
            balls_bowled: 0,
            overs: 0,
            is_complete: false,
          }),
          'Creating opening innings'
        )

        if (inningsError) {
          console.error('[create-match] Opening innings failed, rolling back match', {
            matchId: match.id,
            error: inningsError,
          })

          const rollbackResult = await withTimeout(
            supabase.from('matches').delete().eq('id', match.id),
            'Rolling back failed match'
          )

          if (rollbackResult.error) {
            console.error('[create-match] Rollback failed', {
              matchId: match.id,
              error: rollbackResult.error,
            })
          }

          throw new Error(inningsError.message)
        }

        toast.success('Match created and started live')
        setLoading(false)
        shouldNavigate = true
        router.push(`/score/${match.id}`)
        return
      }

      toast.success('Upcoming match created')
      setLoading(false)
      shouldNavigate = true
      router.push('/admin/matches')
    } catch (error) {
      console.error('[create-match] Match creation failed', error)
      const message = getAdminWriteErrorMessage(error)
      if (message.toLowerCase().includes('supabase rls')) {
        setSetupError(message)
      }
      toast.error(message)
    } finally {
      if (!shouldNavigate) {
        setLoading(false)
      }
    }
  }

  const knownTeams = teams.map(team => team.name)
  const knownTournaments = tournaments.map(tournament => tournament.name)

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-2xl mx-auto px-4 pb-24 pt-16">
        <div className="mt-4 mb-6 flex items-center gap-3">
          <Link href="/admin/matches">
            <button className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70">Match Builder</p>
            <h1 className="text-2xl font-black tracking-tight">Create Match</h1>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_30%),rgba(255,255,255,0.03)] p-5 shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black">Type-first match setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter any team name. Existing teams will be reused, missing teams will be created automatically, and tournaments only attach when the typed name already exists.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-300">
              <Sparkles size={18} />
            </div>
          </div>

          {setupError && (
            <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-50">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-amber-400/15 p-2 text-amber-200">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="font-bold">Database setup is still blocking match creation.</p>
                  <p className="mt-1 text-amber-100/90">{setupError}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-amber-200/70">Do this in Supabase</p>
                  <p className="mt-1 text-sm text-amber-50/90">1. In `public.users`, make sure your account role is `admin`.</p>
                  <p className="mt-1 text-sm text-amber-50/90">2. In SQL Editor, run the `supabase-admin-policies.sql` file from this project root.</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm(current => ({ ...current, status: 'upcoming' }))}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  form.status === 'upcoming'
                    ? 'border-amber-400/50 bg-amber-400/10 text-amber-100'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <CalendarDays size={16} />
                  <span className="text-xs font-black uppercase tracking-[0.25em]">Upcoming</span>
                </div>
                <p className="text-sm font-semibold">Create fixture first</p>
                <p className="mt-1 text-xs opacity-75">Shows on public pages and can be started later from admin control.</p>
              </button>

              <button
                type="button"
                onClick={() => setForm(current => ({ ...current, status: 'live' }))}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  form.status === 'live'
                    ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <CircleDot size={16} />
                  <span className="text-xs font-black uppercase tracking-[0.25em]">Live</span>
                </div>
                <p className="text-sm font-semibold">Start scoring immediately</p>
                <p className="mt-1 text-xs opacity-75">Initial innings will be created and you will be sent to the scorer.</p>
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-200/80">
                  <Flag size={14} /> Team A
                </label>
                <p className="mb-2 text-[11px] text-muted-foreground">Select an existing team or type manually. Bats first when innings begins.</p>
                <select
                  value={form.teamAId}
                  onChange={event => {
                    const selectedId = event.target.value

                    if (selectedId && selectedId === form.teamBId) {
                      toast.error('Team A and Team B cannot be the same')
                      return
                    }

                    handleExistingTeamSelect('A', selectedId)
                  }}
                  className="mb-2 w-full rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-3 text-sm text-white focus:border-emerald-300 focus:outline-none"
                >
                  <option value="">Manual team name</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <input
                  list="team-suggestions"
                  value={form.teamAName}
                  onChange={event => {
                    const value = event.target.value
                    setForm(current => {
                      const selectedTeam = teams.find(team => team.id === current.teamAId)
                      const isStillSelected = selectedTeam && normalizeName(selectedTeam.name).toLowerCase() === normalizeName(value).toLowerCase()

                      return {
                        ...current,
                        teamAName: value,
                        teamAId: isStillSelected ? current.teamAId : '',
                      }
                    })
                  }}
                  required
                  placeholder="Street Kings"
                  className="w-full rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-emerald-300 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-orange-200/80">
                  <Swords size={14} /> Team B
                </label>
                <p className="mb-2 text-[11px] text-muted-foreground">Select an existing team or type manually. Bowls first against Team A.</p>
                <select
                  value={form.teamBId}
                  onChange={event => {
                    const selectedId = event.target.value

                    if (selectedId && selectedId === form.teamAId) {
                      toast.error('Team A and Team B cannot be the same')
                      return
                    }

                    handleExistingTeamSelect('B', selectedId)
                  }}
                  className="mb-2 w-full rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-3 text-sm text-white focus:border-orange-300 focus:outline-none"
                >
                  <option value="">Manual team name</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <input
                  list="team-suggestions"
                  value={form.teamBName}
                  onChange={event => {
                    const value = event.target.value
                    setForm(current => {
                      const selectedTeam = teams.find(team => team.id === current.teamBId)
                      const isStillSelected = selectedTeam && normalizeName(selectedTeam.name).toLowerCase() === normalizeName(value).toLowerCase()

                      return {
                        ...current,
                        teamBName: value,
                        teamBId: isStillSelected ? current.teamBId : '',
                      }
                    })
                  }}
                  required
                  placeholder="Tape Ball Tigers"
                  className="w-full rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-orange-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-sky-200/80">Overs</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  inputMode="numeric"
                  value={form.overs}
                  onChange={event => setForm(current => ({ ...current, overs: event.target.value }))}
                  className="w-full rounded-xl border border-sky-400/20 bg-sky-400/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-sky-300 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200/80">Tournament</label>
                <input
                  list="tournament-suggestions"
                  value={form.tournamentName}
                  onChange={event => setForm(current => ({ ...current, tournamentName: event.target.value }))}
                  placeholder="Existing tournament name (optional)"
                  className="w-full rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-fuchsia-300 focus:outline-none"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  We will attach the match only if this matches an existing tournament.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-emerald-200/80">Team A Squad</label>
                <textarea
                  value={form.teamAPlayers}
                  onChange={event => setForm(current => ({ ...current, teamAPlayers: event.target.value }))}
                  rows={6}
                  placeholder={'Rafi\nShuvo\nArif\nor comma separated'}
                  className="w-full rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-emerald-300 focus:outline-none"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Optional. One player per line or comma separated. Selecting an existing team auto-loads its players.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.22em] text-orange-200/80">Team B Squad</label>
                <textarea
                  value={form.teamBPlayers}
                  onChange={event => setForm(current => ({ ...current, teamBPlayers: event.target.value }))}
                  rows={6}
                  placeholder={'Nayeem\nTanim\nSabbir\nor comma separated'}
                  className="w-full rounded-xl border border-orange-400/20 bg-orange-400/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-orange-300 focus:outline-none"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Existing team players are auto-filled, and any new names are created automatically.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-xs text-muted-foreground">
              Existing teams: {knownTeams.length > 0 ? knownTeams.slice(0, 8).join(', ') : 'none yet'}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #10b981, #f97316)' }}
            >
              {loading ? 'Building Match...' : form.status === 'live' ? 'Create Match And Go Live' : 'Create Upcoming Match'}
            </button>
          </form>
        </div>

        <datalist id="team-suggestions">
          {knownTeams.map(teamName => (
            <option key={teamName} value={teamName} />
          ))}
        </datalist>

        <datalist id="tournament-suggestions">
          {knownTournaments.map(tournamentName => (
            <option key={tournamentName} value={tournamentName} />
          ))}
        </datalist>

      </main>
    </>
  )
}
