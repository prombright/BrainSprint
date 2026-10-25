// Tests the Fact Engine and the fact sets in content/. Run: npm run check:facts [file.json]
// For every set: no problems in the set itself, and 2,000 generated questions where the answer is
// always one of the choices, choices are all different, no {gap} is left unfilled, and no wrong
// choice could also be right. Then it counts how many different questions each set makes.
import { readFileSync } from 'node:fs'
import { ambiguous, allFactQuestions, checkFactSet, commonGroup, factQuestion, gapsOf, matchedPair, type FactSet } from '../src/game/facts.ts'

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
  // the two free types
  let pairsMade = 0
  let commonMade = 0
  const pairKeys = new Set<string>()
  for (let i = 0; i < 500; i++) {
    const q = matchedPair(set)
    if (!q) break
    pairsMade++
    pairKeys.add(q.variant!)
    const [a, b] = q.prompt.replace(/^.*\(/, '').replace(/\)$/, '').split(' — ').map((x) => x.replace(/ /g, '_'))
    const trueOnes = q.choices.filter((c) => {
      const [x, y] = c.split(' — ')
      return rows.some((r) => r[a]?.toLowerCase() === x.toLowerCase() && r[b]?.toLowerCase() === y.toLowerCase())
    })
    if (trueOnes.length !== 1 || trueOnes[0] !== q.answer) fail(`${set.name}: matched pairs must have exactly one true pair: ${q.choices.join(' | ')}`)
  }
  for (const t of set.templates.filter((x) => x.not)) {
    for (let i = 0; i < 200; i++) {
      const q = commonGroup(set, t)
      if (!q) break
      commonMade++
      const listed = q.prompt.slice(q.prompt.lastIndexOf(': ') + 2, -1).split(', ').map((x) => x.toLowerCase())
      const groupOf = (v: string) => new Set(rows.filter((r) => r[t.answer].toLowerCase() === v).map((r) => r[t.not!].toLowerCase()))
      for (const c of q.choices) {
        const all3 = listed.every((v) => groupOf(v).has(c.toLowerCase()))
        if (c === q.answer && !all3) fail(`${set.name}: "${c}" is not shared by ${listed.join(', ')}`)
        if (c !== q.answer && all3) fail(`${set.name}: wrong choice "${c}" is also shared by ${listed.join(', ')}`)
      }
    }
  }
  const all = allFactQuestions(set)
  const unfair = all.filter((x) => !x.fair).length
  console.log(`✓ ${set.name.padEnd(26)} ${String(set.rows.length).padStart(2)} facts × ${set.templates.length} patterns → ${String(seen.size).padStart(4)} different · matched pairs: ${pairsMade ? `${pairKeys.size}+ sets` : 'none'}${commonMade ? ' · have in common: yes' : ''} (${unfair} skipped as ambiguous)`)
}

console.log(failed ? `\n${failed} FAILED` : '\nAll fact checks pass')
process.exit(failed ? 1 : 0)
