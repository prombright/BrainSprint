// A test Android app that talks to THIS computer over Wi-Fi, so everything online (leagues,
// friends, competitions) can be tried on a real phone before the live server exists.
// Run: npm run build:android-lan        (the phone must be on the same Wi-Fi as this computer)
//
// Never give this APK to anyone else: it uses plain http and only works on this network.
// The address changes if the router gives this computer a new one; then run it again.
import { copyFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..')
const JAVA_HOME = process.env.BSK_JAVA_HOME ?? 'C:\\Users\\HP\\.jdks\\jdk-21.0.12.1+1'

// this computer's Wi-Fi (or LAN) address
const ip =
  process.argv[2] ??
  Object.entries(networkInterfaces())
    .filter(([name]) => !/vethernet|virtualbox|vmware|loopback|bluetooth/i.test(name))
    .flatMap(([, list]) => list ?? [])
    .find((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254'))?.address
if (!ip) {
  console.error('No network address found. Connect to Wi-Fi, or pass one: npm run build:android-lan -- 192.168.1.20')
  process.exit(1)
}
const api = `http://${ip}/brainsprint/api`
const run = (cmd, cwd, env = {}) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })

console.log(`1/4 Building the game for ${api} …`)
run('npx vue-tsc -b && npx vite build --mode android', frontend, { VITE_API_URL: api })
console.log('2/4 Copying into the Android project (http allowed for this test build) …')
run('npx cap sync android', frontend, { BSK_LAN_TEST: '1' })
console.log('3/4 Making the APK …')
run(`"${join(frontend, 'android', 'gradlew.bat')}" assembleDebug`, join(frontend, 'android'), { JAVA_HOME })
console.log('4/4 Putting the website back and the APK where the phone can download it …')
run('npx vite build', frontend)
mkdirSync(join(frontend, 'dist'), { recursive: true })
copyFileSync(join(frontend, 'android/app/build/outputs/apk/debug/app-debug.apk'), join(frontend, 'dist/BrainSprintKids-wifi-test.apk'))

console.log(`
Done. On the phone (same Wi-Fi):
  1. Check it can reach this computer: open http://${ip}/brainsprint/api/health  →  {"ok":true}
  2. Download the app: http://${ip}/brainsprint/frontend/dist/BrainSprintKids-wifi-test.apk
  3. Open it and allow "install unknown apps" for the browser when Android asks.
`)
