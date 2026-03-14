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
import { Plus, UserCheck, ArrowLeft, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { PostgrestError } from '@supabase/supabase-js'

async function fetchAllPlayers() {
  const { data } = await supabase
    .from('players')
    .select('*, team:teams(name)')
    .order('name')
  return data || []
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return 'Failed to delete player'
}

async function unlinkBallsReference(column: 'batsman_id' | 'bowler_id' | 'fielder_id', playerId: string) {
  const { error } = await supabase
    .from('balls')
    .update({ [column]: null })
    .eq(column, playerId)

  if (!error) return

  // Support both schema variants where fielder_id may not exist.
  if (error.code === '42703') return

  throw error
}

export default function AdminPlayersPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null)
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { if (!isAdmin) router.push('/') }, [isAdmin, router])

  const { data: players, refetch } = useQuery({ queryKey: ['admin-players'], queryFn: fetchAllPlayers })

  async function deletePlayer(playerId: string, playerName: string) {
    setDeletingPlayerId(playerId)

    try {
      let { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId)

      if (error?.code === '23503') {
        await Promise.all([
          unlinkBallsReference('batsman_id', playerId),
          unlinkBallsReference('bowler_id', playerId),
          unlinkBallsReference('fielder_id', playerId),
        ])

        const retryDelete = await supabase
          .from('players')
          .delete()
          .eq('id', playerId)
        error = retryDelete.error
      }

      if (error) throw error

      toast.success(`${playerName} deleted permanently`)
      setPlayerToDelete(null)
      await refetch()
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[admin-players] Failed to delete player', error as PostgrestError)
      toast.error(message)
    } finally {
      setDeletingPlayerId(null)
    }
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><button className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><ArrowLeft size={18} /></button></Link>
            <h1 className="text-xl font-black">All Players</h1>
          </div>
          <Link href="/admin/players/new">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
              <Plus size={14} /> New
            </button>
          </Link>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {players && players.length > 0 ? players.map(player => (
            <div key={player.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-purple-400 text-sm">
                {player.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{player.name}</p>
                <p className="text-xs text-muted-foreground">{player.team?.name || 'No team'}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold text-amber-400">{player.total_runs}r</p>
                <p className="text-muted-foreground">{player.total_wickets}w</p>
              </div>
              <Link href={`/player/${player.id}`}>
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10">
                  <ExternalLink size={13} />
                  View
                </button>
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setPlayerToDelete({ id: player.id, name: player.name || 'Player' })}
                  disabled={deletingPlayerId === player.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          )) : (
            <div className="p-12 text-center">
              <UserCheck size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No players</p>
            </div>
          )}
        </div>

        <AlertDialog
          open={Boolean(playerToDelete)}
          onOpenChange={open => {
            if (!open && !deletingPlayerId) setPlayerToDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Player</AlertDialogTitle>
              <AlertDialogDescription>
                {playerToDelete
                  ? `Are you sure you want to delete ${playerToDelete.name}? This action cannot be undone.`
                  : 'Are you sure you want to delete this item? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingPlayerId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(deletingPlayerId)}
                onClick={() => {
                  if (!playerToDelete || deletingPlayerId) return
                  void deletePlayer(playerToDelete.id, playerToDelete.name)
                }}
              >
                {deletingPlayerId ? 'Deleting...' : 'Delete Player'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  )
}
