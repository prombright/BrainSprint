// Builds an upload-ready copy of BrainSprint Kids for a web host:
//   release/public_html/      → everything that goes in the website's root folder
//   release/database.sql      → every table, for importing in phpMyAdmin on a new database
//   release/brainsprint-<date>.zip
// Run with: npm run release   (needs .env.live; see DEPLOY.md)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..')
const project = join(frontend, '..')
const out = join(project, 'release')
const web = join(out, 'public_html')

if (!existsSync(join(frontend, '.env.live'))) {
  console.error('Missing frontend/.env.live: copy .env.live.example and set VITE_API_URL first.')
  process.exit(1)
}

console.log('1/4 Building the website with the live settings …')
execSync('npx vue-tsc -b && npx vite build --mode live && node scripts/copy-apk.mjs', { cwd: frontend, stdio: 'inherit' })
// the Paper Pool the server builds competition papers from (made fresh from this release's generators)
execSync('node scripts/export-pool.ts', { cwd: frontend, stdio: 'inherit' })

console.log('2/4 Collecting files …')
rmSync(out, { recursive: true, force: true })
mkdirSync(web, { recursive: true })
cpSync(join(frontend, 'dist'), web, { recursive: true })
// the API, minus anything that must never reach a live server
const skip = new Set(['config.local.php', 'seed-demo.php'])
cpSync(join(project, 'api'), join(web, 'api'), { recursive: true, filter: (src) => !skip.has(src.split(/[\\/]/).pop()) })

console.log('3/4 Writing database.sql …')
const strip = (sql) => sql.replace(/^\s*(CREATE DATABASE|USE)\b[^;]*;\s*$/gim, '')
const parts = [join(project, 'api/schema.sql'), ...readdirSync(join(project, 'api/migrations')).sort().map((f) => join(project, 'api/migrations', f))]
const names = ['001_schema.sql', ...readdirSync(join(project, 'api/migrations')).sort()]
writeFileSync(
  join(out, 'database.sql'),
  [
    '-- BrainSprint Kids: every table, for a NEW empty database (phpMyAdmin → Import).',
    '-- For an existing live database run `php api/migrate.php` instead.',
    ...parts.map((p) => strip(readFileSync(p, 'utf8'))),
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;',
    `INSERT IGNORE INTO schema_migrations (name) VALUES ${names.map((n) => `('${n}')`).join(', ')};`,
  ].join('\n\n'),
)

console.log('4/4 Zipping …')
const zip = `brainsprint-${new Date().toISOString().slice(0, 10)}.zip`
execSync(`tar -a -c -f ${zip} public_html database.sql`, { cwd: out, stdio: 'inherit' })
// building for live replaced dist/; put the local (XAMPP) build back
console.log('Restoring the local build …')
execSync('npx vite build && node scripts/copy-apk.mjs', { cwd: frontend, stdio: 'ignore' })
console.log(`\nDone: release/${zip}  (upload it and follow DEPLOY.md)`)
