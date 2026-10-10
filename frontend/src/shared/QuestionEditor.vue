<script setup lang="ts">
// Write or edit one question, with a live preview of what a child will see.
// Used by the admin panel (write / approve) and the teacher portal (suggest).
import { computed } from 'vue'
import { GRADES, LEVELS, SUBJECTS } from '../game/types'
import type { QuestionDraft } from './questionDraft'

const draft = defineModel<QuestionDraft>({ required: true })
defineProps<{ busy?: boolean; saveLabel?: string; subjects?: string[] }>()
const emit = defineEmits<{ save: []; cancel: [] }>()

const filled = computed(() => draft.value.choices.map((c) => c.trim()).filter(Boolean))
// a problem shown before saving (the server checks the same rules)
const problem = computed(() => {
  const d = draft.value
  if (!d.prompt.trim()) return 'Write the question'
  if (filled.value.length < 2) return 'Give at least 2 answer choices'
  if (new Set(filled.value.map((c) => c.toLowerCase())).size !== filled.value.length) return 'Two choices are the same'
  if (!d.answer || !filled.value.includes(d.answer.trim())) return 'Tick the correct answer'
  if (!/^[a-z][a-z \-]{1,38}$/.test(d.topic.trim().toLowerCase())) return 'Give a topic, e.g. "plants" (letters only)'
  return ''
})
</script>

<template>
  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <form class="space-y-3" @submit.prevent="!problem && emit('save')">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="block"><span class="mb-1 block text-sm font-semibold">Subject</span>
          <select v-model="draft.subject" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2">
            <option v-for="s in SUBJECTS.filter((x) => !subjects || subjects.includes(x.id))" :key="s.id" :value="s.id">{{ s.label }}</option>
          </select>
        </label>
        <label class="block"><span class="mb-1 block text-sm font-semibold">Class</span>
          <select v-model="draft.grade" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2"><option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option></select>
        </label>
        <label class="block"><span class="mb-1 block text-sm font-semibold">Level</span>
          <select v-model="draft.level" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2"><option v-for="l in LEVELS" :key="l.id" :value="l.id">{{ l.emoji }} {{ l.label }}</option></select>
        </label>
        <label class="block"><span class="mb-1 block text-sm font-semibold">Topic</span>
          <input v-model="draft.topic" maxlength="39" placeholder="e.g. plants" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2 outline-none focus:border-ocean" />
        </label>
      </div>

      <label class="block"><span class="mb-1 block text-sm font-semibold">Question</span>
        <textarea v-model="draft.prompt" rows="2" maxlength="400" placeholder="Which part of a plant takes in water from the soil?" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
      </label>

      <fieldset>
        <legend class="mb-1 text-sm font-semibold">Answer choices <span class="font-normal text-ink/60">(2–4; tick the correct one)</span></legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <label v-for="(_, i) in draft.choices" :key="i" class="flex items-center gap-2 rounded-xl border-2 px-2 py-1" :class="draft.answer && draft.answer === draft.choices[i].trim() ? 'border-leaf bg-leaf/5' : 'border-ink/10'">
            <input type="radio" name="answer" :checked="!!draft.answer && draft.answer === draft.choices[i].trim()" :disabled="!draft.choices[i].trim()" class="size-5 accent-leaf" :aria-label="`Choice ${i + 1} is correct`" @change="draft.answer = draft.choices[i].trim()" />
            <input v-model="draft.choices[i]" maxlength="100" :placeholder="`Choice ${i + 1}${i >= 2 ? ' (optional)' : ''}`" class="min-w-0 flex-1 bg-transparent py-1 outline-none" @input="draft.answer && !draft.choices.map((c) => c.trim()).includes(draft.answer) && (draft.answer = '')" />
          </label>
        </div>
      </fieldset>

      <label class="block"><span class="mb-1 block text-sm font-semibold">Working / explanation <span class="font-normal text-ink/60">(optional, one step per line; shown after a wrong answer)</span></span>
        <textarea v-model="draft.stepsText" rows="3" placeholder="Roots grow under the ground.&#10;They take in water and mineral salts." class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
      </label>

      <details class="text-sm">
        <summary class="font-semibold text-ocean">Read-aloud text (optional)</summary>
        <input v-model="draft.speak" maxlength="400" placeholder="If empty, the question itself is read out" class="mt-1 w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
      </details>

      <p v-if="problem" class="text-sm text-cherry">{{ problem }}</p>
      <div class="flex gap-2">
        <button type="button" class="rounded-xl bg-cream px-4 py-2 font-semibold" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="btn-chunky bg-ocean px-6 py-2 text-lg text-white" :disabled="busy || !!problem">{{ saveLabel ?? 'Save' }}</button>
      </div>
    </form>

    <!-- what a child sees -->
    <aside aria-label="Preview">
      <p class="mb-1 text-sm font-semibold text-ink/60">Preview: what a child sees</p>
      <div class="rounded-3xl border-8 border-ink bg-cream p-3">
        <div class="rounded-2xl bg-white p-4 text-center">
          <p class="text-xs text-ink/50">{{ draft.grade }} · {{ draft.topic || 'topic' }}</p>
          <p class="mt-1 text-lg leading-snug font-bold">{{ draft.prompt || 'Your question appears here' }}</p>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <span
            v-for="(c, i) in (filled.length ? filled : ['…', '…'])"
            :key="i"
            class="rounded-xl py-2 text-center text-sm font-semibold break-words shadow-[0_3px_0_rgb(0_0_0/0.12)]"
            :class="c === draft.answer.trim() ? 'bg-leaf text-white' : 'bg-white'"
            >{{ c }}</span
          >
        </div>
        <ol v-if="draft.stepsText.trim()" class="mt-2 list-decimal space-y-0.5 rounded-xl bg-white p-2 pl-6 text-xs">
          <li v-for="(s, i) in draft.stepsText.split('\n').filter((x) => x.trim())" :key="i">{{ s }}</li>
        </ol>
      </div>
      <p class="mt-1 text-xs text-ink/50">Choices are shuffled for each child.</p>
    </aside>
  </div>
</template>
