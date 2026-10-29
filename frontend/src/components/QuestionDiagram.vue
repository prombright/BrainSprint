<script setup lang="ts">
// Draws a question's diagram (clock, shape, Venn diagram, bar graph …) from its description.
// Colours come from the theme tokens, so diagrams follow light and dark screens.
import { computed } from 'vue'
import type { Diagram } from '../game/types'

const props = defineProps<{ d: Diagram }>()

const INK = 'var(--color-ink)'
const GREEN = 'var(--color-sprint)'
const FACE = 'var(--color-cream)'
const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
const at = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))] as const

// ---------- clock ----------
const clock = computed(() => {
  if (props.d.kind !== 'clock') return null
  const { h, m } = props.d
  const numbers = Array.from({ length: 12 }, (_, i) => ({ n: i + 1, xy: at(100, 100, 70, (i + 1) * 30) }))
  const ticks = Array.from({ length: 60 }, (_, i) => ({ a: at(100, 100, 88, i * 6), b: at(100, 100, i % 5 ? 84 : 80, i * 6), big: i % 5 === 0 }))
  return { numbers, ticks, hour: at(100, 100, 46, ((h % 12) + m / 60) * 30), minute: at(100, 100, 74, m * 6) }
})

// ---------- shapes for the youngest ----------
const polygon = (n: number, r: number, cx = 100, cy = 85) =>
  Array.from({ length: n }, (_, i) => at(cx, cy, r, (360 / n) * i).join(',')).join(' ')

// ---------- bar graph ----------
const bars = computed(() => {
  if (props.d.kind !== 'bars') return null
  const { values, labels, step } = props.d
  const top = Math.ceil(Math.max(...values) / step) * step
  const W = 300
  const H = 200
  const left = 40
  const bottom = 170
  const plotH = 140
  const y = (v: number) => bottom - (v / top) * plotH
  const slot = (W - left - 10) / values.length
  const grid = Array.from({ length: top / step + 1 }, (_, i) => i * step)
  return {
    grid: grid.map((v) => ({ v, y: y(v) })),
    bars: values.map((v, i) => ({ x: left + slot * i + slot * 0.2, w: slot * 0.6, y: y(v), h: bottom - y(v), label: labels[i], cx: left + slot * i + slot / 2 })),
    left,
    bottom,
    right: W - 10,
    W,
    H,
  }
})

// ---------- number line ----------
const line = computed(() => {
  if (props.d.kind !== 'numberline') return null
  const { from, to, step, mark } = props.d
  const n = (to - from) / step
  const x = (v: number) => 20 + ((v - from) / (to - from)) * 260
  const every = n > 10 ? 5 : n > 5 ? 2 : 1
  const ticks = Array.from({ length: n + 1 }, (_, i) => {
    const v = from + i * step
    // label the ends and every few ticks, never the marked one (that is the question)
    return { x: x(v), v, label: (i === 0 || i === n || i % every === 0) && v !== mark }
  })
  return { ticks, mark: x(mark) }
})

// ---------- fraction ----------
const sectors = computed(() => {
  if (props.d.kind !== 'fraction' || props.d.style !== 'circle') return null
  const { parts, shaded } = props.d
  return Array.from({ length: parts }, (_, i) => {
    const [x1, y1] = at(90, 90, 75, (360 / parts) * i)
    const [x2, y2] = at(90, 90, 75, (360 / parts) * (i + 1))
    const large = 360 / parts > 180 ? 1 : 0
    return { path: `M90,90 L${x1},${y1} A75,75 0 ${large} 1 ${x2},${y2} Z`, on: i < shaded }
  })
})
</script>

<template>
  <div class="mx-auto mt-8 mb-3 w-full max-w-xs" role="img" :aria-label="d.kind">
    <!-- clock -->
    <svg v-if="d.kind === 'clock' && clock" viewBox="0 0 200 200" class="mx-auto w-full max-w-48">
      <circle cx="100" cy="100" r="92" :fill="FACE" :stroke="INK" stroke-width="4" />
      <line v-for="(t, i) in clock.ticks" :key="i" :x1="t.a[0]" :y1="t.a[1]" :x2="t.b[0]" :y2="t.b[1]" :stroke="INK" :stroke-width="t.big ? 3 : 1" />
      <text v-for="n in clock.numbers" :key="n.n" :x="n.xy[0]" :y="n.xy[1] + 6" text-anchor="middle" font-size="17" font-weight="600" :fill="INK">{{ n.n }}</text>
      <line x1="100" y1="100" :x2="clock.hour[0]" :y2="clock.hour[1]" :stroke="INK" stroke-width="8" stroke-linecap="round" />
      <line x1="100" y1="100" :x2="clock.minute[0]" :y2="clock.minute[1]" :stroke="GREEN" stroke-width="5" stroke-linecap="round" />
      <circle cx="100" cy="100" r="6" :fill="INK" />
    </svg>

    <!-- a shape to name -->
    <svg v-else-if="d.kind === 'shape'" viewBox="0 0 200 170" class="mx-auto w-full max-w-48">
      <g :fill="GREEN" fill-opacity="0.2" :stroke="GREEN" stroke-width="5" stroke-linejoin="round">
        <circle v-if="d.shape === 'circle'" cx="100" cy="85" r="68" />
        <ellipse v-else-if="d.shape === 'oval'" cx="100" cy="85" rx="88" ry="55" />
        <rect v-else-if="d.shape === 'square'" x="35" y="20" width="130" height="130" />
        <rect v-else-if="d.shape === 'rectangle'" x="10" y="40" width="180" height="95" />
        <polygon v-else-if="d.shape === 'triangle'" points="100,12 188,158 12,158" />
        <polygon v-else-if="d.shape === 'pentagon'" :points="polygon(5, 75, 100, 90)" />
        <polygon v-else-if="d.shape === 'hexagon'" :points="polygon(6, 75, 100, 85)" />
      </g>
    </svg>

    <!-- rectangle with its sides -->
    <svg v-else-if="d.kind === 'rect'" viewBox="0 0 285 180" class="mx-auto w-full max-w-64">
      <rect x="30" y="20" width="180" height="110" :fill="GREEN" fill-opacity="0.12" :stroke="INK" stroke-width="3" />
      <polyline points="30,118 42,118 42,130" fill="none" :stroke="INK" stroke-width="2" />
      <text x="120" y="160" text-anchor="middle" font-size="20" font-weight="600" :fill="INK">{{ d.w }}</text>
      <text x="220" y="80" font-size="20" font-weight="600" :fill="INK">{{ d.h }}</text>
    </svg>

    <!-- triangle with base and height -->
    <svg v-else-if="d.kind === 'triangle'" viewBox="0 0 260 190" class="mx-auto w-full max-w-64">
      <polygon points="30,150 220,150 90,25" :fill="GREEN" fill-opacity="0.12" :stroke="INK" stroke-width="3" stroke-linejoin="round" />
      <line x1="90" y1="25" x2="90" y2="150" :stroke="INK" stroke-width="2" stroke-dasharray="6 5" />
      <polyline points="90,138 102,138 102,150" fill="none" :stroke="INK" stroke-width="2" />
      <text x="125" y="176" text-anchor="middle" font-size="20" font-weight="600" :fill="INK">{{ d.base }}</text>
      <text x="96" y="95" font-size="20" font-weight="600" :fill="INK">{{ d.height }}</text>
    </svg>

    <!-- circle with radius or diameter -->
    <svg v-else-if="d.kind === 'circle'" viewBox="0 0 200 200" class="mx-auto w-full max-w-48">
      <circle cx="100" cy="100" r="80" :fill="GREEN" fill-opacity="0.12" :stroke="INK" stroke-width="3" />
      <line :x1="d.line === 'diameter' ? 20 : 100" y1="100" x2="180" y2="100" :stroke="GREEN" stroke-width="4" />
      <circle cx="100" cy="100" r="4" :fill="INK" />
      <text :x="d.line === 'diameter' ? 100 : 140" y="90" text-anchor="middle" font-size="18" font-weight="600" :fill="INK">{{ d.label }}</text>
    </svg>

    <!-- Venn diagram -->
    <svg v-else-if="d.kind === 'venn'" viewBox="0 0 290 200" class="mx-auto w-full max-w-72">
      <rect v-if="d.outside !== undefined" x="4" y="4" width="282" height="192" rx="8" fill="none" :stroke="INK" stroke-width="2" />
      <circle cx="110" cy="105" r="70" :fill="GREEN" fill-opacity="0.12" :stroke="INK" stroke-width="3" />
      <circle cx="180" cy="105" r="70" :fill="GREEN" fill-opacity="0.12" :stroke="INK" stroke-width="3" />
      <text x="80" y="28" text-anchor="middle" font-size="15" font-weight="600" :fill="INK">{{ d.a }}</text>
      <text x="210" y="28" text-anchor="middle" font-size="15" font-weight="600" :fill="INK">{{ d.b }}</text>
      <text x="78" y="112" text-anchor="middle" font-size="24" font-weight="700" :fill="INK">{{ d.onlyA }}</text>
      <text x="145" y="112" text-anchor="middle" font-size="24" font-weight="700" :fill="INK">{{ d.both }}</text>
      <text x="212" y="112" text-anchor="middle" font-size="24" font-weight="700" :fill="INK">{{ d.onlyB }}</text>
      <text v-if="d.outside !== undefined" x="262" y="185" text-anchor="middle" font-size="20" font-weight="700" :fill="INK">{{ d.outside }}</text>
    </svg>

    <!-- bar graph -->
    <svg v-else-if="d.kind === 'bars' && bars" :viewBox="`0 0 ${bars.W} ${bars.H + 10}`" class="mx-auto w-full">
      <text :x="bars.W / 2" y="14" text-anchor="middle" font-size="13" font-weight="600" :fill="INK">{{ d.title }}</text>
      <g v-for="g in bars.grid" :key="g.v">
        <line :x1="bars.left" :y1="g.y" :x2="bars.right" :y2="g.y" :stroke="INK" stroke-opacity="0.15" />
        <text :x="bars.left - 6" :y="g.y + 4" text-anchor="end" font-size="11" :fill="INK">{{ g.v }}</text>
      </g>
      <rect v-for="b in bars.bars" :key="b.label" :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="3" :fill="GREEN" />
      <line :x1="bars.left" :y1="bars.bottom" :x2="bars.right" :y2="bars.bottom" :stroke="INK" stroke-width="2" />
      <line :x1="bars.left" y1="24" :x2="bars.left" :y2="bars.bottom" :stroke="INK" stroke-width="2" />
      <text v-for="b in bars.bars" :key="'l' + b.label" :x="b.cx" :y="bars.bottom + 18" text-anchor="middle" font-size="12" font-weight="600" :fill="INK">{{ b.label }}</text>
    </svg>

    <!-- number line -->
    <svg v-else-if="d.kind === 'numberline' && line" viewBox="0 0 300 90" class="mx-auto w-full">
      <line x1="10" y1="55" x2="290" y2="55" :stroke="INK" stroke-width="3" />
      <g v-for="t in line.ticks" :key="t.v">
        <line :x1="t.x" y1="47" :x2="t.x" y2="63" :stroke="INK" stroke-width="2" />
        <text v-if="t.label" :x="t.x" y="82" text-anchor="middle" font-size="13" font-weight="600" :fill="INK">{{ t.v }}</text>
      </g>
      <polygon :points="`${line.mark - 9},14 ${line.mark + 9},14 ${line.mark},40`" :fill="GREEN" />
    </svg>

    <!-- fraction: shaded parts of a circle or a bar -->
    <svg v-else-if="d.kind === 'fraction' && d.style === 'circle' && sectors" viewBox="0 0 180 180" class="mx-auto w-full max-w-44">
      <path v-for="(s, i) in sectors" :key="i" :d="s.path" :fill="s.on ? GREEN : FACE" :stroke="INK" stroke-width="2.5" stroke-linejoin="round" />
    </svg>
    <svg v-else-if="d.kind === 'fraction'" viewBox="0 0 280 80" class="mx-auto w-full">
      <rect v-for="i in d.parts" :key="i" :x="10 + ((i - 1) * 260) / d.parts" y="10" :width="260 / d.parts" height="60" :fill="i <= d.shaded ? GREEN : FACE" :stroke="INK" stroke-width="2.5" />
    </svg>
  </div>
</template>
