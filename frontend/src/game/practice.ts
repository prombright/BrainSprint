// Adaptive practice: topic mastery from recent answers, weak-spot detection, and a
// spaced-repetition "review box" that brings missed questions back after 1, 3, 7 and 14 days.
import type { Grade, Level, Question, Subject } from './types.ts'
import { sampleQuestions } from './sprint.ts'
import { shuffle } from './random.ts'

export const RECENT = 20 // mastery looks at the last 20 answers in a topic
export const MIN_ATTEMPTS = 5 // don't judge a topic on fewer answers
export const WEAK_BELOW = 70 // %
export const STRONG_FROM = 85 // %

export interface TopicStat {
  correct: number
  total: number
  recent: number[] // last answers, 1 = right, 0 = wrong
}

export const topicKey = (subject: Subject, grade: Grade, topic: string) => `${subject}:${grade}:${topic}`

export function mastery(s: TopicStat): number {
  return s.recent.length ? Math.round((s.recent.reduce((a, b) => a + b, 0) / s.recent.length) * 100) : 0
}

export type TopicLevel = 'new' | 'weak' | 'ok' | 'strong'
export function topicLevel(s: TopicStat): TopicLevel {
  if (s.total < MIN_ATTEMPTS) return 'new'
  const m = mastery(s)
  return m < WEAK_BELOW ? 'weak' : m < STRONG_FROM ? 'ok' : 'strong'
}

export function addResult(s: TopicStat | undefined, correct: boolean): TopicStat {
  const prev = s ?? { correct: 0, total: 0, recent: [] }
  return { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1, recent: [...prev.recent, correct ? 1 : 0].slice(-RECENT) }
}

// ---------- review box (Leitner system) ----------

export interface ReviewCard {
  q: Question
  subject: Subject
  grade: Grade
  box: number // 0 = just missed … 3 = nearly learnt
  due: number // ms timestamp
}

const DAY = 864e5
const INTERVALS = [1, 3, 7, 14] // days before a card comes back, by box
export const REVIEW_LIMIT = 60

/** A wrong answer puts the question in box 0 (back tomorrow); a right one in review moves it up. */
export function updateCard(cards: ReviewCard[], q: Question, subject: Subject, grade: Grade, correct: boolean, now = Date.now()): ReviewCard[] {
  const i = cards.findIndex((c) => c.q.key === q.key)
  if (i < 0) {
    if (correct) return cards
    return [...cards, { q, subject, grade, box: 0, due: now + INTERVALS[0] * DAY }].slice(-REVIEW_LIMIT)
  }
  const card = cards[i]
  if (!correct) return cards.map((c, j) => (j === i ? { ...c, box: 0, due: now + INTERVALS[0] * DAY } : c))
  // only an answer given when the card was due counts as progress
  if (card.due > now) return cards
  const box = card.box + 1
  if (box >= INTERVALS.length) return cards.filter((_, j) => j !== i) // learnt: out of the box
  return cards.map((c, j) => (j === i ? { ...c, box, due: now + INTERVALS[box] * DAY } : c))
}

export const dueCards = (cards: ReviewCard[], subject: Subject, grade: Grade, now = Date.now()) =>
  cards.filter((c) => c.subject === subject && c.grade === grade && c.due <= now)

/**
 * A practice sprint: up to 4 questions due for review, then questions from the weak topics
 * (or the one `topic` asked for), topped up with anything from the class if there aren't enough.
 */
export function buildPractice(opts: {
  subject: Subject
  grade: Grade
  levels: Level[]
  weak: string[]
  topic?: string
  due: ReviewCard[]
  count?: number
}): Question[] {
  const count = opts.count ?? 10
  const review = opts.topic ? [] : shuffle(opts.due).slice(0, 4).map((c) => ({ ...c.q, review: true }))
  const avoid = new Set(review.map((q) => q.key))
  const targets = opts.topic ? [opts.topic] : opts.weak
  const focused = targets.length ? sampleQuestions(opts.subject, opts.grade, opts.levels, (t) => targets.includes(t), count - review.length, avoid) : []
  for (const q of focused) avoid.add(q.key)
  const topUp = sampleQuestions(opts.subject, opts.grade, opts.levels, () => true, count - review.length - focused.length, avoid)
  return [...review, ...shuffle([...focused, ...topUp])]
}
