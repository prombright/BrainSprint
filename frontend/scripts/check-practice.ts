// Tests the adaptive-practice rules. Run: node scripts/check-practice.ts
import { addResult, buildPractice, mastery, topicLevel, updateCard, dueCards, type ReviewCard, type TopicStat } from '../src/game/practice.ts'
import { makeSprint } from '../src/game/sprint.ts'

let failed = 0
const ok = (c: boolean, label: string) => {
  console.log(c ? '✓' : '✗ FAIL', label)
  if (!c) failed++
}
const DAY = 864e5

// mastery follows recent answers
let s: TopicStat | undefined
for (const r of [0, 0, 1, 0]) s = addResult(s, r === 1)
ok(topicLevel(s!) === 'new', 'fewer than 5 answers: not judged yet')
s = addResult(s, false)
ok(mastery(s!) === 20 && topicLevel(s!) === 'weak', `5 answers, 1 right: 20%, weak`)
for (let i = 0; i < 20; i++) s = addResult(s, true)
ok(mastery(s!) === 100 && topicLevel(s!) === 'strong' && s!.total === 25, 'recent answers outweigh old ones: 20 right in a row → strong')

// the try-again box
const [q] = makeSprint('maths', 'P5', 'hard', 1)
const t0 = Date.UTC(2026, 9, 10)
let box: ReviewCard[] = updateCard([], q, 'maths', 'P5', false, t0)
ok(box.length === 1 && box[0].box === 0 && box[0].due === t0 + DAY, 'a wrong answer comes back tomorrow')
ok(dueCards(box, 'maths', 'P5', t0 + DAY / 2).length === 0 && dueCards(box, 'maths', 'P5', t0 + DAY).length === 1, 'not due early; due after a day')
box = updateCard(box, q, 'maths', 'P5', true, t0 + DAY / 2)
ok(box[0].box === 0, 'answering right before it is due does not count')
let t = t0 + DAY
const schedule: number[] = []
for (const gap of [3, 7, 14]) {
  box = updateCard(box, q, 'maths', 'P5', true, t)
  schedule.push(Math.round((box[0].due - t) / DAY))
  t = box[0].due
}
ok(schedule.join(',') === '3,7,14', `right answers push it back: ${schedule.join(', ')} days`)
box = updateCard(box, q, 'maths', 'P5', true, t)
ok(box.length === 0, 'a fourth right answer means learnt: out of the box')
box = updateCard(updateCard([], q, 'maths', 'P5', false, t0), q, 'maths', 'P5', false, t0 + 2 * DAY)
ok(box[0].box === 0 && box[0].due === t0 + 3 * DAY, 'a wrong answer while reviewing starts again at 1 day')

// practice sprints aim at weak topics and include due reviews
const due: ReviewCard[] = makeSprint('maths', 'P5', 'pro', 6).map((x) => ({ q: x, subject: 'maths', grade: 'P5', box: 0, due: 0 }))
const p = buildPractice({ subject: 'maths', grade: 'P5', levels: ['simple', 'medium', 'hard', 'pro'], weak: ['fractions', 'decimals'], due })
const reviews = p.filter((x) => x.review).length
const focus = p.filter((x) => !x.review && ['fractions', 'decimals'].includes(x.topic)).length
ok(p.length === 10 && reviews === 4, `10 questions, 4 from the try-again box (got ${reviews})`)
ok(focus === 6, `the other 6 are from weak topics fractions/decimals (got ${focus})`)
const one = buildPractice({ subject: 'maths', grade: 'P5', levels: ['simple', 'medium', 'hard', 'pro'], weak: ['fractions'], topic: 'algebra', due })
ok(one.length === 10 && one.every((x) => x.topic === 'algebra'), 'practising one topic gives 10 questions of that topic')
const thin = buildPractice({ subject: 'maths', grade: 'P5', levels: ['simple'], weak: ['money'], due: [] })
ok(thin.length === 10, 'a weak topic missing from open levels is topped up to 10')
ok(new Set(p.map((x) => x.key)).size === p.length, 'no repeats inside a practice sprint')

console.log(failed ? `\n${failed} FAILED` : '\nAll practice checks pass')
process.exit(failed ? 1 : 0)
