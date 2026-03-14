'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    let isActive = true
    let fallbackTimeout: ReturnType<typeof setTimeout> | undefined

    const finish = (path: '/' | '/auth') => {
      if (isActive) {
        router.replace(path)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        finish('/')
      }
    })

    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        finish('/auth')
        return
      }

      if (data.session) {
        finish('/')
      } else {
        fallbackTimeout = setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession()
          finish(retryData.session ? '/' : '/auth')
        }, 1200)
      }
    }

    handleCallback()

    return () => {
      isActive = false
      if (fallbackTimeout) clearTimeout(fallbackTimeout)
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
    </div>
  )
}
