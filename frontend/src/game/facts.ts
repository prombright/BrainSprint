// FACT ENGINE: turns small tables of checked facts into many questions.
//
// A fact set is a table plus question patterns, e.g. "Body organs":
//   columns:  organ | job          | system
//   rows:     heart | pumps blood  | circulatory
//             lungs | take in air  | respiratory   …
//   patterns: "Which organ {job}?"                       → answer column "organ"
//             "What is the work of the {organ}?"         → answer column "job"
//             "Which of these is NOT part of the {system} system?" → a NOT pattern grouped by "system"
//
// Each question uses one row for the right answer and other rows for the wrong choices.
// The safety rule: never ask a question that two different rows could both answer (see `ambiguous`).
// Facts are written and checked by people, so every question made from them is correct.
import type { Level, Question } from './types.ts'
import { pick, shuffle } from './random.ts'

export interface FactTemplate {
  ask: string // pattern with {column} gaps
  answer: string // the column whose value is the right answer
  level: Level
  not?: string // NOT pattern: group column; "Which of these is NOT …?"
}

export interface FactSet {
  id: number
  subject: string
  name: string
  grade_from: string
  grade_to: string
  columns: string[]
  templates: FactTemplate[]
  explain: string | null
  rows: string[][]
  updated?: string // when the set last changed (from the server)
}

type Row = Record<string, string>

const asRows = (set: FactSet): Row[] => set.rows.map((r) => Object.fromEntries(set.columns.map((c, i) => [c, r[i]])))

/** The {column} names a pattern uses. */
export const gapsOf = (text: string) => [...text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1])

const fill = (text: string, row: Row) => text.replace(/\{([a-z_]+)\}/g, (_, c: string) => row[c] ?? `{${c}}`)

/** First letter up, for the start of a sentence: "{organ} is …" with "heart" → "Heart is …" */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const sameOn = (a: Row, b: Row, cols: string[]) => cols.every((c) => a[c].toLowerCase() === b[c].toLowerCase())

/**
 * A pattern is ambiguous for a row if another row fills the gaps identically but has a different answer,
 * e.g. "Which disease is spread by dirty water?" when both cholera and typhoid are in the table.
 */
export function ambiguous(rows: Row[], row: Row, t: FactTemplate): boolean {
  const gaps = gapsOf(t.ask)
  return rows.some((o) => o !== row && sameOn(o, row, gaps) && o[t.answer].toLowerCase() !== row[t.answer].toLowerCase())
}

/** One question from a normal pattern, or null when this row can't make a fair one. */
function normalQuestion(set: FactSet, rows: Row[], row: Row, t: FactTemplate): Omit<Question, 'key'> | null {
  if (ambiguous(rows, row, t)) return null
  const gaps = gapsOf(t.ask)
  const right = row[t.answer]
  // a wrong choice must be a different answer, from a row that wouldn't also fit the question
  const wrong = [...new Set(rows.filter((o) => !sameOn(o, row, gaps) && o[t.answer].toLowerCase() !== right.toLowerCase()).map((o) => o[t.answer]))]
  if (wrong.length < 1) return null
  return build(set, row, sentence(fill(t.ask, row)), right, shuffle(wrong).slice(0, 3))
}

/** "Which of these is NOT a mammal?": three rows from one group and one from another. */
function notQuestion(set: FactSet, rows: Row[], t: FactTemplate): Omit<Question, 'key'> | null {
  const group = t.not!
  const groups = new Map<string, Row[]>()
  for (const r of rows) groups.set(r[group].toLowerCase(), [...(groups.get(r[group].toLowerCase()) ?? []), r])
  const big = [...groups.values()].filter((g) => new Set(g.map((r) => r[t.answer].toLowerCase())).size >= 3)
  if (!big.length) return null
  const inGroup = pick(big)
  const g = inGroup[0][group].toLowerCase()
  const insideValues = new Set(inGroup.map((r) => r[t.answer].toLowerCase()))
  // the odd one out must not also belong to the group under another row
  const outside = rows.filter((r) => r[group].toLowerCase() !== g && !insideValues.has(r[t.answer].toLowerCase()))
  if (!outside.length) return null
  const odd = pick(outside)
  const three = shuffle([...new Map(inGroup.map((r) => [r[t.answer].toLowerCase(), r[t.answer]])).values()]).slice(0, 3)
  return build(set, odd, sentence(fill(t.ask, inGroup[0])), odd[t.answer], three)
}

function build(set: FactSet, row: Row, prompt: string, answer: string, wrong: string[]): Omit<Question, 'key'> {
  return {
    topic: set.name.toLowerCase(),
    prompt,
    speak: prompt,
    choices: shuffle([answer, ...wrong]),
    answer,
    steps: set.explain ? [sentence(fill(set.explain, row))] : undefined,
    extraSeconds: Math.min(12, Math.floor(prompt.length / 12)),
  }
}

/** One question from a set at a level (or from any of its patterns if none match the level). */
export function factQuestion(set: FactSet, level?: Level): Omit<Question, 'key'> | null {
  const rows = asRows(set)
  const patterns = set.templates.filter((t) => !level || t.level === level)
  const usable = patterns.length ? patterns : set.templates
  for (let tries = 0; tries < 20; tries++) {
    const t = pick(usable)
    const q = t.not ? notQuestion(set, rows, t) : normalQuestion(set, rows, pick(rows), t)
    if (q) return q
  }
  return null
}

/** Every distinct question a set can ask (prompt + answer), for previews and counting. */
export function allFactQuestions(set: FactSet): { prompt: string; answer: string; level: Level; fair: boolean }[] {
  const rows = asRows(set)
  const out: { prompt: string; answer: string; level: Level; fair: boolean }[] = []
  for (const t of set.templates) {
    if (t.not) {
      const q = notQuestion(set, rows, t)
      if (q) out.push({ prompt: q.prompt, answer: q.answer, level: t.level, fair: true })
      continue
    }
    for (const r of rows) out.push({ prompt: sentence(fill(t.ask, r)), answer: r[t.answer], level: t.level, fair: !ambiguous(rows, r, t) })
  }
  return out
}

/** Problems with a set before it's saved; the server checks the same rules. */
export function checkFactSet(set: Pick<FactSet, 'columns' | 'templates' | 'rows' | 'explain'>): string[] {
  const problems: string[] = []
  const cols = new Set(set.columns)
  if (set.columns.length < 2) problems.push('A fact set needs at least 2 columns')
  if (set.rows.length < 4) problems.push('Add at least 4 rows so there are enough wrong answers')
  set.templates.forEach((t, i) => {
    for (const g of gapsOf(t.ask)) if (!cols.has(g)) problems.push(`Pattern ${i + 1} uses {${g}}, which is not a column`)
    if (!cols.has(t.answer)) problems.push(`Pattern ${i + 1}: the answer column "${t.answer}" does not exist`)
    if (t.not && !cols.has(t.not)) problems.push(`Pattern ${i + 1}: the group column "${t.not}" does not exist`)
    if (!t.not && gapsOf(t.ask).includes(t.answer)) problems.push(`Pattern ${i + 1} gives the answer away: it shows {${t.answer}}`)
  })
  for (const g of gapsOf(set.explain ?? '')) if (!cols.has(g)) problems.push(`The explanation uses {${g}}, which is not a column`)
  set.rows.forEach((r, i) => {
    if (r.length !== set.columns.length || r.some((v) => !v.trim())) problems.push(`Row ${i + 1} has an empty cell`)
  })
  return problems
}
