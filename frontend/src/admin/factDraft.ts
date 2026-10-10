// A fact set being edited in the admin panel, and conversions to and from the API.
import type { FactTemplate } from '../game/facts'

export interface FactSetDraft {
  subject: string
  name: string
  grade_from: string
  grade_to: string
  columnsText: string // "organ, job, system"
  templates: FactTemplate[]
  explain: string
  rowsText: string // one fact per line, cells separated by | or a tab (pasted from Excel)
}

export interface SavedFactSet {
  id: number
  subject: string
  name: string
  grade_from: string
  grade_to: string
  columns: string[]
  templates: FactTemplate[]
  explain: string | null
  rows?: string[][]
  status?: 'draft' | 'approved' | 'retired'
  source?: string | null
  row_count?: number
}

export const emptyFactDraft = (): FactSetDraft => ({
  subject: 'science',
  name: '',
  grade_from: 'P4',
  grade_to: 'P7',
  columnsText: '',
  templates: [],
  explain: '',
  rowsText: '',
})

export const factDraftFrom = (s: SavedFactSet): FactSetDraft => ({
  subject: s.subject,
  name: s.name,
  grade_from: s.grade_from,
  grade_to: s.grade_to,
  columnsText: s.columns.join(', '),
  templates: s.templates.map((t) => ({ ...t })),
  explain: s.explain ?? '',
  rowsText: (s.rows ?? []).map((r) => r.join(' | ')).join('\n'),
})

export const factPayload = (d: FactSetDraft) => ({
  subject: d.subject,
  name: d.name.trim().toLowerCase(),
  grade_from: d.grade_from,
  grade_to: d.grade_to,
  columns: d.columnsText.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean),
  templates: d.templates.map((t) => ({ ask: t.ask.trim(), answer: t.answer, level: t.level, ...(t.not ? { not: t.not } : {}) })),
  explain: d.explain.trim(),
  rows: d.rowsText
    .split('\n')
    .map((line) => line.split(line.includes('\t') ? '\t' : '|').map((c) => c.trim()))
    .filter((r) => r.some(Boolean)),
})
