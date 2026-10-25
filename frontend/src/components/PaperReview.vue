<script setup lang="ts">
// A marked paper: each question with the child's answer next to the right one, and the working.
import type { PaperQuestion } from '../lib/api'

defineProps<{ questions: PaperQuestion[] }>()
</script>

<template>
  <section class="rounded-3xl bg-white p-5 shadow-sm">
    <h2 class="mb-3 text-xl font-bold">Go through your paper</h2>
    <ol class="space-y-3">
      <li v-for="(q, i) in questions" :key="i" class="rounded-2xl p-3" :class="q.picked === q.answer ? 'bg-leaf/10' : 'bg-cherry/5'">
        <p class="font-semibold">
          {{ i + 1 }}. <span v-if="q.visual && q.visual.length <= 12">{{ q.visual }} </span>{{ q.prompt }} <span v-if="q.big" class="text-ocean">{{ q.big }}</span>
        </p>
        <p class="mt-1 text-sm">
          <span v-if="q.picked === q.answer" class="font-semibold text-leaf">✓ {{ q.answer }}</span>
          <template v-else>
            <span class="text-cherry">Your answer: {{ q.picked ?? 'none' }}</span> · <span class="font-semibold text-leaf">Correct: {{ q.answer }}</span>
          </template>
        </p>
        <details v-if="q.picked !== q.answer && q.steps?.length" class="mt-1 text-sm">
          <summary class="font-semibold text-ocean">See the working</summary>
          <ol class="mt-1 list-decimal space-y-1 pl-5">
            <li v-for="(st, j) in q.steps" :key="j">{{ st }}</li>
          </ol>
        </details>
      </li>
    </ol>
  </section>
</template>
