<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { MIN_ATTEMPTS, type TopicLevel } from '../game/practice'
import { hasQuestions, topicsOf } from '../game/sprint'
import { SUBJECTS, type Subject } from '../game/types'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const grade = computed(() => player.profile!.grade)

const subjects = computed(() => SUBJECTS.filter((s) => s.ready && hasQuestions(s.id, grade.value)))
const subject = ref<Subject>(subjects.value[0]?.id ?? 'maths')

const topics = computed(() => player.topicsFor(subject.value, grade.value))
const weak = computed(() => topics.value.filter((t) => t.level === 'weak'))
const strong = computed(() => topics.value.filter((t) => t.level === 'strong'))
const due = computed(() => player.dueReview(subject.value, grade.value))
// topics this class has that the child hasn't met yet (in levels they've opened)
const untried = computed(() => {
  const met = new Set(topics.value.map((t) => t.topic))
  return topicsOf(subject.value, grade.value, player.openLevels(subject.value, grade.value)).filter((t) => !met.has(t))
})

const LOOK: Record<TopicLevel, { label: string; bar: string; chip: string }> = {
  weak: { label: '🎯 Needs practice', bar: 'bg-cherry', chip: 'bg-cherry/10 text-cherry' },
  ok: { label: '🙂 Getting there', bar: 'bg-sun', chip: 'bg-sun/40 text-ink' },
  strong: { label: '💪 Strong', bar: 'bg-leaf', chip: 'bg-leaf/15 text-leaf' },
  new: { label: '🌱 Just started', bar: 'bg-ocean', chip: 'bg-ocean/10 text-ocean' },
}
const nice = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function practise(topic?: string) {
  router.push({ path: '/practice', query: { subject: subject.value, ...(topic ? { topic } : {}) } })
}
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="🎯 My Progress" back="/" />

    <div v-if="subjects.length > 1" class="flex gap-2">
      <button
        v-for="s in subjects"
        :key="s.id"
        class="rounded-xl px-4 py-2 font-semibold"
        :class="subject === s.id ? 'bg-ink text-white' : 'bg-white'"
        @click="subject = s.id"
      >
        {{ s.emoji }} {{ s.label }}
      </button>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="flex min-w-0 flex-col gap-4">
        <!-- the main action -->
        <section class="rounded-3xl bg-gradient-to-br from-sprint to-sprint-dark p-5 text-white">
          <h2 class="text-2xl font-bold">
            {{ weak.length ? `${weak.length} topic${weak.length === 1 ? '' : 's'} to practise` : due.length ? 'Questions to try again' : 'Keep it up!' }}
          </h2>
          <p class="mt-1 opacity-90">
            <template v-if="weak.length">Your practice sprint mixes {{ weak.slice(0, 3).map((t) => nice(t.topic)).join(', ') }}<template v-if="due.length"> with {{ due.length }} question{{ due.length === 1 ? '' : 's' }} you missed before</template>.</template>
            <template v-else-if="due.length">{{ due.length }} question{{ due.length === 1 ? '' : 's' }} you missed before {{ due.length === 1 ? 'is' : 'are' }} ready to try again.</template>
            <template v-else-if="topics.length">No weak spots right now. A practice sprint keeps your strong topics strong.</template>
            <template v-else>Play a few sprints and we'll work out what you should practise.</template>
          </p>
          <button class="btn-chunky mt-4 w-full bg-white py-3 text-xl text-ink sm:w-auto sm:px-8" @click="practise()">🎯 Practise my weak spots</button>
        </section>

        <!-- every topic -->
        <section class="rounded-3xl bg-white p-4 shadow-sm">
          <h2 class="mb-1 text-xl font-bold">Topics</h2>
          <p class="mb-3 text-sm text-ink/60">Based on your last {{ 20 }} answers in each topic. A topic needs {{ MIN_ATTEMPTS }} answers before we judge it.</p>
          <p v-if="!topics.length" class="text-ink/60">Nothing yet: play a sprint first!</p>
          <ul class="space-y-3">
            <li v-for="t in topics" :key="t.topic" class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-semibold">{{ nice(t.topic) }}</span>
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" :class="LOOK[t.level].chip">{{ LOOK[t.level].label }}</span>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <div class="h-full rounded-full" :class="LOOK[t.level].bar" :style="{ width: `${t.mastery}%` }" />
                  </div>
                  <span class="w-10 text-right text-sm font-semibold tabular-nums">{{ t.mastery }}%</span>
                </div>
              </div>
              <button class="shrink-0 rounded-xl bg-cream px-3 py-2 text-sm font-semibold hover:bg-sun/40" :aria-label="`Practise ${t.topic}`" @click="practise(t.topic)">Practise</button>
            </li>
          </ul>
        </section>
      </div>

      <aside class="flex flex-col gap-4">
        <section class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold text-leaf">{{ strong.length }}</div><div class="text-xs text-ink/60">strong</div></div>
          <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold text-cherry">{{ weak.length }}</div><div class="text-xs text-ink/60">to practise</div></div>
          <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold text-berry">{{ due.length }}</div><div class="text-xs text-ink/60">to try again</div></div>
        </section>

        <section class="rounded-3xl bg-white p-4 shadow-sm">
          <h2 class="text-lg font-bold">🔁 Try-again box</h2>
          <p class="mt-1 text-sm text-ink/70">
            Questions you get wrong come back after 1 day, then 3, 7 and 14 days, until you've learnt them.
            {{ player.state.review.filter((c) => c.subject === subject).length }} waiting, {{ due.length }} ready now.
          </p>
        </section>

        <section v-if="untried.length" class="rounded-3xl bg-white p-4 shadow-sm">
          <h2 class="text-lg font-bold">🌱 Not tried yet</h2>
          <div class="mt-2 flex flex-wrap gap-2">
            <button v-for="t in untried" :key="t" class="rounded-full bg-cream px-3 py-1 text-sm font-semibold hover:bg-sun/40" @click="practise(t)">{{ nice(t) }}</button>
          </div>
        </section>
      </aside>
    </div>
  </main>
</template>
