export type Subject = 'maths' | 'english' | 'science' | 'sst'
export type Grade = 'TOP' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7'
export type Level = 'simple' | 'medium' | 'hard' | 'pro'

export interface Question {
  key: string // used to avoid repeats inside one sprint
  topic: string
  prompt: string // what the child reads
  speak: string // what the read-aloud voice says
  visual?: string // emoji picture shown above the prompt
  big?: string // a letter or word shown very large (e.g. "A", "c _ t")
  passage?: string // a short story shown above the question (reading comprehension)
  variant?: string // tells apart questions with the same wording (e.g. different pairs to match); not shown
  adapt?: 'challenge' | 'warmup' // swapped in during a sprint: from the level above (challenge) or below (warm-up)
  choices: string[]
  answer: string
  extraSeconds?: number // longer questions (word problems) get more time
  steps?: string[] // worked solution, shown when the child gets it wrong
  review?: boolean // brought back from the review box in a practice sprint
}

export interface AnswerRecord {
  question: Question
  picked: string | null // null = ran out of time
  correct: boolean
  ms: number
  points: number
}

export interface SprintResult {
  subject: Subject
  grade: Grade
  level: Level
  answers: AnswerRecord[]
  score: number
  correct: number
  total: number
  avgMs: number
  bestStreak: number
  stars: number
  newBadges: string[]
  playedAt: string
  endedEarly?: boolean // Brain Power ran out before the last question
  assignmentId?: number // played as homework
  homeworkTitle?: string
  mode?: 'boss' | 'practice' | 'homework'
  mixed?: boolean // questions from several levels (practice, topic homework)
  boss?: { name: string; emoji: string; damage: number; defeated: boolean }
  race?: { rivalId: number; rivalName: string; rivalAvatar: string; rivalScore: number; outcome: 'won' | 'lost' | 'draw' }
}

export const GRADES: { id: Grade; label: string; hint: string }[] = [
  { id: 'TOP', label: 'Top Class', hint: 'Nursery' },
  { id: 'P1', label: 'P1', hint: 'Primary 1' },
  { id: 'P2', label: 'P2', hint: 'Primary 2' },
  { id: 'P3', label: 'P3', hint: 'Primary 3' },
  { id: 'P4', label: 'P4', hint: 'Primary 4' },
  { id: 'P5', label: 'P5', hint: 'Primary 5' },
  { id: 'P6', label: 'P6', hint: 'Primary 6' },
  { id: 'P7', label: 'P7', hint: 'Primary 7' },
]

export const LEVELS: { id: Level; label: string; emoji: string; seconds: number }[] = [
  { id: 'simple', label: 'Simple', emoji: '🌱', seconds: 20 },
  { id: 'medium', label: 'Medium', emoji: '🚲', seconds: 15 },
  { id: 'hard', label: 'Hard', emoji: '🚀', seconds: 12 },
  { id: 'pro', label: 'Pro', emoji: '🏆', seconds: 10 },
]

// whether a class can play a subject comes from hasQuestions() (generated, or approved bank questions)
export const SUBJECTS: { id: Subject; label: string; emoji: string }[] = [
  { id: 'maths', label: 'Maths', emoji: '🔢' },
  { id: 'english', label: 'English', emoji: '🔤' },
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'sst', label: 'SST', emoji: '🌍' },
]
