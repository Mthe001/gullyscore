import { Ball, EventType, Innings, PlayerMatchStats } from './types'

export interface BallResult {
  runs: number
  event_type: EventType
  ballCounted: boolean
  strikeRotated: boolean
  overEnded: boolean
}

export function processBall(
  eventType: EventType,
  runs: number,
  currentBall: number,
  maxOvers: number,
  currentOver: number
): BallResult {
  let ballCounted = true
  let strikeRotated = false
  let overEnded = false
  let actualRuns = runs

  switch (eventType) {
    case 'wide':
      // Wide: +1 run, ball NOT counted
      actualRuns = 1
      ballCounted = false
      break
    case 'no_ball':
      // No ball: record runs only, ball NOT counted
      actualRuns = runs
      ballCounted = false
      break
    case 'wicket':
      actualRuns = 0
      ballCounted = true
      break
    case 'run':
      actualRuns = runs
      ballCounted = true
      // Rotate strike on odd runs
      if (runs % 2 !== 0) {
        strikeRotated = true
      }
      break
  }

  let nextBall = currentBall
  if (ballCounted) {
    nextBall = currentBall + 1
    if (nextBall >= 6) {
      overEnded = true
      strikeRotated = true // always swap at end of over
    }
  }

  return { runs: actualRuns, event_type: eventType, ballCounted, strikeRotated, overEnded }
}

export function getCurrentRunRate(score: number, ballsBowled: number): number {
  if (ballsBowled === 0) return 0
  const overs = ballsBowled / 6
  return score / overs
}

export function getRequiredRunRate(
  target: number,
  currentScore: number,
  ballsRemaining: number
): number {
  if (ballsRemaining === 0) return 0
  const runsNeeded = target - currentScore
  const oversRemaining = ballsRemaining / 6
  return runsNeeded / oversRemaining
}

export function calculateWinProbability(
  target: number,
  currentScore: number,
  wicketsLost: number,
  ballsBowled: number,
  totalBalls: number
): number {
  const ballsRemaining = totalBalls - ballsBowled
  if (ballsRemaining <= 0) {
    return currentScore >= target ? 100 : 0
  }

  const runsNeeded = target - currentScore
  if (runsNeeded <= 0) return 100

  const crr = getCurrentRunRate(currentScore, ballsBowled)
  const rrr = getRequiredRunRate(target, currentScore, ballsRemaining)

  // Wicket penalty - each wicket reduces probability
  const wicketFactor = (10 - wicketsLost) / 10

  // Run rate advantage
  const rrAdvantage = crr - rrr
  
  // Base probability using logistic function
  const baseProb = 1 / (1 + Math.exp(-rrAdvantage * 0.5))
  
  // Apply wicket factor
  let probability = baseProb * wicketFactor * 100
  
  // Clamp between 5 and 95
  probability = Math.max(5, Math.min(95, probability))
  
  return Math.round(probability)
}

export function calculateManOfMatch(
  stats: PlayerMatchStats[]
): PlayerMatchStats | null {
  if (!stats.length) return null

  let bestScore = -1
  let motm: PlayerMatchStats | null = null

  for (const stat of stats) {
    const points =
      stat.runs * 1 +
      stat.wickets * 20 +
      (stat.catches || 0) * 10 +
      stat.fours * 2 +
      stat.sixes * 2

    if (points > bestScore) {
      bestScore = points
      motm = stat
    }
  }

  return motm
}

export function formatOvers(ballsBowled: number): string {
  const overs = Math.floor(ballsBowled / 6)
  const balls = ballsBowled % 6
  return `${overs}.${balls}`
}

export function getOverSummary(balls: Ball[], overNumber: number): string {
  const overBalls = balls.filter(b => b.over_number === overNumber)
  return overBalls
    .map(b => {
      if (b.event_type === 'wide') return 'Wd'
      if (b.event_type === 'no_ball') return `NB+${b.runs}`
      if (b.event_type === 'wicket') return 'W'
      return b.runs.toString()
    })
    .join(' ')
}

export function getTournamentPoints(wins: number, losses: number, ties: number): number {
  return wins * 2 + ties * 1
}
