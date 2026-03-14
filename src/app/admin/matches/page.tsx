'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, PlayCircle, Plus, Trash2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Navbar } from '@/components/Navbar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Match, Team } from '@/lib/types'

type AdminMatch = Match & {
  team_a_data?: Pick<Team, 'id' | 'name'>
  team_b_data?: Pick<Team, 'id' | 'name'>
}

async function fetchAllMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team_a_data:teams!matches_team_a_fkey(id, name),
      team_b_data:teams!matches_team_b_fkey(id, name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin-matches] Failed to load matches', error)
    throw error
  }

  return (data || []) as AdminMatch[]
}

export default function AdminMatchesPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [startingMatchId, setStartingMatchId] = useState<string | null>(null)
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null)
  const [matchToDelete, setMatchToDelete] = useState<AdminMatch | null>(null)

  useEffect(() => {
    if (!isAdmin) router.push('/')
  }, [isAdmin, router])

  const { data: matches, error, refetch } = useQuery({
    queryKey: ['admin-matches'],
    queryFn: fetchAllMatches,
  })

  async function startMatch(match: AdminMatch) {
    setStartingMatchId(match.id)

    const { data: existingInnings, error: inningsLookupError } = await supabase
      .from('innings')
      .select('id')
      .eq('match_id', match.id)
      .limit(1)

    if (inningsLookupError) {
      toast.error(inningsLookupError.message)
      setStartingMatchId(null)
      return
    }

    if (!existingInnings?.length) {
      const { error: inningsError } = await supabase.from('innings').insert({
        match_id: match.id,
        innings_number: 1,
        batting_team: match.team_a,
        bowling_team: match.team_b,
        score: 0,
        wickets: 0,
        balls_bowled: 0,
        overs: 0,
        is_complete: false,
      })

      if (inningsError) {
        toast.error(inningsError.message)
        setStartingMatchId(null)
        return
      }
    }

    const { error: matchError } = await supabase
      .from('matches')
      .update({ status: 'live' })
      .eq('id', match.id)

    if (matchError) {
      toast.error(matchError.message)
      setStartingMatchId(null)
      return
    }

    toast.success('Match started')
    setStartingMatchId(null)
    await refetch()
    router.push(`/score/${match.id}`)
  }

  async function deleteMatch(match: AdminMatch) {
    setDeletingMatchId(match.id)

    const { data: inningsRows, error: inningsLookupError } = await supabase
      .from('innings')
      .select('id')
      .eq('match_id', match.id)

    if (inningsLookupError) {
      toast.error(inningsLookupError.message)
      setDeletingMatchId(null)
      return
    }

    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('id', match.id)

    if (deleteError) {
      toast.error(deleteError.message)
      setDeletingMatchId(null)
      return
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`gullyscore:match-squads:${match.id}`)
      window.localStorage.removeItem(`gullyscore:score-selection:${match.id}`)

      for (const inningsRow of inningsRows || []) {
        window.localStorage.removeItem(`gullyscore:innings-dismissals:${inningsRow.id}`)
      }
    }

    toast.success('Match deleted')
    setMatchToDelete(null)
    setDeletingMatchId(null)
    await refetch()
  }

  const statusColor: Record<string, string> = {
    live: 'text-red-400 bg-red-400/10',
    completed: 'text-green-400 bg-green-400/10',
    upcoming: 'text-amber-400 bg-amber-400/10',
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-3xl mx-auto px-4 pb-24 pt-24">
        <div className="mt-4 mb-10 flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <button className="glass-card rounded-2xl p-3 text-muted-foreground transition-all hover:text-foreground">
                <ArrowLeft size={20} />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-black gradient-text md:text-4xl">Match Control</h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-50">Manage game state</p>
            </div>
          </div>
          <Link href="/admin/matches/new">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              <Plus size={16} /> New Match
            </motion.button>
          </Link>
        </div>

        <div className="space-y-3">
          {error ? (
            <div className="glass rounded-2xl border border-red-500/20 p-8 text-center">
              <p className="text-sm font-semibold text-red-400">Failed to load matches</p>
              <p className="mt-2 text-xs text-muted-foreground">Check your Supabase access and try again.</p>
            </div>
          ) : matches && matches.length > 0 ? matches.map(match => (
            <div key={match.id} className="glass-card rounded-2xl border-white/5 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusColor[match.status]}`}>
                  {match.status === 'live' && <span className="live-glow mr-2 inline-block h-1.5 w-1.5 rounded-full" />}
                  {match.status}
                </span>
                <span className="text-xs text-muted-foreground">{match.overs} overs</span>
              </div>
              <p className="text-sm font-bold">{match.team_a_data?.name} vs {match.team_b_data?.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(match.created_at).toLocaleDateString()}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Link href={`/match/${match.id}`}>
                  <button className="glass w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold">View</button>
                </Link>

                {match.status === 'live' ? (
                  <Link href={`/score/${match.id}`}>
                    <button className="w-full rounded-lg py-1.5 text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
                      Score
                    </button>
                  </Link>
                ) : match.status === 'upcoming' ? (
                  <button
                    onClick={() => startMatch(match)}
                    disabled={startingMatchId === match.id}
                    className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #00d4aa, #009980)' }}
                  >
                    <PlayCircle size={14} />
                    {startingMatchId === match.id ? 'Starting...' : 'Start Match'}
                  </button>
                ) : (
                  <button className="w-full rounded-lg border border-white/10 py-1.5 text-xs font-semibold text-muted-foreground" disabled>
                    Finished
                  </button>
                )}

                <button
                  onClick={() => setMatchToDelete(match)}
                  disabled={deletingMatchId === match.id}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          )) : (
            <div className="glass rounded-2xl p-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No matches yet</p>
            </div>
          )}
        </div>

        <AlertDialog
          open={Boolean(matchToDelete)}
          onOpenChange={open => {
            if (!open && !deletingMatchId) setMatchToDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Match</AlertDialogTitle>
              <AlertDialogDescription>
                {matchToDelete
                  ? `Are you sure you want to delete ${matchToDelete.team_a_data?.name || 'Team A'} vs ${matchToDelete.team_b_data?.name || 'Team B'}? This action cannot be undone.`
                  : 'Are you sure you want to delete this item? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingMatchId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(deletingMatchId)}
                onClick={() => {
                  if (!matchToDelete || deletingMatchId) return
                  void deleteMatch(matchToDelete)
                }}
              >
                {deletingMatchId ? 'Deleting...' : 'Delete Match'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  )
}
