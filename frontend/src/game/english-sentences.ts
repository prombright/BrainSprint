// English in sentences: choose the right verb form inside a real sentence. People × verbs × endings ×
// time words give tens of thousands of different questions, each one right by the rules of grammar:
//   every day → goes / go      yesterday → went      now → is going      tomorrow → will go
//   did not → go               has / have → gone     Does / Do … ?
import type { Make } from './sprint.ts'
import { pick, shuffle } from './random.ts'

// every form of each verb, and sentence endings that make sense with it
const VERBS: { base: string; s: string; past: string; ing: string; part: string; endings: string[] }[] = [
  { base: 'go', s: 'goes', past: 'went', ing: 'going', part: 'gone', endings: ['to school', 'to the market', 'to church', 'home early', 'to the well'] },
  { base: 'eat', s: 'eats', past: 'ate', ing: 'eating', part: 'eaten', endings: ['rice', 'posho and beans', 'a mango', 'matooke', 'chapati'] },
  { base: 'drink', s: 'drinks', past: 'drank', ing: 'drinking', part: 'drunk', endings: ['water', 'milk', 'tea', 'porridge'] },
  { base: 'play', s: 'plays', past: 'played', ing: 'playing', part: 'played', endings: ['football', 'netball', 'in the compound', 'with friends'] },
  { base: 'write', s: 'writes', past: 'wrote', ing: 'writing', part: 'written', endings: ['a letter', 'a story', 'notes in class'] },
  { base: 'sing', s: 'sings', past: 'sang', ing: 'singing', part: 'sung', endings: ['a song', 'in the choir', 'the national anthem'] },
  { base: 'swim', s: 'swims', past: 'swam', ing: 'swimming', part: 'swum', endings: ['in the lake', 'in the river'] },
  { base: 'run', s: 'runs', past: 'ran', ing: 'running', part: 'run', endings: ['to school', 'around the field', 'to the shop'] },
  { base: 'carry', s: 'carries', past: 'carried', ing: 'carrying', part: 'carried', endings: ['water', 'firewood', 'a heavy bag'] },
  { base: 'cook', s: 'cooks', past: 'cooked', ing: 'cooking', part: 'cooked', endings: ['supper', 'beans', 'food for the family'] },
  { base: 'wash', s: 'washes', past: 'washed', ing: 'washing', part: 'washed', endings: ['the plates', 'clothes', 'the car'] },
  { base: 'dig', s: 'digs', past: 'dug', ing: 'digging', part: 'dug', endings: ['in the garden', 'a hole'] },
  { base: 'sweep', s: 'sweeps', past: 'swept', ing: 'sweeping', part: 'swept', endings: ['the compound', 'the classroom', 'the house'] },
  { base: 'buy', s: 'buys', past: 'bought', ing: 'buying', part: 'bought', endings: ['sugar', 'bread', 'a new pen', 'tomatoes'] },
  { base: 'sell', s: 'sells', past: 'sold', ing: 'selling', part: 'sold', endings: ['mangoes', 'milk', 'tomatoes at the market'] },
  { base: 'draw', s: 'draws', past: 'drew', ing: 'drawing', part: 'drawn', endings: ['a picture', 'a map of Uganda'] },
  { base: 'ride', s: 'rides', past: 'rode', ing: 'riding', part: 'ridden', endings: ['a bicycle', 'a bicycle to school'] },
  { base: 'climb', s: 'climbs', past: 'climbed', ing: 'climbing', part: 'climbed', endings: ['a tree', 'the hill', 'a mango tree'] },
  { base: 'watch', s: 'watches', past: 'watched', ing: 'watching', part: 'watched', endings: ['television', 'a football match'] },
  { base: 'fetch', s: 'fetches', past: 'fetched', ing: 'fetching', part: 'fetched', endings: ['water', 'firewood'] },
  { base: 'plant', s: 'plants', past: 'planted', ing: 'planting', part: 'planted', endings: ['beans', 'maize', 'trees'] },
  { base: 'clean', s: 'cleans', past: 'cleaned', ing: 'cleaning', part: 'cleaned', endings: ['the classroom', 'the house', 'the toilets'] },
  { base: 'visit', s: 'visits', past: 'visited', ing: 'visiting', part: 'visited', endings: ['the zoo', 'the hospital', 'the museum'] },
  { base: 'feed', s: 'feeds', past: 'fed', ing: 'feeding', part: 'fed', endings: ['the chickens', 'the goats', 'the rabbits'] },
  { base: 'bring', s: 'brings', past: 'brought', ing: 'bringing', part: 'brought', endings: ['a book to school', 'water to class'] },
  { base: 'catch', s: 'catches', past: 'caught', ing: 'catching', part: 'caught', endings: ['fish', 'the ball'] },
  { base: 'throw', s: 'throws', past: 'threw', ing: 'throwing', part: 'thrown', endings: ['the ball', 'the rubbish in the bin'] },
  { base: 'make', s: 'makes', past: 'made', ing: 'making', part: 'made', endings: ['a kite', 'tea', 'a mat'] },
  { base: 'fly', s: 'flies', past: 'flew', ing: 'flying', part: 'flown', endings: ['a kite'] },
  { base: 'study', s: 'studies', past: 'studied', ing: 'studying', part: 'studied', endings: ['for the exams', 'science', 'at night'] },
  { base: 'dance', s: 'dances', past: 'danced', ing: 'dancing', part: 'danced', endings: ['at the party', 'in the competition'] },
  { base: 'take', s: 'takes', past: 'took', ing: 'taking', part: 'taken', endings: ['the goats to graze', 'a bath', 'the books to the library'] },
  { base: 'give', s: 'gives', past: 'gave', ing: 'giving', part: 'given', endings: ['food to the dog', 'a gift to the teacher'] },
]

// who does it: one person (goes) or more than one, I and you (go)
type Who = { text: string; one: boolean; be: 'is' | 'are' | 'am'; have: 'has' | 'have'; do: 'does' | 'do' }
const one = (text: string): Who => ({ text, one: true, be: 'is', have: 'has', do: 'does' })
const many = (text: string): Who => ({ text, one: false, be: 'are', have: 'have', do: 'do' })
const PEOPLE: Who[] = [
  ...['Amina', 'Okello', 'Nakato', 'Kato', 'Achieng', 'Mugisha', 'Apio', 'Wasswa', 'Nansubuga', 'Opio', 'Akello', 'Ssemakula'].map(one),
  one('He'), one('She'), one('My brother'), one('Our teacher'), one('The girl'), one('My mother'),
  many('We'), many('They'), many('The children'), many('My friends'), many('The pupils'), many('Amina and Kato'), many('You'),
  { text: 'I', one: false, be: 'am', have: 'have', do: 'do' },
]

// a sentence starting with "He" reads "Every day, he …"
const lower = (w: Who) => (/^(He|She|We|They|You|My|Our|The)\b/.test(w.text) ? w.text.charAt(0).toLowerCase() + w.text.slice(1) : w.text)
const blankSay = (s: string) => s.replace('___', 'blank')

function ask(prompt: string, answer: string, wrong: string[], rule: string, full: string): Omit<import('./types.ts').Question, 'key'> {
  const seen = new Set([answer])
  const w = shuffle(wrong).filter((x) => x && !seen.has(x) && seen.add(x))
  return {
    topic: 'verbs in sentences',
    prompt,
    speak: `${blankSay(prompt)} Choose the missing word.`,
    answer,
    choices: shuffle([answer, ...w.slice(0, 3)]),
    extraSeconds: 6,
    steps: [rule, full],
  }
}

type Tense = 'every day' | 'yesterday' | 'now' | 'tomorrow' | 'did not' | 'has' | 'helper' | 'question'

/** One sentence question in one of the given tenses. */
export const verbSentence = (tenses: Tense[]): Make => () => {
  const v = pick(VERBS)
  const w = pick(PEOPLE)
  const end = pick(v.endings)
  const forms = [v.base, v.s, v.past, v.ing, v.part]
  const tense = pick(tenses)
  switch (tense) {
    case 'every day': {
      const answer = w.one ? v.s : v.base
      const prompt = `Every day, ${lower(w)} ___ ${end}.`
      return ask(prompt, answer, forms, w.one ? `One person (${w.text}) doing it every day: add -s to the verb.` : `"${w.text}" doing it every day: use the verb without -s.`, prompt.replace('___', answer))
    }
    case 'yesterday': {
      const prompt = `Yesterday, ${lower(w)} ___ ${end}.`
      return ask(prompt, v.past, forms, `"Yesterday" is in the past, so use the past tense: ${v.base} → ${v.past}.`, prompt.replace('___', v.past))
    }
    case 'now': {
      const prompt = `${w.text} ${w.be} ___ ${end} now.`
      return ask(prompt, v.ing, forms, `After ${w.be}, for something happening now, use the -ing form.`, prompt.replace('___', v.ing))
    }
    case 'tomorrow': {
      const prompt = `Tomorrow, ${lower(w)} will ___ ${end}.`
      return ask(prompt, v.base, forms, 'After "will", use the verb without any ending.', prompt.replace('___', v.base))
    }
    case 'did not': {
      const prompt = `Yesterday, ${lower(w)} did not ___ ${end}.`
      return ask(prompt, v.base, forms, '"Did" already shows the past, so the verb after it has no ending.', prompt.replace('___', v.base))
    }
    case 'has': {
      // only verbs whose past participle differs from the past tense test the right thing
      const pv = VERBS.filter((x) => x.part !== x.past)
      const p = pick(pv)
      const e = pick(p.endings)
      const prompt = `${w.text} ${w.have} already ___ ${e}.`
      return ask(prompt, p.part, [p.base, p.s, p.past, p.ing, p.part], `After ${w.have}, use the past participle: ${p.base}, ${p.past}, ${p.part}.`, prompt.replace('___', p.part))
    }
    case 'helper': {
      // the helping verb before an -ing word
      const prompt = `${w.text} ___ ${v.ing} ${end} now.`
      return ask(prompt, w.be, ['is', 'are', 'am', 'be'], `${w.text} takes "${w.be}": I am, he/she is, we/you/they are.`, prompt.replace('___', w.be))
    }
    case 'question': {
      const subject = w.text === 'I' ? 'I' : lower(w)
      const prompt = `___ ${subject} ${v.base} ${end} every day?`
      const answer = w.do === 'does' ? 'Does' : 'Do'
      return ask(prompt, answer, ['Does', 'Do', 'Is', 'Are'], `${w.one ? 'One person: use Does.' : `"${w.text}": use Do.`} The verb after Do/Does has no ending.`, prompt.replace('___', answer))
    }
  }
}
