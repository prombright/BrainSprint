import type { Grade, Level, Question, Subject } from './types.ts'
import { pick } from './random.ts'
import { MATHS_PLAN } from './maths.ts'
import { ENGLISH_PLAN } from './english.ts'

export type Make = () => Omit<Question, 'key'>
// a subject may not cover every class yet
export type Plan = Partial<Record<Grade, Record<Level, Make[]>>>

const PLANS: Partial<Record<Subject, Plan>> = {
  maths: MATHS_PLAN,
  english: ENGLISH_PLAN,
}

export const hasQuestions = (subject: Subject, grade: Grade) => !!PLANS[subject]?.[grade]

export const questionKey = (q: Omit<Question, 'key'>) => `${q.prompt}|${q.big ?? ''}|${q.visual ?? ''}`

/**
 * A fresh sprint of `count` questions with no repeats inside the sprint, and avoiding
 * `recent` (questions this child saw in earlier sprints) whenever the level has enough variety.
 */
export function makeSprint(subject: Subject, grade: Grade, level: Level, count = 10, recent: ReadonlySet<string> = new Set()): Question[] {
  const makers = PLANS[subject]?.[grade]?.[level]
  if (!makers) return []
  const out: Question[] = []
  const seen = new Set<string>()
  let tries = 0
  while (out.length < count && tries < count * 60) {
    tries++
    const q = pick(makers)()
    const key = questionKey(q)
    if (seen.has(key) && tries < count * 40) continue
    // small levels (e.g. counting to 5) run out of new questions; let old ones back in after a while
    if (recent.has(key) && tries < count * 20) continue
    seen.add(key)
    out.push({ ...q, key })
  }
  return out
}

/**
 * Questions from any of `levels` in a class whose topic passes `wanted`, for practice sprints.
 * Gives up after a fixed number of tries, so it may return fewer than `count`.
 */
export function sampleQuestions(
  subject: Subject,
  grade: Grade,
  levels: Level[],
  wanted: (topic: string) => boolean,
  count: number,
  avoid: ReadonlySet<string> = new Set(),
): Question[] {
  const makers = levels.flatMap((l) => PLANS[subject]?.[grade]?.[l] ?? [])
  if (!makers.length) return []
  const out: Question[] = []
  const seen = new Set(avoid)
  for (let tries = 0; out.length < count && tries < 3000; tries++) {
    const q = pick(makers)()
    const key = questionKey(q)
    if (!wanted(q.topic) || seen.has(key)) continue
    seen.add(key)
    out.push({ ...q, key })
  }
  return out
}

/** Every topic name a class + subject can produce (sampled), e.g. for a topic list. */
export function topicsOf(subject: Subject, grade: Grade, levels: Level[]): string[] {
  const makers = levels.flatMap((l) => PLANS[subject]?.[grade]?.[l] ?? [])
  const names = new Set<string>()
  for (const make of makers) for (let i = 0; i < 4; i++) names.add(make().topic)
  return [...names].sort()
}
