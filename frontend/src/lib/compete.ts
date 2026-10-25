// Small helpers shared by the competition screens.
import { GRADES, SUBJECTS } from '../game/types'

export const subjectLabel = (s: string) => {
  const found = SUBJECTS.find((x) => x.id === s)
  return found ? found.label : 'Mixed'
}
export const gradeLabel = (g: string) => GRADES.find((x) => x.id === g)?.label ?? g

/** "Fri 10:30" */
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** "2 h 5 min", "12 min", "less than a minute" */
export function until(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60_000))
  if (m < 1) return 'less than a minute'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ${m % 60} min`
  return `${Math.floor(h / 24)} days`
}

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
