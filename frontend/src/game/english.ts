// English question engine: letters, sounds, words, spelling and grammar.
// Word lists are hand-picked; questions are mixed from them at random.
import type { Make, Plan } from './sprint.ts'
import { pick, randInt, shuffle } from './random.ts'
import { ENGLISH_UPPER_PLAN } from './english-upper.ts'
import { verbSentence } from './english-sentences.ts'
import { comprehension } from './english-stories.ts'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('')
const VOWELS = ['a', 'e', 'i', 'o', 'u']
const NAMES = ['Amina', 'Okello', 'Nakato', 'Kato', 'Achieng', 'Mugisha', 'Apio', 'Wasswa']

// Picture words. Emoji are from older Unicode versions so they show on cheap/older phones.
const PICTURES: { word: string; emoji: string; easy?: true }[] = [
  { word: 'cat', emoji: '🐱', easy: true },
  { word: 'dog', emoji: '🐶', easy: true },
  { word: 'hen', emoji: '🐔', easy: true },
  { word: 'pig', emoji: '🐷', easy: true },
  { word: 'cow', emoji: '🐄', easy: true },
  { word: 'sun', emoji: '☀️', easy: true },
  { word: 'bus', emoji: '🚌', easy: true },
  { word: 'cup', emoji: '☕', easy: true },
  { word: 'bed', emoji: '🛏️', easy: true },
  { word: 'egg', emoji: '🥚', easy: true },
  { word: 'ant', emoji: '🐜', easy: true },
  { word: 'hat', emoji: '🎩', easy: true },
  { word: 'box', emoji: '📦', easy: true },
  { word: 'car', emoji: '🚗', easy: true },
  { word: 'fox', emoji: '🦊', easy: true },
  { word: 'bee', emoji: '🐝', easy: true },
  { word: 'pen', emoji: '🖊️', easy: true },
  { word: 'key', emoji: '🔑', easy: true },
  { word: 'goat', emoji: '🐐' },
  { word: 'fish', emoji: '🐟' },
  { word: 'ball', emoji: '⚽' },
  { word: 'tree', emoji: '🌳' },
  { word: 'book', emoji: '📘' },
  { word: 'duck', emoji: '🦆' },
  { word: 'frog', emoji: '🐸' },
  { word: 'lion', emoji: '🦁' },
  { word: 'cake', emoji: '🎂' },
  { word: 'milk', emoji: '🥛' },
  { word: 'star', emoji: '⭐' },
  { word: 'moon', emoji: '🌙' },
  { word: 'boat', emoji: '⛵' },
  { word: 'door', emoji: '🚪' },
  { word: 'ring', emoji: '💍' },
  { word: 'drum', emoji: '🥁' },
  { word: 'bell', emoji: '🔔' },
  { word: 'shoe', emoji: '👟' },
  { word: 'bird', emoji: '🐦' },
  { word: 'house', emoji: '🏠' },
  { word: 'apple', emoji: '🍎' },
  { word: 'mango', emoji: '🥭' },
  { word: 'horse', emoji: '🐴' },
  { word: 'sheep', emoji: '🐑' },
  { word: 'snake', emoji: '🐍' },
  { word: 'clock', emoji: '🕐' },
  { word: 'banana', emoji: '🍌' },
  { word: 'orange', emoji: '🍊' },
]
const EASY = PICTURES.filter((p) => p.easy)

const RHYMES = [
  ['cat', 'hat', 'mat', 'bat', 'rat'],
  ['dog', 'log', 'frog', 'jog'],
  ['hen', 'pen', 'ten', 'men'],
  ['sun', 'run', 'bun', 'fun'],
  ['pig', 'big', 'dig', 'wig'],
  ['bed', 'red', 'fed', 'led'],
  ['top', 'hop', 'mop', 'shop'],
  ['bug', 'mug', 'rug', 'jug'],
  ['ball', 'tall', 'wall', 'call'],
  ['cake', 'lake', 'make', 'snake'],
  ['king', 'ring', 'sing', 'wing'],
  ['tree', 'bee', 'see', 'three'],
  ['goat', 'boat', 'coat', 'float'],
]

const OPPOSITES: [string, string, 'easy' | 'hard'][] = [
  ['big', 'small', 'easy'],
  ['hot', 'cold', 'easy'],
  ['up', 'down', 'easy'],
  ['happy', 'sad', 'easy'],
  ['fast', 'slow', 'easy'],
  ['tall', 'short', 'easy'],
  ['day', 'night', 'easy'],
  ['old', 'new', 'easy'],
  ['wet', 'dry', 'easy'],
  ['full', 'empty', 'easy'],
  ['open', 'shut', 'easy'],
  ['in', 'out', 'easy'],
  ['clean', 'dirty', 'hard'],
  ['hard', 'soft', 'hard'],
  ['rich', 'poor', 'hard'],
  ['early', 'late', 'hard'],
  ['near', 'far', 'hard'],
  ['strong', 'weak', 'hard'],
  ['thick', 'thin', 'hard'],
  ['buy', 'sell', 'hard'],
  ['push', 'pull', 'hard'],
  ['laugh', 'cry', 'hard'],
  ['inside', 'outside', 'hard'],
  ['heavy', 'light', 'hard'],
]
// words that mean nearly the same, so they must never be the "wrong" choices for each other
const SIMILAR = [
  ['small', 'short', 'thin', 'weak', 'little'],
  ['big', 'tall', 'thick', 'strong', 'heavy'],
  ['sad', 'cry'],
  ['happy', 'laugh'],
  ['shut', 'in', 'inside'],
  ['open', 'out', 'outside'],
  ['night', 'late'],
  ['day', 'early', 'light'],
]

const PLURALS: [string, string, 'regular' | 'es' | 'ies' | 'irregular'][] = [
  ['cat', 'cats', 'regular'],
  ['book', 'books', 'regular'],
  ['pen', 'pens', 'regular'],
  ['goat', 'goats', 'regular'],
  ['tree', 'trees', 'regular'],
  ['girl', 'girls', 'regular'],
  ['box', 'boxes', 'es'],
  ['bus', 'buses', 'es'],
  ['dish', 'dishes', 'es'],
  ['watch', 'watches', 'es'],
  ['glass', 'glasses', 'es'],
  ['church', 'churches', 'es'],
  ['baby', 'babies', 'ies'],
  ['lady', 'ladies', 'ies'],
  ['story', 'stories', 'ies'],
  ['city', 'cities', 'ies'],
  ['child', 'children', 'irregular'],
  ['man', 'men', 'irregular'],
  ['woman', 'women', 'irregular'],
  ['foot', 'feet', 'irregular'],
  ['tooth', 'teeth', 'irregular'],
  ['mouse', 'mice', 'irregular'],
  ['sheep', 'sheep', 'irregular'],
  ['knife', 'knives', 'irregular'],
  ['leaf', 'leaves', 'irregular'],
]

const SPELLING_EASY = ['school', 'water', 'mother', 'father', 'house', 'table', 'happy', 'green', 'yellow', 'little', 'chicken', 'pencil']
const SPELLING_HARD = ['friend', 'because', 'teacher', 'beautiful', 'family', 'people', 'morning', 'garden', 'market', 'window', 'Wednesday', 'February', 'answer', 'country']

const VERBS = [
  { base: 'go', s: 'goes', past: 'went', ing: 'going', place: 'to school' },
  { base: 'eat', s: 'eats', past: 'ate', ing: 'eating', place: 'rice' },
  { base: 'play', s: 'plays', past: 'played', ing: 'playing', place: 'football' },
  { base: 'run', s: 'runs', past: 'ran', ing: 'running', place: 'to the shop' },
  { base: 'write', s: 'writes', past: 'wrote', ing: 'writing', place: 'a letter' },
  { base: 'drink', s: 'drinks', past: 'drank', ing: 'drinking', place: 'milk' },
  { base: 'sing', s: 'sings', past: 'sang', ing: 'singing', place: 'a song' },
  { base: 'swim', s: 'swims', past: 'swam', ing: 'swimming', place: 'in the lake' },
  { base: 'carry', s: 'carries', past: 'carried', ing: 'carrying', place: 'water' },
  { base: 'dig', s: 'digs', past: 'dug', ing: 'digging', place: 'in the garden' },
]

// ---------- helpers ----------

function choicesFrom(answer: string, pool: string[], n = 3): string[] {
  const wrong = shuffle([...new Set(pool)].filter((w) => w !== answer)).slice(0, n)
  return shuffle([answer, ...wrong])
}

function lettersExcept(answer: string, from = ALPHABET): string[] {
  // c and k sound the same at the start of a word: never offer both
  const confusing: Record<string, string[]> = { c: ['k', 's'], k: ['c'], s: ['c'] }
  return from.filter((l) => l !== answer && !(confusing[answer] ?? []).includes(l))
}

const similarTo = (word: string) => SIMILAR.find((g) => g.includes(word)) ?? [word]

function misspell(word: string): string[] {
  const out = new Set<string>()
  const w = word
  const vowelSwap: Record<string, string> = { a: 'e', e: 'i', i: 'e', o: 'u', u: 'o' }
  for (let i = 1; i < w.length; i++) {
    out.add(w.slice(0, i) + w.slice(i + 1)) // drop a letter
    if (i < w.length - 1) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)) // swap two letters
    out.add(w.slice(0, i) + w[i] + w.slice(i)) // double a letter
    const v = vowelSwap[w[i]]
    if (v) out.add(w.slice(0, i) + v + w.slice(i + 1)) // wrong vowel
  }
  out.delete(w)
  return shuffle([...out]).slice(0, 3)
}

// ---------- templates ----------

// showBig: nursery children match the shape; older ones read the letter name
const letterFind = (upper: boolean, showBig: boolean): Make => () => {
  const l = pick(ALPHABET)
  const show = upper ? l.toUpperCase() : l
  return {
    topic: 'letters',
    prompt: showBig ? 'Tap the same letter' : `Tap the letter ${show}`,
    speak: `Tap the letter ${l.toUpperCase()}.`,
    big: showBig ? show : undefined,
    answer: show,
    choices: choicesFrom(show, lettersExcept(l).map((x) => (upper ? x.toUpperCase() : x))),
  }
}

const caseMatch = (): Make => () => {
  const l = pick(ALPHABET.filter((x) => !'cosuvwxz'.includes(x))) // skip letters that look the same big and small
  return {
    topic: 'letters',
    prompt: 'Find the small letter',
    speak: `This is big ${l.toUpperCase()}. Find the small ${l.toUpperCase()}.`,
    big: l.toUpperCase(),
    answer: l,
    choices: choicesFrom(l, lettersExcept(l)),
  }
}

const firstSound = (words: typeof PICTURES): Make => () => {
  const p = pick(words.filter((w) => !['key'].includes(w.word)))
  const l = p.word[0]
  return {
    topic: 'first sounds',
    prompt: `${p.word[0].toUpperCase() + p.word.slice(1)} starts with…`,
    speak: `${p.word}. Which letter does ${p.word} start with?`,
    visual: p.emoji,
    answer: l,
    choices: choicesFrom(l, lettersExcept(l)),
  }
}

const pictureWord = (words: typeof PICTURES): Make => () => {
  const p = pick(words)
  // wrong words share a letter count so the child must read, not guess by length
  const sameLength = words.filter((w) => w.word.length === p.word.length).map((w) => w.word)
  return {
    topic: 'reading',
    prompt: 'Which word is this?',
    speak: 'Look at the picture. Which word is this?',
    visual: p.emoji,
    answer: p.word,
    choices: choicesFrom(p.word, sameLength.length >= 4 ? sameLength : words.map((w) => w.word)),
  }
}

const missingLetter = (maxLen: number): Make => () => {
  const p = pick(PICTURES.filter((w) => w.word.length <= maxLen))
  const vowelSpots = [...p.word].map((c, i) => (VOWELS.includes(c) ? i : -1)).filter((i) => i > 0)
  const at = vowelSpots.length ? pick(vowelSpots) : randInt(1, p.word.length - 1)
  const l = p.word[at]
  const pool = VOWELS.includes(l) ? VOWELS : lettersExcept(l)
  return {
    topic: 'spelling',
    prompt: 'Which letter is missing?',
    speak: `${p.word}. Which letter is missing?`,
    visual: p.emoji,
    big: [...p.word].map((c, i) => (i === at ? '_' : c)).join(' '),
    answer: l,
    choices: choicesFrom(l, pool),
  }
}

const rhyme = (): Make => () => {
  const family = pick(RHYMES)
  const [word, answer] = shuffle(family)
  const others = RHYMES.filter((f) => f !== family).map((f) => pick(f))
  return {
    topic: 'rhyming',
    prompt: `Which word rhymes with "${word}"?`,
    speak: `Which word rhymes with ${word}?`,
    answer,
    choices: choicesFrom(answer, others),
  }
}

const opposite = (kind: 'easy' | 'hard' | 'all'): Make => () => {
  const pairs = OPPOSITES.filter((p) => kind === 'all' || p[2] === kind)
  const [a, b] = pick(pairs)
  const [word, answer] = Math.random() < 0.5 ? [a, b] : [b, a]
  const avoid = new Set([word, ...similarTo(answer), ...similarTo(word)])
  const pool = OPPOSITES.flatMap((p) => [p[0], p[1]]).filter((w) => !avoid.has(w))
  return {
    topic: 'opposites',
    prompt: `What is the opposite of "${word}"?`,
    speak: `What is the opposite of ${word}?`,
    answer,
    choices: choicesFrom(answer, pool),
  }
}

const plural = (kinds: (typeof PLURALS)[number][2][]): Make => () => {
  const [one, many] = pick(PLURALS.filter((p) => kinds.includes(p[2])))
  const stem = one.endsWith('y') ? one.slice(0, -1) : one
  const wrong = [one + 's', one + 'es', stem + 'ies', one + 'ren', stem + 'is', one + 'ys']
  return {
    topic: 'plurals',
    prompt: `One ${one}, two ___`,
    speak: `One ${one}. Two what?`,
    answer: many,
    choices: choicesFrom(many, wrong),
  }
}

const spelling = (words: string[]): Make => () => {
  const w = pick(words)
  return {
    topic: 'spelling',
    prompt: 'Which word is spelt correctly?',
    speak: `${w}. Which word is spelt correctly?`,
    answer: w,
    choices: shuffle([w, ...misspell(w)]),
    extraSeconds: 5,
  }
}

const aOrAn = (): Make => () => {
  const [word, article] = pick([
    ['orange', 'an'], ['egg', 'an'], ['umbrella', 'an'], ['elephant', 'an'], ['ant', 'an'], ['ice cream', 'an'], ['owl', 'an'],
    ['mango', 'a'], ['book', 'a'], ['cup', 'a'], ['goat', 'a'], ['banana', 'a'], ['pencil', 'a'], ['house', 'a'],
  ] as const)
  return {
    topic: 'grammar',
    prompt: `___ ${word}`,
    speak: `Do we say a ${word}, or an ${word}?`,
    answer: article,
    choices: ['a', 'an'],
  }
}

const isAre = (): Make => () => {
  const [subject, answer] = pick([
    ['The cat', 'is'], ['My mother', 'is'], ['The bus', 'is'], ['Okello', 'is'],
    ['The children', 'are'], ['The goats', 'are'], ['We', 'are'], ['They', 'are'], ['You', 'are'],
    ['I', 'am'],
  ] as const)
  const action = pick(['sleeping', 'eating', 'singing', 'playing', 'running'])
  const text = `${subject} ___ ${action}.`
  return { topic: 'grammar', prompt: text, speak: `${subject}, blank, ${action}. Choose the missing word.`, answer, choices: shuffle(['is', 'are', 'am', 'be']) }
}

const verbForm = (tenses: ('every day' | 'yesterday' | 'now')[]): Make => () => {
  const v = pick(VERBS)
  const name = pick(NAMES)
  const tense = pick(tenses)
  const [sentence, answer] =
    tense === 'every day'
      ? [`Every day, ${name} ___ ${v.place}.`, v.s]
      : tense === 'yesterday'
        ? [`Yesterday, ${name} ___ ${v.place}.`, v.past]
        : [`${name} is ___ ${v.place} now.`, v.ing]
  return {
    topic: 'grammar',
    prompt: sentence,
    speak: sentence.replace('___', 'blank') + ' Choose the missing word.',
    answer,
    choices: shuffle([v.base, v.s, v.past, v.ing]),
    extraSeconds: 6,
  }
}

// ---------- what each class + level practises ----------

export const ENGLISH_PLAN: Plan = {
  // P4–P7: upper-primary grammar (english-upper.ts)
  ...ENGLISH_UPPER_PLAN,
  TOP: {
    simple: [letterFind(true, true)],
    medium: [caseMatch(), letterFind(false, true)],
    hard: [firstSound(EASY)],
    pro: [pictureWord(EASY), firstSound(EASY)],
  },
  P1: {
    simple: [firstSound(PICTURES), letterFind(false, false)],
    medium: [pictureWord(EASY)],
    hard: [missingLetter(3), pictureWord(PICTURES)],
    pro: [rhyme(), missingLetter(4)],
  },
  P2: {
    simple: [missingLetter(5), pictureWord(PICTURES)],
    medium: [rhyme(), plural(['regular']), verbSentence(['every day'])],
    hard: [opposite('easy'), aOrAn(), plural(['regular', 'es'])],
    pro: [isAre(), verbForm(['every day']), spelling(SPELLING_EASY), verbSentence(['every day', 'now'])],
  },
  P3: {
    simple: [opposite('easy'), plural(['regular', 'es', 'ies']), verbSentence(['every day', 'now'])],
    medium: [verbForm(['every day', 'yesterday', 'now']), isAre(), aOrAn(), verbSentence(['every day', 'yesterday', 'now'])],
    hard: [spelling(SPELLING_EASY), plural(['ies', 'irregular']), opposite('hard'), comprehension(['farm'])],
    pro: [verbForm(['yesterday', 'now']), spelling(SPELLING_HARD), opposite('all'), comprehension(['farm', 'market']), verbSentence(['yesterday', 'tomorrow', 'helper'])],
  },
}
