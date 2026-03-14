'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Trophy, Users, BarChart2, Plus, Settings,
  Activity, Shield, UserCheck
} from 'lucide-react'

async function fetchAdminStats() {
  const [matchesRes, teamsRes, playersRes, usersRes] = await Promise.all([
    supabase.from('matches').select('id, status'),
    supabase.from('teams').select('id'),
    supabase.from('players').select('id'),
    supabase.from('users').select('id, role'),
  ])

  return {
    totalMatches: matchesRes.data?.length || 0,
    liveMatches: matchesRes.data?.filter(m => m.status === 'live').length || 0,
    totalTeams: teamsRes.data?.length || 0,
    totalPlayers: playersRes.data?.length || 0,
    totalUsers: usersRes.data?.length || 0,
    admins: usersRes.data?.filter(u => u.role === 'admin').length || 0,
  }
}

export default function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/')
  }, [loading, isAdmin])

  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchAdminStats })

  if (!isAdmin) return null

  const quickLinks = [
    { href: '/admin/matches/new', icon: Trophy, label: 'New Match', color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400' },
    { href: '/admin/teams/new', icon: Users, label: 'New Team', color: 'from-teal-500/20 to-teal-600/20 border-teal-500/30 text-teal-400' },
    { href: '/admin/players/new', icon: UserCheck, label: 'New Player', color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 text-amber-400' },
    { href: '/admin/tournaments/new', icon: Trophy, label: 'New Tournament', color: 'from-pink-500/20 to-pink-600/20 border-pink-500/30 text-pink-400' },
    { href: '/admin/users', icon: Shield, label: 'Manage Users', color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400' },
  ]

  return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen px-4 max-w-2xl mx-auto">
        <div className="mt-4 mb-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-400">
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-black">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Welcome, {user?.name}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="glass rounded-xl p-3 text-center border border-white/5">
            <p className="text-xl font-black text-purple-400">{stats?.totalMatches}</p>
            <p className="text-[10px] text-muted-foreground">Matches</p>
          </div>
          <div className="glass rounded-xl p-3 text-center border border-white/5">
            <div className="flex items-center justify-center gap-1">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <p className="text-xl font-black text-red-400">{stats?.liveMatches}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Live</p>
          </div>
          <div className="glass rounded-xl p-3 text-center border border-white/5">
            <p className="text-xl font-black text-teal-400">{stats?.totalTeams}</p>
            <p className="text-[10px] text-muted-foreground">Teams</p>
          </div>
          <div className="glass rounded-xl p-3 text-center border border-white/5">
            <p className="text-xl font-black text-amber-400">{stats?.totalPlayers}</p>
            <p className="text-[10px] text-muted-foreground">Players</p>
          </div>
          <div className="glass rounded-xl p-3 text-center border border-white/5">
            <p className="text-xl font-black text-blue-400">{stats?.totalUsers}</p>
            <p className="text-[10px] text-muted-foreground">Users</p>
          </div>
          <div className="glass rounded-xl p-3 text-center border border-white/5">
            <p className="text-xl font-black text-pink-400">{stats?.admins}</p>
            <p className="text-[10px] text-muted-foreground">Admins</p>
          </div>
        </div>

        {/* Quick actions */}
        <h2 className="font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {quickLinks.map(item => (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`glass rounded-xl p-4 border flex items-center gap-3 cursor-pointer bg-gradient-to-br ${item.color}`}
              >
                <item.icon size={20} />
                <span className="font-semibold text-sm">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Navigation */}
        <h2 className="font-bold text-sm mb-3 text-muted-foreground uppercase tracking-wider">Manage</h2>
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          {[
            { href: '/admin/matches', label: 'All Matches', icon: Activity },
            { href: '/admin/teams', label: 'All Teams', icon: Users },
            { href: '/admin/players', label: 'All Players', icon: UserCheck },
            { href: '/admin/tournaments', label: 'Tournaments', icon: Trophy },
            { href: '/admin/users', label: 'User Management', icon: Shield },
            { href: '/leaderboard', label: 'Leaderboard', icon: BarChart2 },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer">
                <item.icon size={18} className="text-muted-foreground" />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-auto text-muted-foreground text-xs">â†’</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  )
}
