import type { AnswerRecord, Grade, Level, Subject } from './types.ts'

export const BASE_POINTS = 10
export const MAX_SPEED_BONUS = 10
export const STREAK_BONUS = 5 // from the 3rd correct answer in a row
export const FREE_SPRINTS_PER_DAY = 3
// Everything is free while the game is being built. Set to true to turn the
// daily limit and Sprint Pass back on.
export const PAYWALL_ENABLED = false

// ⚡ Brain Power: every wrong answer uses 1, and it refills for free over time.
// A Sprint Pass gives unlimited Brain Power. Points (XP) are only ever earned, never bought.
export const BRAIN_POWER_ENABLED = true
export const BRAIN_POWER_MAX = 25
export const BRAIN_POWER_REFILL_MINUTES = 15 // one ⚡ back every 15 minutes: empty to full in about 6 hours
export const QUESTIONS_PER_SPRINT = 10

/** Points for one answer. Wrong or too slow earns nothing, so random tapping never pays. */
export function pointsFor(correct: boolean, msTaken: number, msAllowed: number, streak: number): number {
  if (!correct) return 0
  const left = Math.max(0, msAllowed - msTaken) / msAllowed
  const speed = Math.round(MAX_SPEED_BONUS * left)
  return BASE_POINTS + speed + (streak >= 3 ? STREAK_BONUS : 0)
}

export function starsFor(correct: number, total: number): number {
  const pct = total ? correct / total : 0
  if (pct >= 0.9) return 3
  if (pct >= 0.7) return 2
  if (pct >= 0.5) return 1
  return 0
}

export function bestStreak(answers: AnswerRecord[]): number {
  let best = 0
  let run = 0
  for (const a of answers) {
    run = a.correct ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export const levelKey = (subject: Subject, grade: Grade, level: Level) => `${subject}:${grade}:${level}`

// A level opens once the level before it has 2 stars.
export const STARS_TO_UNLOCK = 2
