// Gentle background music made on the fly (no audio files): a slow, quiet
// pentatonic tune that loops on the menus and pauses during sprints.
import { watch } from 'vue'
import { settings } from './settings'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let loop: number | undefined
let paused = false

// C major pentatonic, two calm phrases (0 = rest)
const TUNE = [523, 659, 784, 659, 587, 523, 0, 392, 440, 523, 587, 659, 587, 523, 440, 0]
const BASS = [131, 131, 165, 165, 147, 147, 131, 131]
const BEAT = 0.42 // seconds per note

function note(freq: number, at: number, len: number, type: OscillatorType, vol: number) {
  if (!ctx || !master || !freq) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(master)
  o.start(at)
  o.stop(at + len + 0.05)
}

function playPhrase() {
  if (!ctx) return
  const t = ctx.currentTime + 0.05
  TUNE.forEach((f, i) => note(f, t + i * BEAT, BEAT * 1.6, 'triangle', 0.5))
  BASS.forEach((f, i) => note(f, t + i * BEAT * 2, BEAT * 2.2, 'sine', 0.6))
}

function start() {
  if (loop || paused || !settings.music) return
  try {
    ctx ??= new AudioContext()
    if (!master) {
      master = ctx.createGain()
      master.gain.value = 0.035 // quiet: it's background
      master.connect(ctx.destination)
    }
    ctx.resume()
    playPhrase()
    loop = window.setInterval(playPhrase, TUNE.length * BEAT * 1000)
  } catch {
    // no audio on this device
  }
}

function stop() {
  clearInterval(loop)
  loop = undefined
  ctx?.suspend()
}

/** Browsers only allow sound after the first tap, so start then. */
export function initMusic() {
  const kick = () => start()
  window.addEventListener('pointerdown', kick, { once: true })
  watch(
    () => settings.music,
    (on) => (on ? start() : stop()),
  )
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()))
}

/** Quiet during a sprint so children can concentrate. */
export function pauseMusic() {
  paused = true
  stop()
}

export function resumeMusic() {
  paused = false
  start()
}
