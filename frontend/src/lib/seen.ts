// Which questions this child has already seen, so new sprints keep giving new ones.
// Each question is remembered as a short fingerprint (a 32-bit hash, about 7 characters) instead of
// its full text, so the last SEEN_LIMIT questions fit in a small storage slot of their own: weeks to
// months of daily play. (A different question sharing a fingerprint is about 1 in 200,000 per
// question: harmless, it is just treated as seen.)

const KEY = 'bsk:seen'
export const SEEN_LIMIT = 20_000

/** FNV-1a: a fast, well-spread 32-bit hash of the question's key, written in base 36. */
export function fingerprint(key: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

let order: string[] = [] // oldest first
const set = new Set<string>()
let loaded = false
let saveTimer: ReturnType<typeof setTimeout> | undefined

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) order = raw.split(',')
  } catch {
    // storage blocked: remember for this session only
  }
  for (const f of order) set.add(f)
}

function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, order.join(','))
    } catch {
      // storage full or blocked: keep going without saving
    }
  }, 300)
}

export const seenQuestions = {
  /** Has this child seen the question with this key (as made by questionKey)? */
  has(key: string): boolean {
    load()
    return set.has(fingerprint(key))
  },
  /** Remember these questions (a question seen again moves to the newest end). */
  add(keys: string[]) {
    load()
    for (const k of keys) {
      const f = fingerprint(k)
      if (set.has(f)) order.splice(order.indexOf(f), 1)
      else set.add(f)
      order.push(f)
    }
    while (order.length > SEEN_LIMIT) set.delete(order.shift()!)
    save()
  },
  get size() {
    load()
    return order.length
  },
}
