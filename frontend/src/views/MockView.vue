<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { MOCK_GRADES, MOCK_MINUTES, MOCK_QUESTIONS, readinessBand } from '../game/mock'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const grade = computed(() => player.profile!.grade)
const eligible = computed(() => MOCK_GRADES.includes(grade.value))
const history = computed(() => player.state.mockHistory)
const band = computed(() => (history.value?.readiness != null ? readinessBand(history.value.readiness) : null))

onMounted(() => eligible.value && player.loadMocks())
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="🎓 PLE Prep" back="/" />

    <section v-if="!eligible" class="rounded-3xl bg-white p-6 text-center shadow-sm">
      <div class="text-6xl">🎓</div>
      <h2 class="mt-2 text-2xl font-bold">PLE Prep is for P6 and P7</h2>
      <p class="mt-1 text-ink/70">Keep practising your class's levels and weak spots. Mock exams open when you reach P6.</p>
    </section>

    <template v-else>
      <section class="rounded-3xl bg-ink p-6 text-white">
        <p class="text-sm font-semibold tracking-widest text-sun uppercase">Your PLE readiness</p>
        <template v-if="band && history?.readiness != null">
          <p class="mt-1 text-6xl font-bold">{{ history.readiness }}%</p>
          <p class="text-xl font-semibold">{{ band.emoji }} {{ band.label }}</p>
          <p class="mt-1 opacity-80">{{ band.note }}</p>
          <p class="mt-2 text-sm opacity-60">The average of your last {{ Math.min(3, history.mocks.length) }} mock{{ history.mocks.length === 1 ? '' : 's' }}.</p>
        </template>
        <template v-else>
          <p class="mt-2 text-2xl font-bold">Take your first mock to see how ready you are</p>
        </template>
      </section>

      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="text-xl font-bold">📝 Maths mock paper</h2>
        <ul class="mt-2 space-y-1 text-ink/80">
          <li>⏱️ <b>{{ MOCK_MINUTES }} minutes</b> for <b>{{ MOCK_QUESTIONS }} questions</b> from across the {{ grade }} syllabus, with some revision from the year below.</li>
          <li>✏️ Have paper and a pencil ready for working.</li>
          <li>🔕 No answers or hints until you finish, just like the real exam. You can go back and change answers.</li>
          <li>📊 At the end: your score, each topic, and the working for every question you missed.</li>
          <li>⚡ Mocks don't use Brain Power.</li>
        </ul>
        <button class="btn-chunky mt-4 w-full bg-sprint py-4 text-2xl text-white sm:w-auto sm:px-10" @click="router.push('/mock/exam')">Start a mock</button>
      </section>

      <section v-if="history?.mocks.length" class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="mb-2 text-xl font-bold">Past mocks</h2>
        <ul class="divide-y divide-ink/5">
          <li v-for="m in history.mocks" :key="m.id" class="flex items-center gap-3 py-2">
            <span class="w-28 text-sm text-ink/60">{{ new Date(m.taken_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }}</span>
            <div class="h-3 flex-1 overflow-hidden rounded-full bg-ink/10">
              <div class="h-full rounded-r-[4px]" :class="m.percent >= 65 ? 'bg-leaf' : m.percent >= 50 ? 'bg-sun' : 'bg-cherry'" :style="{ width: `${m.percent}%` }" />
            </div>
            <span class="w-24 text-right font-semibold tabular-nums">{{ m.correct }}/{{ m.total }} · {{ m.percent }}%</span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>
