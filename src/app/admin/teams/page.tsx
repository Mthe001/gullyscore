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
import { Plus, Users, ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

async function fetchAllTeams() {
  const { data } = await supabase
    .from('teams')
    .select('*, players:players(id)')
    .order('name')
  return data || []
}

export default function AdminTeamsPage() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null)
  const [teamToDelete, setTeamToDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { if (!isAdmin) router.push('/') }, [isAdmin, router])

  const { data: teams, refetch } = useQuery({ queryKey: ['admin-teams'], queryFn: fetchAllTeams })

  async function deleteTeam(teamId: string, teamName: string) {
    setDeletingTeamId(teamId)

    try {
      const { count, error: usageError } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .or(`team_a.eq.${teamId},team_b.eq.${teamId}`)

      if (usageError) {
        throw usageError
      }

      if ((count || 0) > 0) {
        toast.error(`${teamName} is used in existing matches. Delete those matches first.`)
        return
      }

      const { error: detachPlayersError } = await supabase
        .from('players')
        .update({ team_id: null })
        .eq('team_id', teamId)

      if (detachPlayersError) {
        throw detachPlayersError
      }

      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)

      if (deleteError) {
        throw deleteError
      }

      toast.success('Team deleted')
      setTeamToDelete(null)
      await refetch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete team'
      toast.error(message)
    } finally {
      setDeletingTeamId(null)
    }
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><button className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><ArrowLeft size={18} /></button></Link>
            <h1 className="text-xl font-black">All Teams</h1>
          </div>
          <Link href="/admin/teams/new">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
              <Plus size={14} /> New
            </button>
          </Link>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {teams && teams.length > 0 ? teams.map(team => (
            <div key={team.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center font-bold text-purple-400">
                {team.name?.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{team.name}</p>
                <p className="text-xs text-muted-foreground">{team.players?.length || 0} players</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setTeamToDelete({ id: team.id, name: team.name || 'Team' })}
                  disabled={deletingTeamId === team.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          )) : (
            <div className="p-12 text-center">
              <Users size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No teams</p>
            </div>
          )}
        </div>

        <AlertDialog
          open={Boolean(teamToDelete)}
          onOpenChange={open => {
            if (!open && !deletingTeamId) setTeamToDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Team</AlertDialogTitle>
              <AlertDialogDescription>
                {teamToDelete
                  ? `Are you sure you want to delete ${teamToDelete.name}? This action cannot be undone.`
                  : 'Are you sure you want to delete this item? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingTeamId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(deletingTeamId)}
                onClick={() => {
                  if (!teamToDelete || deletingTeamId) return
                  void deleteTeam(teamToDelete.id, teamToDelete.name)
                }}
              >
                {deletingTeamId ? 'Deleting...' : 'Delete Team'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  )
}
