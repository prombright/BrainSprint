<script setup lang="ts">
// School contests from the child's side, school vs school and class vs class: what's live, what's coming, and results.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { api, type ClassContest, type Contest } from '../lib/api'
import { gradeLabel, subjectLabel, timeOnly, until, when } from '../lib/compete'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const contests = ref<Contest[] | null>(null)
const classContests = ref<ClassContest[]>([])
const error = ref('')
const now = ref(Date.now())
let tick: number | undefined

async function load() {
  await player.sync()
  if (!player.auth) return void (error.value = 'Connect to the internet to see competitions')
  try {
    const c = await api.compete(player.auth)
    contests.value = c.contests
    classContests.value = c.class_contests
  } catch (e) {
    error.value = (e as Error).message
  }
}

const live = computed(() => contests.value?.filter((c) => c.phase === 'live') ?? [])
const upcoming = computed(() => contests.value?.filter((c) => c.phase === 'upcoming').reverse() ?? [])
const finished = computed(() => contests.value?.filter((c) => c.phase === 'finished') ?? [])
const us = (c: Contest) => (c.my_school_id === c.school_b.id ? c.school_b : c.school_a)
const them = (c: Contest) => (c.my_school_id === c.school_b.id ? c.school_a : c.school_b)
const classLive = computed(() => classContests.value.filter((c) => c.phase === 'live'))
const classUpcoming = computed(() => classContests.value.filter((c) => c.phase === 'upcoming').reverse())
const classFinished = computed(() => classContests.value.filter((c) => c.phase === 'finished'))
const myClass = (c: ClassContest) => c.classes.find((x) => x.id === c.my_class_id)
const others = (c: ClassContest) => c.classes.filter((x) => x.id !== c.my_class_id).map((x) => x.name).join(', ')
function classOutcome(c: ClassContest) {
  if (!c.summary) return ''
  if (c.summary.draw) return 'A draw!'
  if (c.summary.winner_id === null) return 'Not enough pupils played'
  return c.summary.winner_id === c.my_class_id ? 'Your class won!' : `${c.classes.find((x) => x.id === c.summary!.winner_id)?.name} won`
}
function outcome(c: Contest) {
  if (!c.summary) return ''
  if (c.summary.draw) return 'A draw!'
  if (c.summary.winner_id === null) return 'Not enough pupils played'
  return c.summary.winner_id === c.my_school_id ? 'Your school won!' : `${them(c).name} won`
}

onMounted(() => {
  load()
  // keep countdowns fresh, and notice when a competition opens
  tick = window.setInterval(() => {
    now.value = Date.now()
    if ([...upcoming.value, ...classUpcoming.value].some((c) => new Date(c.starts_at).getTime() <= now.value)) load()
  }, 30_000)
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="School contests" back="/compete" />
    <p v-if="error && !contests" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">📶 {{ error }}</p>

    <template v-if="contests">
      <section v-for="c in live" :key="c.id" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-cherry"><span class="animate-pulse">🔴</span> Open now · ends {{ timeOnly(c.ends_at) }}</p>
        <p class="text-xl font-bold">{{ us(c).name }} <span class="text-ink/40">vs</span> {{ them(c).name }}</p>
        <p class="text-ink/70">{{ gradeLabel(c.grade) }} · {{ subjectLabel(c.subject) }} · {{ c.questions }} questions · {{ c.minutes }} min</p>
        <button v-if="c.mine?.state === 'not_started' || c.mine?.state === 'started'" class="btn-chunky mt-3 w-full bg-sprint py-4 text-xl text-white" @click="router.push(`/compete/play/contests/${c.id}`)">
          {{ c.mine?.state === 'started' ? 'Continue my paper →' : 'Start my paper →' }}
        </button>
        <p v-else-if="c.mine?.state === 'done'" class="mt-2 font-semibold text-leaf">✓ Handed in. Results at {{ timeOnly(c.ends_at) }}.</p>
        <p v-else class="mt-2 text-ink/60">Your time for this paper is up.</p>
      </section>

      <!-- class vs class, live -->
      <section v-for="c in classLive" :key="'c' + c.id" class="rounded-3xl bg-white p-5 shadow-sm">
        <p class="text-sm font-semibold text-cherry"><span class="animate-pulse">🔴</span> Open now · ends {{ timeOnly(c.ends_at) }}</p>
        <p class="text-xl font-bold">{{ myClass(c)?.name }} <span class="text-ink/40">vs</span> {{ others(c) }}</p>
        <p class="text-ink/70">{{ subjectLabel(c.subject) }} · {{ c.questions }} questions · {{ c.minutes }} min</p>
        <button v-if="c.mine.state === 'not_started' || c.mine.state === 'started'" class="btn-chunky mt-3 w-full bg-sprint py-4 text-xl text-white" @click="router.push(`/compete/play/class-contests/${c.id}`)">
          {{ c.mine.state === 'started' ? 'Continue my paper →' : 'Start my paper →' }}
        </button>
        <p v-else-if="c.mine.state === 'done'" class="mt-2 font-semibold text-leaf">✓ Handed in. Results at {{ timeOnly(c.ends_at) }}.</p>
        <p v-else class="mt-2 text-ink/60">Your time for this paper is up.</p>
      </section>

      <section v-for="c in classUpcoming" :key="'cu' + c.id" class="rounded-3xl bg-ink p-5 text-white">
        <p class="text-sm font-semibold text-sun">📅 {{ when(c.starts_at) }} · in {{ until(c.starts_at, now) }}</p>
        <p class="text-xl font-bold">{{ myClass(c)?.name }} <span class="opacity-50">vs</span> {{ others(c) }}</p>
        <p class="opacity-80">{{ subjectLabel(c.subject) }} · {{ c.questions }} questions</p>
      </section>

      <section v-for="c in upcoming" :key="c.id" class="rounded-3xl bg-ink p-5 text-white">
        <p class="text-sm font-semibold text-sun">📅 {{ when(c.starts_at) }} · in {{ until(c.starts_at, now) }}</p>
        <p class="text-xl font-bold">{{ us(c).name }} <span class="opacity-50">vs</span> {{ them(c).name }}</p>
        <p class="opacity-80">{{ gradeLabel(c.grade) }} · {{ subjectLabel(c.subject) }} · {{ c.questions }} questions</p>
      </section>

      <section v-if="finished.length || classFinished.length" class="rounded-3xl bg-white p-4 shadow-sm">
        <h2 class="mb-2 text-lg font-bold">Results</h2>
        <button v-for="c in classFinished" :key="'cf' + c.id" class="flex w-full items-center gap-3 border-b border-ink/5 py-3 text-left last:border-0" @click="router.push(`/compete/class-contests/${c.id}`)">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ myClass(c)?.name }} vs {{ others(c) }}</span>
            <span class="block text-sm text-ink/70">{{ classOutcome(c) }} · {{ subjectLabel(c.subject) }}</span>
          </span>
          <span class="text-2xl text-ink/30">›</span>
        </button>
        <button v-for="c in finished" :key="c.id" class="flex w-full items-center gap-3 border-b border-ink/5 py-3 text-left last:border-0" @click="router.push(`/compete/contests/${c.id}`)">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">vs {{ them(c).name }}</span>
            <span class="block text-sm text-ink/70">{{ outcome(c) }} · {{ subjectLabel(c.subject) }}</span>
          </span>
          <span class="text-2xl text-ink/30">›</span>
        </button>
      </section>

      <div v-if="!contests.length && !classContests.length" class="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p class="text-5xl">🏫</p>
        <p class="mt-2 text-lg font-semibold">No school competitions yet</p>
        <p class="text-ink/70">Your teacher can challenge another school, or another class at your school. You take part when you are in their BrainSprint class.</p>
      </div>
    </template>
  </main>
</template>
