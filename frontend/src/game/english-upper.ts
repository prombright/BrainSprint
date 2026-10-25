// English for P4–P7: the grammar of the upper-primary syllabus, generated from checked word lists.
// British spelling, as taught in Uganda. Every template keeps one rule in mind: exactly one choice is
// right. Wrong choices are made by breaking the rule ("goed", "biger", "do'nt"); where breaking a rule
// could make another real word, the wrong choices are written by hand instead.
import type { Make, Plan } from './sprint.ts'
import type { Level } from './types.ts'
import { pick, shuffle } from './random.ts'
import { NAMES } from './mathskit.ts'

/** The answer plus up to three different wrong choices (never the answer itself), shuffled. */
function choices(answer: string, wrong: string[], n = 3): string[] {
  const seen = new Set([answer.toLowerCase()])
  const out: string[] = []
  for (const w of shuffle(wrong)) {
    if (!w || seen.has(w.toLowerCase())) continue
    seen.add(w.toLowerCase())
    out.push(w)
    if (out.length === n) break
  }
  return shuffle([answer, ...out])
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------- plurals ----------

type PluralKind = 'regular' | 'es' | 'ies' | 'ys' | 'ves' | 'oes' | 'os' | 'irregular' | 'same' | 'compound'
const PLURALS: [string, string, PluralKind][] = [
  ['pupil', 'pupils', 'regular'], ['teacher', 'teachers', 'regular'], ['farmer', 'farmers', 'regular'], ['river', 'rivers', 'regular'],
  ['box', 'boxes', 'es'], ['bus', 'buses', 'es'], ['brush', 'brushes', 'es'], ['bench', 'benches', 'es'], ['class', 'classes', 'es'], ['dish', 'dishes', 'es'],
  ['baby', 'babies', 'ies'], ['lady', 'ladies', 'ies'], ['country', 'countries', 'ies'], ['dictionary', 'dictionaries', 'ies'], ['party', 'parties', 'ies'], ['library', 'libraries', 'ies'],
  ['key', 'keys', 'ys'], ['day', 'days', 'ys'], ['toy', 'toys', 'ys'], ['donkey', 'donkeys', 'ys'], ['monkey', 'monkeys', 'ys'], ['valley', 'valleys', 'ys'],
  ['knife', 'knives', 'ves'], ['wife', 'wives', 'ves'], ['leaf', 'leaves', 'ves'], ['wolf', 'wolves', 'ves'], ['half', 'halves', 'ves'], ['thief', 'thieves', 'ves'], ['shelf', 'shelves', 'ves'],
  ['tomato', 'tomatoes', 'oes'], ['potato', 'potatoes', 'oes'], ['hero', 'heroes', 'oes'],
  ['radio', 'radios', 'os'], ['photo', 'photos', 'os'], ['piano', 'pianos', 'os'],
  ['child', 'children', 'irregular'], ['man', 'men', 'irregular'], ['woman', 'women', 'irregular'], ['foot', 'feet', 'irregular'], ['tooth', 'teeth', 'irregular'],
  ['mouse', 'mice', 'irregular'], ['goose', 'geese', 'irregular'], ['ox', 'oxen', 'irregular'], ['louse', 'lice', 'irregular'],
  ['sheep', 'sheep', 'same'], ['deer', 'deer', 'same'],
  ['mother-in-law', 'mothers-in-law', 'compound'], ['passer-by', 'passers-by', 'compound'], ['brother-in-law', 'brothers-in-law', 'compound'],
]
const PLURAL_RULE: Record<PluralKind, string> = {
  regular: 'Most nouns just add -s.',
  es: 'Nouns ending in s, x, sh or ch add -es.',
  ies: 'A consonant + y: change y to i and add -es.',
  ys: 'A vowel + y: just add -s.',
  ves: 'Many nouns ending in f or fe change to -ves.',
  oes: 'Some nouns ending in o add -es: tomatoes, potatoes, heroes.',
  os: 'Some nouns ending in o just add -s: radios, photos, pianos.',
  irregular: 'This noun changes in its own way. Learn it by heart.',
  same: 'This noun stays the same when there are many.',
  compound: 'In a word like mother-in-law, the main word (mother) takes the -s.',
}

const plural = (kinds: PluralKind[]): Make => () => {
  const [one, many, kind] = pick(PLURALS.filter((p) => kinds.includes(p[2])))
  const parts = one.split('-')
  const wrong =
    kind === 'compound'
      ? [`${one}s`, parts.map((w) => `${w}s`).join('-'), `${parts[0]}s-${parts.slice(1).join('-')}s`, `${one}es`]
      : [
          `${one}s`,
          `${one}es`,
          one.endsWith('y') ? `${one.slice(0, -1)}ies` : '',
          /fe?$/.test(one) ? `${one.replace(/fe?$/, '')}ves` : '',
          kind === 'irregular' || kind === 'same' ? `${one}en` : '',
          one,
          `${many}s`,
        ]
  const prompt = `One ${one}, many ___`
  return {
    topic: 'plurals',
    prompt,
    speak: `One ${one}. Many what?`,
    answer: many,
    choices: choices(many, wrong),
    steps: [PLURAL_RULE[kind], `${one} → ${many}`],
  }
}

// ---------- verbs: past tense and past participle ----------

// irregular verbs: base, past, past participle
const IRREGULAR: [string, string, string][] = [
  ['go', 'went', 'gone'], ['eat', 'ate', 'eaten'], ['write', 'wrote', 'written'], ['drink', 'drank', 'drunk'], ['sing', 'sang', 'sung'],
  ['swim', 'swam', 'swum'], ['run', 'ran', 'run'], ['see', 'saw', 'seen'], ['take', 'took', 'taken'], ['give', 'gave', 'given'],
  ['come', 'came', 'come'], ['begin', 'began', 'begun'], ['break', 'broke', 'broken'], ['choose', 'chose', 'chosen'], ['drive', 'drove', 'driven'],
  ['fly', 'flew', 'flown'], ['forget', 'forgot', 'forgotten'], ['know', 'knew', 'known'], ['ride', 'rode', 'ridden'], ['speak', 'spoke', 'spoken'],
  ['throw', 'threw', 'thrown'], ['wear', 'wore', 'worn'], ['grow', 'grew', 'grown'], ['draw', 'drew', 'drawn'],
  ['blow', 'blew', 'blown'], ['hide', 'hid', 'hidden'], ['bite', 'bit', 'bitten'], ['shake', 'shook', 'shaken'], ['fall', 'fell', 'fallen'],
  ['do', 'did', 'done'], ['buy', 'bought', 'bought'], ['bring', 'brought', 'brought'], ['catch', 'caught', 'caught'], ['teach', 'taught', 'taught'],
  ['think', 'thought', 'thought'], ['fight', 'fought', 'fought'], ['sell', 'sold', 'sold'], ['tell', 'told', 'told'], ['sleep', 'slept', 'slept'],
  ['keep', 'kept', 'kept'], ['feel', 'felt', 'felt'], ['leave', 'left', 'left'], ['meet', 'met', 'met'], ['sit', 'sat', 'sat'],
  ['stand', 'stood', 'stood'], ['win', 'won', 'won'], ['dig', 'dug', 'dug'], ['hold', 'held', 'held'], ['find', 'found', 'found'],
  ['make', 'made', 'made'], ['pay', 'paid', 'paid'], ['say', 'said', 'said'], ['lose', 'lost', 'lost'], ['build', 'built', 'built'],
  ['send', 'sent', 'sent'], ['spend', 'spent', 'spent'], ['cut', 'cut', 'cut'], ['put', 'put', 'put'], ['hit', 'hit', 'hit'],
]
const COMMON = new Set(['go', 'eat', 'write', 'drink', 'sing', 'run', 'see', 'take', 'give', 'come', 'buy', 'bring', 'catch', 'teach', 'sleep', 'sit', 'make', 'say', 'cut', 'put'])

// regular verbs, and how their -ed is spelt
type EdKind = 'ed' | 'd' | 'double' | 'ied'
const REGULAR: [string, string, EdKind][] = [
  ['play', 'played', 'ed'], ['walk', 'walked', 'ed'], ['jump', 'jumped', 'ed'], ['cook', 'cooked', 'ed'], ['visit', 'visited', 'ed'], ['open', 'opened', 'ed'],
  ['dance', 'danced', 'd'], ['like', 'liked', 'd'], ['smile', 'smiled', 'd'], ['hope', 'hoped', 'd'], ['arrive', 'arrived', 'd'],
  ['stop', 'stopped', 'double'], ['clap', 'clapped', 'double'], ['plan', 'planned', 'double'], ['beg', 'begged', 'double'], ['drop', 'dropped', 'double'],
  ['carry', 'carried', 'ied'], ['cry', 'cried', 'ied'], ['study', 'studied', 'ied'], ['try', 'tried', 'ied'], ['marry', 'married', 'ied'],
]
const ED_RULE: Record<EdKind, string> = {
  ed: 'Most verbs add -ed.',
  d: 'A verb ending in e just adds -d.',
  double: 'A short verb ending in one vowel + one consonant doubles the last letter, then adds -ed.',
  ied: 'A consonant + y: change y to i and add -ed.',
}

const sForm = (v: string) => (/(s|sh|ch|x|o)$/.test(v) ? `${v}es` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : `${v}s`)
// "see" + d would be "seed", a real word, so verbs ending in ee get -ed ("seeed")
const wrongEd = (v: string) => (v.endsWith('e') && !v.endsWith('ee') ? `${v}d` : `${v}ed`)

const pastTense = (which: 'common' | 'all'): Make => () => {
  const name = pick(NAMES)
  if (Math.random() < 0.6) {
    const list = IRREGULAR.filter((v) => which === 'all' || COMMON.has(v[0]))
    const [base, past, part] = pick(list)
    const prompt = `What is the past tense of "${base}"?`
    return {
      topic: 'past tense',
      prompt,
      speak: `What is the past tense of ${base}?`,
      answer: past,
      choices: choices(past, [wrongEd(base), part, base, sForm(base), `${past}ed`, `${base}${base[base.length - 1]}ed`]),
      steps: [`"${base}" is an irregular verb: its past tense is not made with -ed.`, `Today I ${base}. Yesterday I ${past}.`],
    }
  }
  const [base, past, kind] = pick(REGULAR)
  const last = base[base.length - 1]
  const wrong = [`${base}ed`, `${base}d`, `${base}${last}ed`, `${base.slice(0, -1)}ied`, `${base}ied`].filter((w) => w !== past)
  const prompt = `Yesterday ${name} ___. (${base})`
  return {
    topic: 'past tense',
    prompt,
    speak: `Yesterday ${name} blank. Use the word ${base} in the past tense.`,
    answer: past,
    choices: choices(past, wrong),
    steps: [ED_RULE[kind], `${base} → ${past}`],
  }
}

const pastParticiple = (): Make => () => {
  // only verbs whose past and participle differ, so the question tests the right form
  const [base, past, part] = pick(IRREGULAR.filter((v) => v[1] !== v[2]))
  const name = pick(NAMES)
  return {
    topic: 'past participles',
    prompt: `${name} has ___. (${base})`,
    speak: `${name} has blank. Use the word ${base}.`,
    answer: part,
    choices: choices(part, [past, base, wrongEd(base), sForm(base)]),
    steps: ['After has, have or had we use the past participle.', `${base}, ${past}, ${part}: ${name} has ${part}.`],
  }
}

// ---------- comparing: -er / -est, more / most ----------

type Cmp = [string, string, string, 'er' | 'double' | 'ier' | 'e' | 'more' | 'irregular']
const COMPARE: Cmp[] = [
  ['tall', 'taller', 'tallest', 'er'], ['short', 'shorter', 'shortest', 'er'], ['small', 'smaller', 'smallest', 'er'], ['strong', 'stronger', 'strongest', 'er'], ['fast', 'faster', 'fastest', 'er'], ['long', 'longer', 'longest', 'er'],
  ['big', 'bigger', 'biggest', 'double'], ['hot', 'hotter', 'hottest', 'double'], ['fat', 'fatter', 'fattest', 'double'], ['thin', 'thinner', 'thinnest', 'double'], ['wet', 'wetter', 'wettest', 'double'],
  ['happy', 'happier', 'happiest', 'ier'], ['heavy', 'heavier', 'heaviest', 'ier'], ['easy', 'easier', 'easiest', 'ier'], ['busy', 'busier', 'busiest', 'ier'], ['dirty', 'dirtier', 'dirtiest', 'ier'],
  ['large', 'larger', 'largest', 'e'], ['nice', 'nicer', 'nicest', 'e'], ['wide', 'wider', 'widest', 'e'], ['late', 'later', 'latest', 'e'],
  ['beautiful', 'more beautiful', 'most beautiful', 'more'], ['expensive', 'more expensive', 'most expensive', 'more'], ['careful', 'more careful', 'most careful', 'more'],
  ['interesting', 'more interesting', 'most interesting', 'more'], ['dangerous', 'more dangerous', 'most dangerous', 'more'], ['important', 'more important', 'most important', 'more'],
  ['good', 'better', 'best', 'irregular'], ['bad', 'worse', 'worst', 'irregular'],
]
const CMP_RULE: Record<Cmp[3], string> = {
  er: 'Short words add -er (two things) and -est (more than two).',
  double: 'A short word ending in one vowel + one consonant doubles the last letter: big, bigger, biggest.',
  ier: 'A word ending in consonant + y changes y to i: happy, happier, happiest.',
  e: 'A word ending in e just adds -r and -st.',
  more: 'Long words use "more" and "most" instead of -er and -est.',
  irregular: 'Good and bad change completely: good, better, best; bad, worse, worst.',
}

const comparing = (kinds: Cmp[3][]): Make => () => {
  const [adj, er, est, kind] = pick(COMPARE.filter((c) => kinds.includes(c[3])))
  const last = adj[adj.length - 1]
  const asks = Math.random() < 0.5 ? 'er' : 'est'
  const answer = asks === 'er' ? er : est
  const wrongEr = [`${adj}er`, `${adj}${last}er`, `more ${adj}`, `${adj.slice(0, -1)}ier`, `${adj}r`, er, est]
  const wrongEst = [`${adj}est`, `${adj}${last}est`, `most ${adj}`, `${adj.slice(0, -1)}iest`, `${adj}st`, er, est]
  const prompt = asks === 'er' ? `${cap(adj)}, ___, ${est}` : `${cap(adj)}, ${er}, ___`
  return {
    topic: 'comparing words',
    prompt,
    speak: `${adj}, ${asks === 'er' ? `blank, ${est}` : `${er}, blank`}. Fill in the missing word.`,
    answer,
    choices: choices(answer, asks === 'er' ? wrongEr : wrongEst),
    steps: [CMP_RULE[kind], `${adj}, ${er}, ${est}`],
  }
}

// ---------- adverbs ----------

const ADVERBS: [string, string][] = [
  ['quick', 'quickly'], ['slow', 'slowly'], ['loud', 'loudly'], ['quiet', 'quietly'], ['bad', 'badly'], ['careful', 'carefully'],
  ['beautiful', 'beautifully'], ['happy', 'happily'], ['easy', 'easily'], ['angry', 'angrily'], ['gentle', 'gently'], ['simple', 'simply'], ['good', 'well'],
]
const adverb = (): Make => () => {
  const [adj, adv] = pick(ADVERBS)
  const name = pick(NAMES)
  const prompt = `${name} sings ___. (${adj})`
  const rule = adj === 'good' ? '"Good" becomes "well": she sings well.' : adj.endsWith('y') ? 'A word ending in y changes y to i and adds -ly.' : adj.endsWith('le') ? 'A word ending in -le changes the e to y.' : 'Add -ly to describe how something is done.'
  return {
    topic: 'adverbs',
    prompt,
    speak: `${name} sings blank. Use the word ${adj}.`,
    answer: adv,
    // "goodly" is a real (old) word, so "good" gets its own wrong choices
    choices: choices(adv, adj === 'good' ? ['good', 'goodily', 'goodlly'] : [`${adj}ly`, adj, `${adj.slice(0, -1)}ly`, `${adj}ily`, `${adj}lly`]),
    steps: [rule, `${adj} → ${adv}`],
  }
}

// ---------- masculine / feminine, young ones, collective nouns ----------

const GENDER: [string, string][] = [
  ['king', 'queen'], ['father', 'mother'], ['uncle', 'aunt'], ['brother', 'sister'], ['husband', 'wife'], ['son', 'daughter'],
  ['nephew', 'niece'], ['bull', 'cow'], ['cock', 'hen'], ['ram', 'ewe'], ['lion', 'lioness'], ['prince', 'princess'], ['waiter', 'waitress'],
  ['actor', 'actress'], ['host', 'hostess'], ['headmaster', 'headmistress'], ['landlord', 'landlady'], ['grandfather', 'grandmother'], ['bridegroom', 'bride'], ['gentleman', 'lady'],
]
const gender = (): Make => () => {
  const [m, f] = pick(GENDER)
  const toFem = Math.random() < 0.6
  const [word, answer] = toFem ? [m, f] : [f, m]
  const pool = GENDER.map((g) => (toFem ? g[1] : g[0]))
  return {
    topic: 'masculine and feminine',
    prompt: `What is the ${toFem ? 'feminine' : 'masculine'} of "${word}"?`,
    speak: `What is the ${toFem ? 'feminine' : 'masculine'} of ${word}?`,
    answer,
    choices: choices(answer, pool),
    steps: [`Masculine is for male, feminine is for female: ${m} and ${f}.`],
  }
}

const YOUNG: [string, string][] = [
  ['cow', 'calf'], ['goat', 'kid'], ['dog', 'puppy'], ['cat', 'kitten'], ['hen', 'chick'], ['sheep', 'lamb'], ['pig', 'piglet'],
  ['horse', 'foal'], ['duck', 'duckling'], ['lion', 'cub'], ['frog', 'tadpole'], ['goose', 'gosling'], ['owl', 'owlet'], ['kangaroo', 'joey'],
]
const young = (): Make => () => {
  const [animal, baby] = pick(YOUNG)
  return {
    topic: 'young ones of animals',
    // "a young hen" is strictly a pullet; "the young one of a hen" is a chick
    prompt: `The young one of a ${animal} is called a ___`,
    speak: `The young one of a ${animal} is called a what?`,
    answer: baby,
    choices: choices(baby, YOUNG.map((y) => y[1])),
    steps: [`The young one of a ${animal} is a ${baby}.`],
  }
}

// collective noun, the things, and other words that are also right for those things (kept out of the wrong choices)
const COLLECTIVE: [string, string, string[]][] = [
  ['herd', 'cattle', []], ['flock', 'sheep', []], ['swarm', 'bees', ['colony']], ['bunch', 'bananas', []], ['pride', 'lions', []],
  ['team', 'players', []], ['choir', 'singers', []], ['crowd', 'people', []], ['fleet', 'ships', []], ['bundle', 'sticks', []],
  ['gang', 'thieves', ['band']], ['litter', 'puppies', []], ['colony', 'ants', ['swarm']], ['class', 'pupils', []], ['bunch', 'keys', []],
  ['school', 'fish', ['shoal']], ['pack', 'wolves', []], ['cluster', 'grapes', ['bunch']],
]
const collective = (): Make => () => {
  const [word, things, also] = pick(COLLECTIVE)
  // crowd and team fit almost any group of people, so they are never offered as wrong
  const pool = COLLECTIVE.map((c) => c[0]).filter((w) => !also.includes(w) && !['crowd', 'team'].includes(w))
  return {
    topic: 'collective nouns',
    prompt: `A ___ of ${things}`,
    speak: `A blank of ${things}. Choose the word for a group.`,
    answer: word,
    choices: choices(word, pool),
    steps: [`A group of ${things} is called a ${word}.`],
  }
}

// ---------- contractions and apostrophes ----------

const CONTRACTIONS: [string, string][] = [
  ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"], ['was not', "wasn't"],
  ['were not', "weren't"], ['cannot', "can't"], ['will not', "won't"], ['I am', "I'm"], ['you are', "you're"], ['they are', "they're"],
  ['we are', "we're"], ['I will', "I'll"], ['I have', "I've"], ['she is', "she's"], ['has not', "hasn't"], ['have not', "haven't"],
]
const contraction = (): Make => () => {
  const [full, short] = pick(CONTRACTIONS)
  const at = short.indexOf("'")
  const bare = short.replace("'", '')
  const wrong = [bare, bare.slice(0, at - 1) + "'" + bare.slice(at - 1), bare.slice(0, at + 1) + "'" + bare.slice(at + 1)]
  if (full === 'will not') wrong.push("willn't")
  if (full === 'cannot') wrong.push("cann't")
  return {
    topic: 'contractions',
    prompt: `"${full}" is shortened to ___`,
    speak: `How do we shorten ${full}?`,
    answer: short,
    choices: choices(short, wrong),
    steps: ['The apostrophe goes where letters are left out.', `${full} → ${short}`],
  }
}

// the apostrophe for owning: the boy's book, the boys' books, the children's toys
const OWNERS: { one: string; many: string; irregular?: true }[] = [
  { one: 'boy', many: 'boys' }, { one: 'girl', many: 'girls' }, { one: 'teacher', many: 'teachers' }, { one: 'farmer', many: 'farmers' },
  { one: 'dog', many: 'dogs' }, { one: 'pupil', many: 'pupils' },
  { one: 'man', many: 'men', irregular: true }, { one: 'woman', many: 'women', irregular: true }, { one: 'child', many: 'children', irregular: true },
]
const THINGS = ['book', 'bag', 'house', 'ball', 'pen', 'chair']
const possession = (which: 'one' | 'all'): Make => () => {
  const o = pick(OWNERS.filter((x) => which === 'all' || !x.irregular))
  const thing = pick(THINGS)
  const many = which === 'all' && Math.random() < 0.6
  const owner = many ? o.many : o.one
  const answer = many && !o.irregular ? `the ${owner}' ${thing}s` : `the ${owner}'s ${thing}${many ? 's' : ''}`
  const things = many ? `${thing}s` : thing
  const forms = [`the ${o.one}'s ${things}`, `the ${o.many}' ${things}`, `the ${o.many}'s ${things}`, `the ${o.one}s' ${things}`, `the ${o.many} ${things}`]
  const rule = !many ? 'One owner: add \'s.' : o.irregular ? `"${o.many}" does not end in s, so add 's.` : 'Many owners ending in s: add the apostrophe after the s.'
  return {
    topic: 'apostrophes',
    prompt: `The ${things} of the ${owner}: ___`,
    speak: `The ${things} of the ${owner}. Which is written correctly?`,
    answer,
    choices: choices(answer, forms),
    extraSeconds: 4,
    steps: [rule, `The ${things} of the ${owner} → ${answer}`],
  }
}

// ---------- alphabetical order ----------

const WORDS = [
  'apple', 'basket', 'church', 'doctor', 'engine', 'flower', 'garden', 'hospital', 'island', 'jacket', 'kitchen', 'lorry', 'market',
  'needle', 'orange', 'pencil', 'queen', 'river', 'school', 'teacher', 'umbrella', 'village', 'window', 'yellow', 'zebra',
  'banana', 'bottle', 'bridge', 'brother', 'butter', 'candle', 'carrot', 'castle', 'chair', 'cloud', 'mango', 'milk', 'money', 'monkey', 'mother',
  'paper', 'parrot', 'people', 'picture', 'potato', 'sand', 'seed', 'shirt', 'sister', 'stone', 'table', 'tiger', 'tomato', 'tree', 'turtle',
]
const alphabetical = (sameStart: boolean): Make => () => {
  let four: string[]
  const groups = new Map<string, string[]>()
  for (const w of WORDS) groups.set(w[0], [...(groups.get(w[0]) ?? []), w])
  if (sameStart) {
    // same first letter: the order is decided by the second or third letter
    four = shuffle(pick([...groups.values()].filter((g) => g.length >= 4))).slice(0, 4)
  } else {
    four = shuffle([...groups.values()].map((g) => pick(g))).slice(0, 4)
  }
  const answer = [...four].sort()[0]
  return {
    topic: 'alphabetical order',
    // the words are in the question, so each set counts as a different question (no false repeats)
    prompt: `Which comes first in alphabetical order: ${four.join(', ')}?`,
    speak: `Which word comes first in alphabetical order? ${four.join(', ')}.`,
    answer,
    choices: shuffle(four),
    extraSeconds: 4,
    steps: [sameStart ? 'They all start with the same letter, so look at the next letter.' : 'Look at the first letter of each word.', [...four].sort().join(', ')],
  }
}

// ---------- question tags ----------

// [statement, right tag, three wrong tags]
const TAGS: [string, string, [string, string, string]][] = [
  ['She is a good teacher', "isn't she", ['is she', "isn't he", "doesn't she"]],
  ['They are playing football', "aren't they", ['are they', "aren't we", "don't they"]],
  ['Okello was late', "wasn't he", ['was he', "wasn't she", "didn't he"]],
  ['The girls were singing', "weren't they", ['were they', "wasn't she", "didn't they"]],
  ['You can swim', "can't you", ['can you', "don't you", "can't I"]],
  ['Amina will come', "won't she", ['will she', "won't he", "doesn't she"]],
  ['He has eaten', "hasn't he", ['has he', "didn't he", "hasn't she"]],
  ['We have finished', "haven't we", ['have we', "haven't they", "didn't we"]],
  ['It is raining', "isn't it", ['is it', "doesn't it", "isn't he"]],
  ['Kato is not here', 'is he', ["isn't he", 'is she', 'does he']],
  ["They didn't come", 'did they', ["didn't they", 'do they', 'did we']],
  ["She doesn't like milk", 'does she', ["doesn't she", 'is she', 'did she']],
  ["You don't eat meat", 'do you', ["don't you", 'are you', 'did you']],
  ['He plays football', "doesn't he", ['does he', "isn't he", "didn't he"]],
  ['They went home', "didn't they", ['did they', "don't they", "weren't they"]],
  ['The children like mangoes', "don't they", ['do they', "doesn't it", "aren't they"]],
  ['I am late', "aren't I", ['am I', "isn't it", "don't I"]],
  ["Nakato can't swim", 'can she', ["can't she", 'does she', 'can he']],
  ['The dog was barking', "wasn't it", ["wasn't they", 'was it', "didn't it"]],
  ['We must go now', "mustn't we", ['must we', "don't we", "mustn't they"]],
]
const questionTag = (which: 'easy' | 'all'): Make => () => {
  // easy: a positive sentence with be/can/will (the tag repeats that word)
  const list = which === 'all' ? TAGS : TAGS.filter(([s, t]) => !/n't|not/.test(s) && /^(isn't|aren't|wasn't|weren't|can't|won't)/.test(t))
  const [statement, tag, wrong] = pick(list)
  const negative = /n't|not/.test(statement)
  return {
    topic: 'question tags',
    prompt: `${statement}, ___?`,
    speak: `${statement}, blank? Choose the question tag.`,
    answer: `${tag}?`,
    choices: choices(`${tag}?`, wrong.map((w) => `${w}?`)),
    extraSeconds: 4,
    steps: [negative ? 'A negative sentence takes a positive tag.' : 'A positive sentence takes a negative tag.', 'The tag uses the same helping word (or do/does/did) and a pronoun for the subject.', `${statement}, ${tag}?`],
  }
}

// ---------- making new words ----------

// verb → noun, with hand-written wrong forms (some made-up forms could be real words, so none are generated)
const NOUNS_FROM_VERBS: [string, string, [string, string, string]][] = [
  ['decide', 'decision', ['decidement', 'decidation', 'decition']],
  ['arrive', 'arrival', ['arrivement', 'arrivation', 'arrivance']],
  ['describe', 'description', ['describement', 'describation', 'describal']],
  ['explain', 'explanation', ['explainment', 'explaination', 'explainal']],
  ['invite', 'invitation', ['invitement', 'invital', 'invition']],
  ['agree', 'agreement', ['agreeation', 'agreeal', 'agreance']],
  ['improve', 'improvement', ['improvation', 'improval', 'improvance']],
  ['enjoy', 'enjoyment', ['enjoyation', 'enjoyal', 'enjoyness']],
  ['refuse', 'refusal', ['refusement', 'refusation', 'refusion']],
  ['choose', 'choice', ['choosement', 'choosal', 'choosation']],
  ['succeed', 'success', ['succeedment', 'succeedation', 'succeedal']],
  ['marry', 'marriage', ['marryment', 'marrition', 'marryal']],
  ['know', 'knowledge', ['knowment', 'knowation', 'knowance']],
  ['grow', 'growth', ['growment', 'growation', 'growal']],
  ['protect', 'protection', ['protectment', 'protectal', 'protectance']],
  ['educate', 'education', ['educatement', 'educatal', 'educance']],
  ['behave', 'behaviour', ['behavement', 'behavation', 'behaval']],
  ['laugh', 'laughter', ['laughment', 'laughation', 'laughal']],
]
// noun → adjective
const ADJ_FROM_NOUNS: [string, string, [string, string, string]][] = [
  ['danger', 'dangerous', ['dangerful', 'dangery', 'dangerly']],
  ['poison', 'poisonous', ['poisonful', 'poisony', 'poisonly']],
  ['fame', 'famous', ['fameful', 'famy', 'famely']],
  ['beauty', 'beautiful', ['beautious', 'beautyful', 'beautyous']],
  ['nature', 'natural', ['natureful', 'naturous', 'naturely']],
  ['music', 'musical', ['musicful', 'musicous', 'musicy']],
  ['sun', 'sunny', ['sunful', 'sunous', 'suny']],
  ['rain', 'rainy', ['rainful', 'rainous', 'rainly']],
  ['noise', 'noisy', ['noiseful', 'noiseous', 'noisely']],
  ['courage', 'courageous', ['courageful', 'couragy', 'couragely']],
  ['mud', 'muddy', ['mudful', 'mudous', 'mudy']],
  ['fool', 'foolish', ['foolful', 'foolous', 'fooly']],
]
const wordFormation = (which: 'nouns' | 'all'): Make => () => {
  const toAdj = which === 'all' && Math.random() < 0.5
  const [word, answer, wrong] = pick(toAdj ? ADJ_FROM_NOUNS : NOUNS_FROM_VERBS)
  const prompt = toAdj ? `Make an adjective from "${word}": ___` : `Make a noun from "${word}": ___`
  return {
    topic: 'word formation',
    prompt,
    speak: toAdj ? `Make an adjective from the word ${word}.` : `Make a noun from the word ${word}.`,
    answer,
    choices: choices(answer, wrong),
    steps: [toAdj ? 'An adjective describes a noun.' : 'A noun names a thing or an idea.', `${word} → ${answer}`],
  }
}

// one word for many: [meaning, word, words that could also fit (never offered as wrong choices)]
const ONE_WORD: [string, string, string[], 'person' | 'place'][] = [
  ['a person who treats sick people', 'doctor', ['nurse'], 'person'],
  ['a person who flies an aeroplane', 'pilot', [], 'person'],
  ['a person who mends shoes', 'cobbler', [], 'person'],
  ['a person who sells meat', 'butcher', [], 'person'],
  ['a person who bakes bread', 'baker', [], 'person'],
  ['a person who makes things from wood', 'carpenter', [], 'person'],
  ['a person who cuts hair', 'barber', [], 'person'],
  ['a person who writes books', 'author', ['writer'], 'person'],
  ['a person who rides a bicycle', 'cyclist', [], 'person'],
  ['a person who repairs cars', 'mechanic', [], 'person'],
  ['a person who catches fish', 'fisherman', [], 'person'],
  ['a person who grows crops', 'farmer', [], 'person'],
  ['a person who looks after a library', 'librarian', [], 'person'],
  ['a person who visits a place on holiday', 'tourist', [], 'person'],
  ['a child whose parents have died', 'orphan', [], 'person'],
  ['a place where books are kept for reading', 'library', [], 'place'],
  ['a place where sick people are treated', 'hospital', ['clinic'], 'place'],
  ['a place where aeroplanes land', 'airport', [], 'place'],
  ['a place where money is kept safely', 'bank', [], 'place'],
  ['a place where we buy medicine', 'pharmacy', [], 'place'],
  ['a place where wild animals are kept for people to see', 'zoo', [], 'place'],
  ['a place where bread is made', 'bakery', [], 'place'],
]
const oneWord = (which: 'person' | 'all'): Make => () => {
  const list = ONE_WORD.filter((o) => which === 'all' || o[3] === 'person')
  const [meaning, word, also, kind] = pick(list)
  const pool = ONE_WORD.filter((o) => o[3] === kind && !also.includes(o[1])).map((o) => o[1])
  return {
    topic: 'one word for many',
    prompt: `One word for ${meaning}: ___`,
    speak: `What is one word for ${meaning}?`,
    answer: word,
    choices: choices(word, pool),
    extraSeconds: 4,
    steps: [`${cap(meaning)} is a ${word}.`],
  }
}

// ---------- what each class + level practises ----------

const plan = (l: Record<Level, Make[]>) => l
export const ENGLISH_UPPER_PLAN: Plan = {
  P4: plan({
    simple: [plural(['regular', 'es', 'ies']), gender(), young()],
    medium: [pastTense('common'), plural(['ys', 'irregular', 'same']), young()],
    hard: [comparing(['er', 'double', 'e']), contraction(), gender()],
    pro: [alphabetical(false), possession('one'), comparing(['ier'])],
  }),
  P5: plan({
    simple: [comparing(['er', 'double', 'ier', 'e']), collective(), plural(['regular', 'es', 'ies', 'ys'])],
    medium: [pastTense('all'), adverb(), comparing(['more'])],
    hard: [possession('all'), plural(['ves', 'oes', 'os', 'irregular']), contraction()],
    pro: [pastParticiple(), gender(), alphabetical(false)],
  }),
  P6: plan({
    simple: [collective(), young(), gender(), adverb()],
    medium: [questionTag('easy'), pastParticiple(), comparing(['more', 'irregular'])],
    hard: [wordFormation('nouns'), oneWord('person'), possession('all')],
    pro: [questionTag('all'), alphabetical(true), plural(['ves', 'oes', 'os', 'compound'])],
  }),
  P7: plan({
    simple: [pastParticiple(), contraction(), collective()],
    medium: [wordFormation('all'), comparing(['more', 'irregular', 'ier'])],
    hard: [questionTag('all'), oneWord('all')],
    pro: [alphabetical(true), possession('all'), plural(['compound', 'irregular', 'ves']), wordFormation('all')],
  }),
}
