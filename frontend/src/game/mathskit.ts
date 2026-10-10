// Small helpers shared by the lower (maths.ts) and upper (maths-upper.ts) maths engines.
import type { Question } from './types.ts'
import { fmt, numberChoices } from './random.ts'

export const NAMES = ['Amina', 'Okello', 'Nakato', 'Kato', 'Achieng', 'Mugisha', 'Apio', 'Wasswa', 'Nansubuga', 'Opio', 'Akello', 'Ssemakula', 'Namata', 'Odongo', 'Kyomugisha', 'Tumusiime']

/** A question whose answer is a whole number, with nearby numbers as wrong choices. */
export function numeric(
  topic: string,
  prompt: string,
  speak: string,
  answer: number,
  extra: Partial<Question> = {},
  step = 1,
  min = 0,
): Omit<Question, 'key'> {
  return { topic, prompt, speak, answer: fmt(answer), choices: numberChoices(answer, step, min), ...extra }
}

/** "XLIV" → ["XL = 40", "IV = 4", "40 + 4 = 44"] */
export function romanSteps(n: number): string[] {
  const parts: string[] = []
  const vals: number[] = []
  for (const v of [1000, 100, 10, 1]) {
    const chunk = Math.floor((n % (v * 10)) / v) * v
    if (chunk) {
      parts.push(`${roman(chunk)} = ${chunk}`)
      vals.push(chunk)
    }
  }
  return ['Split the numeral into thousands, hundreds, tens and ones.', ...parts, vals.length > 1 ? `${vals.join(' + ')} = ${n}` : `= ${n}`]
}

export function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [v, s] of table) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}
