<script setup lang="ts">
// School vs School from the child's side: what's live, what's coming, and past results.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { api, type Contest } from '../lib/api'
import { gradeLabel, subjectLabel, timeOnly, until, when } from '../lib/compete'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const contests = ref<Contest[] | null>(null)
const error = ref('')
const now = ref(Date.now())
let tick: number | undefined

async function load() {
  await player.sync()
  if (!player.auth) return void (error.value = 'Connect to the internet to see competitions')
  try {
    contests.value = (await api.compete(player.auth)).contests
  } catch (e) {
    error.value = (e as Error).message
  }
}

const live = computed(() => contests.value?.filter((c) => c.phase === 'live') ?? [])
const upcoming = computed(() => contests.value?.filter((c) => c.phase === 'upcoming').reverse() ?? [])
const finished = computed(() => contests.value?.filter((c) => c.phase === 'finished') ?? [])
const us = (c: Contest) => (c.my_school_id === c.school_b.id ? c.school_b : c.school_a)
const them = (c: Contest) => (c.my_school_id === c.school_b.id ? c.school_a : c.school_b)
function outcome(c: Contest) {
  if (!c.summary) return ''
  if (c.summary.draw) return '🤝 A draw!'
  if (c.summary.winner_id === null) return 'Not enough pupils played'
  return c.summary.winner_id === c.my_school_id ? '🏆 Your school won!' : `${them(c).name} won`
}

onMounted(() => {
  load()
  // keep countdowns fresh, and notice when a competition opens
  tick = window.setInterval(() => {
    now.value = Date.now()
    if (upcoming.value.some((c) => new Date(c.starts_at).getTime() <= now.value)) load()
  }, 30_000)
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="🏫 School vs School" back="/compete" />
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

      <section v-for="c in upcoming" :key="c.id" class="rounded-3xl bg-ink p-5 text-white">
        <p class="text-sm font-semibold text-sun">📅 {{ when(c.starts_at) }} · in {{ until(c.starts_at, now) }}</p>
        <p class="text-xl font-bold">{{ us(c).name }} <span class="opacity-50">vs</span> {{ them(c).name }}</p>
        <p class="opacity-80">{{ gradeLabel(c.grade) }} · {{ subjectLabel(c.subject) }} · {{ c.questions }} questions</p>
      </section>

      <section v-if="finished.length" class="rounded-3xl bg-white p-4 shadow-sm">
        <h2 class="mb-2 text-lg font-bold">Results</h2>
        <button v-for="c in finished" :key="c.id" class="flex w-full items-center gap-3 border-b border-ink/5 py-3 text-left last:border-0" @click="router.push(`/compete/contests/${c.id}`)">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">vs {{ them(c).name }}</span>
            <span class="block text-sm text-ink/70">{{ outcome(c) }} · {{ subjectLabel(c.subject) }}</span>
          </span>
          <span class="text-2xl text-ink/30">›</span>
        </button>
      </section>

      <div v-if="!contests.length" class="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p class="text-5xl">🏫</p>
        <p class="mt-2 text-lg font-semibold">No school competitions yet</p>
        <p class="text-ink/70">Your teacher can challenge another school. You take part when you are in their BrainSprint class.</p>
      </div>
    </template>
  </main>
</template>
