// Maths with pictures the app draws (see components/QuestionDiagram.vue): clocks, shapes, number lines,
// shaded fractions, rectangles and triangles with their sides, circles, Venn diagrams and bar graphs.
// The numbers in each picture are random, so these never run out either.

import type { Make } from './sprint.ts'
import { choicesFrom, fmt, pick, randInt, shuffle } from './random.ts'
import { numeric } from './mathskit.ts'


// ---------- clocks ----------

const hourAfter = (h: number) => (h % 12) + 1
const hourBefore = (h: number) => ((h + 10) % 12) + 1

/** Read a clock face: o'clock, half past, quarter past/to, or any five minutes (written 4:35). */
export const clockFace = (kind: 'oclock' | 'half' | 'quarter' | 'five'): Make => () => {
  const h = randInt(1, 12)
  if (kind === 'oclock') {
    const answer = `${h} o'clock`
    return {
      topic: 'time', prompt: 'What time is it?', speak: 'Look at the clock. What time is it?', diagram: { kind: 'clock', h, m: 0 },
      answer, choices: choicesFrom(answer, [hourAfter(h), hourBefore(h), (h + 5) % 12 + 1, 12 - h || 12].map((x) => `${x} o'clock`)),
      steps: ['The long hand points to 12, so it is o\'clock.', `The short hand points to ${h}: ${answer}.`],
    }
  }
  if (kind === 'half') {
    const answer = `half past ${h}`
    return {
      topic: 'time', prompt: 'What time is it?', speak: 'Look at the clock. What time is it?', diagram: { kind: 'clock', h, m: 30 },
      answer, choices: choicesFrom(answer, [`half past ${hourAfter(h)}`, `half past ${hourBefore(h)}`, `${h} o'clock`, `${hourAfter(h)} o'clock`]),
      steps: ['The long hand points to 6: half past.', `The short hand is just past ${h}: ${answer}.`],
    }
  }
  if (kind === 'quarter') {
    const past = Math.random() < 0.5
    const answer = past ? `quarter past ${h}` : `quarter to ${hourAfter(h)}`
    return {
      topic: 'time', prompt: 'What time is it?', speak: 'Look at the clock. What time is it?', diagram: { kind: 'clock', h, m: past ? 15 : 45 },
      answer,
      choices: choicesFrom(answer, [`quarter to ${h}`, `quarter past ${hourAfter(h)}`, `half past ${h}`, past ? `quarter to ${hourAfter(h)}` : `quarter past ${h}`]),
      steps: [past ? 'The long hand points to 3: quarter past.' : 'The long hand points to 9: quarter to the next hour.', answer],
    }
  }
  const m = randInt(1, 11) * 5
  const answer = `${h}:${String(m).padStart(2, '0')}`
  // a common mistake: reading the hands the wrong way round
  const swapped = `${m / 5}:${String((h % 12) * 5).padStart(2, '0')}`
  return {
    topic: 'time', prompt: 'What time does the clock show?', speak: 'Look at the clock. What time does it show?', diagram: { kind: 'clock', h, m },
    answer,
    choices: choicesFrom(answer, [swapped, `${hourAfter(h)}:${String(m).padStart(2, '0')}`, `${h}:${String(60 - m).padStart(2, '0')}`, `${h}:${String((m + 5) % 60).padStart(2, '0')}`]),
    steps: [`The short hand has passed ${h}, so the hour is ${h}.`, `The long hand points to ${m / 5}: ${m / 5} × 5 = ${m} minutes.`, `The time is ${answer}`],
  }
}

// ---------- shapes for the youngest ----------

const SHAPES = { circle: 0, oval: 0, triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 } as const
type ShapeName = keyof typeof SHAPES

export const shapeName = (names: ShapeName[]): Make => () => {
  const shape = pick(names)
  return {
    topic: 'shapes', prompt: 'What shape is this?', speak: 'Look at the picture. What shape is this?', diagram: { kind: 'shape', shape },
    answer: shape, choices: choicesFrom(shape, names.length >= 4 ? names : Object.keys(SHAPES)),
    steps: [`This shape is a ${shape}.`],
  }
}

export const shapeSides = (names: ShapeName[]): Make => () => {
  const shape = pick(names.filter((n) => SHAPES[n] > 0))
  const sides = SHAPES[shape]
  return numeric('shapes', 'How many sides does this shape have?', 'Count the sides. How many sides does this shape have?', sides, {
    diagram: { kind: 'shape', shape }, steps: [`A ${shape} has ${sides} straight sides.`, `Answer: ${sides}`],
  }, 1, 2)
}

// ---------- number lines ----------

export const numberLine = (to: number, step: number): Make => () => {
  const n = to / step
  const k = randInt(1, n - 1)
  const mark = k * step
  return numeric('number lines', 'What number is the arrow pointing to?', 'Look at the number line. What number is the arrow pointing to?', mark, {
    diagram: { kind: 'numberline', from: 0, to, step, mark },
    steps: [`Each small mark is ${step} more than the one before.`, `Count ${k} marks from 0: ${mark}`],
  }, step)
}

// ---------- shaded fractions ----------

const sameValue = (a: [number, number], b: [number, number]) => a[0] * b[1] === b[0] * a[1]

export const fractionShaded = (maxParts: number): Make => () => {
  const parts = randInt(2, maxParts)
  const shaded = randInt(1, parts - 1)
  const answer = `${shaded}/${parts}`
  // never offer another way of writing the same amount (2/4 when 1/2 is shaded)
  const wrong = [[parts - shaded, parts], [shaded, parts - shaded], [shaded + 1, parts], [shaded, parts + 1], [Math.max(1, shaded - 1), parts]]
    .filter(([a, b]) => a > 0 && b > 0 && a < b && !sameValue([a, b], [shaded, parts]))
    .map(([a, b]) => `${a}/${b}`)
  return {
    topic: 'fractions', prompt: 'What fraction is shaded?', speak: 'Look at the picture. What fraction is shaded?',
    diagram: { kind: 'fraction', parts, shaded, style: Math.random() < 0.5 ? 'circle' : 'bar' },
    answer, choices: choicesFrom(answer, wrong),
    steps: [`The whole is cut into ${parts} equal parts (the bottom number).`, `${shaded} parts are shaded (the top number): ${answer}`],
  }
}

// ---------- area and perimeter with the shape drawn ----------

export const rectangleDrawn = (what: 'perimeter' | 'area' | 'both', maxSide: number): Make => () => {
  const w = randInt(3, maxSide)
  let h = randInt(2, maxSide)
  if (h === w) h = w > 2 ? w - 1 : w + 1
  const unit = pick(['cm', 'm'])
  const ask = what === 'both' ? pick(['perimeter', 'area'] as const) : what
  const diagram = { kind: 'rect' as const, w: `${w} ${unit}`, h: `${h} ${unit}` }
  if (ask === 'perimeter') {
    const p = 2 * (w + h)
    return numeric('area and perimeter', `Find the perimeter of the rectangle (in ${unit}).`, `Find the perimeter of the rectangle in ${unit === 'cm' ? 'centimetres' : 'metres'}.`, p, {
      diagram, steps: ['Perimeter is the distance all the way round.', `${w} + ${h} + ${w} + ${h} = ${p}`, `Perimeter = ${p} ${unit}`],
    }, 2)
  }
  const a = w * h
  return numeric('area and perimeter', `Find the area of the rectangle (in square ${unit}).`, `Find the area of the rectangle in square ${unit === 'cm' ? 'centimetres' : 'metres'}.`, a, {
    diagram, steps: ['Area of a rectangle = length × width.', `${w} × ${h} = ${a}`, `Area = ${a} square ${unit}`],
  }, Math.max(1, Math.min(w, h)))
}

export const triangleDrawn = (): Make => () => {
  const base = randInt(3, 12) * 2
  const height = randInt(3, 14)
  const area = (base * height) / 2
  return numeric('area and perimeter', 'Find the area of the triangle (in square cm).', 'Find the area of the triangle in square centimetres.', area, {
    diagram: { kind: 'triangle', base: `${base} cm`, height: `${height} cm` },
    steps: ['Area of a triangle = ½ × base × height.', `½ × ${base} × ${height} = ${base / 2} × ${height}`, `Area = ${area} square cm`],
  }, Math.max(1, height))
}

export const circleDrawn = (): Make => () => {
  const r = pick([7, 14, 21, 28, 35])
  const diameter = Math.random() < 0.4
  const label = diameter ? `${2 * r} cm` : `${r} cm`
  const diagram = { kind: 'circle' as const, label, line: diameter ? 'diameter' as const : 'radius' as const }
  const first = diameter ? [`The diameter is ${2 * r} cm, so the radius is ${r} cm.`] : []
  if (Math.random() < 0.5) {
    const c = (44 * r) / 7
    return numeric('circles', 'Find the circumference of the circle (in cm). Use π = 22/7.', 'Find the circumference of the circle in centimetres. Use pi equals twenty two over seven.', c, {
      diagram, steps: [...first, 'Circumference = 2 × π × r', `2 × 22/7 × ${r} = 44 × ${r / 7}`, `Circumference = ${c} cm`],
    }, 22)
  }
  const a = (22 * r * r) / 7
  return numeric('circles', 'Find the area of the circle (in square cm). Use π = 22/7.', 'Find the area of the circle in square centimetres. Use pi equals twenty two over seven.', a, {
    diagram, steps: [...first, 'Area = π × r × r', `22/7 × ${r} × ${r} = 22 × ${r / 7} × ${r}`, `Area = ${fmt(a)} square cm`],
  }, 22 * (r / 7))
}

// ---------- Venn diagrams ----------

const PAIRS: [string, string, string][] = [
  ['Football', 'Netball', 'play'], ['Maths', 'English', 'like'], ['Mangoes', 'Oranges', 'eat'], ['Tea', 'Milk', 'take'], ['Singing', 'Dancing', 'enjoy'],
]

export const vennRead = (hard: boolean): Make => () => {
  const [a, b, verb] = pick(PAIRS)
  const onlyA = randInt(3, 20)
  const both = randInt(2, 15)
  const onlyB = randInt(3, 20)
  const outside = hard ? randInt(1, 9) : undefined
  const total = onlyA + both + onlyB + (outside ?? 0)
  const shown = { kind: 'venn' as const, a, b, onlyA: String(onlyA), both: String(both), onlyB: String(onlyB), outside: outside === undefined ? undefined : String(outside) }
  const ask = pick(hard ? ['onlyA', 'allA', 'total', 'missing', 'neither'] : ['both', 'onlyA', 'allA', 'total'])
  if (ask === 'missing') {
    // one region hidden: find it from the total
    return numeric('sets', `${total} pupils were asked. Find the number for "?" in the diagram.`, `${total} pupils were asked. Find the missing number.`, onlyB, {
      diagram: { ...shown, onlyB: '?' }, extraSeconds: 15,
      steps: ['All the numbers in the diagram add up to the total.', `${onlyA} + ${both} + ${outside ?? 0} = ${onlyA + both + (outside ?? 0)}`, `${total} − ${onlyA + both + (outside ?? 0)} = ${onlyB}`],
    })
  }
  const q: Record<string, [string, number, string[]]> = {
    both: [`How many pupils ${verb} both ${a} and ${b}?`, both, ['Both = the part where the circles overlap.', `Answer: ${both}`]],
    onlyA: [`How many pupils ${verb} only ${a}?`, onlyA, [`Only ${a} = the part of the ${a} circle outside the overlap.`, `Answer: ${onlyA}`]],
    allA: [`How many pupils ${verb} ${a} altogether?`, onlyA + both, [`Everything inside the ${a} circle: only ${a} + both.`, `${onlyA} + ${both} = ${onlyA + both}`]],
    total: [`How many pupils were asked altogether?`, total, ['Add every number in the diagram.', `${[onlyA, both, onlyB, outside].filter((x) => x !== undefined).join(' + ')} = ${total}`]],
    neither: [`How many pupils ${verb} neither ${a} nor ${b}?`, outside ?? 0, ['Neither = outside both circles, inside the box.', `Answer: ${outside}`]],
  }
  const [prompt, answer, steps] = q[ask]
  return numeric('sets', prompt, prompt, answer, { diagram: shown, extraSeconds: 10, steps })
}

// ---------- bar graphs ----------

const GRAPHS: { title: string; labels: string[]; what: string }[] = [
  { title: 'Bags of maize sold', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], what: 'bags of maize were sold' },
  { title: 'Pupils present', labels: ['P3', 'P4', 'P5', 'P6', 'P7'], what: 'pupils were present' },
  { title: 'Mangoes picked', labels: ['Amina', 'Kato', 'Apio', 'Opio'], what: 'mangoes were picked' },
  { title: 'Litres of milk', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], what: 'litres of milk were collected' },
]

export const barGraph = (withMean: boolean): Make => () => {
  const g = pick(GRAPHS)
  const step = pick([2, 5, 10])
  // all different, so "most" and "least" have one answer
  const values = shuffle(Array.from({ length: 10 }, (_, i) => (i + 1) * step)).slice(0, g.labels.length)
  const diagram = { kind: 'bars' as const, title: g.title, labels: g.labels, values, step }
  const kinds = ['most', 'least', 'more', 'total', 'one', ...(withMean ? ['mean'] : [])]
  const ask = pick(kinds)
  const by = (i: number) => g.labels[i]
  const maxI = values.indexOf(Math.max(...values))
  const minI = values.indexOf(Math.min(...values))
  if (ask === 'most' || ask === 'least') {
    const i = ask === 'most' ? maxI : minI
    return {
      topic: 'graphs', prompt: `Which had the ${ask === 'most' ? 'most' : 'fewest'}? (${g.title.toLowerCase()})`, speak: `Look at the graph. Which had the ${ask === 'most' ? 'most' : 'fewest'}?`,
      diagram, answer: by(i), choices: choicesFrom(by(i), g.labels),
      steps: [`Find the ${ask === 'most' ? 'tallest' : 'shortest'} bar: ${by(i)} (${values[i]}).`],
    }
  }
  if (ask === 'one') {
    const i = randInt(0, values.length - 1)
    return numeric('graphs', `How many ${g.what.split(' ')[0]} for ${by(i)}?`, `Look at the graph. How many for ${by(i)}?`, values[i], {
      diagram, steps: [`Go to the top of the ${by(i)} bar and read across to the scale: ${values[i]}`],
    }, step)
  }
  if (ask === 'more') {
    const [i, j] = shuffle(values.map((_, k) => k)).slice(0, 2)
    const [hi, lo] = values[i] > values[j] ? [i, j] : [j, i]
    const d = values[hi] - values[lo]
    return numeric('graphs', `How many more for ${by(hi)} than for ${by(lo)}?`, `Look at the graph. How many more for ${by(hi)} than for ${by(lo)}?`, d, {
      diagram, extraSeconds: 8, steps: [`${by(hi)}: ${values[hi]}, ${by(lo)}: ${values[lo]}`, `${values[hi]} − ${values[lo]} = ${d}`],
    }, step)
  }
  const total = values.reduce((s, v) => s + v, 0)
  if (ask === 'total') {
    return numeric('graphs', `How many ${g.what} altogether?`, `Look at the graph. How many ${g.what} altogether?`, total, {
      diagram, extraSeconds: 12, steps: ['Read every bar and add.', `${values.join(' + ')} = ${total}`],
    }, step)
  }
  // mean: make the total share out exactly by changing the last bar if needed
  const n = values.length
  const rem = total % n
  if (rem) return barGraph(withMean)()
  const mean = total / n
  return numeric('graphs', `What is the mean (average) of the ${g.title.toLowerCase()}?`, `Look at the graph. What is the mean?`, mean, {
    diagram, extraSeconds: 20, steps: ['Mean = total ÷ number of bars.', `${values.join(' + ')} = ${total}`, `${total} ÷ ${n} = ${mean}`],
  }, step)
}
