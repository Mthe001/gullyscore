'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const APP_NAME = 'GullyScore Pro'

function getTitle(pathname: string): string {
  if (pathname === '/') return `Home | ${APP_NAME}`
  if (pathname === '/matches') return `Matches | ${APP_NAME}`
  if (pathname === '/leaderboard') return `Leaderboard | ${APP_NAME}`
  if (pathname === '/teams') return `Teams | ${APP_NAME}`
  if (pathname === '/tournaments') return `Tournaments | ${APP_NAME}`
  if (pathname === '/profile') return `My Profile | ${APP_NAME}`
  if (pathname === '/auth') return `Sign In | ${APP_NAME}`
  if (pathname === '/auth/callback') return `Signing In | ${APP_NAME}`
  if (pathname === '/admin') return `Admin Dashboard | ${APP_NAME}`
  if (pathname === '/admin/matches') return `Admin Matches | ${APP_NAME}`
  if (pathname === '/admin/matches/new') return `Add Match | ${APP_NAME}`
  if (pathname === '/admin/players') return `Admin Players | ${APP_NAME}`
  if (pathname === '/admin/players/new') return `Add Player | ${APP_NAME}`
  if (pathname === '/admin/teams') return `Admin Teams | ${APP_NAME}`
  if (pathname === '/admin/teams/new') return `Add Team | ${APP_NAME}`
  if (pathname === '/admin/tournaments') return `Admin Tournaments | ${APP_NAME}`
  if (pathname === '/admin/tournaments/new') return `Add Tournament | ${APP_NAME}`
  if (pathname === '/admin/users') return `Admin Users | ${APP_NAME}`
  if (/^\/match\/[^/]+$/.test(pathname)) return `Match Details | ${APP_NAME}`
  if (/^\/score\/[^/]+$/.test(pathname)) return `Live Scoring | ${APP_NAME}`
  if (/^\/player\/[^/]+$/.test(pathname)) return `Player Profile | ${APP_NAME}`

  const section = pathname
    .split('/')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')

  return section ? `${section} | ${APP_NAME}` : APP_NAME
}

export function DynamicTitle() {
  const pathname = usePathname()

  useEffect(() => {
    document.title = getTitle(pathname || '/')
  }, [pathname])

  return null
}
