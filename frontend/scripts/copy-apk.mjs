// After a web build: put the latest Android app next to the website so the landing page's
// download button works (the APK is built separately; see README "Put it on a phone").
import { copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const apk = [join(root, 'android/app/build/outputs/apk/debug/app-debug.apk'), join(root, '../BrainSprintKids.apk')].find(existsSync)
if (apk) {
  copyFileSync(apk, join(root, 'dist/BrainSprintKids.apk'))
  console.log(`APK copied into dist/ (${(statSync(apk).size / 1e6).toFixed(1)} MB)`)
} else {
  console.log('No APK built yet: the download button will not work until one is')
}
