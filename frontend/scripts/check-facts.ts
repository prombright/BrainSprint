// Tests the Fact Engine and the fact sets in content/. Run: npm run check:facts [file.json]
// For every set: no problems in the set itself, and 2,000 generated questions where the answer is
// always one of the choices, choices are all different, no {gap} is left unfilled, and no wrong
// choice could also be right. Then it counts how many different questions each set makes.
import { readFileSync } from 'node:fs'
import { ambiguous, allFactQuestions, checkFactSet, factQuestion, gapsOf, type FactSet } from '../src/game/facts.ts'

const file = process.argv[2] ?? new URL('../../content/fact-sets-starter.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const sets = (JSON.parse(readFileSync(file, 'utf8')) as Omit<FactSet, 'id'>[]).map((s, i) => ({ ...s, id: i + 1 }) as FactSet)

let failed = 0
const fail = (msg: string) => {
  failed++
  if (failed <= 20) console.log('✗', msg)
}

// the ambiguity guard itself
const risky: FactSet = {
  id: 0, subject: 'science', name: 'test', grade_from: 'P5', grade_to: 'P5', explain: null,
  columns: ['disease', 'spread'],
  templates: [{ ask: 'Which disease is spread by {spread}?', answer: 'disease', level: 'simple' }],
  rows: [['cholera', 'dirty water'], ['typhoid', 'dirty water'], ['malaria', 'mosquitoes'], ['plague', 'fleas']],
}
const rowsOf = (s: FactSet) => s.rows.map((r) => Object.fromEntries(s.columns.map((c, i) => [c, r[i]])))
const rr = rowsOf(risky)
console.log(ambiguous(rr, rr[0], risky.templates[0]) && !ambiguous(rr, rr[2], risky.templates[0]) ? '✓' : '✗', 'two diseases spread by "dirty water" make that question ambiguous; "mosquitoes" is fine')
for (let i = 0; i < 300; i++) {
  const q = factQuestion(risky)
  if (q && /dirty water/.test(q.prompt)) fail('an ambiguous question was asked: ' + q.prompt)
}

for (const set of sets) {
  const problems = checkFactSet(set)
  if (problems.length) fail(`${set.name}: ${problems.join('; ')}`)
  const seen = new Set<string>()
  const rows = rowsOf(set)
  for (let i = 0; i < 2000; i++) {
    const q = factQuestion(set)
    if (!q) {
      fail(`${set.name}: no question could be made`)
      break
    }
    seen.add(q.prompt + '→' + q.answer)
    if (!q.choices.includes(q.answer)) fail(`${set.name}: answer missing from choices: ${q.prompt}`)
    if (new Set(q.choices.map((c) => c.toLowerCase())).size !== q.choices.length) fail(`${set.name}: repeated choice: ${q.choices.join(', ')}`)
    if (q.choices.length < 2) fail(`${set.name}: fewer than 2 choices: ${q.prompt}`)
    if (gapsOf(q.prompt).length || /\{|\}/.test(q.prompt + (q.steps ?? []).join(''))) fail(`${set.name}: unfilled gap: ${q.prompt}`)
    // no wrong choice may be a right answer: for normal patterns, check every row with that wrong value
    for (const t of set.templates.filter((x) => !x.not)) {
      const asked = rows.filter((r) => q.prompt.toLowerCase() === (t.ask.replace(/\{([a-z_]+)\}/g, (_, c) => r[c])).toLowerCase())
      if (!asked.length) continue
      const rightValues = new Set(asked.map((r) => r[t.answer].toLowerCase()))
      const wrongButRight = q.choices.filter((c) => c !== q.answer && rightValues.has(c.toLowerCase()))
      if (wrongButRight.length) fail(`${set.name}: "${wrongButRight[0]}" is also right for: ${q.prompt}`)
    }
  }
  const all = allFactQuestions(set)
  const unfair = all.filter((x) => !x.fair).length
  console.log(`✓ ${set.name.padEnd(22)} ${set.rows.length} facts × ${set.templates.length} patterns → ${seen.size} different questions (${unfair} skipped as ambiguous)`)
}

console.log(failed ? `\n${failed} FAILED` : '\nAll fact checks pass')
process.exit(failed ? 1 : 0)
