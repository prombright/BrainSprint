import type { Grade, Level, Question, Subject } from './types.ts'
import { pick, shuffle } from './random.ts'
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

// ---------- the question bank: questions written by people, downloaded from the server ----------

export interface BankQuestion {
  id: number
  level: Level
  topic: string
  prompt: string
  speak: string | null
  choices: string[]
  answer: string
  steps: string[]
}

export const BANK_MIN = 4 // a class needs at least this many approved questions before the subject opens
const bankGrades = new Set<string>() // "science:P5", … filled from the bank, so sprints never repeat its questions

const fromBank = (b: BankQuestion): Omit<Question, 'key'> => ({
  topic: b.topic,
  prompt: b.prompt,
  speak: b.speak || b.prompt,
  choices: shuffle(b.choices),
  answer: b.answer,
  steps: b.steps.length ? b.steps : undefined,
  extraSeconds: Math.min(15, Math.floor(b.prompt.length / 12)), // longer questions get more reading time
})

/**
 * Makes a class's bank questions playable like any other level. While a level has fewer than 10
 * questions it borrows from the class's other levels, so a small bank still gives full sprints.
 * Generated subjects (Maths, English Top–P3) are never replaced.
 */
export function registerBank(subject: Subject, grade: Grade, questions: BankQuestion[]) {
  const key = `${subject}:${grade}`
  if (PLANS[subject]?.[grade] && !bankGrades.has(key)) return
  if (questions.length < BANK_MIN) {
    if (bankGrades.has(key)) delete PLANS[subject]![grade]
    bankGrades.delete(key)
    return
  }
  const plan = (PLANS[subject] ??= {})
  const levelMaker = (level: Level): Make[] => {
    const own = questions.filter((q) => q.level === level)
    const pool = own.length >= 10 ? own : questions
    return [() => fromBank(pick(pool))]
  }
  plan[grade] = { simple: levelMaker('simple'), medium: levelMaker('medium'), hard: levelMaker('hard'), pro: levelMaker('pro') }
  bankGrades.add(key)
}

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
    // bank questions are written by hand: a short bank gives a shorter sprint rather than repeats
    if (seen.has(key) && bankGrades.has(`${subject}:${grade}`)) break
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
