'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewTournamentPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', format: 'league', start_date: '' })

  useEffect(() => {
    if (!isAdmin) router.push('/')
  }, [isAdmin])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('tournaments').insert({
      name: form.name,
      format: form.format,
      start_date: form.start_date || null,
      status: 'upcoming',
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Tournament created!')
    router.push('/tournaments')
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-lg mx-auto">
        <div className="mt-4 mb-5 flex items-center gap-3">
          <Link href="/admin"><button className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"><ArrowLeft size={18} /></button></Link>
          <h1 className="text-xl font-black">Create Tournament</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="glass rounded-2xl p-4 space-y-4 border border-white/5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tournament Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="e.g. Gully Premier League"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Format</label>
              <select
                value={form.format}
                onChange={e => setForm(f => ({ ...f, format: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="league">League (Round Robin)</option>
                <option value="knockout">Knockout</option>
                <option value="mixed">Mixed (League + Knockout)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}>
            {loading ? 'Creating...' : 'Create Tournament'}
          </button>
        </form>
      </main>
    </>
  )
}
