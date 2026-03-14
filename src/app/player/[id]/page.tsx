'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Navbar } from '@/components/Navbar'
import { motion } from 'framer-motion'
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

async function fetchPlayer(id: string) {
  const { data } = await supabase
    .from('players')
    .select('*, team:teams(id, name, logo_url)')
    .eq('id', id)
    .single()
  return data
}

async function fetchPlayerMatchHistory(id: string) {
  const { data } = await supabase
    .from('player_match_stats')
    .select('*, match:matches(id, created_at, team_a_data:teams!matches_team_a_fkey(name), team_b_data:teams!matches_team_b_fkey(name))')
    .eq('player_id', id)
    .order('match_id', { ascending: false })
    .limit(10)
  return data || []
}

export default function PlayerProfilePage() {
  const { id } = useParams()
  const { data: player } = useQuery({ queryKey: ['player', id], queryFn: () => fetchPlayer(id as string) })
  const { data: history } = useQuery({ queryKey: ['player-history', id], queryFn: () => fetchPlayerMatchHistory(id as string) })

  if (!player) return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading player...</p>
      </main>
    </>
  )

  const radarData = [
    { stat: 'Batting', value: Math.min(100, (player.total_runs / 500) * 100) },
    { stat: 'Strike Rate', value: Math.min(100, player.strike_rate) },
    { stat: 'Bowling', value: Math.min(100, player.total_wickets * 10) },
    { stat: 'Economy', value: player.economy_rate > 0 ? Math.max(0, 100 - player.economy_rate * 8) : 0 },
    { stat: 'Experience', value: Math.min(100, player.matches_played * 5) },
  ]

  const runHistory = (history || []).map((h: any) => ({
    match: `M${h.match_id?.slice(-3)}`,
    runs: h.runs || 0,
    wickets: h.wickets || 0,
  }))

  return (
    <>
      <Navbar />
      <main className="pt-14 pb-24 min-h-screen">
        {/* Profile header */}
        <div className="gradient-hero px-4 pt-6 pb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #6c63ff 0%, transparent 70%)' }} />
          
          <Link href="/leaderboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-4">
            <ArrowLeft size={14} /> Back
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-teal-500/30 border border-purple-500/30 flex items-center justify-center text-4xl font-black text-purple-400">
              {player.avatar_url ? (
                <img src={player.avatar_url} alt={player.name} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                player.name?.charAt(0)
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black">{player.name}</h1>
              <p className="text-muted-foreground text-sm">{player.team?.name || 'No team'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                  {player.matches_played} matches
                </span>
              </div>
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            <StatCard label="Runs" value={player.total_runs} color="text-amber-400" />
            <StatCard label="HS" value={player.highest_score} color="text-purple-400" />
            <StatCard label="SR" value={player.strike_rate?.toFixed(0)} color="text-teal-400" />
            <StatCard label="Wkts" value={player.total_wickets} color="text-red-400" />
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
          {/* Radar chart */}
          <div className="glass rounded-2xl p-4">
            <h3 className="font-bold text-sm mb-3">Performance Radar</h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: '#6060a0', fontSize: 11 }} />
                <Radar name="Player" dataKey="value" stroke="#6c63ff" fill="#6c63ff" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Run history */}
          {runHistory.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <h3 className="font-bold text-sm mb-3">Recent Match Performance</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={runHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="match" tick={{ fill: '#6060a0', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="runs" fill="#6c63ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* All round stats */}
          <div className="glass rounded-2xl p-4">
            <h3 className="font-bold text-sm mb-3">Detailed Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Best Bowling</p>
                <p className="font-bold text-lg">{player.best_bowling || 'N/A'}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Economy Rate</p>
                <p className="font-bold text-lg text-teal-400">{player.economy_rate?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>

          {/* Match history */}
          {history && history.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-bold text-sm">Match History</h3>
              </div>
              <div className="divide-y divide-white/5">
                {history.map((h: any) => (
                  <Link key={h.id} href={`/match/${h.match_id}`}>
                    <div className="flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors cursor-pointer">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {h.match?.team_a_data?.name} vs {h.match?.team_b_data?.name}
                        </p>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="font-bold text-amber-400">{h.runs}r</span>
                        <span className="font-bold text-red-400">{h.wickets}w</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function StatCard({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="glass rounded-xl p-2.5 text-center border border-white/5">
      <p className={`font-black text-lg ${color}`}>{value ?? '–'}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
