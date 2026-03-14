'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewPlayerPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [teams, setTeams] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', team_id: '', avatar_url: '' })

  useEffect(() => {
    if (!isAdmin) { router.push('/'); return }
    supabase.from('teams').select('*').order('name').then(({ data }) => setTeams(data || []))
  }, [isAdmin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('players').insert({
      name: form.name,
      team_id: form.team_id || null,
      avatar_url: form.avatar_url || null,
      matches_played: 0, total_runs: 0, highest_score: 0,
      strike_rate: 0, total_wickets: 0, best_bowling: '0/0', economy_rate: 0,
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Player created!')
    router.push('/admin')
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-lg mx-auto">
        <div className="mt-4 mb-5 flex items-center gap-3">
          <Link href="/admin"><button className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><ArrowLeft size={18} /></button></Link>
          <h1 className="text-xl font-black">Add New Player</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="glass rounded-2xl p-4 space-y-4 border border-white/5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Player Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="Player name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Team</label>
              <select
                value={form.team_id}
                onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="">No team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Avatar URL (optional)</label>
              <input
                value={form.avatar_url}
                onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
            {loading ? 'Creating...' : 'Add Player'}
          </button>
        </form>
      </main>
    </>
  )
}
