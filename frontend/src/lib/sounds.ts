// Tiny generated sound effects: no audio files to download.
import { settings } from './settings'

let ctx: AudioContext | null = null

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  if (!settings.sound) return
  try {
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime + start)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
    osc.connect(g).connect(ctx.destination)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + duration)
  } catch {
    // sound is a nice-to-have
  }
}

export function playCorrect() {
  tone(660, 0, 0.12, 'triangle')
  tone(880, 0.1, 0.18, 'triangle')
}

export function playWrong() {
  tone(220, 0, 0.25, 'sawtooth', 0.06)
}

export function playFinish() {
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle'))
}
