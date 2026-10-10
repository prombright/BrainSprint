<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StarRow from '../components/StarRow.vue'
import TopBar from '../components/TopBar.vue'
import { STARS_TO_UNLOCK } from '../game/scoring'
import { hasQuestions } from '../game/sprint'
import { bankVersion } from '../lib/bank'
import { GRADES, LEVELS, SUBJECTS, type Grade, type Level, type Subject } from '../game/types'
import { usePlayer } from '../stores/player'

const route = useRoute()
const router = useRouter()
const player = usePlayer()

const subject = route.params.subject as Subject
const info = SUBJECTS.find((s) => s.id === subject)
if (!info) router.replace('/')

const grade = ref<Grade>(player.profile?.grade ?? 'P1')
const available = computed(() => (bankVersion.value, hasQuestions(subject, grade.value)))
const levels = computed(() =>
  LEVELS.map((l) => ({
    ...l,
    stars: player.starsOf(subject, grade.value, l.id),
    open: player.isUnlocked(subject, grade.value, l.id),
  })),
)

function play(level: Level) {
  router.push(`/sprint/${subject}/${grade.value}/${level}`)
}
</script>

<template>
  <main class="flex flex-1 flex-col">
    <TopBar :title="`${info?.emoji} ${info?.label}`" back="/" />

    <div class="mb-5 grid grid-cols-4 gap-2 rounded-2xl bg-white p-1.5">
      <button
        v-for="g in GRADES"
        :key="g.id"
        class="rounded-xl py-2 text-lg font-semibold transition"
        :class="grade === g.id ? 'bg-ocean text-white' : 'text-ink/60'"
        @click="grade = g.id"
      >
        {{ g.id === 'TOP' ? 'Top' : g.label }}
      </button>
    </div>

    <div v-if="!available" class="rounded-3xl bg-white p-6 text-center shadow-sm">
      <div class="text-5xl">🚧</div>
      <p class="mt-2 text-xl font-bold">{{ info?.label }} for {{ grade }} is coming soon</p>
      <p class="mt-1 text-ink/60">Try another class, or play Maths for now.</p>
    </div>

    <div v-else class="flex flex-col gap-4">
      <button
        v-for="(l, i) in levels"
        :key="l.id"
        class="btn-chunky flex items-center gap-4 p-4 text-left"
        :class="l.open ? 'bg-white' : 'bg-ink/5'"
        :disabled="!l.open"
        @click="play(l.id)"
      >
        <span class="grid size-16 shrink-0 place-items-center rounded-2xl bg-cream text-4xl">{{ l.open ? l.emoji : '🔒' }}</span>
        <span class="flex-1">
          <span class="block text-2xl">{{ l.label }}</span>
          <span v-if="l.open" class="text-sm font-normal text-ink/60">{{ l.seconds }} seconds a question</span>
          <span v-else class="text-sm font-normal text-ink/60">
            Get {{ STARS_TO_UNLOCK }} ⭐ on {{ levels[i - 1].label }} to open
          </span>
        </span>
        <StarRow :stars="l.stars" />
      </button>
    </div>

    <p class="mt-auto pt-6 text-center text-ink/60">Answer fast to earn bonus points ⚡</p>
  </main>
</template>
