'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'

async function fetchTeams() {
  const { data } = await supabase
    .from('teams')
    .select('*, players:players(id, name, total_runs, total_wickets)')
    .order('name')
  return data || []
}

export default function TeamsPage() {
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5">
          <h1 className="text-2xl font-black">Teams</h1>
          <p className="text-sm text-muted-foreground">All registered teams</p>
        </div>

        <div className="space-y-3">
          {teams && teams.length > 0 ? teams.map(team => (
            <motion.div
              key={team.id}
              whileHover={{ scale: 1.01 }}
              className="glass rounded-2xl p-4 border border-white/5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-teal-500/20 border border-purple-500/20 flex items-center justify-center text-xl font-black text-purple-400">
                  {team.logo_url ? <img src={team.logo_url} alt={team.name} className="w-full h-full rounded-xl object-cover" /> : team.name?.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold">{team.name}</h2>
                  <p className="text-xs text-muted-foreground">{team.players?.length || 0} players</p>
                </div>
              </div>

              {team.players && team.players.length > 0 && (
                <div className="space-y-1.5">
                  {team.players.slice(0, 5).map((player: any) => (
                    <Link key={player.id} href={`/player/${player.id}`}>
                      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                        <span className="text-sm">{player.name}</span>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{player.total_runs}r</span>
                          <span>{player.total_wickets}w</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {team.players.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{team.players.length - 5} more players
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )) : (
            <div className="glass rounded-2xl p-12 text-center">
              <Users size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No teams yet</p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
