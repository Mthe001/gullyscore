'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
import { toast } from 'sonner'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

type AdminUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'moderator' | 'client'
}

async function loadUsers(): Promise<AdminUser[]> {
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
  return data || []
}

export default function UsersAdminPage() {
  const { isAdmin, user } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!isAdmin) { router.push('/'); return }
    loadUsers().then(setUsers)
  }, [isAdmin, router])

  async function changeRole(userId: string, newRole: AdminUser['role']) {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) { toast.error(error.message); return }
    toast.success(`Role updated to ${newRole}`)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  async function deleteUser(targetUserId: string, targetUserName: string) {
    if (targetUserId === user?.id) {
      toast.error('You cannot delete your own admin account')
      return
    }

    setDeletingUserId(targetUserId)

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUserId)

    if (error) {
      toast.error(error.message)
      setDeletingUserId(null)
      return
    }

    setUsers(prev => prev.filter(u => u.id !== targetUserId))
    toast.success(`${targetUserName} deleted`)
    setUserToDelete(null)
    setDeletingUserId(null)
  }

  const roleColors: Record<string, string> = {
    admin: 'text-amber-400 bg-amber-400/10',
    moderator: 'text-blue-400 bg-blue-400/10',
    client: 'text-slate-400 bg-slate-400/10',
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5 flex items-center gap-3">
          <Link href="/admin"><button className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><ArrowLeft size={18} /></button></Link>
          <div>
            <h1 className="text-xl font-black">User Management</h1>
            <p className="text-xs text-muted-foreground">{users.length} users</p>
          </div>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400">
                  {u.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <select
                value={u.role}
                onChange={e => changeRole(u.id, e.target.value as AdminUser['role'])}
                className={`text-xs font-bold px-2 py-1 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer ${roleColors[u.role] || ''}`}
              >
                <option value="client">Client</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              {isAdmin && (
                <button
                  onClick={() => setUserToDelete({ id: u.id, name: u.name || 'User' })}
                  disabled={deletingUserId === u.id}
                  className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>

        <AlertDialog
          open={Boolean(userToDelete)}
          onOpenChange={open => {
            if (!open && !deletingUserId) setUserToDelete(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                {userToDelete
                  ? `Are you sure you want to delete ${userToDelete.name}? This action cannot be undone.`
                  : 'Are you sure you want to delete this item? This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingUserId)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(deletingUserId)}
                onClick={() => {
                  if (!userToDelete || deletingUserId) return
                  void deleteUser(userToDelete.id, userToDelete.name)
                }}
              >
                {deletingUserId ? 'Deleting...' : 'Delete User'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  )
}
