import type { SprintResult } from './types.ts'

export interface Badge {
  id: string
  emoji: string
  name: string
  how: string
}

export const BADGES: Badge[] = [
  { id: 'first_sprint', emoji: '🏁', name: 'First Sprint', how: 'Finish your first sprint' },
  { id: 'perfect', emoji: '💯', name: 'Perfect 10', how: 'Get every question right in a sprint' },
  { id: 'on_fire', emoji: '🔥', name: 'On Fire', how: 'Get 5 right in a row' },
  { id: 'lightning', emoji: '⚡', name: 'Lightning', how: 'Get 8 or more right, answering in under 3 seconds each' },
  { id: 'keep_running', emoji: '👟', name: 'Keep Running', how: 'Finish 10 sprints' },
  { id: 'collector', emoji: '🪙', name: 'Point Collector', how: 'Collect 1,000 points' },
  { id: 'pro_champ', emoji: '🏆', name: 'Pro Champ', how: 'Get 3 stars on a Pro level' },
  { id: 'week_streak', emoji: '📅', name: 'Every Day', how: 'Play 7 days in a row' },
  { id: 'racer', emoji: '🏁', name: 'Racer', how: 'Win a race against another player' },
  { id: 'race_king', emoji: '🥇', name: 'Race Champion', how: 'Win 10 races' },
  { id: 'boss_slayer', emoji: '⚔️', name: 'Boss Slayer', how: 'Defeat a Weekly Boss' },
]

export interface BadgeContext {
  result: SprintResult
  totalPoints: number
  sprintsPlayed: number
  dayStreak: number
  raceWins: number
}

const RULES: Record<string, (c: BadgeContext) => boolean> = {
  first_sprint: (c) => c.sprintsPlayed >= 1,
  perfect: (c) => c.result.correct === c.result.total,
  on_fire: (c) => c.result.bestStreak >= 5,
  lightning: (c) => c.result.correct >= 8 && c.result.avgMs <= 3000,
  keep_running: (c) => c.sprintsPlayed >= 10,
  collector: (c) => c.totalPoints >= 1000,
  pro_champ: (c) => c.result.level === 'pro' && c.result.stars === 3,
  week_streak: (c) => c.dayStreak >= 7,
  racer: (c) => c.raceWins >= 1,
  race_king: (c) => c.raceWins >= 10,
  boss_slayer: (c) => !!c.result.boss?.defeated,
}

export function earnedBadges(ctx: BadgeContext, already: string[]): string[] {
  return BADGES.filter((b) => !already.includes(b.id) && RULES[b.id]?.(ctx)).map((b) => b.id)
}

export const badgeById = (id: string) => BADGES.find((b) => b.id === id)
