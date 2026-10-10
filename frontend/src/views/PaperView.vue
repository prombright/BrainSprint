<script setup lang="ts">
// A competition paper (school contest or duel). The server sends the questions without answers and
// keeps the clock; this screen only shows how long is left. Answers can be changed until handing in.
// Picks are kept on the device as the child goes, so a refresh or a dropped network loses nothing.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { api, ApiError, type PaperQuestion } from '../lib/api'
import { clock } from '../lib/compete'
import { canSpeak, speak, stopSpeaking } from '../lib/speech'
import { playFinish } from '../lib/sounds'
import { pauseMusic, resumeMusic } from '../lib/music'
import { usePlayer } from '../stores/player'

const route = useRoute()
const router = useRouter()
const player = usePlayer()
const kind = route.params.kind === 'duels' ? 'duels' : 'contests'
const id = Number(route.params.id)
const saveKey = `bsk:paper:${kind}:${id}`

const questions = ref<PaperQuestion[]>([])
const picks = ref<(string | null)[]>([])
const index = ref(0)
const error = ref('')
const status = ref<'loading' | 'exam' | 'sending' | 'done'>('loading')
const sendProblem = ref('')
let endsAt = 0 // performance.now() when the server's time runs out
const msLeft = ref(0)
let tick: number | undefined

const current = computed(() => questions.value[index.value])
const answered = computed(() => picks.value.filter((p) => p !== null).length)
const secondsLeft = computed(() => Math.ceil(msLeft.value / 1000))

function remember() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(picks.value))
  } catch {
    // storage full or blocked: the paper still works, it just can't survive a refresh
  }
}

function choose(c: string) {
  picks.value[index.value] = c
  remember()
}
const go = (i: number) => (index.value = Math.max(0, Math.min(questions.value.length - 1, i)))

/** Hands in; on a bad network it keeps trying until the server's grace period is over. */
async function handIn(auto = false) {
  if (status.value !== 'exam') return
  const blank = questions.value.length - answered.value
  if (!auto && blank && !confirm(`${blank} question${blank === 1 ? ' is' : 's are'} not answered. Hand in anyway?`)) return
  status.value = 'sending'
  clearInterval(tick)
  stopSpeaking()
  for (let tries = 0; tries < 30; tries++) {
    try {
      await api.submitPaper(player.auth!, kind, id, picks.value)
      break
    } catch (e) {
      // 409: it already arrived (an earlier try got through)
      if (e instanceof ApiError && e.status === 409) break
      if (e instanceof ApiError && e.status !== 0) {
        sendProblem.value = e.message
        return
      }
      sendProblem.value = 'No internet. Keep this screen open: trying again…'
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  try {
    localStorage.removeItem(saveKey)
  } catch {
    // ignore
  }
  status.value = 'done'
  playFinish()
  router.replace(`/compete/${kind}/${id}`)
}

function onKey(e: KeyboardEvent) {
  if (status.value !== 'exam' || e.ctrlKey || e.metaKey || e.altKey) return
  const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase())
  if (i >= 0 && current.value?.choices[i] !== undefined) choose(current.value.choices[i])
  else if (e.key === 'ArrowRight') go(index.value + 1)
  else if (e.key === 'ArrowLeft') go(index.value - 1)
}

onMounted(async () => {
  await player.sync()
  if (!player.auth) {
    error.value = 'Connect to the internet to start the paper.'
    return
  }
  try {
    const p = await api.startPaper(player.auth, kind, id)
    questions.value = p.questions
    let saved: unknown = null
    try {
      saved = JSON.parse(localStorage.getItem(saveKey) ?? 'null')
    } catch {
      // nothing saved
    }
    picks.value = Array.isArray(saved) && saved.length === p.questions.length ? saved : p.questions.map(() => null)
    endsAt = performance.now() + p.seconds_left * 1000
    msLeft.value = p.seconds_left * 1000
    status.value = 'exam'
    pauseMusic()
    tick = window.setInterval(() => {
      msLeft.value = Math.max(0, endsAt - performance.now())
      if (msLeft.value === 0) handIn(true)
    }, 250)
    window.addEventListener('keydown', onKey)
  } catch (e) {
    error.value = (e as Error).message
  }
})

onBeforeUnmount(() => {
  clearInterval(tick)
  stopSpeaking()
  window.removeEventListener('keydown', onKey)
  resumeMusic()
})

// leaving doesn't stop the server's clock: say so
onBeforeRouteLeave(() => status.value !== 'exam' || confirm('Leave the paper? Your answers are kept, but the clock keeps running.'))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <div v-if="error" class="rounded-3xl bg-white p-6 text-center shadow-sm">
      <p class="text-lg">{{ error }}</p>
      <button class="btn-chunky mt-4 bg-ink px-6 py-2 text-white" @click="router.replace('/compete')">Back to Compete</button>
    </div>
    <p v-else-if="status === 'loading'" class="p-6 text-center text-ink/60">Getting your paper…</p>

    <div v-if="status === 'sending'" class="rounded-3xl bg-white p-6 text-center shadow-sm">
      <p class="text-4xl">📨</p>
      <p class="text-xl font-bold">Handing in…</p>
      <p v-if="sendProblem" class="mt-2 text-cherry">{{ sendProblem }}</p>
    </div>

    <template v-if="status === 'exam' && current">
      <header class="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-cream/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <button class="btn-chunky grid size-11 shrink-0 place-items-center bg-white" aria-label="Leave the paper" @click="router.push('/compete')">✕</button>
        <div class="min-w-0 flex-1">
          <p class="font-bold">Question {{ index + 1 }} of {{ questions.length }}</p>
          <p class="text-sm text-ink/60">{{ answered }} answered</p>
        </div>
        <div class="rounded-full px-4 py-2 text-xl font-bold tabular-nums" :class="secondsLeft < 60 ? 'animate-pulse bg-cherry text-white' : 'bg-white'" role="timer" :aria-label="`${clock(secondsLeft)} left`">
          ⏱️ {{ clock(secondsLeft) }}
        </div>
      </header>

      <section class="rounded-3xl bg-white p-6 shadow-sm">
        <div class="mb-3 flex items-center justify-between gap-2">
          <span class="rounded-full bg-ink/5 px-3 py-1 text-sm font-semibold text-ink/60">{{ current.topic.charAt(0).toUpperCase() + current.topic.slice(1) }}</span>
          <button v-if="canSpeak()" class="grid size-10 place-items-center rounded-full bg-ocean/10" aria-label="Read the question aloud" @click="speak(current.speak)">🔊</button>
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
        <button v-else class="btn-chunky flex-1 bg-sprint py-3 text-lg text-white" @click="handIn()">Hand in ✓</button>
      </div>

      <section class="rounded-3xl bg-white p-4 shadow-sm">
        <h2 class="mb-2 font-bold">All questions</h2>
        <div class="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          <button
            v-for="(_, i) in questions"
            :key="i"
            class="rounded-lg py-2 text-sm font-bold tabular-nums"
            :class="[i === index ? 'ring-2 ring-sprint' : '', picks[i] !== null ? 'bg-ocean text-white' : 'bg-ink/5']"
            :aria-label="`Question ${i + 1}${picks[i] !== null ? ', answered' : ''}`"
            @click="go(i)"
          >
            {{ i + 1 }}
          </button>
        </div>
        <button class="btn-chunky mt-4 w-full bg-sprint py-3 text-lg text-white" @click="handIn()">Hand in my paper</button>
      </section>
    </template>
  </main>
</template>
