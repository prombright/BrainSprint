// Downloads approved question-bank questions (Science, SST, English P4–P7 …) and keeps them on the
// device, so those subjects work offline too. Refreshed in the background when the app opens.
import { ref } from 'vue'
import type { Grade, Subject } from '../game/types'
import { registerBank, type BankQuestion } from '../game/sprint'

const BASE = import.meta.env.VITE_API_URL ?? '/brainsprint/api'
const key = (subject: string, grade: string) => `bsk:bank:${subject}:${grade}`

/** Bumped whenever a bank arrives, so screens that list subjects/levels recompute. */
export const bankVersion = ref(0)

function read<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null')
  } catch {
    return null
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    // storage full or blocked: the bank lasts for this session only
  }
}

/** Load whatever this class has saved on the device (instant, offline). */
export function loadSavedBanks(grade: Grade) {
  for (const subject of ['english', 'science', 'sst'] as Subject[]) {
    const saved = read<{ version: string; questions: BankQuestion[] }>(key(subject, grade))
    if (saved) registerBank(subject, grade, saved.questions)
  }
  bankVersion.value++
}

/** Ask the server which subjects have questions for this class, and fetch any that changed. */
export async function refreshBanks(grade: Grade) {
  try {
    const r = await fetch(`${BASE}/questions/coverage`)
    if (!r.ok) return
    const { coverage } = (await r.json()) as { coverage: { subject: Subject; grade: Grade; count: number }[] }
    const mine = new Set(coverage.filter((c) => c.grade === grade).map((c) => c.subject))
    for (const subject of ['english', 'science', 'sst'] as Subject[]) {
      if (!mine.has(subject)) {
        // nothing approved any more (all retired): forget the saved copy
        if (read(key(subject, grade))) {
          registerBank(subject, grade, [])
          try {
            localStorage.removeItem(key(subject, grade))
          } catch {
            /* ignore */
          }
        }
        continue
      }
      const saved = read<{ version: string }>(key(subject, grade))
      const res = await fetch(`${BASE}/questions?subject=${subject}&grade=${grade}`)
      if (!res.ok) continue
      const bank = (await res.json()) as { version: string; questions: BankQuestion[] }
      if (bank.version === saved?.version) continue
      write(key(subject, grade), bank)
      registerBank(subject, grade, bank.questions)
    }
    bankVersion.value++
  } catch {
    // offline: keep the saved copies
  }
}
