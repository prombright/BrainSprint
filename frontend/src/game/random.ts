export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 12345 → "12,345" so big numbers are easy to read. */
export const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 })

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b

/** The answer plus up to three distinct wrong choices from `wrong`, shuffled. */
export function choicesFrom(answer: string, wrong: string[], n = 3): string[] {
  const pool = shuffle([...new Set(wrong)].filter((w) => w !== answer && w !== ''))
  return shuffle([answer, ...pool.slice(0, n)])
}

/** Three wrong-but-believable numbers near the answer, plus the answer, shuffled. */
export function numberChoices(answer: number, step = 1, min = 0): string[] {
  const near = new Set<number>()
  for (let k = 1; k <= 4; k++) {
    near.add(answer + k * step)
    near.add(answer - k * step)
  }
  // a classic slip: being off by ten
  if (answer >= 10 && step === 1) {
    near.add(answer + 10)
    near.add(answer - 10)
  }
  const wrong = shuffle([...near].filter((n) => n >= min && n !== answer)).slice(0, 3)
  return shuffle([answer, ...wrong]).map(fmt)
}
