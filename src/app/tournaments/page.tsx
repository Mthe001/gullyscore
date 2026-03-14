'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

async function fetchTournaments() {
  const { data } = await supabase
    .from('tournaments')
    .select('*, matches:matches(id, status)')
    .order('created_at', { ascending: false })
  return data || []
}

const statusConfig: Record<string, { label: string; class: string }> = {
  upcoming: { label: 'Upcoming', class: 'bg-amber-400/10 text-amber-400 border-amber-400/30' },
  active: { label: 'Active', class: 'bg-green-400/10 text-green-400 border-green-400/30' },
  completed: { label: 'Completed', class: 'bg-slate-400/10 text-slate-400 border-slate-400/30' },
}

export default function TournamentsPage() {
  const { data: tournaments } = useQuery({ queryKey: ['tournaments'], queryFn: fetchTournaments })

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5">
          <h1 className="text-2xl font-black">Tournaments</h1>
          <p className="text-sm text-muted-foreground">All cricket tournaments</p>
        </div>

        <div className="space-y-3">
          {tournaments && tournaments.length > 0 ? tournaments.map(t => {
            const cfg = statusConfig[t.status] || statusConfig.upcoming
            const liveMatches = (t.matches || []).filter((m: any) => m.status === 'live').length
            const totalMatches = (t.matches || []).length

            return (
              <motion.div key={t.id} whileHover={{ scale: 1.01 }} className="glass rounded-2xl p-4 border border-white/5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h2 className="font-bold">{t.name}</h2>
                    <p className="text-xs text-muted-foreground capitalize">{t.format} format</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cfg.class}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy size={12} />
                    {totalMatches} matches
                  </span>
                  {liveMatches > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <span className="live-dot" style={{ width: 6, height: 6 }} />
                      {liveMatches} live
                    </span>
                  )}
                </div>
              </motion.div>
            )
          }) : (
            <div className="glass rounded-2xl p-12 text-center">
              <Trophy size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No tournaments yet</p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
