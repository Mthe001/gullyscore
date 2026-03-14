'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  BarChart2,
  Home,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/leaderboard', label: 'Leaderboard', icon: BarChart2 },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, isAdmin } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRootRef = useRef<HTMLElement | null>(null)
  const navShellRef = useRef<HTMLDivElement | null>(null)
  const brandRef = useRef<HTMLDivElement | null>(null)
  const desktopPillRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    if (!navRootRef.current || !navShellRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        navShellRef.current,
        { y: -18, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }
      )

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: '+=220',
          scrub: true,
        },
      })

      timeline.to(
        navShellRef.current,
        {
          y: 7,
          backgroundColor: 'rgba(2, 6, 23, 0.9)',
          borderColor: 'rgba(56, 189, 248, 0.35)',
          boxShadow: '0 26px 90px -48px rgba(56, 189, 248, 0.85)',
          borderRadius: 28,
          ease: 'none',
          duration: 1,
        },
        0
      )

      if (brandRef.current) {
        timeline.to(
          brandRef.current,
          {
            scale: 1.05,
            ease: 'none',
            duration: 1,
          },
          0
        )
      }

      if (desktopPillRef.current) {
        timeline.to(
          desktopPillRef.current,
          {
            paddingLeft: 20,
            paddingRight: 20,
            ease: 'none',
            duration: 1,
          },
          0
        )
      }
    }, navRootRef)

    return () => ctx.revert()
  }, [])

  async function handleSignOut() {
    await signOut()
    setMobileOpen(false)
    router.replace('/')
    router.refresh()
  }

  return (
    <>
      <nav ref={navRootRef} className="fixed inset-x-0 top-0 z-50 pointer-events-none">
        <div className="mx-auto max-w-7xl px-3 pt-2 sm:px-4 sm:pt-3">
          <div
            ref={navShellRef}
            className="pointer-events-auto rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(8,12,25,0.88),rgba(3,8,20,0.82))] shadow-[0_20px_70px_-45px_rgba(15,23,42,0.95)] backdrop-blur-xl"
          >
            <div className="flex min-h-16 items-center gap-3 px-3 sm:px-4">
              <Link href="/" className="min-w-[144px] sm:min-w-[188px]">
                <div ref={brandRef} className="flex items-center gap-2.5">
                  <Image
                    src="/gullyscore-logo.png"
                    alt="GullyScore logo"
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-xl object-cover shadow-[0_14px_40px_-20px_rgba(34,211,238,0.95)]"
                    priority
                  />
                  <div className="hidden sm:block">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-cyan-300">GullyScore</p>
                    <p className="text-base font-bold text-white">Pro Dashboard</p>
                  </div>
                </div>
              </Link>

              <div className="hidden flex-1 justify-center lg:flex">
                <div
                  ref={desktopPillRef}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
                >
                  {navItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all ${
                        pathname === item.href
                          ? 'bg-[linear-gradient(135deg,rgba(8,145,178,0.33),rgba(79,70,229,0.35))] text-cyan-100 shadow-[0_12px_35px_-24px_rgba(34,211,238,0.95)]'
                          : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <item.icon size={14} />
                      {item.label}
                    </Link>
                  ))}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15"
                    >
                      <Shield size={14} />
                      Admin
                    </Link>
                  )}
                </div>
              </div>

              <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                

                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <div className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1 transition hover:border-cyan-300/25">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-cyan-400/15 text-cyan-300">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden text-xs font-semibold text-slate-100 sm:block">{user.name}</span>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
                        <User size={14} className="mr-2" /> Profile
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => router.push('/admin')} className="cursor-pointer text-amber-400">
                          <Shield size={14} className="mr-2" /> Admin Panel
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-400">
                        <LogOut size={14} className="mr-2" /> Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link href="/auth">
                    <Button
                      size="sm"
                      className="min-h-10 rounded-xl border border-cyan-300/25 bg-[linear-gradient(135deg,#0ea5e9,#4f46e5)] px-4 text-xs font-bold text-white hover:brightness-110"
                    >
                      Sign In
                    </Button>
                  </Link>
                )}

                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 lg:hidden"
                  onClick={() => setMobileOpen(open => !open)}
                  aria-label="Toggle mobile menu"
                >
                  {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>

            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-white/10 px-3 pb-3 pt-2 lg:hidden"
              >
                {navItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      pathname === item.href
                        ? 'bg-[linear-gradient(135deg,rgba(8,145,178,0.23),rgba(79,70,229,0.25))] text-cyan-100'
                        : 'text-slate-300 hover:bg-white/6 hover:text-white'
                    }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-amber-400/10"
                  >
                    <Shield size={16} />
                    Admin
                  </Link>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </nav>

      <div className="fixed inset-x-0 bottom-0 z-50 px-2 pb-safe-area-inset-bottom lg:hidden">
        <div className="mx-auto max-w-md rounded-t-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,24,0.92),rgba(4,8,20,0.95))] px-1 py-2 backdrop-blur-xl">
          <div className="flex items-center justify-around">
            {navItems.slice(0, 5).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 min-w-[62px] flex-col items-center justify-center gap-0.5 rounded-xl transition ${
                  pathname === item.href
                    ? 'bg-[linear-gradient(135deg,rgba(8,145,178,0.22),rgba(79,70,229,0.25))] text-cyan-200'
                    : 'text-slate-400'
                }`}
              >
                <item.icon size={18} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
