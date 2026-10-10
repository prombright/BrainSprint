// Admin API calls. The sign-in lasts for this browser tab only (sessionStorage), 12 hours at most.
const BASE = import.meta.env.VITE_API_URL ?? '/brainsprint/api'
const KEY = 'bsk:admin'

export const session = {
  get: () => {
    try {
      return sessionStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set: (t: string | null) => {
    try {
      if (t) sessionStorage.setItem(KEY, t)
      else sessionStorage.removeItem(KEY)
    } catch {
      /* blocked: sign-in lasts for this page only */
    }
  },
}

export class AdminError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function adminCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = session.get()
  if (t) headers.Authorization = `Bearer ${t}`
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => {
    throw new AdminError('Cannot reach the server', 0)
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new AdminError(data.error ?? `Error ${r.status}`, r.status)
  return data as T
}

export interface Overview {
  players: number
  players_new_7d: number
  active_today: number
  online_now: number
  sprints_today: number
  questions_total: number
  parents: number
  schools_pending: number
  leads_new: number
  demo_players: number
  days: { day: string; sprints: number; players: number }[]
  grades: { grade: string; players: number }[]
}

export interface AdminSchool {
  id: number
  name: string
  district: string
  status: 'pending' | 'approved' | 'hidden'
  members: number
  creator: string | null
  created_at: string
}

export interface AdminPlayer {
  id: number
  name: string
  avatar: string
  grade: string
  xp_total: number
  created_at: string
  last_seen_at: string | null
  school: string | null
  has_parent: boolean
  flagged: boolean
}

export interface Lead {
  id: number
  kind: 'school' | 'parent' | 'other'
  name: string
  organisation: string | null
  phone: string
  email: string | null
  message: string | null
  status: 'new' | 'contacted' | 'closed'
  created_at: string
}

export interface FeedEvent {
  id: number
  kind: string
  detail: string
  created_at: string
  name: string
  avatar: string
  is_demo: number
}

export interface BankItem {
  id: number
  subject: string
  grade: string
  level: string
  topic: string
  prompt: string
  speak: string | null
  choices: string[]
  answer: string
  steps: string[]
  status: 'draft' | 'approved' | 'retired'
  source: string | null
  teacher: string | null
  review_note: string | null
  updated_at: string
}

export interface BankList {
  questions: BankItem[]
  counts: { draft: number; approved: number; retired: number }
  coverage: { subject: string; grade: string; count: number }[]
}
