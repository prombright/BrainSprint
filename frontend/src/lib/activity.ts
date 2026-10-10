import { LEVELS, SUBJECTS } from '../game/types'

/** "maths:P5:hard" → "P5 Maths · Hard" */
export function activityLabel(a: string | null | undefined): string {
  if (!a) return ''
  const [subject, grade, level] = a.split(':')
  const s = SUBJECTS.find((x) => x.id === subject)?.label ?? subject
  const l = LEVELS.find((x) => x.id === level)?.label ?? level
  return `${grade === 'TOP' ? 'Top Class' : grade} ${s} · ${l}`
}

/** "2026-10-08T16:40:00+03:00" → "just now" / "5 min ago" / "2 h ago" */
export function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
