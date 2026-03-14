import { formatOvers } from '@/lib/scoring-engine'

export interface MatchInningsSummary {
  id: string
  batting_team: string
  bowling_team: string
  score: number
  wickets: number
  balls_bowled: number
  innings_number?: number | null
  is_complete?: boolean | null
  target?: number | null
  created_at?: string | null
}

export function sortInnings<T extends MatchInningsSummary>(innings?: T[] | null): T[] {
  if (!innings?.length) return []

  return [...innings].sort((a, b) => {
    const inningsDiff = (a.innings_number ?? 0) - (b.innings_number ?? 0)
    if (inningsDiff !== 0) return inningsDiff

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return aTime - bTime
  })
}

export function getTeamInnings<T extends MatchInningsSummary>(innings: T[] | null | undefined, teamId: string) {
  return sortInnings(innings).find(inningsItem => inningsItem.batting_team === teamId) ?? null
}

export function getActiveInnings<T extends MatchInningsSummary>(innings: T[] | null | undefined) {
  return sortInnings(innings).find(inningsItem => !inningsItem.is_complete) ?? null
}

export function getScoreText(innings?: MatchInningsSummary | null) {
  if (!innings) return 'Yet to bat'
  return `${innings.score}/${innings.wickets}`
}

export function getOversText(innings?: MatchInningsSummary | null) {
  if (!innings) return ''
  return formatOvers(innings.balls_bowled ?? 0)
}
