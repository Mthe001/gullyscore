'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ChangeEvent } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import { ArrowLeft, Check, ImagePlus, LoaderCircle, Plus, Users, X } from 'lucide-react'
import Link from 'next/link'

const TEAM_LOGO_BUCKET = 'team-logos'
const TEAM_LOGO_FALLBACK_BUCKET = 'avatars'
const MAX_LOGO_SIZE = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

type ExistingPlayer = {
  id: string
  name: string
  team_id: string | null
  team?: Array<{
    name?: string | null
  }> | null
}

type NewPlayerDraft = {
  id: string
  name: string
}

export default function NewTeamPage() {
  const router = useRouter()
  const { isAdmin, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [playersLoading, setPlayersLoading] = useState(true)
  const [existingPlayers, setExistingPlayers] = useState<ExistingPlayer[]>([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [newPlayers, setNewPlayers] = useState<NewPlayerDraft[]>([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [form, setForm] = useState({ name: '' })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const logoPreview = useMemo(() => (
    logoFile ? URL.createObjectURL(logoFile) : null
  ), [logoFile])

  useEffect(() => {
    if (!isAdmin) {
      router.push('/')
      return
    }

    let mounted = true
    setPlayersLoading(true)

    supabase
      .from('players')
      .select('id, name, team_id, team:teams(name)')
      .order('name')
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('[teams/new] Failed to load players', error)
          toast.error('Could not load players')
          setExistingPlayers([])
        } else {
          setExistingPlayers(data || [])
        }
        setPlayersLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [isAdmin, router])

  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  const selectedExistingPlayers = existingPlayers.filter(player => selectedPlayerIds.includes(player.id))

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null

    if (!file) {
      setLogoFile(null)
      return
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Use PNG, JPG, or WEBP for team logos')
      event.target.value = ''
      return
    }

    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Logo size must be under 2MB')
      event.target.value = ''
      return
    }

    setLogoFile(file)
  }

  function toggleExistingPlayer(playerId: string) {
    setSelectedPlayerIds(current =>
      current.includes(playerId)
        ? current.filter(id => id !== playerId)
        : [...current, playerId]
    )
  }

  function handleAddNewPlayer() {
    const trimmedName = newPlayerName.trim()
    if (!trimmedName) {
      toast.error('Enter a player name first')
      return
    }

    const normalizedName = trimmedName.toLowerCase()
    const existsInExisting = existingPlayers.some(player => player.name.trim().toLowerCase() === normalizedName)
    const existsInDrafts = newPlayers.some(player => player.name.trim().toLowerCase() === normalizedName)

    if (existsInExisting || existsInDrafts) {
      toast.error('This player is already added')
      return
    }

    setNewPlayers(current => [
      ...current,
      { id: `${Date.now()}-${current.length}`, name: trimmedName },
    ])
    setNewPlayerName('')
  }

  function removeDraftPlayer(playerId: string) {
    setNewPlayers(current => current.filter(player => player.id !== playerId))
  }

  async function uploadTeamLogo() {
    if (!logoFile || !user) return null

    const fileExt = logoFile.name.split('.').pop()?.toLowerCase() || 'png'
    const safeName = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'
    const primaryFilePath = `${user.id}/${safeName}-${Date.now()}.${fileExt}`
    const fallbackFilePath = `${user.id}/team-logos/${safeName}-${Date.now()}.${fileExt}`

    const primaryUpload = await supabase.storage
      .from(TEAM_LOGO_BUCKET)
      .upload(primaryFilePath, logoFile, {
        cacheControl: '3600',
        upsert: true,
      })

    if (primaryUpload.error?.message?.toLowerCase().includes('bucket not found')) {
      const fallbackUpload = await supabase.storage
        .from(TEAM_LOGO_FALLBACK_BUCKET)
        .upload(fallbackFilePath, logoFile, {
          cacheControl: '3600',
          upsert: true,
        })

      if (fallbackUpload.error) {
        throw new Error(fallbackUpload.error.message)
      }

      const { data: publicUrlData } = supabase.storage
        .from(TEAM_LOGO_FALLBACK_BUCKET)
        .getPublicUrl(fallbackFilePath)

      return publicUrlData.publicUrl
    }

    if (primaryUpload.error) {
      throw new Error(primaryUpload.error.message)
    }

    const { data: publicUrlData } = supabase.storage
      .from(TEAM_LOGO_BUCKET)
      .getPublicUrl(primaryFilePath)

    return publicUrlData.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const teamName = form.name.trim()
    if (!teamName) {
      toast.error('Team name is required')
      return
    }

    setLoading(true)

    try {
      const logoUrl = await uploadTeamLogo()

      const { data: createdTeam, error: teamError } = await supabase
        .from('teams')
        .insert({ name: teamName, logo_url: logoUrl })
        .select('id')
        .single()

      if (teamError || !createdTeam) {
        throw new Error(teamError?.message || 'Could not create team')
      }

      if (selectedPlayerIds.length > 0) {
        const { error: updatePlayersError } = await supabase
          .from('players')
          .update({ team_id: createdTeam.id })
          .in('id', selectedPlayerIds)

        if (updatePlayersError) {
          throw new Error(updatePlayersError.message)
        }
      }

      if (newPlayers.length > 0) {
        const { error: insertPlayersError } = await supabase
          .from('players')
          .insert(
            newPlayers.map(player => ({
              name: player.name,
              team_id: createdTeam.id,
              avatar_url: null,
              matches_played: 0,
              total_runs: 0,
              highest_score: 0,
              strike_rate: 0,
              total_wickets: 0,
              best_bowling: '0/0',
              economy_rate: 0,
            }))
          )

        if (insertPlayersError) {
          throw new Error(insertPlayersError.message)
        }
      }

      toast.success('Team created with players!')
      router.push('/admin/teams')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create team'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen max-w-2xl px-4 pb-24 pt-16 mx-auto">
        <div className="mt-4 mb-5 flex items-center gap-3">
          <Link href="/admin">
            <button className="rounded-xl p-2 text-muted-foreground transition hover:bg-white/5">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-black sm:text-2xl">Create New Team</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Build the squad in one mobile-friendly flow.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="glass rounded-3xl border border-white/5 p-4 sm:p-5 space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Team Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Street Kings"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-muted-foreground">Team Logo</label>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/20 mx-auto sm:mx-0">
                    {logoPreview ? (
                      <Image
                        src={logoPreview}
                        alt="Team logo preview"
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImagePlus size={20} className="mx-auto mb-1" />
                        <p className="text-[10px] uppercase tracking-[0.2em]">Preview</p>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-purple-500/40 hover:bg-white/8 w-full sm:w-auto">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                      <ImagePlus size={16} />
                      Upload logo
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, WEBP up to 2MB.</p>
                    {logoFile && (
                      <p className="mt-1 truncate text-xs text-white/80">{logoFile.name}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Users size={16} className="text-cyan-300" />
                <label className="text-xs font-semibold text-muted-foreground">Add Existing Players</label>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
                {playersLoading ? (
                  <p className="text-sm text-muted-foreground">Loading players...</p>
                ) : existingPlayers.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {existingPlayers.map(player => {
                      const isSelected = selectedPlayerIds.includes(player.id)
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => toggleExistingPlayer(player.id)}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            isSelected
                              ? 'border-cyan-400/40 bg-cyan-400/10'
                              : 'border-white/8 bg-black/10 hover:border-white/16'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {player.team?.[0]?.name ? `Current: ${player.team[0].name}` : 'No team'}
                              </p>
                            </div>
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                              isSelected
                                ? 'border-cyan-400/40 bg-cyan-400/20 text-cyan-200'
                                : 'border-white/10 text-muted-foreground'
                            }`}>
                              {isSelected ? <Check size={14} /> : <Plus size={14} />}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No players found yet.</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-muted-foreground">Add New Players</label>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newPlayerName}
                    onChange={e => setNewPlayerName(e.target.value)}
                    placeholder="Type player name"
                    className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddNewPlayer()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddNewPlayer}
                    className="rounded-2xl bg-[linear-gradient(135deg,#0891b2,#4f46e5)] px-4 py-3 text-sm font-bold text-white whitespace-nowrap"
                  >
                    Add Player
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Quick add brand-new players directly into this team.</p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-muted-foreground">Selected Squad</label>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 sm:p-4">
                {selectedExistingPlayers.length === 0 && newPlayers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No players selected yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedExistingPlayers.map(player => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                          <p className="text-xs text-cyan-300">Existing player</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExistingPlayer(player.id)}
                          className="rounded-full border border-white/10 p-2 text-muted-foreground transition hover:bg-white/5 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {newPlayers.map(player => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{player.name}</p>
                          <p className="text-xs text-emerald-300">New player</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDraftPlayer(player.id)}
                          className="rounded-full border border-white/10 p-2 text-muted-foreground transition hover:bg-white/5 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6c63ff, #5a52e0)' }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle size={16} className="animate-spin" />
                Creating team...
              </span>
            ) : (
              'Create Team'
            )}
          </button>
        </form>
      </main>
    </>
  )
}
