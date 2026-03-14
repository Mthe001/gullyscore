'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Camera, LoaderCircle, User } from 'lucide-react'

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE = 2 * 1024 * 1024

export default function ProfilePage() {
  const { user, loading, updateUserProfile } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [name, setName] = useState<string | null>(null)

  const displayName = useMemo(() => name ?? user?.name ?? '', [name, user?.name])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
  }, [loading, router, user])

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !user) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Image size must be 2MB or less')
      return
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${user.id}/${Date.now()}.${fileExt}`

    setUploadingAvatar(true)

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      toast.error(uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(filePath)

    const avatarUrl = publicUrlData.publicUrl
    const { error: profileError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (profileError) {
      toast.error(profileError.message)
      setUploadingAvatar(false)
      return
    }

    updateUserProfile({ avatar_url: avatarUrl })
    toast.success('Profile picture updated!')
    setUploadingAvatar(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const nextName = (name ?? user?.name ?? '').trim()
    const { error } = await supabase.from('users').update({ name: nextName }).eq('id', user!.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    updateUserProfile({ name: nextName })
    setName(null)
    toast.success('Profile updated!')
    setSaving(false)
  }

  if (loading || !user) return (
    <>
      <Navbar />
      <main className="pt-16 pb-24 min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {loading ? 'Loading profile...' : 'Redirecting...'}
        </p>
      </main>
    </>
  )

  const roleColor: Record<string, string> = {
    admin: 'bg-amber-400/10 text-amber-400',
    moderator: 'bg-blue-400/10 text-blue-400',
    client: 'bg-slate-400/10 text-slate-400',
  }

  return (
    <>
      <Navbar />
      <main className="page-header min-h-screen">
        {/* Profile header */}
        <div className="text-center mb-12 relative">
          <div className="relative z-10">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="w-24 h-24 rounded-[3rem] bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-4xl font-black text-purple-400 shadow-2xl overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} className="w-full h-full rounded-[3rem] object-cover" alt="avatar" />
                ) : <User size={40} />}
              </div>
              <label className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-black/70 text-white shadow-lg transition hover:scale-105 hover:bg-black/85">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarUpload}
                />
                {uploadingAvatar ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />}
              </label>
            </div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.28rem] text-muted-foreground">
              Tap camera to upload photo
            </p>
            <h1 className="text-3xl md:text-4xl font-black gradient-text mb-2">{user.name}</h1>
            <p className="text-sm text-muted-foreground mb-6 opacity-60 tracking-wide">{user.email}</p>
            <div className="inline-flex">
              <span className={`text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full font-black ${roleColor[user.role] || ''}`}>
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="glass rounded-2xl p-5 border border-white/5">
          <h2 className="font-bold text-sm mb-4">Edit Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Display Name</label>
              <input
                value={displayName}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Email</label>
              <input
                value={user.email}
                disabled
                className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={saving || uploadingAvatar}
              className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="mt-4 glass rounded-2xl p-4 border border-white/5">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Account Info</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="capitalize font-semibold">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-semibold">{new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
