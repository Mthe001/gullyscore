'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { Mail, Lock, User, Eye, EyeOff, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { toAbsoluteUrl } from '@/lib/site-url'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithOAuth } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Welcome back!')
        const target = toAbsoluteUrl('/')
        if (typeof window !== 'undefined' && window.location.origin !== new URL(target).origin) {
          window.location.replace(target)
        } else {
          router.push('/')
        }
      }
    } else {
      if (!name.trim()) {
        toast.error('Please enter your name')
        setLoading(false)
        return
      }
      const { error } = await signUp(email, password, name)
      if (error) {
        toast.error(error)
      } else {
        toast.success('Account created! Please check your email.')
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
            <Zap size={32} className="text-white fill-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter gradient-text">
            GullyScore Pro
          </h1>
          <p className="text-xs uppercase tracking-[0.4rem] font-bold mt-4 opacity-40">
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8 border-white/5 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex rounded-2xl bg-white/5 p-1.5 mb-8">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${mode === 'signin' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-muted-foreground'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${mode === 'signup' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-muted-foreground'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white disabled:opacity-60 transition-all shadow-lg shadow-primary/20 brightness-110 mt-2"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            >
              {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In Now' : 'Create Account'}
            </motion.button>
          </form>

          {/* Social Logins */}
          <div className="mt-8">
            <div className="relative flex items-center justify-center mb-6">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink mx-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                Or continue with
              </span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  const { error } = await signInWithOAuth('google')
                  if (error) toast.error(error)
                }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-tight">Google</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { error } = await signInWithOAuth('facebook')
                  if (error) toast.error(error)
                }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
              >
                <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-tight">Facebook</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          By continuing, you agree to our Terms of Service
        </p>
      </motion.div>
    </main>
  )
}
