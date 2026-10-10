// PLE-style mock exams for P6 and P7: a long mixed paper, timed as a whole,
// with no feedback until the end (like the real exam).
import type { Grade, Level, Question } from './types.ts'
import { sampleQuestions } from './sprint.ts'
import { shuffle } from './random.ts'

export const MOCK_QUESTIONS = 30
export const MOCK_MINUTES = 45
export const MOCK_GRADES: Grade[] = ['P6', 'P7']

/** Where a class's paper comes from: its own Hard/Pro levels plus revision from the year below. */
const SOURCES: Record<string, { grade: Grade; levels: Level[]; share: number }[]> = {
  P7: [
    { grade: 'P7', levels: ['hard', 'pro'], share: 18 },
    { grade: 'P7', levels: ['medium'], share: 6 },
    { grade: 'P6', levels: ['hard', 'pro'], share: 6 },
  ],
  P6: [
    { grade: 'P6', levels: ['hard', 'pro'], share: 18 },
    { grade: 'P6', levels: ['medium'], share: 6 },
    { grade: 'P5', levels: ['hard', 'pro'], share: 6 },
  ],
}

/** 30 questions, at most 3 from any one topic (loosened only if a source runs short). */
export function buildMock(grade: Grade): Question[] {
  const sources = SOURCES[grade]
  if (!sources) return []
  const perTopic = new Map<string, number>()
  const seen = new Set<string>()
  const out: Question[] = []
  for (const src of sources) {
    let taken = 0
    for (const cap of [3, 4, 6]) {
      const batch = sampleQuestions('maths', src.grade, src.levels, (t) => (perTopic.get(t) ?? 0) < cap, (src.share - taken) * 3, seen)
      for (const q of batch) {
        if (taken >= src.share) break
        const n = perTopic.get(q.topic) ?? 0
        if (n >= cap) continue
        perTopic.set(q.topic, n + 1)
        seen.add(q.key)
        out.push(q)
        taken++
      }
      if (taken >= src.share) break
    }
  }
  return shuffle(out).slice(0, MOCK_QUESTIONS)
}

export function readinessBand(percent: number) {
  if (percent >= 80) return { label: 'Excellent', emoji: '🌟', colour: 'text-leaf', note: 'Ready: keep sharp with a mock a week.' }
  if (percent >= 65) return { label: 'Good', emoji: '👍', colour: 'text-ocean', note: 'Nearly there: practise your weak topics.' }
  if (percent >= 50) return { label: 'Getting there', emoji: '📈', colour: 'text-sprint-dark', note: 'Keep practising your weak topics every day.' }
  return { label: 'Needs work', emoji: '💪', colour: 'text-cherry', note: 'Start with the topics marked "Needs practice".' }
}
