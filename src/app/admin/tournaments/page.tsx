'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
import Link from 'next/link'
import { Plus, Trophy, ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

async function fetchAllTournaments() {
  const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
  return data || []
}

export default function AdminTournamentsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [deletingTournamentId, setDeletingTournamentId] = useState<string | null>(null)
  const [tournamentToDelete, setTournamentToDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { if (!isAdmin) router.push('/') }, [isAdmin, router])

  const { data: tournaments, refetch } = useQuery({ queryKey: ['admin-tournaments'], queryFn: fetchAllTournaments })

  async function deleteTournament(tournamentId: string) {
    setDeletingTournamentId(tournamentId)

    try {
      const { error: detachMatchesError } = await supabase
        .from('matches')
        .update({ tournament_id: null })
        .eq('tournament_id', tournamentId)

      if (detachMatchesError) throw detachMatchesError

      const { error: deleteError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId)

      if (deleteError) throw deleteError

      toast.success('Tournament deleted')
      setTournamentToDelete(null)
      await refetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete tournament'
      toast.error(message)
    } finally {
      setDeletingTournamentId(null)
    }
  }

  const statusColors: Record<string, string> = {
    upcoming: 'text-amber-400',
    active: 'text-green-400',
    completed: 'text-slate-400',
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><button className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><ArrowLeft size={18} /></button></Link>
            <h1 className="text-xl font-black">Tournaments</h1>
          </div>
          <Link href="/admin/tournaments/new">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
              <Plus size={14} /> New
            </button>
          </Link>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {tournaments && tournaments.length > 0 ? tournaments.map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 last:border-0">
              <div>
                <p className="font-semibold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{t.format}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold capitalize ${statusColors[t.status]}`}>{t.status}</span>
                {isAdmin && (
                  <button
                    onClick={() => setTournamentToDelete({ id: t.id, name: t.name || 'Tournament' })}
                    disabled={deletingTournamentId === t.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center">
              <Trophy size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No tournaments</p>
            </div>
          )}
        </div>

        <AlertDialog
          open={Boolean(tournamentToDelete)}
          onOpenChange={open => {
            if (!open && !deletingTournamentId) setTournamentToDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
              <AlertDialogDescription>
                {tournamentToDelete
                  ? `Are you sure you want to delete ${tournamentToDelete.name}? This action cannot be undone.`
                  : 'Are you sure you want to delete this item? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingTournamentId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(deletingTournamentId)}
                onClick={() => {
                  if (!tournamentToDelete || deletingTournamentId) return
                  void deleteTournament(tournamentToDelete.id)
                }}
              >
                {deletingTournamentId ? 'Deleting...' : 'Delete Tournament'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  )
}
