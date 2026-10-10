import type { League } from './api'

const TIERS = [
  { name: 'Bronze', emoji: '🥉' },
  { name: 'Silver', emoji: '🥈' },
  { name: 'Gold', emoji: '🥇' },
  { name: 'Diamond', emoji: '💎' },
  { name: 'Champion', emoji: '👑' },
]

export const tierBadge = (tier: number) => TIERS[tier] ?? TIERS[0]

/** "3 days", "5 hours", "12 minutes" */
export function timeLeft(ms: number): string {
  const h = ms / 3_600_000
  if (h >= 48) return `${Math.floor(h / 24)} days`
  if (h >= 2) return `${Math.floor(h)} hours`
  return `${Math.max(1, Math.floor(ms / 60_000))} minutes`
}

/**
 * Where the child would stand if their week XP grew by `extra` right now:
 * used to show the live position during a sprint.
 */
export function liveRank(league: League, extra: number): { rank: number; passed: string | null } {
  const me = league.members.find((m) => m.me)
  if (!me) return { rank: league.members.length + 1, passed: null }
  const mine = me.xp + extra
  const others = league.members.filter((m) => !m.me)
  const ahead = others.filter((m) => m.xp > mine)
  // the player just overtaken: the highest one at or below the new score but above the old one
  const passed = others.filter((m) => m.xp <= mine && m.xp > me.xp).sort((a, b) => b.xp - a.xp)[0]
  return { rank: ahead.length + 1, passed: passed?.name ?? null }
}
