// Reading comprehension: the app writes a short story and asks about it. Stories are built from
// Ugandan names, towns, foods and places, so they never run out, and every answer is in the text.
// Wrong choices are the same kind of thing (other names, towns, numbers), some taken from the story
// itself, so the child has to read carefully rather than guess.
import type { Make } from './sprint.ts'
import type { Question } from './types.ts'
import { pick, shuffle } from './random.ts'

const GIRLS = ['Amina', 'Nakato', 'Achieng', 'Apio', 'Nansubuga', 'Namata', 'Kyomugisha', 'Atim']
const BOYS = ['Okello', 'Kato', 'Wasswa', 'Opio', 'Ssemakula', 'Odongo', 'Mugisha', 'Tumusiime']
const TOWNS = ['Masaka', 'Mbarara', 'Jinja', 'Gulu', 'Lira', 'Mbale', 'Fort Portal', 'Hoima', 'Arua', 'Soroti', 'Kabale', 'Tororo']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FRUITS = ['mangoes', 'oranges', 'pineapples', 'avocados', 'pawpaws', 'bananas']
const GROCERIES = ['sugar', 'rice', 'beans', 'salt', 'maize flour']
const TIMES = ['8 o\'clock', '9 o\'clock', '10 o\'clock', 'half past two', '3 o\'clock', 'half past four', '5 o\'clock', 'half past six']
const RELATIVES = ['uncle', 'aunt', 'brother', 'sister', 'cousin', 'grandfather']
const RACES = ['100 metres', '400 metres', 'relay', 'sack', 'egg-and-spoon']
// titles that match the names (Namubiru is a woman's name, Mukasa a man's)
const HEADS = ['Mr Mukasa', 'Mrs Namubiru', 'Mr Okot', 'Ms Atwine', 'Mr Byaruhanga', 'Mrs Nakimuli', 'Mr Ochieng']
const PRIZES = ['an exercise book', 'a football', 'a certificate', 'a mathematical set', 'a school bag']
const HOUSES = ['Elgon', 'Rwenzori', 'Victoria', 'Kyoga', 'Albert', 'Muhabura']
const VILLAGES = ['Kiwanga', 'Nyamitanga', 'Bulenga', 'Kapeeka', 'Lwengo', 'Busega', 'Kitgum Matidi', 'Nakaseke']
const ANIMALS = ['chickens', 'goats', 'rabbits', 'pigs', 'cows', 'sheep']
const CROPS = ['cassava', 'beans', 'maize', 'groundnuts', 'sweet potatoes', 'bananas', 'millet', 'coffee']
const PRODUCTS = ['milk', 'eggs', 'matooke', 'vegetables', 'honey']
const TRIPS: [string, string][] = [
  ['the zoo in Entebbe', 'chimpanzees and lions'],
  ['the source of the Nile in Jinja', 'the River Nile leaving Lake Victoria'],
  ['the Uganda Museum in Kampala', 'old drums and spears'],
  ['Parliament in Kampala', 'members of parliament in a meeting'],
  ['Murchison Falls', 'water rushing through a narrow gap'],
  ['the Namugongo Martyrs Shrine', 'the place where the martyrs were killed'],
]
const TRANSPORT = ['bus', 'lorry', 'taxi', 'train']
const MONTHS = ['February', 'March', 'June', 'July', 'September', 'October']
const SCHOOLS = ['Kibuli Primary School', 'Bright Future Primary School', 'Hillside Primary School', 'St. Mary\'s Primary School', 'Lakeview Primary School']

/** a, b, c … different picks from one list */
function picks<T>(list: readonly T[], n: number): T[] {
  return shuffle(list).slice(0, n)
}

interface Ask {
  q: string
  a: string
  wrong: string[]
}

function build(topic: string, passage: string, asks: Ask[]): Omit<Question, 'key'> {
  const { q, a, wrong } = pick(asks)
  const w = shuffle([...new Set(wrong)].filter((x) => x.toLowerCase() !== a.toLowerCase())).slice(0, 3)
  return {
    topic,
    passage,
    prompt: q,
    speak: `${passage} ${q}`,
    answer: a,
    choices: shuffle([a, ...w]),
    // reading time: about one second for every 12 letters of the story
    extraSeconds: Math.min(45, Math.round(passage.length / 12)),
    steps: [`Look in the story: the answer is "${a}".`],
  }
}

const number = (n: number) => ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n - 2]

// ---------- the stories ----------

function marketStory(): Omit<Question, 'key'> {
  const girl = Math.random() < 0.5
  const [child, met] = girl ? [pick(GIRLS), pick(BOYS)] : [pick(BOYS), pick(GIRLS)]
  const her = girl ? 'her' : 'his'
  const [rel, otherRel] = picks(RELATIVES, 2)
  const relName = pick(['grandfather', 'brother', 'uncle', 'cousin'].includes(rel) ? BOYS.filter((b) => b !== child && b !== met) : GIRLS.filter((g) => g !== child && g !== met))
  const [town] = picks(TOWNS, 1)
  const day = pick(DAYS)
  const [fruit] = picks(FRUITS, 1)
  const grocery = pick(GROCERIES)
  const [n1, n2] = picks([2, 3, 4, 5, 6, 7, 8, 9, 10], 2)
  const time = pick(TIMES)
  const passage =
    `On ${day}, ${child} went to ${town} market with ${her} ${rel}, ${relName}. ` +
    `They bought ${number(n1)} ${fruit} and ${number(n2)} kilograms of ${grocery}. ` +
    `On the way home, they met ${met}, who was riding a bicycle. They got home at ${time}.`
  return build('reading comprehension', passage, [
    { q: `Who went to the market with ${child}?`, a: relName, wrong: [met, ...GIRLS, ...BOYS].filter((x) => x !== child) },
    { q: `Which market did they go to?`, a: `${town} market`, wrong: TOWNS.map((t) => `${t} market`) },
    { q: `On which day did they go to the market?`, a: day, wrong: DAYS },
    { q: `How many ${fruit} did they buy?`, a: number(n1), wrong: [number(n2), ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(number)] },
    { q: `Who was riding a bicycle?`, a: met, wrong: [relName, child, ...GIRLS, ...BOYS] },
    { q: `What time did they get home?`, a: time, wrong: TIMES },
    { q: `How is ${relName} related to ${child}?`, a: `${her} ${rel}`, wrong: RELATIVES.filter((r) => r !== rel).map((r) => `${her} ${r}`).concat(`${her} ${otherRel}`) },
  ])
}

function sportsStory(): Omit<Question, 'key'> {
  const school = pick(SCHOOLS)
  const day = pick(DAYS.slice(0, 5))
  const [winner, second] = picks([...GIRLS, ...BOYS], 2)
  const race = pick(RACES)
  const prize = pick(PRIZES)
  const house = pick(HOUSES)
  const head = pick(HEADS)
  const time = pick(TIMES)
  const passage =
    `On ${day}, ${school} held its sports day. ${winner} won the ${race} race and got ${prize}. ` +
    `${second} came second. The pupils of ${house} House cheered the loudest. ` +
    `The head teacher, ${head}, gave out the prizes at ${time}.`
  return build('reading comprehension', passage, [
    { q: `Who won the ${race} race?`, a: winner, wrong: [second, ...GIRLS, ...BOYS] },
    { q: `Who came second?`, a: second, wrong: [winner, ...GIRLS, ...BOYS] },
    { q: `What did ${winner} get as a prize?`, a: prize, wrong: PRIZES },
    { q: `Which house cheered the loudest?`, a: `${house} House`, wrong: HOUSES.map((h) => `${h} House`) },
    { q: `Who gave out the prizes?`, a: head, wrong: [...HEADS, winner] },
    { q: `Which race did ${winner} win?`, a: `the ${race} race`, wrong: RACES.map((r) => `the ${r} race`) },
    { q: `On which day was the sports day?`, a: day, wrong: DAYS },
  ])
}

function farmStory(): Omit<Question, 'key'> {
  const girl = Math.random() < 0.5
  const child = pick(girl ? GIRLS : BOYS)
  const his = girl ? 'her' : 'his'
  const village = pick(VILLAGES)
  const n = pick([2, 3, 4, 5, 6, 7, 8, 9, 10])
  const animals = pick(ANIMALS)
  const [crop1, crop2] = picks(CROPS, 2)
  const product = pick(PRODUCTS)
  const day = pick(DAYS)
  const notGrown = CROPS.filter((c) => c !== crop1 && c !== crop2)
  const passage =
    `${child} lives in ${village} village with ${his} grandmother. Every morning, ${child} feeds ${number(n)} ${animals} ` +
    `before going to school. ${his.charAt(0).toUpperCase() + his.slice(1)} grandmother grows ${crop1} and ${crop2}. ` +
    `On ${day}s, they sell ${product} at the trading centre.`
  return build('reading comprehension', passage, [
    { q: `Where does ${child} live?`, a: `${village} village`, wrong: VILLAGES.map((v) => `${v} village`) },
    { q: `Who does ${child} live with?`, a: `${his} grandmother`, wrong: ['grandfather', 'uncle', 'aunt', 'sister', 'teacher'].map((r) => `${his} ${r}`) },
    { q: `How many ${animals} does ${child} feed every morning?`, a: number(n), wrong: [2, 3, 4, 5, 6, 7, 8, 9, 10].map(number) },
    { q: `Which animals does ${child} feed?`, a: animals, wrong: ANIMALS },
    // only one of the choices is grown by the grandmother
    { q: `Which crop does ${his} grandmother grow?`, a: pick([crop1, crop2]), wrong: notGrown },
    { q: `What do they sell at the trading centre?`, a: product, wrong: [...PRODUCTS, crop1, crop2] },
    { q: `When does ${child} feed the ${animals}?`, a: 'every morning', wrong: ['every evening', 'at lunch time', 'on Sundays', 'after school'] },
  ])
}

function tripStory(): Omit<Question, 'key'> {
  const month = pick(MONTHS)
  const grade = pick(['P4', 'P5', 'P6', 'P7'])
  const school = pick(SCHOOLS)
  const [place, saw] = pick(TRIPS)
  const transport = pick(TRANSPORT.slice(0, 3))
  const time = pick(TIMES.slice(0, 3))
  const child = pick([...GIRLS, ...BOYS])
  const n = pick([5, 6, 7, 8, 9, 10])
  const passage =
    `Last ${month}, the ${grade} pupils of ${school} went on a trip to ${place}. They travelled by ${transport} ` +
    `and left school at ${time}. There they saw ${saw}. ${child} took ${number(n)} photographs.`
  return build('reading comprehension', passage, [
    { q: `Where did the pupils go?`, a: place, wrong: TRIPS.map((t) => t[0]) },
    { q: `How did the pupils travel?`, a: `by ${transport}`, wrong: TRANSPORT.map((t) => `by ${t}`).concat('on foot') },
    { q: `In which month did they go on the trip?`, a: month, wrong: MONTHS },
    { q: `Which class went on the trip?`, a: grade, wrong: ['P3', 'P4', 'P5', 'P6', 'P7'] },
    { q: `What did they see there?`, a: saw, wrong: TRIPS.map((t) => t[1]) },
    { q: `How many photographs did ${child} take?`, a: number(n), wrong: [5, 6, 7, 8, 9, 10].map(number) },
    { q: `What time did they leave school?`, a: time, wrong: TIMES.slice(0, 5) },
  ])
}

/** A story and one question about it. `stories` limits which kinds (the easier ones for younger classes). */
export const comprehension = (stories: ('market' | 'sports' | 'farm' | 'trip')[]): Make => () => {
  const kind = pick(stories)
  return kind === 'market' ? marketStory() : kind === 'sports' ? sportsStory() : kind === 'farm' ? farmStory() : tripStory()
}
