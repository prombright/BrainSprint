// Player level, title and unlockable avatars, all from total XP.

/** XP needed to reach a level: 100, 300, 600, 1,000, 1,500 … (50 × L × (L+1)) */
export const xpForLevel = (level: number) => 50 * (level - 1) * level

export function levelFromXp(xp: number) {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)
  return { level, into: xp - from, needed: to - from, pct: Math.round(((xp - from) / (to - from)) * 100) }
}

export const TITLES = [
  { from: 1, name: 'Seedling', emoji: '🌱', ring: '#16a34a' },
  { from: 3, name: 'Explorer', emoji: '🧭', ring: '#15803d' },
  { from: 5, name: 'Thinker', emoji: '💡', ring: '#4d7c0f' },
  { from: 8, name: 'Scholar', emoji: '📚', ring: '#0f766e' },
  { from: 12, name: 'Genius', emoji: '🧠', ring: '#ca8a04' },
  { from: 17, name: 'Legend', emoji: '🏆', ring: '#a16207' },
]

export const titleFor = (level: number) => [...TITLES].reverse().find((t) => level >= t.from) ?? TITLES[0]

/** Everyone starts with these … */
export const FREE_AVATARS = ['🦁', '🐘', '🦒', '🐵', '🦓', '🐢', '🦜', '🐆', '🦛', '🐊']
/** … and earns these by levelling up. */
export const LEVEL_AVATARS = [
  { emoji: '🦉', level: 2 },
  { emoji: '🐬', level: 3 },
  { emoji: '🦄', level: 4 },
  { emoji: '🐼', level: 5 },
  { emoji: '🦊', level: 6 },
  { emoji: '🐉', level: 8 },
  { emoji: '🦅', level: 10 },
  { emoji: '🐯', level: 12 },
  { emoji: '🦖', level: 15 },
  { emoji: '👑', level: 20 },
]

export const DAILY_GOAL = 3 // sprints a day

export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const yesterdayKey = () => {
  const d = new Date(Date.now() - 864e5)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
