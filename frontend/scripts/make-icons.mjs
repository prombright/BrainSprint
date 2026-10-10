// Builds every app icon and splash image from the logo SVG.
// Run: npm run icons   (after `npx cap add android` to also fill the Android folders)
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORANGE = '#ff7a1a'
const INK = '#1f2547'
const CREAM = '#fff8ec'

const bolt = (stroke = 3) =>
  `<path d="M36 6 L16 36 H30 L26 58 L48 26 H34 Z" fill="#fff" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"/>`

// rounded square, like the favicon
const roundIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${ORANGE}"/>${bolt()}</svg>`
// full-bleed square: Android/PWA "maskable" icons are cropped by the phone into its own shape
const squareIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 88 88"><rect x="-12" y="-12" width="88" height="88" fill="${ORANGE}"/>${bolt()}</svg>`
// adaptive icon layers (108dp canvas, art kept inside the middle 66dp)
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -22 108 108">${bolt()}</svg>`
const splash = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${CREAM}"/><svg x="${size / 2 - size * 0.12}" y="${size / 2 - size * 0.12}" width="${size * 0.24}" height="${size * 0.24}" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${ORANGE}"/>${bolt()}</svg></svg>`

async function png(svg, size, out) {
  mkdirSync(dirname(out), { recursive: true })
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out)
}

// ---- web / PWA ----
const pub = join(root, 'public', 'icons')
await png(roundIcon, 192, join(pub, 'icon-192.png'))
await png(roundIcon, 512, join(pub, 'icon-512.png'))
await png(squareIcon, 512, join(pub, 'maskable-512.png'))
await png(squareIcon, 180, join(pub, 'apple-touch-icon.png'))
console.log('web icons ✓')

// ---- Android ----
const res = join(root, 'android', 'app', 'src', 'main', 'res')
if (existsSync(res)) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  for (const [d, scale] of Object.entries(densities)) {
    await png(squareIcon, 48 * scale, join(res, `mipmap-${d}`, 'ic_launcher.png'))
    await png(roundIcon, 48 * scale, join(res, `mipmap-${d}`, 'ic_launcher_round.png'))
    await png(foreground, 108 * scale, join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'))
  }
  // splash for every drawable folder Capacitor created (portrait + landscape)
  for (const folder of ['drawable', 'drawable-port-mdpi', 'drawable-port-hdpi', 'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi', 'drawable-land-mdpi', 'drawable-land-hdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi']) {
    if (existsSync(join(res, folder))) {
      const [w, h] = folder.includes('land') ? [1920, 1080] : [1080, 1920]
      await sharp(Buffer.from(splash(2732))).resize(w, h, { fit: 'cover' }).png().toFile(join(res, folder, 'splash.png'))
    }
  }
  console.log('android icons + splash ✓')
} else {
  console.log('no android/ folder yet: run `npx cap add android`, then this script again')
}
