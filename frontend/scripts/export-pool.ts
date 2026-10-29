// Writes the Paper Pool: questions made by the game's own generators, saved for the server.
// Run: npm run pool   (npm run release runs it too)
//
// The server is plain PHP and cannot run the TypeScript generators, but competition papers must
// be built by the server so no phone ever holds the answers before the end. So once per release
// we generate a large, checked pool for every generated subject + class and save it in api/pool/
// (not reachable from the web; .htaccess only exposes index.php). The server draws papers from it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasQuestions, makeSprint } from '../src/game/sprint.ts'
import { GRADES, LEVELS } from '../src/game/types.ts'

const PER_LEVEL = Number(process.argv[2] ?? 300) // different questions per class + subject + level (fewer if a level has less variety)
const out = join(dirname(fileURLToPath(import.meta.url)), '../../api/pool')
mkdirSync(out, { recursive: true })

let files = 0
let total = 0
for (const subject of ['maths', 'english'] as const) {
  for (const { id: grade } of GRADES) {
    if (!hasQuestions(subject, grade)) continue
    const pool = []
    for (const { id: level } of LEVELS) {
      for (const q of makeSprint(subject, grade, level, PER_LEVEL)) {
        // a broken question must never reach a competition
        if (!q.choices.includes(q.answer) || new Set(q.choices).size !== q.choices.length) throw new Error(`bad question: ${q.prompt}`)
        pool.push({
          level,
          topic: q.topic,
          prompt: q.prompt,
          speak: q.speak,
          ...(q.visual ? { visual: q.visual } : {}),
          ...(q.big ? { big: q.big } : {}),
          ...(q.passage ? { passage: q.passage } : {}),
          ...(q.diagram ? { diagram: q.diagram } : {}),
          choices: q.choices,
          answer: q.answer,
          ...(q.steps?.length ? { steps: q.steps } : {}),
        })
      }
    }
    writeFileSync(join(out, `${subject}-${grade}.json`), JSON.stringify(pool))
    files++
    total += pool.length
  }
}
console.log(`Paper Pool: ${total} questions in ${files} files → api/pool/`)
