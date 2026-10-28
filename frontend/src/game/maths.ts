// Maths question engine, Top Class to P3. Every question is built from a template
// with random numbers, so a child never runs out of fresh questions.
// P4–P7 live in maths-upper.ts.
import type { Make, Plan } from './sprint.ts'
import { choicesFrom, fmt, numberChoices, pick, randInt, shuffle } from './random.ts'
import { NAMES, numeric, roman, romanSteps } from './mathskit.ts'
import { UPPER_MATHS_PLAN } from './maths-upper.ts'

const THINGS = [
  { emoji: '🥭', one: 'mango', many: 'mangoes' },
  { emoji: '🍌', one: 'banana', many: 'bananas' },
  { emoji: '⚽', one: 'ball', many: 'balls' },
  { emoji: '🐔', one: 'chicken', many: 'chickens' },
  { emoji: '⭐', one: 'star', many: 'stars' },
  { emoji: '🍊', one: 'orange', many: 'oranges' },
  { emoji: '🐐', one: 'goat', many: 'goats' },
  { emoji: '✏️', one: 'pencil', many: 'pencils' },
  { emoji: '🍎', one: 'apple', many: 'apples' },
  { emoji: '🐟', one: 'fish', many: 'fish' },
  { emoji: '🌸', one: 'flower', many: 'flowers' },
  { emoji: '🚗', one: 'car', many: 'cars' },
  { emoji: '🐄', one: 'cow', many: 'cows' },
  { emoji: '🥚', one: 'egg', many: 'eggs' },
  { emoji: '🐝', one: 'bee', many: 'bees' },
  { emoji: '🎈', one: 'balloon', many: 'balloons' },
  { emoji: '🐑', one: 'sheep', many: 'sheep' },
  { emoji: '🍉', one: 'watermelon', many: 'watermelons' },
  { emoji: '🦋', one: 'butterfly', many: 'butterflies' },
  { emoji: '📘', one: 'book', many: 'books' },
  { emoji: '🐶', one: 'dog', many: 'dogs' },
  { emoji: '🐱', one: 'cat', many: 'cats' },
  { emoji: '🐰', one: 'rabbit', many: 'rabbits' },
  { emoji: '🐸', one: 'frog', many: 'frogs' },
  { emoji: '🦆', one: 'duck', many: 'ducks' },
  { emoji: '🐷', one: 'pig', many: 'pigs' },
  { emoji: '🐴', one: 'horse', many: 'horses' },
  { emoji: '🐘', one: 'elephant', many: 'elephants' },
  { emoji: '🐒', one: 'monkey', many: 'monkeys' },
  { emoji: '🐢', one: 'tortoise', many: 'tortoises' },
  { emoji: '🐜', one: 'ant', many: 'ants' },
  { emoji: '🍍', one: 'pineapple', many: 'pineapples' },
  { emoji: '🥑', one: 'avocado', many: 'avocados' },
  { emoji: '🌽', one: 'maize cob', many: 'maize cobs' },
  { emoji: '🥕', one: 'carrot', many: 'carrots' },
  { emoji: '🍅', one: 'tomato', many: 'tomatoes' },
  { emoji: '🍋', one: 'lemon', many: 'lemons' },
  { emoji: '🚌', one: 'bus', many: 'buses' },
  { emoji: '🚲', one: 'bicycle', many: 'bicycles' },
  { emoji: '🌳', one: 'tree', many: 'trees' },
  { emoji: '🏠', one: 'house', many: 'houses' },
  { emoji: '🔑', one: 'key', many: 'keys' },
  { emoji: '👟', one: 'shoe', many: 'shoes' },
  { emoji: '☂️', one: 'umbrella', many: 'umbrellas' },
  { emoji: '🥁', one: 'drum', many: 'drums' },
  { emoji: '🔔', one: 'bell', many: 'bells' },
  { emoji: '🍬', one: 'sweet', many: 'sweets' },
  { emoji: '📏', one: 'ruler', many: 'rulers' },
]

// ---------- templates ----------

const count = (min: number, max: number): Make => () => {
  const t = pick(THINGS)
  const n = randInt(min, max)
  return {
    topic: 'counting',
    prompt: `How many ${t.many}?`,
    speak: `Count the ${t.many}. How many ${t.many} are there?`,
    visual: t.emoji.repeat(n),
    answer: String(n),
    choices: numberChoices(n, 1, 1),
  }
}

const pictureAdd = (maxA: number, maxB: number): Make => () => {
  const t = pick(THINGS)
  const a = randInt(1, maxA)
  const b = randInt(1, maxB)
  return numeric('adding', `${a} + ${b} = ?`, `${a} ${a === 1 ? t.one : t.many} and ${b} more. How many altogether?`, a + b, {
    visual: `${t.emoji.repeat(a)} ➕ ${t.emoji.repeat(b)}`,
  })
}

const pictureTakeAway = (max: number): Make => () => {
  const t = pick(THINGS)
  const a = randInt(2, max)
  const b = randInt(1, a - 1)
  return numeric('taking away', `${a} − ${b} = ?`, `There are ${a} ${t.many}. Take away ${b}. How many are left?`, a - b, {
    visual: t.emoji.repeat(a),
  })
}

const numberNext = (max: number, step = 1): Make => () => {
  const after = Math.random() < 0.6
  const n = randInt(step, max - step)
  const seq = after ? [n - step, n, '☐'] : ['☐', n, n + step]
  const answer = after ? n + step : n - step
  return numeric(
    'number order',
    after ? 'What number comes next?' : 'What number comes before?',
    after ? `${n - step}, ${n}, what comes next?` : `What number comes just before ${n}?`,
    answer,
    { big: seq.join('  ') },
  )
}

const skipCount = (steps: number[], maxStart: number): Make => () => {
  const s = pick(steps)
  const start = s * randInt(0, maxStart)
  const seq = [start, start + s, start + 2 * s]
  return numeric('skip counting', 'What number comes next?', `Count in ${s}s. ${seq.join(', ')}, what comes next?`, start + 3 * s, { big: `${seq.join(', ')}, ☐` }, s)
}

// "Tap the number 7": read aloud; nursery sees it big and matches the shape
const tapNumber = (max: number, showBig: boolean): Make => () => {
  const n = randInt(0, max)
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const x = randInt(0, max)
    if (x !== n) wrong.add(x)
  }
  return {
    topic: 'numbers',
    prompt: showBig ? 'Tap the same number' : `Tap the number ${n}`,
    speak: `Tap the number ${n}.`,
    big: showBig ? String(n) : undefined,
    answer: String(n),
    choices: shuffle([n, ...wrong]).map(String),
  }
}

// "Tap the group with 4 mangoes": the choices are pictures
const pickGroup = (max: number): Make => () => {
  const t = pick(THINGS)
  const n = randInt(1, max)
  const sizes = new Set<number>([n])
  while (sizes.size < 4) sizes.add(randInt(1, max))
  return {
    topic: 'counting',
    prompt: `Tap the group with ${n} ${n === 1 ? t.one : t.many}`,
    speak: `Tap the group with ${n} ${n === 1 ? t.one : t.many}.`,
    answer: t.emoji.repeat(n),
    choices: shuffle([...sizes]).map((k) => t.emoji.repeat(k)),
  }
}

const bigger = (max: number): Make => () => {
  const a = randInt(0, max)
  let b = randInt(0, max)
  while (b === a) b = randInt(0, max)
  const big = Math.random() < 0.6
  const answer = big ? Math.max(a, b) : Math.min(a, b)
  const w = big ? 'bigger' : 'smaller'
  return { topic: 'comparing', prompt: `Which number is ${w}?`, speak: `${a} or ${b}. Which number is ${w}?`, answer: String(answer), choices: [String(a), String(b)] }
}

const tensOnes = (): Make => () => {
  const tens = randInt(1, 9)
  const ones = randInt(0, 9)
  const n = tens * 10 + ones
  return Math.random() < 0.5
    ? numeric('tens and ones', `${n} = ☐ tens and ${ones} ones`, `${n} is how many tens and ${ones} ones?`, tens)
    : numeric('tens and ones', `${tens} tens and ${ones} ones = ?`, `What number is ${tens} tens and ${ones} ones?`, n)
}

const add = (maxA: number, maxB: number, minA = 1): Make => () => {
  const a = randInt(minA, maxA)
  const b = randInt(1, maxB)
  return numeric('adding', `${fmt(a)} + ${fmt(b)} = ?`, `What is ${a} plus ${b}?`, a + b)
}

const sub = (max: number, min = 2): Make => () => {
  const a = randInt(min, max)
  const b = randInt(1, a)
  return numeric('subtracting', `${fmt(a)} − ${fmt(b)} = ?`, `What is ${a} minus ${b}?`, a - b)
}

const mul = (tables: number[], maxFactor: number): Make => () => {
  const t = pick(tables)
  const f = randInt(1, maxFactor)
  const [a, b] = Math.random() < 0.5 ? [t, f] : [f, t]
  return numeric('multiplying', `${a} × ${b} = ?`, `What is ${a} times ${b}?`, a * b, {}, t)
}

const div = (divisors: number[], maxQuotient: number): Make => () => {
  const d = pick(divisors)
  const q = randInt(1, maxQuotient)
  return numeric('dividing', `${d * q} ÷ ${d} = ?`, `What is ${d * q} divided by ${d}?`, q)
}

const compare = (max: number): Make => () => {
  const nums = new Set<number>()
  while (nums.size < 4) nums.add(randInt(0, max))
  const list = [...nums]
  const biggest = Math.random() < 0.6
  const answer = biggest ? Math.max(...list) : Math.min(...list)
  const word = biggest ? 'biggest' : 'smallest'
  return {
    topic: 'comparing',
    prompt: `Which number is the ${word}?`,
    speak: `Which number is the ${word}?`,
    answer: fmt(answer),
    choices: shuffle(list).map(fmt),
  }
}

const oddEven = (max: number): Make => () => {
  const even = Math.random() < 0.5
  const want = (n: number) => (n % 2 === 0) === even
  let answer = randInt(1, max)
  while (!want(answer)) answer = randInt(1, max)
  const wrong = new Set<number>()
  while (wrong.size < 3) {
    const n = randInt(1, max)
    if (!want(n)) wrong.add(n)
  }
  const word = even ? 'even' : 'odd'
  return { topic: 'odd and even', prompt: `Which number is ${word}?`, speak: `Which number is ${word}?`, answer: String(answer), choices: shuffle([answer, ...wrong]).map(String) }
}

const missingAdd = (max: number): Make => () => {
  const a = randInt(1, max - 1)
  const b = randInt(1, max - a)
  return numeric('missing number', `${a} + ☐ = ${a + b}`, `${a} plus what number makes ${a + b}?`, b, {
    steps: [`To find the missing number, take away: ${a + b} − ${a}`, `${a + b} − ${a} = ${b}`, `Check: ${a} + ${b} = ${a + b} ✓`],
  })
}

const missingSub = (max: number): Make => () => {
  const a = randInt(5, max)
  const b = randInt(1, a - 1)
  return numeric('missing number', `${a} − ☐ = ${a - b}`, `${a} minus what number leaves ${a - b}?`, b, {
    steps: [`What was taken away? Subtract: ${a} − ${a - b}`, `${a} − ${a - b} = ${b}`, `Check: ${a} − ${b} = ${a - b} ✓`],
  })
}

const missingMul = (tables: number[]): Make => () => {
  const t = pick(tables)
  const f = randInt(2, 12)
  return numeric('missing number', `☐ × ${t} = ${t * f}`, `What number times ${t} makes ${t * f}?`, f, {
    steps: [`To find the missing number, divide: ${t * f} ÷ ${t}`, `${t * f} ÷ ${t} = ${f}`, `Check: ${f} × ${t} = ${t * f} ✓`],
  })
}

const wordAdd = (max: number): Make => () => {
  const t = pick(THINGS)
  const name = pick(NAMES)
  const a = randInt(2, Math.floor(max / 2))
  const b = randInt(2, Math.floor(max / 2))
  const text = pick([
    `${name} has ${a} ${t.many} and gets ${b} more. How many ${t.many} does ${name} have now?`,
    `There are ${a} ${t.many} in one box and ${b} in another. How many ${t.many} altogether?`,
    `${name} counted ${a} ${t.many} in the morning and ${b} in the evening. How many in total?`,
  ])
  return numeric('word problem', text, text, a + b, { visual: t.emoji, extraSeconds: 10, steps: [`"More", "altogether" and "in total" mean we add.`, `${a} + ${b} = ${a + b}`] })
}

const wordSub = (max: number): Make => () => {
  const t = pick(THINGS)
  const name = pick(NAMES)
  const a = randInt(5, max)
  const b = randInt(1, a - 1)
  const text = pick([
    `${name} had ${a} ${t.many} and gave away ${b}. How many ${t.many} are left?`,
    `There were ${a} ${t.many}. ${b} were sold at the market. How many are left?`,
    `${name} has ${a} ${t.many}. A friend has ${b}. How many more does ${name} have?`,
  ])
  return numeric('word problem', text, text, a - b, { visual: t.emoji, extraSeconds: 10, steps: [`"Left" and "how many more" mean we subtract.`, `${a} − ${b} = ${a - b}`] })
}

const wordMul = (tables: number[]): Make => () => {
  const t = pick(THINGS)
  const bags = randInt(2, 9)
  const each = pick(tables)
  const box = pick(['baskets', 'bags', 'boxes', 'trays'])
  const text = `There are ${bags} ${box} with ${each} ${t.many} in each. How many ${t.many} altogether?`
  return numeric('word problem', text, text, bags * each, { visual: '🧺'.repeat(Math.min(bags, 6)), extraSeconds: 10, steps: [`${bags} groups of ${each} means we multiply.`, `${bags} × ${each} = ${bags * each}`] }, each)
}

const wordShare = (divisors: number[]): Make => () => {
  const t = pick(THINGS)
  const kids = pick(divisors)
  const each = randInt(2, 10)
  const text = `${kids * each} ${t.many} are shared equally among ${kids} children. How many does each child get?`
  return numeric('word problem', text, text, each, { visual: t.emoji, extraSeconds: 10, steps: [`"Shared equally" means we divide.`, `${kids * each} ÷ ${kids} = ${each}`, `Check: ${kids} × ${each} = ${kids * each} ✓`] })
}

const ITEMS = [
  { one: 'pencil', many: 'pencils', emoji: '✏️' },
  { one: 'book', many: 'books', emoji: '📘' },
  { one: 'mandazi', many: 'mandazi', emoji: '🍩' },
  { one: 'sweet', many: 'sweets', emoji: '🍬' },
  { one: 'egg', many: 'eggs', emoji: '🥚' },
  { one: 'ruler', many: 'rulers', emoji: '📏' },
]

const money = (prices: number[], maxQty: number): Make => () => {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const price = pick(prices)
  const qty = randInt(2, maxQty)
  const text = `One ${item.one} costs ${fmt(price)} shillings. ${name} buys ${qty} ${item.many}. How much does ${name} pay?`
  return numeric('money', text, text, price * qty, { visual: item.emoji.repeat(qty), extraSeconds: 12, steps: [`Cost of one × number bought`, `${fmt(price)} × ${qty} = ${fmt(price * qty)} shillings`] }, price)
}

const change = (notes: number[]): Make => () => {
  const name = pick(NAMES)
  const item = pick(ITEMS)
  const paid = pick(notes)
  const cost = 100 * randInt(1, paid / 100 - 1)
  const text = `${name} buys a ${item.one} for ${fmt(cost)} shillings and pays with ${fmt(paid)} shillings. What is the change?`
  return numeric('money', text, text, paid - cost, { visual: item.emoji, extraSeconds: 12, steps: [`Change = money paid − cost`, `${fmt(paid)} − ${fmt(cost)} = ${fmt(paid - cost)} shillings`] }, 100)
}

const placeValue = (): Make => () => {
  const n = randInt(100, 999)
  const places = [
    { name: 'hundreds', digit: Math.floor(n / 100) },
    { name: 'tens', digit: Math.floor(n / 10) % 10 },
    { name: 'ones', digit: n % 10 },
  ]
  const p = pick(places)
  return {
    topic: 'place value',
    prompt: `In ${n}, which digit is in the ${p.name} place?`,
    speak: `In the number ${n}, which digit is in the ${p.name} place?`,
    answer: String(p.digit),
    choices: choicesFrom(String(p.digit), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(String)),
    extraSeconds: 5,
  }
}

const fractionOf = (parts: (2 | 3 | 4)[], maxWhole: number): Make => () => {
  const part = pick(parts)
  const word = { 2: 'Half', 3: 'A third', 4: 'A quarter' }[part]
  const n = part * randInt(1, Math.floor(maxWhole / part))
  return numeric('fractions', `${word} of ${n} = ?`, `What is ${word.toLowerCase()} of ${n}?`, n / part, {
    steps: [`${word} means share into ${part} equal parts.`, `${n} ÷ ${part} = ${n / part}`],
  })
}

const mixed = (): Make => () => {
  const a = randInt(2, 12)
  const b = randInt(2, 9)
  const c = randInt(1, 30)
  return Math.random() < 0.5
    ? numeric('mixed', `${a} × ${b} + ${c} = ?`, `What is ${a} times ${b}, plus ${c}?`, a * b + c, {
        extraSeconds: 5,
        steps: ['Multiply first, then add (BODMAS).', `${a} × ${b} = ${a * b}`, `${a * b} + ${c} = ${a * b + c}`],
      })
    : numeric('mixed', `${a * b + c} − ${a} × ${b} = ?`, `What is ${a * b + c} minus ${a} times ${b}?`, c, {
        extraSeconds: 6,
        steps: ['Multiply first, then subtract (BODMAS).', `${a} × ${b} = ${a * b}`, `${a * b + c} − ${a * b} = ${c}`],
      })
}

// Clock emoji: 🕐..🕛 are 1..12 o'clock, 🕜..🕧 are half past 1..12
const clock = (halves: boolean): Make => () => {
  const h = randInt(1, 12)
  const half = halves && Math.random() < 0.5
  const emoji = String.fromCodePoint((half ? 0x1f55c : 0x1f550) + h - 1)
  const say = (hr: number, hf: boolean) => (hf ? `half past ${hr}` : `${hr} o'clock`)
  const answer = say(h, half)
  const wrong = [say(h, !half), say((h % 12) + 1, half), say(((h + 10) % 12) + 1, half), say((h % 12) + 1, !half)]
  return { topic: 'time', prompt: 'What time is it?', speak: 'Look at the clock. What time is it?', visual: emoji, answer, choices: choicesFrom(answer, wrong) }
}

const measures = (): Make => () => {
  const [q, unitA, unitB, factor] = pick([
    ['days', 'weeks', 'days', 7],
    ['hours', 'days', 'hours', 24],
    ['minutes', 'hours', 'minutes', 60],
    ['months', 'years', 'months', 12],
    ['centimetres', 'metres', 'centimetres', 100],
    ['grams', 'kilograms', 'grams', 1000],
  ] as const)
  const n = randInt(2, q === 'grams' ? 5 : 9)
  const text = `How many ${unitB} are in ${n} ${unitA}?`
  return numeric('measures', text, text, n * factor, { extraSeconds: 6, steps: [`1 ${unitA.replace(/s$/, '')} = ${factor} ${unitB}`, `${n} × ${factor} = ${n * factor} ${unitB}`] }, factor)
}

const smallRoman = (max: number): Make => () => {
  const n = randInt(1, max)
  const r = roman(n)
  return Math.random() < 0.5
    ? numeric('roman numerals', `${r} = ?`, `What number is the Roman numeral ${r.split('').join(' ')}?`, n, { big: r, steps: romanSteps(n) })
    : {
        topic: 'roman numerals',
        prompt: `Write ${n} in Roman numerals`,
        speak: `Write ${n} in Roman numerals.`,
        answer: r,
        choices: choicesFrom(r, [roman(n + 1), roman(Math.max(1, n - 1)), roman(n + 5), roman(Math.max(1, n - 5)), roman(n + 10)]),
      }
}

// ---------- what each class + level practises ----------

const LOWER: Plan = {
  TOP: {
    simple: [count(1, 5), numberNext(6), tapNumber(10, true), pickGroup(5)],
    medium: [count(3, 10), numberNext(10), tapNumber(10, false), pickGroup(8), bigger(10)],
    hard: [pictureAdd(3, 2), count(5, 10), numberNext(10), pickGroup(10), bigger(20)],
    pro: [pictureAdd(5, 5), pictureTakeAway(6), numberNext(15), tapNumber(20, false), bigger(20)],
  },
  P1: {
    simple: [count(3, 10), add(5, 5), numberNext(20), pictureAdd(5, 5), tapNumber(50, false), bigger(50)],
    medium: [add(10, 10), sub(20), compare(20), numberNext(50), skipCount([2, 5, 10], 5), missingAdd(10), pictureTakeAway(10), wordAdd(10)],
    hard: [add(30, 20), sub(50), missingAdd(20), wordAdd(20), tensOnes()],
    pro: [add(60, 39), sub(99), missingAdd(50), missingSub(30), wordAdd(50), wordSub(50), tensOnes()],
  },
  P2: {
    simple: [add(20, 20), sub(40), compare(100), oddEven(50), skipCount([2, 5, 10], 10)],
    medium: [add(50, 49), sub(99), mul([2, 5, 10], 10), clock(false), tensOnes()],
    hard: [mul([2, 3, 4, 5, 10], 10), missingAdd(100), wordSub(99), wordMul([2, 5, 10]), clock(true)],
    pro: [div([2, 5, 10], 10), mul([2, 3, 4, 5, 10], 10), money([100, 200, 500], 5), wordShare([2, 5, 10]), missingSub(99)],
  },
  P3: {
    simple: [add(99, 99), sub(99), mul([2, 3, 4, 5], 10), oddEven(200), clock(true)],
    medium: [add(500, 400, 100), sub(999, 100), mul([2, 3, 4, 5, 6, 7, 8, 9, 10], 10), placeValue(), measures()],
    hard: [div([2, 3, 4, 5, 6, 10], 10), wordMul([3, 4, 5, 6]), money([100, 200, 500], 6), fractionOf([2, 4], 40), smallRoman(20), change([500, 1000])],
    pro: [mixed(), fractionOf([2, 3, 4], 90), money([200, 500, 1000], 9), missingMul([3, 4, 6, 7, 8, 9]), wordShare([3, 4, 5, 6]), change([1000, 2000, 5000])],
  },
}

export const MATHS_PLAN: Plan = { ...LOWER, ...UPPER_MATHS_PLAN }
