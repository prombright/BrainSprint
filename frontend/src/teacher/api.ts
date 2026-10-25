// Teacher portal API calls. The sign-in is kept on this computer for 30 days.
const BASE = import.meta.env.VITE_API_URL ?? '/brainsprint/api'
const KEY = 'bsk:teacher'

export const session = {
  get: () => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(KEY, t)
      else localStorage.removeItem(KEY)
    } catch {
      /* blocked: sign-in lasts for this page only */
    }
  },
}

export class TeacherError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function teacherCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = session.get()
  if (t) headers.Authorization = `Bearer ${t}`
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => {
    throw new TeacherError('Cannot reach the server. Check the internet connection.', 0)
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new TeacherError(data.error ?? `Error ${r.status}`, r.status)
  return data as T
}

export interface Teacher {
  id: number
  name: string
  phone: string
  school: string | null
}

export interface ClassSummary {
  id: number
  name: string
  grade: string
  code: string
  pupils: number
}

export interface ClassDetail {
  class: { id: number; name: string; grade: string; code: string }
  pupils: { id: number; name: string; avatar: string; xp_total: number; last_played_at: string | null; week_sprints: number; week_accuracy: number | null; weak: string[]; mock_readiness: number | null }[]
  topics: { subject: string; topic: string; pupils: number; mastery: number; struggling: number }[]
  assignments: { id: number; title: string; subject: string; level: string | null; topic: string | null; due_on: string; results: Record<string, { correct: number; total: number }> }[]
}
