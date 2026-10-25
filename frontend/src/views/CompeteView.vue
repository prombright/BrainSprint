<script setup lang="ts">
// The Compete menu: three big buttons, each saying in one line what is waiting there.
// Each competition has its own page (weekly results, duels, school vs school).
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { api, type CompeteData, type WeeklyData } from '../lib/api'
import { when } from '../lib/compete'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const data = ref<CompeteData | null>(null)
const weekly = ref<WeeklyData | null>(null)
const error = ref('')

onMounted(async () => {
  await player.sync()
  if (!player.auth) return void (error.value = 'Connect to the internet to compete')
  try {
    const [c, w] = await Promise.all([api.compete(player.auth), api.weekly(player.auth).catch(() => null)])
    data.value = c
    weekly.value = w
  } catch (e) {
    error.value = (e as Error).message
  }
})

// one line per button, and whether something is waiting for the child (a red dot)
const weeklyLine = computed(() => {
  const w = weekly.value?.this_week
  if (!w) return { text: 'Not ready for your class yet', alert: false }
  if (w.mine.state === 'not_started') return { text: "This week's paper is ready!", alert: true }
  if (w.mine.state === 'started') return { text: 'Finish your paper!', alert: true }
  const last = weekly.value?.last_week?.result?.my_rank
  return { text: `Done ✓ ${w.mine.correct}/${w.mine.total}${last ? ` · last week you came ${last}` : ' · places on Monday'}`, alert: false }
})

const duelLine = computed(() => {
  const duels = data.value?.duels ?? []
  const waiting = duels.filter((d) => d.phase === 'open' && (d.mine.state === 'not_started' || d.mine.state === 'started'))
  if (waiting.length) {
    const d = waiting[0]
    const name = d.other.name.split(' ')[0]
    return { text: d.i_challenged ? 'Play your duel!' : `${name} challenged you!`, alert: true, count: waiting.length }
  }
  const finished = duels.find((d) => d.phase === 'done')
  if (finished) return { text: finished.outcome === 'won' ? `You beat ${finished.other.name.split(' ')[0]}!` : 'Challenge a friend again', alert: false, count: 0 }
  return { text: 'Challenge a friend', alert: false, count: 0 }
})

const schoolLine = computed(() => {
  // school vs school and class vs class look the same here
  const cs = [...(data.value?.contests ?? []), ...(data.value?.class_contests ?? [])].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const live = cs.find((c) => c.phase === 'live')
  if (live && (live.mine?.state === 'not_started' || live.mine?.state === 'started')) return { text: 'Live now: play for your school!', alert: true }
  if (live) return { text: 'Live now · you handed in ✓', alert: false }
  const next = cs.filter((c) => c.phase === 'upcoming').at(-1)
  if (next) return { text: `Next: ${when(next.starts_at)}`, alert: false }
  if (cs.some((c) => c.phase === 'finished')) return { text: 'See your results', alert: false }
  return { text: 'Ask your teacher to set one up', alert: false }
})
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="Compete" back="/" />
    <p v-if="error && !data" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">📶 {{ error }}</p>

    <template v-if="data">
      <button class="btn-chunky relative flex items-center gap-4 bg-gradient-to-br from-ocean to-berry p-5 text-left text-white" @click="router.push('/compete/weekly/0')">
        <span class="text-6xl">🌍</span>
        <span class="min-w-0 flex-1">
          <span class="block text-2xl">Weekly Challenge</span>
          <span class="block font-normal opacity-90">{{ weeklyLine.text }}</span>
        </span>
        <span v-if="weeklyLine.alert" class="absolute top-3 right-3 size-4 rounded-full bg-cherry ring-2 ring-white" aria-label="Waiting for you" />
      </button>

      <button class="btn-chunky relative flex items-center gap-4 bg-gradient-to-br from-sprint to-sprint-dark p-5 text-left text-white" @click="router.push('/compete/duels')">
        <span class="text-6xl">⚔️</span>
        <span class="min-w-0 flex-1">
          <span class="block text-2xl">Duels</span>
          <span class="block font-normal opacity-90">{{ duelLine.text }}</span>
        </span>
        <span v-if="duelLine.count" class="absolute top-3 right-3 grid min-w-7 place-items-center rounded-full bg-white px-2 text-lg font-bold text-cherry">{{ duelLine.count }}</span>
      </button>

      <button class="btn-chunky relative flex items-center gap-4 bg-ink p-5 text-left text-white" @click="router.push('/compete/schools')">
        <span class="text-6xl">🏫</span>
        <span class="min-w-0 flex-1">
          <span class="block text-2xl">School contests</span>
          <span class="block font-normal opacity-90">{{ schoolLine.text }}</span>
        </span>
        <span v-if="schoolLine.alert" class="absolute top-3 right-3 size-4 animate-pulse rounded-full bg-cherry ring-2 ring-white" aria-label="Live now" />
      </button>

      <p class="mt-auto text-center text-sm text-ink/50">Competitions are free and use no Brain Power.</p>
    </template>
  </main>
</template>
