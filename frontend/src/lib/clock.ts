import { ref } from 'vue'

// One shared ticking clock (every second) for countdowns like Brain Power refills.
const now = ref(Date.now())
let started = false

export function useClock() {
  if (!started) {
    started = true
    setInterval(() => (now.value = Date.now()), 1000)
  }
  return now
}

/** 754000 → "12:34", 4000000 → "1 h 07 min" */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
