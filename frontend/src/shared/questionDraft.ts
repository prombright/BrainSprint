// A question being written in the editor, and how it is sent to the API.
export interface QuestionDraft {
  subject: string
  grade: string
  level: string
  topic: string
  prompt: string
  speak: string
  choices: string[] // always 4 boxes; empty ones are dropped when saving
  answer: string
  stepsText: string // one step per line
}

export const emptyDraft = (grade = 'P5', subject = 'science'): QuestionDraft => ({
  subject,
  grade,
  level: 'medium',
  topic: '',
  prompt: '',
  speak: '',
  choices: ['', '', '', ''],
  answer: '',
  stepsText: '',
})

/** The draft as the API expects it. */
export const toPayload = (d: QuestionDraft) => ({
  subject: d.subject,
  grade: d.grade,
  level: d.level,
  topic: d.topic.trim().toLowerCase(),
  prompt: d.prompt.trim(),
  speak: d.speak.trim(),
  choices: d.choices.map((c) => c.trim()).filter(Boolean),
  answer: d.answer.trim(),
  steps: d.stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
})

/** A saved bank question back into the editor. */
export const fromSaved = (q: { subject: string; grade: string; level: string; topic: string; prompt: string; speak: string | null; choices: string[]; answer: string; steps: string[] }): QuestionDraft => ({
  subject: q.subject,
  grade: q.grade,
  level: q.level,
  topic: q.topic,
  prompt: q.prompt,
  speak: q.speak ?? '',
  choices: [...q.choices, '', '', '', ''].slice(0, 4),
  answer: q.answer,
  stepsText: q.steps.join('\n'),
})
