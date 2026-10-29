// Maths question engine, P4 to P7, following the Uganda primary syllabus and PLE topics.
// Every question carries `steps`: the worked solution a child sees after a wrong answer.
import type { Question } from './types.ts'
import type { Make, Plan } from './sprint.ts'
import { choicesFrom, fmt, gcd, lcm, pick, randInt, shuffle } from './random.ts'
import { NAMES, numeric, roman, romanSteps } from './mathskit.ts'
import { barGraph, circleDrawn, clockFace, rectangleDrawn, triangleDrawn, vennRead } from './maths-pictures.ts'

type Q = Omit<Question, 'key'>

const word = (text: string, answer: number, steps: string[], step = 1, extraSeconds = 15, min = 0): Q =>
  numeric('word problem', text, text, answer, { extraSeconds, steps }, step, min)

const frac = (n: number, d: number) => {
  const g = gcd(n, d)
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`
}

const sayFrac = (s: string) => s.replace(/(\d+)\/(\d+)/g, '$1 over $2')

/** "6/8 = 3/4 (divide top and bottom by 2)" when a fraction can be simplified */
const simplifyStep = (n: number, d: number) => {
  const g = gcd(n, d)
  return g > 1 ? [`Simplify: divide top and bottom by ${g} → ${frac(n, d)}`] : []
}

const PLACE_NAMES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands']

// ---------- numbers ----------

const placeValueBig = (digits: number): Make => () => {
  const n = randInt(10 ** (digits - 1), 10 ** digits - 1)
  const s = String(n)
  const i = randInt(0, s.length - 1)
  const d = Number(s[i])
  if (d === 0) return placeValueBig(digits)()
  const power = s.length - 1 - i
  const answer = d * 10 ** power
  const wrong = [0, 1, 2, 3, 4, 5].filter((p) => p !== power && p < digits + 1).map((p) => fmt(d * 10 ** p))
  return {
    topic: 'place value',
    prompt: `What is the value of ${d} in ${fmt(n)}?`,
    speak: `What is the value of the digit ${d} in ${fmt(n)}?`,
    answer: fmt(answer),
    choices: choicesFrom(fmt(answer), wrong),
    extraSeconds: 5,
    steps: [`Count places from the right: ones, tens, hundreds, thousands…`, `${d} is in the ${PLACE_NAMES[power]} place.`, `Value = ${d} × ${fmt(10 ** power)} = ${fmt(answer)}`],
  }
}

const rounding = (): Make => () => {
  const [to, unit] = pick([[10, 'ten'], [100, 'hundred'], [1000, 'thousand']] as const)
  const n = randInt(to * 2, to * 99) + randInt(1, to - 1)
  const answer = Math.round(n / to) * to
  const down = Math.floor(n / to) * to
  const lookAt = Math.floor((n % to) / (to / 10))
  return {
    topic: 'rounding',
    prompt: `Round ${fmt(n)} to the nearest ${unit}`,
    speak: `Round ${fmt(n)} to the nearest ${unit}.`,
    answer: fmt(answer),
    choices: choicesFrom(fmt(answer), [down, down + to, down - to, down + 2 * to, Math.round(n / (to / 10)) * (to / 10)].map(fmt)),
    extraSeconds: 5,
    steps: [
      `${fmt(n)} lies between ${fmt(down)} and ${fmt(down + to)}.`,
      `Look at the next digit to the right: ${lookAt}.`,
      lookAt >= 5 ? `${lookAt} is 5 or more, so round up → ${fmt(answer)}` : `${lookAt} is less than 5, so round down → ${fmt(answer)}`,
    ],
  }
}

const romanBig = (max: number): Make => () => {
  const n = randInt(11, max)
  const r = roman(n)
  return Math.random() < 0.5
    ? numeric('roman numerals', `${r} = ?`, `What number is the Roman numeral ${r.split('').join(' ')}?`, n, { big: r, extraSeconds: 6, steps: romanSteps(n) })
    : {
        topic: 'roman numerals',
        prompt: `Write ${fmt(n)} in Roman numerals`,
        speak: `Write ${n} in Roman numerals.`,
        answer: r,
        choices: choicesFrom(r, [n + 1, n - 1, n + 10, n - 10, n + 40, n + 9].filter((x) => x > 0).map(roman)),
        extraSeconds: 8,
        steps: [...romanSteps(n).slice(1, -1), `Join them: ${r}`],
      }
}

const addSubBig = (digits: number): Make => () => {
  const a = randInt(10 ** (digits - 1), 10 ** digits - 1)
  const b = randInt(10 ** (digits - 2), a)
  return Math.random() < 0.5
    ? numeric('adding', `${fmt(a)} + ${fmt(b)} = ?`, `What is ${a} plus ${b}?`, a + b, { extraSeconds: 8, steps: ['Line up the ones, tens, hundreds… and add from the right, carrying when a column passes 9.', `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}`] }, 10)
    : numeric('subtracting', `${fmt(a)} − ${fmt(b)} = ?`, `What is ${a} minus ${b}?`, a - b, { extraSeconds: 8, steps: ['Line up the columns and subtract from the right, borrowing when the top digit is smaller.', `${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}`, `Check: ${fmt(a - b)} + ${fmt(b)} = ${fmt(a)} ✓`] }, 10)
}

const longMul = (maxA: number, maxB: number): Make => () => {
  const a = randInt(11, maxA)
  const b = randInt(2, maxB)
  const parts = String(a).split('').reverse().map((d, i) => Number(d) * 10 ** i).filter(Boolean).reverse()
  return numeric('multiplying', `${a} × ${b} = ?`, `What is ${a} times ${b}?`, a * b, {
    extraSeconds: 8,
    steps: [`Split ${a} into ${parts.join(' + ')}`, ...parts.map((p) => `${p} × ${b} = ${fmt(p * b)}`), `Add: ${parts.map((p) => fmt(p * b)).join(' + ')} = ${fmt(a * b)}`],
  }, b)
}

const longDiv = (maxDivisor: number, maxQuotient: number): Make => () => {
  const d = randInt(2, maxDivisor)
  const q = randInt(11, maxQuotient)
  return numeric('dividing', `${fmt(d * q)} ÷ ${d} = ?`, `What is ${d * q} divided by ${d}?`, q, {
    extraSeconds: 8,
    steps: [`How many ${d}s make ${fmt(d * q)}?`, `${d} × ${q} = ${fmt(d * q)}`, `So ${fmt(d * q)} ÷ ${d} = ${q}`],
  })
}

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]
const isPrime = (n: number) => PRIMES.includes(n)
const smallestFactor = (n: number) => PRIMES.find((p) => n % p === 0) ?? n

const primePick = (): Make => () => {
  const answer = pick(PRIMES.filter((p) => p > 2))
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const n = randInt(4, 99)
    if (!isPrime(n) && n % 2 === 1) wrong.add(n) // odd non-primes are the tricky ones
  }
  return {
    topic: 'prime numbers',
    prompt: 'Which is a prime number?',
    speak: 'Which of these is a prime number?',
    answer: String(answer),
    choices: shuffle([answer, ...wrong]).map(String),
    steps: ['A prime number has exactly two factors: 1 and itself.', ...[...wrong].map((w) => `${w} = ${smallestFactor(w)} × ${w / smallestFactor(w)}, so it is not prime.`), `${answer} can only be divided by 1 and ${answer}. It is prime.`],
  }
}

const factors = (): Make => () => {
  const n = pick([12, 16, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48, 60])
  const fs = [...Array(n).keys()].map((i) => i + 1).filter((i) => n % i === 0)
  const pairs = fs.filter((f) => f * f <= n).map((f) => `${f} × ${n / f}`)
  if (Math.random() < 0.5)
    return numeric('factors', `How many factors does ${n} have?`, `How many factors does ${n} have?`, fs.length, {
      steps: [`List factor pairs of ${n}: ${pairs.join(', ')}`, `Factors: ${fs.join(', ')}`, `Count them: ${fs.length}`],
    })
  const answer = pick(fs.filter((f) => f > 1 && f < n))
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const x = randInt(2, n - 1)
    if (n % x !== 0) wrong.add(x)
  }
  return {
    topic: 'factors',
    prompt: `Which is a factor of ${n}?`,
    speak: `Which of these is a factor of ${n}?`,
    answer: String(answer),
    choices: shuffle([answer, ...wrong]).map(String),
    steps: [`A factor divides ${n} exactly, with no remainder.`, `${n} ÷ ${answer} = ${n / answer} exactly ✓`, `Factors of ${n}: ${fs.join(', ')}`],
  }
}

const multiplesList = (a: number, upTo: number) => Array.from({ length: Math.min(8, Math.ceil(upTo / a)) }, (_, i) => a * (i + 1))

const lcmHcf = (max: number): Make => () => {
  const g = randInt(2, 6)
  let a = g * randInt(2, Math.floor(max / g))
  let b = g * randInt(2, Math.floor(max / g))
  while (a === b) b = g * randInt(2, Math.floor(max / g))
  if (a > b) [a, b] = [b, a]
  const L = lcm(a, b)
  const H = gcd(a, b)
  const fa = [...Array(a).keys()].map((i) => i + 1).filter((i) => a % i === 0)
  const fb = [...Array(b).keys()].map((i) => i + 1).filter((i) => b % i === 0)
  return Math.random() < 0.5
    ? numeric('LCM', `LCM of ${a} and ${b} = ?`, `What is the lowest common multiple of ${a} and ${b}?`, L, {
        extraSeconds: 10,
        steps: [`Multiples of ${a}: ${multiplesList(a, L).join(', ')}…`, `Multiples of ${b}: ${multiplesList(b, L).join(', ')}…`, `The first one in both lists is ${L}.`],
      }, a)
    : numeric('HCF', `HCF of ${a} and ${b} = ?`, `What is the highest common factor of ${a} and ${b}?`, H, {
        extraSeconds: 10,
        steps: [`Factors of ${a}: ${fa.join(', ')}`, `Factors of ${b}: ${fb.join(', ')}`, `The biggest factor in both lists is ${H}.`],
      }, 1, 1)
}

const squares = (): Make => () => {
  const n = randInt(2, 25)
  return Math.random() < 0.5
    ? numeric('squares', `${n}² = ?`, `What is ${n} squared?`, n * n, { extraSeconds: 5, steps: [`${n}² means ${n} × ${n}`, `${n} × ${n} = ${n * n}`] }, n)
    : numeric('square roots', `√${n * n} = ?`, `What is the square root of ${n * n}?`, n, { extraSeconds: 5, steps: [`Which number times itself makes ${n * n}?`, `${n} × ${n} = ${n * n}, so √${n * n} = ${n}`] }, 1, 1)
}

const DIV_RULES: Record<number, string> = {
  3: 'A number is divisible by 3 if its digits add up to a multiple of 3.',
  4: 'A number is divisible by 4 if its last two digits make a multiple of 4.',
  6: 'A number is divisible by 6 if it is even AND its digits add up to a multiple of 3.',
  9: 'A number is divisible by 9 if its digits add up to a multiple of 9.',
}
const digitSum = (n: number) => String(n).split('').reduce((t, d) => t + Number(d), 0)

const divisibility = (): Make => () => {
  const by = pick([3, 4, 6, 9])
  const answer = by * randInt(12, 111)
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const n = randInt(100, 999)
    if (n % by !== 0) wrong.add(n)
  }
  const check = by === 4 ? `Last two digits of ${answer}: ${answer % 100}, and ${answer % 100} ÷ 4 = ${(answer % 100) / 4} ✓` : `Digits of ${answer} add up to ${String(answer).split('').join(' + ')} = ${digitSum(answer)} ✓`
  return { topic: 'divisibility', prompt: `Which number is divisible by ${by}?`, speak: `Which number can be divided by ${by} exactly?`, answer: String(answer), choices: shuffle([answer, ...wrong]).map(String), extraSeconds: 8, steps: [DIV_RULES[by], check, `${answer} ÷ ${by} = ${answer / by}`] }
}

const integers = (range: number): Make => () => {
  const a = randInt(-range, range)
  const b = randInt(-range, range)
  const sign = (n: number) => (n < 0 ? `(−${-n})` : String(n))
  const op = pick(['+', '−'])
  const answer = op === '+' ? a + b : a - b
  const show = (n: number) => (n < 0 ? `−${-n}` : String(n))
  const wrong = [answer + 1, answer - 1, -answer, op === '+' ? a - b : a + b, answer + 2].filter((n) => n !== answer).map(show)
  const rewrite = op === '−' && b < 0 ? [`Subtracting a negative is the same as adding: ${show(a)} − (−${-b}) = ${show(a)} + ${-b}`] : op === '+' && b < 0 ? [`Adding a negative is the same as subtracting: ${show(a)} + (−${-b}) = ${show(a)} − ${-b}`] : []
  return {
    topic: 'integers',
    prompt: `${show(a)} ${op} ${sign(b)} = ?`,
    speak: `What is ${a < 0 ? 'negative ' + -a : a} ${op === '+' ? 'plus' : 'minus'} ${b < 0 ? 'negative ' + -b : b}?`,
    answer: show(answer),
    choices: choicesFrom(show(answer), wrong),
    extraSeconds: 6,
    steps: [...rewrite, `Start at ${show(a)} on the number line and move ${Math.abs(answer - a)} step${Math.abs(answer - a) === 1 ? '' : 's'} ${answer >= a ? 'right' : 'left'}.`, `You land on ${show(answer)}.`],
  }
}

const bases = (): Make => () => {
  const base = pick([2, 5])
  const n = randInt(base === 2 ? 5 : 6, base === 2 ? 31 : 124)
  const s = n.toString(base)
  const name = base === 2 ? 'two' : 'five'
  if (Math.random() < 0.5) {
    const terms = s.split('').map((d, i) => ({ d: Number(d), p: base ** (s.length - 1 - i) }))
    return numeric('number bases', `Change ${s} (base ${name}) to base ten`, `Change ${s.split('').join(' ')} in base ${name} to base ten.`, n, {
      extraSeconds: 12,
      steps: [`Place values in base ${name}: ${terms.map((t) => t.p).join(', ')}`, terms.map((t) => `${t.d}×${t.p}`).join(' + '), `= ${terms.map((t) => t.d * t.p).join(' + ')} = ${n}`],
    })
  }
  const divs: string[] = []
  for (let x = n; x > 0; x = Math.floor(x / base)) divs.push(`${x} ÷ ${base} = ${Math.floor(x / base)} remainder ${x % base}`)
  const wrong = [n + 1, n - 1, n + 2, n * 2, n + base].map((x) => x.toString(base))
  return {
    topic: 'number bases',
    prompt: `Change ${n} to base ${name}`,
    speak: `Change ${n} to base ${name}.`,
    answer: s,
    choices: choicesFrom(s, wrong.filter((w) => !/^0/.test(w))),
    extraSeconds: 12,
    steps: [`Keep dividing by ${base} and write down the remainders:`, ...divs, `Read the remainders from the bottom up: ${s}`],
  }
}

const finite = (): Make => () => {
  const m = pick([5, 6, 7, 8, 9, 12])
  const a = randInt(1, m - 1)
  const b = randInt(1, m - 1)
  const op = pick(['+', '−', '×'])
  const raw = op === '+' ? a + b : op === '−' ? a - b : a * b
  const answer = ((raw % m) + m) % m
  const choices = choicesFrom(String(answer), [...Array(m).keys()].map(String))
  const work =
    raw >= m ? [`${raw} ÷ ${m} = ${Math.floor(raw / m)} remainder ${answer}`] : raw < 0 ? [`${raw} is below 0, so add ${m}: ${raw} + ${m} = ${answer}`] : [`${raw} is already less than ${m}.`]
  return {
    topic: 'finite systems',
    prompt: `In finite ${m}: ${a} ${op} ${b} = ?`,
    speak: `In finite ${m}, what is ${a} ${op === '+' ? 'plus' : op === '−' ? 'minus' : 'times'} ${b}?`,
    answer: String(answer),
    choices,
    extraSeconds: 10,
    steps: [`Finite ${m} only uses the numbers 0 to ${m - 1}.`, `${a} ${op} ${b} = ${raw}`, ...work, `Answer: ${answer}`],
  }
}

// ---------- sets ----------

const sets = (hard: boolean): Make => () => {
  const pool = shuffle([...Array(15).keys()].map((i) => i + 1))
  const a = pool.slice(0, randInt(3, 6)).sort((x, y) => x - y)
  const common = a.slice(0, randInt(1, 3))
  const b = [...common, ...pool.slice(6, 6 + randInt(1, 4))].sort((x, y) => x - y)
  const inter = a.filter((x) => b.includes(x))
  const union = [...new Set([...a, ...b])].sort((x, y) => x - y)
  const show = (s: number[]) => `{${s.join(', ')}}`
  const kind = hard ? pick(['nunion', 'inter', 'venn']) : pick(['n', 'inter'])
  if (kind === 'n')
    return numeric('sets', `A = ${show(a)}. Find n(A).`, `A is the set ${a.join(', ')}. How many members are in set A?`, a.length, { extraSeconds: 6, steps: ['n(A) means the number of members in set A.', `Count: ${a.join(', ')} → ${a.length}`] }, 1, 1)
  if (kind === 'nunion')
    return numeric('sets', `A = ${show(a)}, B = ${show(b)}. Find n(A ∪ B).`, `How many members are in A union B?`, union.length, {
      extraSeconds: 12,
      steps: ['A ∪ B means all members of A and B together, each written once.', `A ∪ B = ${show(union)}`, `Count them: ${union.length}`],
    }, 1, 1)
  if (kind === 'venn') {
    const na = randInt(10, 30)
    const nb = randInt(10, 30)
    const both = randInt(2, Math.min(na, nb) - 2)
    const text = `In a class, ${na} pupils like tea, ${nb} like porridge and ${both} like both. How many pupils are in the class? (Everyone likes at least one.)`
    return word(text, na + nb - both, [
      `Tea only: ${na} − ${both} = ${na - both}`,
      `Porridge only: ${nb} − ${both} = ${nb - both}`,
      `Total: ${na - both} + ${nb - both} + ${both} = ${na + nb - both}`,
    ], 1, 20)
  }
  const answer = show(inter)
  return {
    topic: 'sets',
    prompt: `A = ${show(a)}, B = ${show(b)}. Find A ∩ B.`,
    speak: 'Find A intersection B: the members found in both sets.',
    answer,
    choices: choicesFrom(answer, [show(union), show(a), show(b), show(inter.slice(0, -1)), show(a.filter((x) => !b.includes(x)))].filter((s) => s !== '{}')),
    extraSeconds: 12,
    steps: ['A ∩ B means the members found in BOTH sets.', `Go through A and keep those also in B: ${inter.join(', ')}`, `A ∩ B = ${answer}`],
  }
}

// ---------- fractions, decimals, percentages ----------

function fractionChoices(n: number, d: number): string[] {
  const answer = frac(n, d)
  const wrong = [frac(n + 1, d), frac(Math.max(1, n - 1), d), frac(n, d + 1), frac(d, n || 1), frac(n * 2, d), frac(n + d, d * 2)]
  return choicesFrom(answer, wrong)
}

const fracSameDen = (): Make => () => {
  const d = randInt(5, 12)
  const a = randInt(1, d - 2)
  const b = randInt(1, d - a - 1)
  const add = Math.random() < 0.6
  const [x, y] = add ? [a, b] : [a + b, b]
  const n = add ? a + b : a
  return {
    topic: 'fractions',
    prompt: `${x}/${d} ${add ? '+' : '−'} ${y}/${d} = ?`,
    speak: sayFrac(`${x}/${d} ${add ? 'plus' : 'minus'} ${y}/${d}`),
    answer: frac(n, d),
    choices: fractionChoices(n, d),
    extraSeconds: 8,
    steps: ['The bottom numbers are the same, so keep the bottom.', `${add ? 'Add' : 'Subtract'} the tops: ${x} ${add ? '+' : '−'} ${y} = ${n}`, `${n}/${d}`, ...simplifyStep(n, d)],
  }
}

const fracDiffDen = (): Make => () => {
  const [d1, d2] = pick([[2, 4], [3, 6], [2, 3], [4, 8], [3, 4], [2, 5], [5, 10], [4, 6], [6, 9]])
  const a = randInt(1, d1 - 1)
  const b = randInt(1, d2 - 1)
  const L = lcm(d1, d2)
  const add = Math.random() < 0.6 || a * (L / d1) <= b * (L / d2)
  const [x, y] = [a * (L / d1), b * (L / d2)]
  const n = add ? x + y : x - y
  const prompt = `${a}/${d1} ${add ? '+' : '−'} ${b}/${d2} = ?`
  return {
    topic: 'fractions',
    prompt,
    speak: sayFrac(prompt.replace('+', 'plus').replace('−', 'minus').replace(' = ?', '')),
    answer: frac(n, L),
    choices: fractionChoices(n, L),
    extraSeconds: 15,
    steps: [`Make the bottoms the same. LCM of ${d1} and ${d2} is ${L}.`, `${a}/${d1} = ${x}/${L} and ${b}/${d2} = ${y}/${L}`, `${x}/${L} ${add ? '+' : '−'} ${y}/${L} = ${n}/${L}`, ...simplifyStep(n, L)],
  }
}

const fracMulDiv = (): Make => () => {
  const b = randInt(2, 9), d = randInt(2, 9)
  const a = randInt(1, b - 1), c = randInt(1, d - 1) // proper fractions
  const mul = Math.random() < 0.5
  const [n, den] = mul ? [a * c, b * d] : [a * d, b * c]
  const prompt = `${a}/${b} ${mul ? '×' : '÷'} ${c}/${d} = ?`
  return {
    topic: 'fractions',
    prompt,
    speak: sayFrac(`${a}/${b} ${mul ? 'times' : 'divided by'} ${c}/${d}`),
    answer: frac(n, den),
    choices: fractionChoices(n, den),
    extraSeconds: 15,
    steps: mul
      ? ['Multiply the tops, then multiply the bottoms.', `${a} × ${c} = ${n},  ${b} × ${d} = ${den}`, `${n}/${den}`, ...simplifyStep(n, den)]
      : [`Dividing by a fraction: turn the second one upside down and multiply.`, `${a}/${b} × ${d}/${c}`, `${a} × ${d} = ${n},  ${b} × ${c} = ${den} → ${n}/${den}`, ...simplifyStep(n, den)],
  }
}

const equivalent = (): Make => () => {
  const d = randInt(2, 9)
  const n = randInt(1, d - 1)
  const k = randInt(2, 6)
  return numeric('fractions', `${n}/${d} = ☐/${d * k}`, sayFrac(`${n}/${d} equals what over ${d * k}?`), n * k, {
    extraSeconds: 8,
    steps: [`The bottom went from ${d} to ${d * k}: that is × ${k}.`, `Do the same to the top: ${n} × ${k} = ${n * k}`],
  }, 1, 1)
}

const fractionOfQty = (): Make => () => {
  const d = pick([3, 4, 5, 6, 8, 10])
  const n = randInt(1, d - 1)
  const whole = d * randInt(3, 30)
  const thing = pick(['shillings', 'kg of sugar', 'pupils', 'litres of milk'])
  const text = `What is ${n}/${d} of ${fmt(whole)} ${thing}?`
  return numeric('fractions', text, sayFrac(text), (whole / d) * n, {
    extraSeconds: 12,
    steps: [`First find 1/${d}: ${fmt(whole)} ÷ ${d} = ${fmt(whole / d)}`, `Then ${n}/${d}: ${fmt(whole / d)} × ${n} = ${fmt((whole / d) * n)}`],
  }, whole / d)
}

const mixedImproper = (): Make => () => {
  const d = randInt(2, 9)
  const w = randInt(1, 6)
  const n = randInt(1, d - 1)
  if (Math.random() < 0.5) {
    const answer = `${w * d + n}/${d}`
    return {
      topic: 'fractions',
      prompt: `Change ${w} ${n}/${d} to an improper fraction`,
      speak: sayFrac(`Change ${w} and ${n}/${d} to an improper fraction.`),
      answer,
      choices: choicesFrom(answer, [`${w * n + d}/${d}`, `${w + n}/${d}`, `${w * d}/${d}`, `${w * d + n}/${n}`, `${w * d - n}/${d}`].filter((x) => !x.endsWith('/1'))),
      extraSeconds: 10,
      steps: [`Multiply the whole number by the bottom: ${w} × ${d} = ${w * d}`, `Add the top: ${w * d} + ${n} = ${w * d + n}`, `Keep the bottom: ${answer}`],
    }
  }
  const answer = `${w} ${n}/${d}`
  return {
    topic: 'fractions',
    prompt: `Change ${w * d + n}/${d} to a mixed number`,
    speak: sayFrac(`Change ${w * d + n}/${d} to a mixed number.`),
    answer,
    choices: choicesFrom(answer, [`${w + 1} ${n}/${d}`, `${w} ${d - n}/${d}`, `${w - 1 || w + 2} ${n}/${d}`, `${n} ${w}/${d}`]),
    extraSeconds: 10,
    steps: [`Divide the top by the bottom: ${w * d + n} ÷ ${d} = ${w} remainder ${n}`, `Whole number ${w}, remainder ${n} goes over ${d}: ${answer}`],
  }
}

const fixed = (n: number, dp: number) => String(Number(n.toFixed(dp)))

const decimals = (dp: 1 | 2): Make => () => {
  const scale = 10 ** dp
  const a = randInt(scale, 50 * scale) / scale
  const b = randInt(1, a * scale) / scale
  const add = Math.random() < 0.5
  const answer = add ? a + b : a - b
  const s = fixed(answer, dp)
  const wrong = [answer + 1 / scale, answer - 1 / scale, answer + 1, answer * 10, answer + 10 / scale].filter((x) => x >= 0).map((x) => fixed(x, dp))
  return {
    topic: 'decimals',
    prompt: `${fixed(a, dp)} ${add ? '+' : '−'} ${fixed(b, dp)} = ?`,
    speak: `What is ${fixed(a, dp)} ${add ? 'plus' : 'minus'} ${fixed(b, dp)}?`,
    answer: s,
    choices: choicesFrom(s, wrong),
    extraSeconds: 10,
    steps: ['Line up the decimal points, then work as with whole numbers.', `${a.toFixed(dp)} ${add ? '+' : '−'} ${b.toFixed(dp)} = ${answer.toFixed(dp)}`, `= ${s}`],
  }
}

const fracToDecimal = (): Make => () => {
  const [n, d] = pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [1, 20], [3, 20], [1, 8], [3, 8], [9, 25], [7, 50], [1, 25]])
  const answer = fixed(n / d, 3)
  const wrong = [`${n}.${d}`, `0.${n}${d}`, fixed(d / n, 3), fixed((n / d) * 10, 3), fixed(n / d + 0.1, 3), `0.${d}`]
  const to = [10, 100, 1000].find((t) => t % d === 0)
  return {
    topic: 'decimals',
    prompt: `Write ${n}/${d} as a decimal`,
    speak: sayFrac(`Write ${n}/${d} as a decimal.`),
    answer,
    choices: choicesFrom(answer, wrong),
    extraSeconds: 10,
    steps: to ? [`Make the bottom ${to}: multiply top and bottom by ${to / d}.`, `${n}/${d} = ${(n * to) / d}/${to}`, `${(n * to) / d}/${to} = ${answer}`] : [`Divide the top by the bottom: ${n} ÷ ${d} = ${answer}`],
  }
}

const percentOf = (): Make => () => {
  const p = pick([10, 20, 25, 50, 75, 5, 15, 30, 40, 60])
  const whole = pick([20, 40, 60, 80, 100, 120, 200, 400, 500, 800, 1000, 2000, 5000, 10000])
  if ((p * whole) % 100) return percentOf()()
  return numeric('percentages', `${p}% of ${fmt(whole)} = ?`, `What is ${p} percent of ${whole}?`, (p * whole) / 100, {
    extraSeconds: 10,
    steps: [`${p}% means ${p}/100.`, `${p}/100 × ${fmt(whole)} = ${fmt(p * whole)} ÷ 100`, `= ${fmt((p * whole) / 100)}`],
  }, Math.max(1, whole / 20))
}

const toPercent = (): Make => () => {
  const [n, d] = pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [7, 10], [9, 10], [3, 20], [7, 20], [9, 25], [13, 50]])
  const answer = `${(n / d) * 100}%`
  const wrong = [`${n}${d}%`, `${(d / n) * 100}%`.replace(/\.\d+/, ''), `${(n / d) * 10}%`, `${(n / d) * 100 + 5}%`, `${(n / d) * 100 - 5}%`]
  return {
    topic: 'percentages',
    prompt: `Express ${n}/${d} as a percentage`,
    speak: sayFrac(`Express ${n}/${d} as a percentage.`),
    answer,
    choices: choicesFrom(answer, wrong),
    extraSeconds: 10,
    steps: ['Multiply the fraction by 100%.', `${n}/${d} × 100 = ${n * 100} ÷ ${d}`, `= ${answer}`],
  }
}

// ---------- ratio, money, business ----------

const ratioShare = (): Make => () => {
  const [a, b] = pick([[1, 2], [2, 3], [1, 3], [3, 4], [2, 5], [3, 5], [1, 4], [4, 5]])
  const unit = 100 * randInt(1, 40)
  const total = (a + b) * unit
  const [n1, n2] = shuffle(NAMES).slice(0, 2)
  const bigger = Math.random() < 0.5
  const share = bigger ? b : a
  const text = `${fmt(total)} shillings is shared between ${n1} and ${n2} in the ratio ${a}:${b}. How much does ${bigger ? n2 : n1} get?`
  return word(text, share * unit, [`Total parts: ${a} + ${b} = ${a + b}`, `One part: ${fmt(total)} ÷ ${a + b} = ${fmt(unit)}`, `${bigger ? n2 : n1} gets ${share} parts: ${share} × ${fmt(unit)} = ${fmt(share * unit)} shillings`], unit)
}

const proportion = (): Make => () => {
  const item = pick(['pens', 'exercise books', 'loaves of bread', 'kg of beans', 'bars of soap'])
  const price = pick([200, 300, 500, 800, 1000, 1500, 2500])
  const n1 = randInt(2, 6)
  let n2 = randInt(2, 12)
  while (n2 === n1) n2 = randInt(2, 12)
  const text = `${n1} ${item} cost ${fmt(n1 * price)} shillings. How much do ${n2} ${item} cost?`
  return word(text, n2 * price, [`Find the cost of one: ${fmt(n1 * price)} ÷ ${n1} = ${fmt(price)}`, `Cost of ${n2}: ${n2} × ${fmt(price)} = ${fmt(n2 * price)} shillings`], price)
}

const profitLoss = (): Make => () => {
  const name = pick(NAMES)
  const cost = 500 * randInt(4, 60)
  const diff = 100 * randInt(2, 40)
  const profit = Math.random() < 0.6
  const sell = profit ? cost + diff : cost - diff
  const item = pick(['a goat', 'a bicycle', 'a bag of maize', 'a radio', 'a chair'])
  const text = `${name} bought ${item} for ${fmt(cost)} shillings and sold it for ${fmt(sell)} shillings. What was the ${profit ? 'profit' : 'loss'}?`
  return word(text, diff, profit
    ? ['Sold for more than it cost, so there is a profit.', 'Profit = selling price − buying price', `${fmt(sell)} − ${fmt(cost)} = ${fmt(diff)} shillings`]
    : ['Sold for less than it cost, so there is a loss.', 'Loss = buying price − selling price', `${fmt(cost)} − ${fmt(sell)} = ${fmt(diff)} shillings`], 100)
}

const discount = (): Make => () => {
  const p = pick([5, 10, 15, 20, 25])
  const price = 1000 * randInt(4, 60)
  const item = pick(['a shirt', 'a pair of shoes', 'a school bag', 'a radio', 'a mattress'])
  const off = (price * p) / 100
  const text = `The price of ${item} is ${fmt(price)} shillings. A discount of ${p}% is given. How much is paid?`
  return word(text, price - off, [`Discount = ${p}% of ${fmt(price)} = ${p}/100 × ${fmt(price)} = ${fmt(off)}`, `Amount paid = ${fmt(price)} − ${fmt(off)} = ${fmt(price - off)} shillings`], 500)
}

const simpleInterest = (): Make => () => {
  const principal = pick([100000, 200000, 250000, 400000, 500000, 600000, 1000000])
  const rate = pick([5, 10, 12, 15, 20])
  const years = randInt(1, 4)
  const si = (principal * rate * years) / 100
  const text = `Find the simple interest on ${fmt(principal)} shillings at ${rate}% per year for ${years} year${years > 1 ? 's' : ''}.`
  return word(text, si, ['Simple interest = Principal × Rate × Time ÷ 100', `= ${fmt(principal)} × ${rate} × ${years} ÷ 100`, `= ${fmt(si)} shillings`], (principal * rate) / 100 / 2, 20, 1)
}

// ---------- measures and geometry ----------

const perimeterArea = (withTriangle: boolean): Make => () => {
  const l = randInt(3, 25)
  const w = randInt(2, l)
  const kind = pick(withTriangle ? ['rectP', 'rectA', 'sqA', 'tri'] : ['rectP', 'rectA', 'sqP', 'sqA'])
  if (kind === 'rectP') return word(`A rectangle is ${l} cm long and ${w} cm wide. Find its perimeter in cm.`, 2 * (l + w), ['Perimeter is the distance all the way round.', `P = 2 × (length + width) = 2 × (${l} + ${w})`, `= 2 × ${l + w} = ${2 * (l + w)} cm`], 2, 12)
  if (kind === 'rectA') return word(`A rectangle is ${l} cm long and ${w} cm wide. Find its area in square cm.`, l * w, ['Area of a rectangle = length × width', `= ${l} × ${w} = ${l * w} square cm`], w, 12)
  if (kind === 'sqP') return word(`Each side of a square is ${l} cm. Find its perimeter in cm.`, 4 * l, ['A square has 4 equal sides.', `P = 4 × ${l} = ${4 * l} cm`], 4, 10)
  if (kind === 'sqA') return word(`Each side of a square is ${l} cm. Find its area in square cm.`, l * l, ['Area of a square = side × side', `= ${l} × ${l} = ${l * l} square cm`], l, 10)
  const base = 2 * randInt(2, 15)
  return word(`A triangle has a base of ${base} cm and a height of ${l} cm. Find its area in square cm.`, (base * l) / 2, ['Area of a triangle = ½ × base × height', `= ½ × ${base} × ${l}`, `= ${base / 2} × ${l} = ${(base * l) / 2} square cm`], l, 12)
}

const volume = (): Make => () => {
  const l = randInt(2, 15), w = randInt(2, 10), h = randInt(2, 10)
  return word(`A box is ${l} cm long, ${w} cm wide and ${h} cm high. Find its volume in cubic cm.`, l * w * h, ['Volume = length × width × height', `= ${l} × ${w} × ${h}`, `= ${l * w} × ${h} = ${l * w * h} cubic cm`], w * h, 15)
}

const circle = (): Make => () => {
  const r = 7 * randInt(1, 4)
  return Math.random() < 0.5
    ? word(`Find the circumference of a circle of radius ${r} cm. (Use π = 22/7)`, (2 * 22 * r) / 7, ['Circumference = 2 × π × r', `= 2 × 22/7 × ${r}`, `${r} ÷ 7 = ${r / 7}, so = 2 × 22 × ${r / 7} = ${(2 * 22 * r) / 7} cm`], 22, 18)
    : word(`Find the area of a circle of radius ${r} cm in square cm. (Use π = 22/7)`, (22 * r * r) / 7, ['Area = π × r × r', `= 22/7 × ${r} × ${r}`, `${r} ÷ 7 = ${r / 7}, so = 22 × ${r / 7} × ${r} = ${(22 * r * r) / 7} square cm`], 22, 20)
}

const angles = (hard: boolean): Make => () => {
  const kind = pick(hard ? ['triangle', 'polygon', 'line', 'point'] : ['line', 'triangle', 'right'])
  if (kind === 'line') {
    const a = randInt(20, 160)
    return numeric('angles', `Angles on a straight line: ${a}° + x = 180°. Find x.`, `Angles on a straight line add up to 180 degrees. If one is ${a}, find the other.`, 180 - a, { extraSeconds: 8, steps: ['Angles on a straight line add up to 180°.', `x = 180° − ${a}° = ${180 - a}°`] }, 5)
  }
  if (kind === 'right') {
    const a = randInt(10, 80)
    return numeric('angles', `Two angles make a right angle. One is ${a}°. Find the other.`, `Two angles make a right angle. One is ${a} degrees. Find the other.`, 90 - a, { extraSeconds: 8, steps: ['A right angle is 90°.', `90° − ${a}° = ${90 - a}°`] }, 5)
  }
  if (kind === 'point') {
    const a = randInt(60, 150), b = randInt(60, 150)
    return numeric('angles', `Angles at a point: ${a}°, ${b}° and x. Find x.`, `Angles at a point add up to 360 degrees. Two are ${a} and ${b}. Find the third.`, 360 - a - b, { extraSeconds: 10, steps: ['Angles at a point add up to 360°.', `${a}° + ${b}° = ${a + b}°`, `x = 360° − ${a + b}° = ${360 - a - b}°`] }, 5)
  }
  if (kind === 'polygon') {
    const [sides, name] = pick([[5, 'pentagon'], [6, 'hexagon'], [8, 'octagon'], [4, 'quadrilateral'], [10, 'decagon']] as const)
    return numeric('angles', `Find the sum of the interior angles of a ${name}.`, `What is the sum of the interior angles of a ${name}?`, (sides - 2) * 180, { extraSeconds: 12, steps: [`A ${name} has ${sides} sides.`, 'Sum of interior angles = (sides − 2) × 180°', `(${sides} − 2) × 180° = ${sides - 2} × 180° = ${(sides - 2) * 180}°`] }, 180)
  }
  const a = randInt(30, 100), b = randInt(20, 150 - a)
  return numeric('angles', `A triangle has angles ${a}° and ${b}°. Find the third angle.`, `A triangle has angles of ${a} and ${b} degrees. Find the third angle.`, 180 - a - b, { extraSeconds: 10, steps: ['The angles in a triangle add up to 180°.', `${a}° + ${b}° = ${a + b}°`, `Third angle = 180° − ${a + b}° = ${180 - a - b}°`] }, 5)
}

const clock24 = (): Make => () => {
  const h = randInt(1, 11)
  const m = pick([0, 15, 30, 45, 5, 20, 40, 50])
  const pm = Math.random() < 0.6
  const mm = String(m).padStart(2, '0')
  const answer = `${String(pm ? h + 12 : h).padStart(2, '0')}:${mm}`
  const wrong = [`${String(pm ? h : h + 12).padStart(2, '0')}:${mm}`, `${String(pm ? h + 10 : h + 2).padStart(2, '0')}:${mm}`, `${String(pm ? h + 11 : h + 1).padStart(2, '0')}:${mm}`, `${h}:${mm}`]
  return {
    topic: 'time',
    prompt: `Write ${h}:${mm} ${pm ? 'p.m.' : 'a.m.'} in the 24-hour clock`,
    speak: `Write ${h} ${m ? m : "o'clock"} ${pm ? 'p.m.' : 'a.m.'} in the 24 hour clock.`,
    answer,
    choices: choicesFrom(answer, wrong),
    extraSeconds: 8,
    steps: pm ? ['For p.m. times, add 12 to the hours.', `${h} + 12 = ${h + 12}`, `${answer}`] : ['For a.m. times, keep the hours and write two digits.', `${answer}`],
  }
}

const duration = (): Make => () => {
  const start = randInt(6 * 12, 14 * 12) * 5 // minutes after midnight, multiples of 5
  const len = randInt(8, 7 * 12) * 5
  const end = start + len
  const t = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  const show = (x: number) => [Math.floor(x / 60) && `${Math.floor(x / 60)} h`, x % 60 && `${x % 60} min`].filter(Boolean).join(' ')
  const answer = show(len)
  const wrong = [len + 60, len - 60, len + 10, len - 10, len + 40].filter((x) => x > 0).map(show)
  const text = `A bus leaves Kampala at ${t(start)} and arrives at ${t(end)}. How long is the journey?`
  const nextHour = Math.ceil(start / 60) * 60
  const steps =
    start % 60 && end > nextHour
      ? [`From ${t(start)} to ${t(nextHour)} is ${show(nextHour - start)}.`, `From ${t(nextHour)} to ${t(end)} is ${show(end - nextHour) || '0 min'}.`, `Total: ${show(len)}`]
      : [`Count on from ${t(start)} to ${t(end)}.`, `That is ${show(len)}.`]
  return { topic: 'time', prompt: text, speak: text, answer, choices: choicesFrom(answer, wrong), extraSeconds: 15, steps }
}

const speed = (): Make => () => {
  const v = pick([40, 45, 50, 60, 70, 80, 90, 100, 120])
  const t = randInt(2, 6)
  const kind = pick(['speed', 'distance', 'time'])
  if (kind === 'speed') return word(`A car travels ${v * t} km in ${t} hours. Find its speed in km per hour.`, v, ['Speed = distance ÷ time', `= ${v * t} ÷ ${t} = ${v} km per hour`], 5)
  if (kind === 'distance') return word(`A bus moves at ${v} km per hour for ${t} hours. How far does it go in km?`, v * t, ['Distance = speed × time', `= ${v} × ${t} = ${v * t} km`], v)
  return word(`A lorry travels ${v * t} km at ${v} km per hour. How many hours does it take?`, t, ['Time = distance ÷ speed', `= ${v * t} ÷ ${v} = ${t} hours`], 1, 15, 1)
}

const conversions = (): Make => () => {
  const [from, to, factor] = pick([
    ['km', 'm', 1000], ['m', 'cm', 100], ['cm', 'mm', 10], ['kg', 'g', 1000], ['litres', 'ml', 1000], ['tonnes', 'kg', 1000], ['hours', 'minutes', 60],
  ] as const)
  const n = randInt(2, 15)
  const rule = `1 ${from.replace(/s$/, '')} = ${fmt(factor)} ${to}`
  if (Math.random() < 0.5) return numeric('measures', `${n} ${from} = ? ${to}`, `Change ${n} ${from} to ${to}.`, n * factor, { extraSeconds: 6, steps: [rule, `Big unit to small unit: multiply. ${n} × ${fmt(factor)} = ${fmt(n * factor)} ${to}`] }, factor)
  return numeric('measures', `${fmt(n * factor)} ${to} = ? ${from}`, `Change ${n * factor} ${to} to ${from}.`, n, { extraSeconds: 6, steps: [rule, `Small unit to big unit: divide. ${fmt(n * factor)} ÷ ${fmt(factor)} = ${n} ${from}`] }, 1, 1)
}

// ---------- algebra and data ----------

const algebraSimplify = (): Make => () => {
  const v = pick(['a', 'b', 'x', 'y', 'm', 'p'])
  const a = randInt(2, 12), b = randInt(1, a - 1)
  const add = Math.random() < 0.5
  const n = add ? a + b : a - b
  const show = (k: number) => (k === 1 ? v : `${k}${v}`)
  const answer = show(n)
  return {
    topic: 'algebra',
    prompt: `Simplify: ${a}${v} ${add ? '+' : '−'} ${b}${v}`,
    speak: `Simplify ${a} ${v} ${add ? 'plus' : 'minus'} ${b} ${v}.`,
    answer,
    choices: choicesFrom(answer, [show(n + 1), show(Math.abs(n - 1) || 2), `${n}${v}²`, show(add ? a - b : a + b), `${a + b}`]),
    extraSeconds: 8,
    steps: [`Think of ${v} as a thing, like a mango. ${a} mangoes ${add ? 'plus' : 'minus'} ${b} mangoes.`, `${a} ${add ? '+' : '−'} ${b} = ${n}`, `So the answer is ${answer}`],
  }
}

const solve = (twoStep: boolean, brackets: boolean): Make => () => {
  const v = pick(['x', 'y', 'm', 'k', 'n'])
  const x = randInt(1, 15)
  if (brackets) {
    const a = randInt(2, 6), b = randInt(1, 9)
    return numeric('algebra', `Solve: ${a}(${v} + ${b}) = ${a * (x + b)}`, `Solve ${a} times bracket ${v} plus ${b} equals ${a * (x + b)}.`, x, {
      extraSeconds: 15,
      steps: [`Divide both sides by ${a}: ${v} + ${b} = ${a * (x + b)} ÷ ${a} = ${x + b}`, `Take away ${b} from both sides: ${v} = ${x + b} − ${b} = ${x}`, `Check: ${a}(${x} + ${b}) = ${a} × ${x + b} = ${a * (x + b)} ✓`],
    }, 1, 1)
  }
  if (twoStep) {
    const a = randInt(2, 9), b = randInt(1, 20)
    return numeric('algebra', `Solve: ${a}${v} + ${b} = ${a * x + b}`, `Solve ${a} ${v} plus ${b} equals ${a * x + b}.`, x, {
      extraSeconds: 12,
      steps: [`Take away ${b} from both sides: ${a}${v} = ${a * x + b} − ${b} = ${a * x}`, `Divide both sides by ${a}: ${v} = ${a * x} ÷ ${a} = ${x}`, `Check: ${a} × ${x} + ${b} = ${a * x + b} ✓`],
    }, 1, 1)
  }
  const b = randInt(1, 30)
  return Math.random() < 0.5
    ? numeric('algebra', `Solve: ${v} + ${b} = ${x + b}`, `Solve ${v} plus ${b} equals ${x + b}.`, x, { extraSeconds: 8, steps: [`Take away ${b} from both sides.`, `${v} = ${x + b} − ${b} = ${x}`] }, 1, 1)
    : numeric('algebra', `Solve: ${v} − ${b} = ${x}`, `Solve ${v} minus ${b} equals ${x}.`, x + b, { extraSeconds: 8, steps: [`Add ${b} to both sides.`, `${v} = ${x} + ${b} = ${x + b}`] }, 1, 1)
}

const substitution = (): Make => () => {
  const a = randInt(1, 9), b = randInt(1, 9)
  const [p, q] = [randInt(2, 6), randInt(2, 5)]
  const options: [string, number, string][] = [
    [`${p}a + ${q}b`, p * a + q * b, `${p} × ${a} + ${q} × ${b} = ${p * a} + ${q * b}`],
    [`${p}a − b`, p * a - b, `${p} × ${a} − ${b} = ${p * a} − ${b}`],
    [`ab + ${q}`, a * b + q, `${a} × ${b} + ${q} = ${a * b} + ${q}`],
    [`${p}(a + b)`, p * (a + b), `${p} × (${a} + ${b}) = ${p} × ${a + b}`],
  ]
  const [expr, value, work] = pick(options)
  if (value < 0) return substitution()() // keep answers positive at primary level
  return numeric('algebra', `If a = ${a} and b = ${b}, find ${expr}`, `If a is ${a} and b is ${b}, find ${expr.replace('−', 'minus')}.`, value, {
    extraSeconds: 12,
    steps: [`Put ${a} in place of a and ${b} in place of b.`, work, `= ${value}`],
  })
}

const mean = (withMissing: boolean): Make => () => {
  const n = randInt(3, 5)
  const avg = randInt(5, 60)
  const nums = Array.from({ length: n - 1 }, () => randInt(Math.max(1, avg - 15), avg + 15))
  const known = nums.reduce((t, x) => t + x, 0)
  const last = avg * n - known
  if (last <= 0) return mean(withMissing)()
  const all = shuffle([...nums, last])
  if (withMissing) {
    const text = `The mean of ${n} numbers is ${avg}. ${n - 1} of them are ${nums.join(', ')}. Find the last number.`
    return word(text, last, [`Total of all ${n} numbers = mean × count = ${avg} × ${n} = ${avg * n}`, `Total of the ones we know: ${nums.join(' + ')} = ${known}`, `Missing number = ${avg * n} − ${known} = ${last}`], 1, 20, 1)
  }
  return numeric('mean', `Find the mean of ${all.join(', ')}`, `Find the mean, or average, of ${all.join(', ')}.`, avg, {
    extraSeconds: 15,
    steps: ['Mean = total ÷ how many numbers', `Total: ${all.join(' + ')} = ${avg * n}`, `${avg * n} ÷ ${n} = ${avg}`],
  }, 1, 1)
}

// ---------- thinking questions: logic and reasoning, not just calculation ----------

const pattern = (hard: boolean): Make => () => {
  const kind = pick(hard ? ['times', 'squares', 'growing', 'fib', 'minus'] : ['plus', 'minus', 'times'])
  let seq: number[] = []
  let rule = ''
  if (kind === 'plus') {
    const s = randInt(1, 30), d = randInt(2, 12)
    seq = Array.from({ length: 5 }, (_, i) => s + d * i)
    rule = `Each number is ${d} more than the one before.`
  } else if (kind === 'minus') {
    const d = randInt(2, 15), s = d * 5 + randInt(5, 60)
    seq = Array.from({ length: 5 }, (_, i) => s - d * i)
    rule = `Each number is ${d} less than the one before.`
  } else if (kind === 'times') {
    const r = pick([2, 3, 4]), s = randInt(1, 5)
    seq = Array.from({ length: 5 }, (_, i) => s * r ** i)
    rule = `Each number is ${r} times the one before.`
  } else if (kind === 'squares') {
    const s = randInt(1, 6)
    seq = Array.from({ length: 5 }, (_, i) => (s + i) ** 2)
    rule = `These are square numbers: ${s}², ${s + 1}², ${s + 2}², ${s + 3}²…`
  } else if (kind === 'growing') {
    const s = randInt(1, 10), d = randInt(1, 4)
    seq = [s]
    for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + d * i)
    rule = `The gaps grow: +${d}, +${2 * d}, +${3 * d}, then +${4 * d}.`
  } else {
    seq = [randInt(1, 5), randInt(1, 6)]
    for (let i = 2; i < 5; i++) seq.push(seq[i - 1] + seq[i - 2])
    rule = 'Each number is the sum of the two before it.'
  }
  const answer = seq[4]
  const shown = seq.slice(0, 4)
  return numeric('patterns', 'What number comes next?', `Find the pattern. ${shown.join(', ')}, what comes next?`, answer, {
    big: `${shown.join(', ')}, ☐`,
    extraSeconds: 12,
    steps: [rule, `The next number is ${answer}.`],
  }, Math.max(1, Math.round((answer - shown[3]) / 3)))
}

const thinkOfNumber = (): Make => () => {
  const x = randInt(2, 20), m = randInt(2, 9), a = randInt(1, 30)
  const name = pick(NAMES)
  const text = `${name} thinks of a number, multiplies it by ${m} and then adds ${a}. The answer is ${m * x + a}. What was the number?`
  return word(text, x, ['Work backwards, undoing each step.', `Undo "add ${a}": ${m * x + a} − ${a} = ${m * x}`, `Undo "multiply by ${m}": ${m * x} ÷ ${m} = ${x}`], 1, 20, 1)
}

const ages = (): Make => () => {
  const young = randInt(3, 15), times = randInt(2, 5)
  const [a, b] = shuffle(NAMES).slice(0, 2)
  const total = young * (times + 1)
  const askOld = Math.random() < 0.5
  const text = `${a} is ${times} times as old as ${b}. Together their ages add up to ${total}. How old is ${askOld ? a : b}?`
  return word(text, askOld ? young * times : young, [
    `Let ${b}'s age be 1 part. Then ${a}'s age is ${times} parts.`,
    `Together: 1 + ${times} = ${times + 1} parts = ${total} years`,
    `1 part = ${total} ÷ ${times + 1} = ${young}`,
    askOld ? `${a} = ${times} × ${young} = ${young * times} years` : `${b} = ${young} years`,
  ], 1, 25, 1)
}

const headsLegs = (): Make => () => {
  const goats = randInt(2, 15), hens = randInt(2, 15)
  const heads = goats + hens, legs = 4 * goats + 2 * hens
  const text = `A farmer has hens and goats. They have ${heads} heads and ${legs} legs altogether. How many goats are there?`
  return word(text, goats, [
    `Pretend all ${heads} animals are hens: ${heads} × 2 = ${2 * heads} legs.`,
    `There are really ${legs} legs: ${legs} − ${2 * heads} = ${legs - 2 * heads} extra legs.`,
    `Each goat has 2 more legs than a hen: ${legs - 2 * heads} ÷ 2 = ${goats} goat${goats === 1 ? '' : 's'}.`,
  ], 1, 30, 1)
}

const consecutive = (): Make => () => {
  const mid = randInt(5, 60)
  const ask = pick(['smallest', 'largest'])
  const text = `The sum of three consecutive numbers is ${3 * mid}. What is the ${ask} number?`
  return word(text, ask === 'smallest' ? mid - 1 : mid + 1, [
    'Consecutive numbers follow each other, like 7, 8, 9.',
    `The middle one is the sum ÷ 3: ${3 * mid} ÷ 3 = ${mid}`,
    `The numbers are ${mid - 1}, ${mid}, ${mid + 1}. The ${ask} is ${ask === 'smallest' ? mid - 1 : mid + 1}.`,
  ], 1, 20, 1)
}

const handshakes = (): Make => () => {
  const n = randInt(4, 12)
  const text = `${n} pupils meet and each one shakes hands once with every other pupil. How many handshakes are there?`
  return word(text, (n * (n - 1)) / 2, [
    `Each pupil shakes ${n - 1} hands: ${n} × ${n - 1} = ${n * (n - 1)}`,
    'But that counts every handshake twice (A with B and B with A).',
    `${n * (n - 1)} ÷ 2 = ${(n * (n - 1)) / 2} handshakes`,
  ], 1, 25, 1)
}

const digitPuzzle = (): Make => () => {
  const ones = randInt(1, 4), k = pick([2, 3, 4].filter((m) => ones * m <= 9))
  const tens = ones * k
  const text = `I am a two-digit number. My tens digit is ${k} times my ones digit, and my digits add up to ${tens + ones}. What number am I?`
  return word(text, tens * 10 + ones, [
    `Let the ones digit be 1 part; the tens digit is ${k} parts.`,
    `${k} + 1 = ${k + 1} parts = ${tens + ones}, so 1 part = ${ones}.`,
    `Ones digit ${ones}, tens digit ${tens}: the number is ${tens * 10 + ones}.`,
  ], 1, 25, 10)
}

const coins = (): Make => () => {
  const big = randInt(1, 10), small = randInt(1, 10)
  const [bv, sv] = pick([[500, 200], [500, 100], [1000, 500], [200, 100]])
  const total = big * bv + small * sv
  const name = pick(NAMES)
  const text = `${name} has ${big + small} coins of ${bv} and ${sv} shillings, worth ${fmt(total)} shillings in total. How many ${bv}-shilling coins are there?`
  return word(text, big, [
    `Pretend all ${big + small} coins are ${sv} shillings: ${big + small} × ${sv} = ${fmt((big + small) * sv)}.`,
    `Missing: ${fmt(total)} − ${fmt((big + small) * sv)} = ${fmt(total - (big + small) * sv)}.`,
    `Each ${bv} coin is worth ${bv - sv} more: ${fmt(total - (big + small) * sv)} ÷ ${bv - sv} = ${big} coin${big === 1 ? '' : 's'}.`,
  ], 1, 30, 1)
}

// ---------- what each class + level practises ----------

// word problems on a syllabus topic are filed under that topic (so reports show "area and perimeter",
// not "word problem"); puzzles like heads-and-legs stay as word problems
const topic = (name: string, make: Make): Make => () => ({ ...make(), topic: name })

export const UPPER_MATHS_PLAN: Plan = {
  P4: {
    simple: [addSubBig(4), placeValueBig(4), romanBig(50), conversions(), pattern(false), barGraph(false)],
    medium: [longMul(99, 9), longDiv(9, 99), rounding(), sets(false), fracSameDen(), rectangleDrawn('both', 15)],
    hard: [equivalent(), topic('area and perimeter', perimeterArea(false)), clock24(), romanBig(100), primePick(), pattern(false), vennRead(false)],
    pro: [fractionOfQty(), topic('profit and loss', profitLoss()), angles(false), mean(false), topic('proportion', proportion()), thinkOfNumber(), clockFace('five'), barGraph(false)],
  },
  P5: {
    simple: [addSubBig(5), placeValueBig(5), longMul(999, 9), conversions(), factors()],
    medium: [lcmHcf(30), fracDiffDen(), decimals(1), mixedImproper(), sets(false), pattern(false), vennRead(false)],
    hard: [topic('area and perimeter', perimeterArea(true)), fracToDecimal(), integers(10), angles(false), clock24(), romanBig(500), thinkOfNumber(), triangleDrawn(), rectangleDrawn('area', 20)],
    pro: [percentOf(), duration(), topic('profit and loss', profitLoss()), mean(false), fractionOfQty(), algebraSimplify(), pattern(true), consecutive(), barGraph(true)],
  },
  P6: {
    simple: [squares(), divisibility(), lcmHcf(48), decimals(2), integers(20)],
    medium: [fracMulDiv(), toPercent(), solve(false, false), bases(), finite(), algebraSimplify(), pattern(true), barGraph(true)],
    hard: [topic('ratio', ratioShare()), topic('speed distance and time', speed()), topic('volume', volume()), sets(true), angles(true), substitution(), headsLegs(), ages(), vennRead(true)],
    pro: [topic('discount', discount()), solve(true, false), mean(true), duration(), romanBig(2000), bases(), handshakes(), digitPuzzle(), coins(), triangleDrawn()],
  },
  P7: {
    simple: [squares(), fracMulDiv(), percentOf(), integers(30), lcmHcf(60), bases(), barGraph(true)],
    medium: [solve(true, false), topic('ratio', ratioShare()), topic('proportion', proportion()), finite(), substitution(), sets(true), pattern(true), vennRead(true)],
    hard: [topic('circles', circle()), topic('volume', volume()), topic('speed distance and time', speed()), angles(true), topic('discount', discount()), mean(true), headsLegs(), ages(), consecutive(), circleDrawn()],
    pro: [topic('simple interest', simpleInterest()), solve(true, true), topic('circles', circle()), sets(true), topic('profit and loss', profitLoss()), fracDiffDen(), duration(), handshakes(), digitPuzzle(), coins(), thinkOfNumber(), circleDrawn(), vennRead(true)],
  },
}
