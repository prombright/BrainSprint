// The weekly Boss Battle: same boss for everyone all week, a new one each Monday.
// Must match BOSSES / BOSS_HP in api/community.php.
export const BOSS_HP = 180
export const BOSS_HEARTS = 3
export const BOSS_QUESTIONS = 12

export const BOSSES = [
  { name: 'Times-Rex', emoji: '🦖' },
  { name: 'the Fraction Shark', emoji: '🦈' },
  { name: 'Robo-Ruler', emoji: '🤖' },
  { name: 'the Minus Monster', emoji: '👹' },
  { name: 'Octo-Algebra', emoji: '🐙' },
  { name: 'the Division Dragon', emoji: '🐲' },
]

/** Offline fallback: works out this week's boss the same way the server does (weeks since 1970, Mondays). */
export function bossThisWeek() {
  const now = new Date()
  const monday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  // the server counts from a Kampala-time Monday (UTC+3), which falls in the same 7-day bucket
  const n = Math.floor((monday / 1000 - 3 * 3600) / (7 * 86400))
  return BOSSES[n % BOSSES.length]
}

/** "the Fraction Shark" → "The Fraction Shark" at the start of a sentence */
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
