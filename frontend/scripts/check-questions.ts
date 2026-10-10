// Checks every question engine and measures how much variety each level has.
// Run: npm run check:questions
//
// For each subject / class / level it generates many questions and checks that:
//   - the right answer is among the choices, and choices are all different
//   - there are 2–4 choices, none empty, NaN, Infinity or undefined
//   - P4–P7 maths has worked steps, and the steps reach the right answer
// Then it reports how many *different* questions it saw.
import { makeSprint, hasQuestions, questionKey } from '../src/game/sprint.ts'
import { GRADES, LEVELS, SUBJECTS } from '../src/game/types.ts'

const SAMPLE = Number(process.argv[2] ?? 20000)
const UPPER = new Set(['P4', 'P5', 'P6', 'P7'])
// A child playing all day: ~8 hours × 6 sprints an hour × 10 questions
const ALL_DAY = 500

let problems = 0
const rows: string[] = []

for (const subject of SUBJECTS.map((s) => s.id)) {
  for (const { id: grade } of GRADES) {
    if (!hasQuestions(subject, grade)) continue
    const line = [`${subject.padEnd(8)} ${grade.padEnd(4)}`]
    for (const { id: level } of LEVELS) {
      const keys = new Set<string>()
      for (let i = 0; i < SAMPLE / 10; i++) {
        for (const q of makeSprint(subject, grade, level, 10)) {
          keys.add(questionKey(q))
          const bad =
            !q.choices.includes(q.answer) ||
            new Set(q.choices).size !== q.choices.length ||
            q.choices.length < 2 ||
            q.choices.length > 4 ||
            q.choices.some((c) => !c || /NaN|Infinity|undefined/.test(c)) ||
            /NaN|Infinity|undefined/.test(q.prompt + q.answer + (q.steps ?? []).join(' ')) ||
            // P4–P7 maths must explain itself, and the explanation must reach the answer
            (subject === 'maths' && UPPER.has(grade) && !q.steps?.length) ||
            (!!q.steps?.length && !q.steps.join(' ').replace(/,/g, '').includes(q.answer.replace(/,/g, '')))
          if (bad) {
            problems++
            if (problems <= 15) console.log('PROBLEM', subject, grade, level, JSON.stringify({ p: q.prompt, a: q.answer, c: q.choices, s: q.steps }))
          }
        }
      }
      const n = keys.size
      const mark = n >= SAMPLE * 0.9 ? '∞' : n >= ALL_DAY ? '✓' : '⚠'
      line.push(`${level}: ${(n >= SAMPLE * 0.9 ? `${(SAMPLE / 1000).toFixed(0)}k+` : n.toLocaleString()).padStart(6)} ${mark}`)
    }
    rows.push(line.join('   '))
  }
}

console.log(`\nDifferent questions found in ${SAMPLE.toLocaleString()} tries per level`)
console.log(`∞ = practically endless   ✓ = more than a full day (${ALL_DAY})   ⚠ = repeats within a day\n`)
console.log(rows.join('\n'))
console.log(`\nProblems: ${problems}`)
process.exit(problems ? 1 : 0)
