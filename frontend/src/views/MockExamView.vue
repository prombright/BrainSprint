<script setup lang="ts">
// A PLE-style mock: 30 questions, one timer for the whole paper, answers can be changed,
// no feedback until the end. Then a full review with working for every missed question.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { MOCK_GRADES, MOCK_MINUTES, buildMock, readinessBand } from '../game/mock'
import type { Grade, Question } from '../game/types'
import { canSpeak, speak, stopSpeaking } from '../lib/speech'
import { playFinish } from '../lib/sounds'
import { pauseMusic, resumeMusic } from '../lib/music'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const grade = player.profile!.grade as Grade

const questions = ref<Question[]>([])
const picks = ref<(string | null)[]>([])
const flags = ref<boolean[]>([])
const index = ref(0)
const phase = ref<'exam' | 'review'>('exam')
const startedAt = Date.now()
const now = ref(Date.now())
let tick: number | undefined

const msLeft = computed(() => Math.max(0, MOCK_MINUTES * 60_000 - (now.value - startedAt)))
const clock = computed(() => {
  const s = Math.ceil(msLeft.value / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})
const current = computed(() => questions.value[index.value])
const answered = computed(() => picks.value.filter((p) => p !== null).length)

// ---------- results ----------
const correctList = computed(() => questions.value.map((q, i) => picks.value[i] === q.answer))
const correct = computed(() => correctList.value.filter(Boolean).length)
const percent = computed(() => (questions.value.length ? Math.round((correct.value / questions.value.length) * 100) : 0))
const band = computed(() => readinessBand(percent.value))
const minutesUsed = ref(0)
const byTopic = computed(() => {
  const t = new Map<string, [number, number]>()
  questions.value.forEach((q, i) => {
    const [c, n] = t.get(q.topic) ?? [0, 0]
    t.set(q.topic, [c + (correctList.value[i] ? 1 : 0), n + 1])
  })
  return [...t.entries()].map(([topic, [c, n]]) => ({ topic, c, n, pct: Math.round((c / n) * 100) })).sort((a, b) => a.pct - b.pct)
})
const nice = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function submit(auto = false) {
  if (phase.value !== 'exam') return
  const blank = questions.value.length - answered.value
  if (!auto && blank && !confirm(`${blank} question${blank === 1 ? ' is' : 's are'} not answered. Hand in anyway?`)) return
  clearInterval(tick)
  stopSpeaking()
  minutesUsed.value = Math.max(1, Math.round((Date.now() - startedAt) / 60_000))
  questions.value.forEach((q, i) => player.noteAnswer(q, correctList.value[i], 'maths', grade))
  player.recordMock({
    grade,
    correct: correct.value,
    total: questions.value.length,
    minutes_used: Math.min(60, minutesUsed.value),
    taken_at: new Date().toISOString(),
    topics: Object.fromEntries(byTopic.value.map((t) => [t.topic, [t.c, t.n]])),
  })
  phase.value = 'review'
  playFinish()
  window.scrollTo({ top: 0 })
}

function choose(c: string) {
  picks.value[index.value] = c
}
const go = (i: number) => (index.value = Math.max(0, Math.min(questions.value.length - 1, i)))

function onKey(e: KeyboardEvent) {
  if (phase.value !== 'exam' || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement)?.tagName === 'INPUT') return
  const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase())
  if (i >= 0 && current.value?.choices[i] !== undefined) choose(current.value.choices[i])
  else if (e.key === 'ArrowRight') go(index.value + 1)
  else if (e.key === 'ArrowLeft') go(index.value - 1)
}

onMounted(() => {
  if (!MOCK_GRADES.includes(grade)) return void router.replace('/mock')
  questions.value = buildMock(grade)
  picks.value = questions.value.map(() => null)
  flags.value = questions.value.map(() => false)
  pauseMusic()
  tick = window.setInterval(() => {
    now.value = Date.now()
    if (msLeft.value === 0) submit(true)
  }, 1000)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  clearInterval(tick)
  stopSpeaking()
  window.removeEventListener('keydown', onKey)
  resumeMusic()
})

// leaving in the middle of the exam loses it: ask first
onBeforeRouteLeave(() => phase.value === 'review' || confirm('Leave the mock? Your answers will be lost.'))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <!-- ======== the exam ======== -->
    <template v-if="phase === 'exam' && current">
      <header class="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-cream/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <button class="btn-chunky grid size-11 shrink-0 place-items-center bg-white" aria-label="Leave the mock" @click="router.push('/mock')">✕</button>
        <div class="min-w-0 flex-1">
          <p class="font-bold">Question {{ index + 1 }} of {{ questions.length }}</p>
          <p class="text-sm text-ink/60">{{ answered }} answered</p>
        </div>
        <div class="rounded-full px-4 py-2 text-xl font-bold tabular-nums" :class="msLeft < 5 * 60_000 ? 'animate-pulse bg-cherry text-white' : 'bg-white'" role="timer" :aria-label="`${clock} left`">⏱️ {{ clock }}</div>
      </header>

      <section class="relative rounded-3xl bg-white p-6 shadow-sm">
        <div class="mb-3 flex items-center justify-between gap-2">
          <span class="rounded-full bg-ink/5 px-3 py-1 text-sm font-semibold text-ink/60">{{ nice(current.topic) }}</span>
          <div class="flex gap-2">
            <button v-if="canSpeak()" class="grid size-10 place-items-center rounded-full bg-ocean/10" aria-label="Read the question aloud" @click="speak(current.speak)">🔊</button>
            <button class="rounded-full px-3 py-1 text-sm font-semibold" :class="flags[index] ? 'bg-sun text-ink' : 'bg-ink/5 text-ink/60'" @click="flags[index] = !flags[index]">
              🚩 {{ flags[index] ? 'Flagged' : 'Flag for later' }}
            </button>
          </div>
        </div>
        <p v-if="current.visual && current.visual.length <= 12" class="mb-2 text-4xl">{{ current.visual }}</p>
        <p v-if="current.big" class="mb-2 text-4xl font-medium text-ocean">{{ current.big }}</p>
        <p class="text-2xl leading-snug font-bold md:text-3xl">{{ current.prompt }}</p>
      </section>

      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="(c, i) in current.choices"
          :key="c"
          class="btn-chunky relative flex items-center gap-3 px-4 py-4 text-left text-2xl tabular-nums"
          :class="picks[index] === c ? 'bg-ocean text-white' : 'bg-white'"
          :aria-pressed="picks[index] === c"
          @click="choose(c)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-full text-base" :class="picks[index] === c ? 'bg-white/25' : 'bg-ink/5'">{{ 'ABCD'[i] }}</span>
          {{ c }}
        </button>
      </div>

      <div class="flex gap-3">
        <button class="btn-chunky flex-1 bg-white py-3 text-lg" :disabled="index === 0" @click="go(index - 1)">← Back</button>
        <button v-if="index < questions.length - 1" class="btn-chunky flex-1 bg-ink py-3 text-lg text-white" @click="go(index + 1)">Next →</button>
        <button v-else class="btn-chunky flex-1 bg-sprint py-3 text-lg text-white" @click="submit()">Hand in ✓</button>
      </div>

      <!-- all questions at a glance -->
      <section class="rounded-3xl bg-white p-4 shadow-sm">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-bold">All questions</h2>
          <span class="text-xs text-ink/60"><span class="inline-block size-3 rounded bg-ocean align-middle" /> answered · flagged</span>
        </div>
        <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          <button
            v-for="(q, i) in questions"
            :key="q.key"
            class="relative rounded-lg py-2 text-sm font-bold tabular-nums"
            :class="[i === index ? 'ring-2 ring-sprint' : '', picks[i] !== null ? 'bg-ocean text-white' : 'bg-ink/5']"
            :aria-label="`Question ${i + 1}${picks[i] !== null ? ', answered' : ''}${flags[i] ? ', flagged' : ''}`"
            @click="go(i)"
          >
            {{ i + 1 }}<span v-if="flags[i]" class="absolute -top-1 -right-1 text-xs">🚩</span>
          </button>
        </div>
        <button class="btn-chunky mt-4 w-full bg-sprint py-3 text-lg text-white" @click="submit()">Hand in my paper</button>
      </section>
    </template>

    <!-- ======== results and review ======== -->
    <template v-if="phase === 'review'">
      <section class="rounded-3xl bg-ink p-6 text-center text-white">
        <p class="text-sm font-semibold tracking-widest text-sun uppercase">Mock result</p>
        <p class="mt-1 text-6xl font-bold">{{ percent }}%</p>
        <p class="text-xl">{{ correct }} of {{ questions.length }} correct · {{ minutesUsed }} min</p>
        <p class="mt-2 text-xl font-semibold">{{ band.emoji }} {{ band.label }}</p>
        <p class="opacity-80">{{ band.note }}</p>
        <p v-if="player.state.mockHistory?.readiness != null" class="mt-2 text-sm opacity-70">Your readiness (last 3 mocks): {{ player.state.mockHistory.readiness }}%</p>
      </section>

      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="mb-2 text-xl font-bold">By topic</h2>
        <div v-for="t in byTopic" :key="t.topic" class="flex items-center gap-3 py-1">
          <span class="w-36 truncate font-semibold">{{ nice(t.topic) }}</span>
          <div class="h-3 flex-1 overflow-hidden rounded-full bg-ink/10"><div class="h-full rounded-r-[4px]" :class="t.pct >= 70 ? 'bg-leaf' : t.pct >= 50 ? 'bg-sun' : 'bg-cherry'" :style="{ width: `${t.pct}%` }" /></div>
          <span class="w-12 text-right text-sm font-semibold tabular-nums">{{ t.c }}/{{ t.n }}</span>
        </div>
        <button class="btn-chunky mt-4 bg-sprint px-6 py-2 text-lg text-white" @click="router.push('/progress')">Practise my weak spots</button>
      </section>

      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-xl font-bold">Go through your paper</h2>
        <ol class="space-y-3">
          <li v-for="(q, i) in questions" :key="q.key" class="rounded-2xl p-3" :class="correctList[i] ? 'bg-leaf/10' : 'bg-cherry/5'">
            <p class="font-semibold">{{ i + 1 }}. {{ q.prompt }} <span v-if="q.big" class="text-ocean">{{ q.big }}</span></p>
            <p class="mt-1 text-sm">
              <span v-if="correctList[i]" class="font-semibold text-leaf">✓ {{ q.answer }}</span>
              <template v-else>
                <span class="text-cherry">Your answer: {{ picks[i] ?? 'none' }}</span> · <span class="font-semibold text-leaf">Correct: {{ q.answer }}</span>
              </template>
            </p>
            <details v-if="!correctList[i] && q.steps?.length" class="mt-1 text-sm">
              <summary class="font-semibold text-ocean">See the working</summary>
              <ol class="mt-1 list-decimal space-y-1 pl-5">
                <li v-for="(st, j) in q.steps" :key="j">{{ st }}</li>
              </ol>
            </details>
          </li>
        </ol>
      </section>

      <div class="flex gap-3">
        <button class="btn-chunky flex-1 bg-white py-3 text-lg" @click="router.push('/mock')">Back to PLE Prep</button>
        <button class="btn-chunky flex-1 bg-ink py-3 text-lg text-white" @click="router.push('/')">Home</button>
      </div>
    </template>
  </main>
</template>
