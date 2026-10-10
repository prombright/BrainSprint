<script setup lang="ts">
// Edit one fact set: its columns, question patterns and facts, with live checks and a preview
// of the questions the Fact Engine will make (see game/facts.ts).
import { computed, ref } from 'vue'
import { GRADES, LEVELS, SUBJECTS, type Level } from '../game/types'
import { allFactQuestions, checkFactSet, factQuestion, type FactSet } from '../game/facts'
import type { FactSetDraft } from './factDraft'

const draft = defineModel<FactSetDraft>({ required: true })
defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ save: []; cancel: [] }>()

const columns = computed(() => draft.value.columnsText.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean))
const rows = computed(() =>
  draft.value.rowsText
    .split('\n')
    .map((line) => line.split(line.includes('\t') ? '\t' : '|').map((c) => c.trim()))
    .filter((r) => r.some(Boolean)),
)
const asSet = computed<FactSet>(() => ({
  id: 0,
  subject: draft.value.subject,
  name: draft.value.name || 'facts',
  grade_from: draft.value.grade_from,
  grade_to: draft.value.grade_to,
  columns: columns.value,
  templates: draft.value.templates,
  explain: draft.value.explain || null,
  rows: rows.value,
}))
const problems = computed(() => {
  const p = checkFactSet(asSet.value)
  if (!draft.value.name.trim()) p.unshift('Give the set a name, e.g. "body organs"')
  if (!draft.value.templates.length) p.push('Add at least one question pattern')
  return p
})

// preview: a few freshly made questions, and how many different ones the set can ask
const sample = ref<ReturnType<typeof factQuestion>[]>([])
function refreshSample() {
  sample.value = problems.value.length ? [] : Array.from({ length: 6 }, (_, i) => factQuestion(asSet.value, LEVELS[i % 4].id))
}
const counts = computed(() => {
  if (problems.value.length) return null
  const all = allFactQuestions(asSet.value)
  return { total: all.filter((q) => q.fair).length, ambiguous: all.filter((q) => !q.fair).length }
})

function addPattern() {
  draft.value.templates.push({ ask: '', answer: columns.value[0] ?? '', level: 'simple' as Level })
}
const gapHint = computed(() => columns.value.map((c) => `{${c}}`).join(' '))
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label class="block"><span class="mb-1 block text-sm font-semibold">Name (also the topic)</span><input v-model="draft.name" maxlength="59" placeholder="e.g. body organs" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <label class="block"><span class="mb-1 block text-sm font-semibold">Subject</span>
        <select v-model="draft.subject" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2"><option v-for="s in SUBJECTS" :key="s.id" :value="s.id">{{ s.label }}</option></select>
      </label>
      <label class="block"><span class="mb-1 block text-sm font-semibold">From class</span>
        <select v-model="draft.grade_from" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2"><option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option></select>
      </label>
      <label class="block"><span class="mb-1 block text-sm font-semibold">To class</span>
        <select v-model="draft.grade_to" class="w-full rounded-xl border-2 border-ink/10 px-2 py-2"><option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option></select>
      </label>
    </div>

    <label class="block"><span class="mb-1 block text-sm font-semibold">Columns <span class="font-normal text-ink/60">(comma-separated, lowercase: e.g. organ, job, system)</span></span>
      <input v-model="draft.columnsText" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 font-mono outline-none focus:border-ocean" />
    </label>

    <div>
      <p class="mb-1 text-sm font-semibold">Question patterns <span class="font-normal text-ink/60">(use {{ gapHint || '{column}' }} for gaps)</span></p>
      <div v-for="(t, i) in draft.templates" :key="i" class="mb-2 grid gap-2 rounded-xl bg-cream p-2 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_9rem_auto]">
        <input v-model="t.ask" placeholder="Which organ {job}?" class="rounded-lg border-2 border-ink/10 px-2 py-1.5 outline-none focus:border-ocean" />
        <label class="text-xs">answer column<select v-model="t.answer" class="w-full rounded-lg border-2 border-ink/10 px-1 py-1"><option v-for="c in columns" :key="c" :value="c">{{ c }}</option></select></label>
        <label class="text-xs">level<select v-model="t.level" class="w-full rounded-lg border-2 border-ink/10 px-1 py-1"><option v-for="l in LEVELS" :key="l.id" :value="l.id">{{ l.label }}</option></select></label>
        <label class="text-xs">"NOT" grouped by<select :value="t.not ?? ''" class="w-full rounded-lg border-2 border-ink/10 px-1 py-1" @change="t.not = ($event.target as HTMLSelectElement).value || undefined"><option value="">no (normal)</option><option v-for="c in columns" :key="c" :value="c">{{ c }}</option></select></label>
        <button type="button" class="self-end rounded-lg px-2 py-1.5 text-cherry" aria-label="Remove pattern" @click="draft.templates.splice(i, 1)">✕</button>
      </div>
      <button type="button" class="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold shadow-sm" @click="addPattern">+ Add pattern</button>
      <p class="mt-1 text-xs text-ink/60">A normal pattern uses one fact for the right answer and other facts' values for the wrong ones. A "NOT" pattern shows three facts from one group and one from another, e.g. "Which of these is NOT {group}?".</p>
    </div>

    <label class="block"><span class="mb-1 block text-sm font-semibold">Explanation after a wrong answer <span class="font-normal text-ink/60">(optional; uses the right answer's fact)</span></span>
      <input v-model="draft.explain" maxlength="255" placeholder="The {organ}: {job}. Body system: {system}." class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
    </label>

    <label class="block"><span class="mb-1 block text-sm font-semibold">Facts <span class="font-normal text-ink/60">(one per line, cells in column order separated by |, or paste straight from Excel)</span></span>
      <textarea v-model="draft.rowsText" rows="10" placeholder="heart | pumps blood around the body | circulatory" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 font-mono text-sm outline-none focus:border-ocean" />
    </label>

    <div v-if="problems.length" class="rounded-xl bg-cherry/10 p-3 text-sm text-cherry">
      <p v-for="p in problems.slice(0, 6)" :key="p">• {{ p }}</p>
    </div>
    <div v-else class="rounded-xl bg-leaf/10 p-3 text-sm">
      <p class="font-semibold text-leaf">
        ✓ {{ rows.length }} facts × {{ draft.templates.length }} patterns → about {{ counts?.total }} different questions<span v-if="counts?.ambiguous">, {{ counts.ambiguous }} skipped because two facts would both be right</span>.
      </p>
      <button type="button" class="mt-1 font-semibold text-ocean underline" @click="refreshSample">{{ sample.length ? '↻ Show other examples' : 'Show example questions' }}</button>
      <ul v-if="sample.length" class="mt-2 space-y-1">
        <li v-for="(q, i) in sample" :key="i" class="rounded-lg bg-white p-2">
          <template v-if="q">
            <b>{{ q.prompt }}</b>
            <span class="text-ink/60"> · {{ q.choices.map((c) => (c === q!.answer ? `✓ ${c}` : c)).join(' · ') }}</span>
          </template>
        </li>
      </ul>
    </div>

    <div class="flex gap-2">
      <button type="button" class="rounded-xl bg-cream px-4 py-2 font-semibold" @click="emit('cancel')">Cancel</button>
      <button type="button" class="btn-chunky bg-ocean px-6 py-2 text-lg text-white" :disabled="busy || problems.length > 0" @click="emit('save')">Save</button>
    </div>
  </div>
</template>
