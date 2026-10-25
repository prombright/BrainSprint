<script setup lang="ts">
// The whole school, class by class, for any teacher of the school (head teachers especially).
// Only numbers and topics: pupils' names stay with their own class teacher.
import { onMounted, ref } from 'vue'
import { SUBJECTS } from '../game/types'
import { downloadCsv } from '../shared/csv'
import { teacherCall } from './api'

interface ClassRow {
  id: number
  name: string
  grade: string
  teacher: string
  pupils: number
  active_this_week: number
  sprints_this_week: number
  accuracy: number | null
  weak_topics: { subject: string; topic: string; mastery: number }[]
}
interface Overview {
  school: { name: string; district: string } | null
  teachers: number
  pupils: number
  active_this_week: number
  classes: ClassRow[]
}

const data = ref<Overview | null>(null)
const error = ref('')
onMounted(async () => {
  try {
    data.value = await teacherCall<Overview>('GET', '/teacher/school/overview')
  } catch (e) {
    error.value = (e as Error).message
  }
})

const subjectLabel = (s: string) => SUBJECTS.find((x) => x.id === s)?.label ?? s
const gradeLabel = (g: string) => (g === 'TOP' ? 'Top Class' : g)
const printNow = () => window.print()
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

function download() {
  const d = data.value!
  downloadCsv(`${d.school?.name ?? 'school'} - whole school.csv`, [
    ['Class', 'Year', 'Teacher', 'Pupils', 'Played this week', 'Sprints this week', 'Accuracy this week %', 'Weakest topics'],
    ...d.classes.map((c) => [c.name, gradeLabel(c.grade), c.teacher, c.pupils, c.active_this_week, c.sprints_this_week, c.accuracy, c.weak_topics.map((t) => `${t.topic} (${t.mastery}%)`).join('; ')]),
  ])
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-3xl font-bold">Whole school</h1>
        <p class="text-ink/70">Every class at {{ data?.school?.name ?? 'your school' }} on BrainSprint. Class teachers see their own pupils by name; here you see the classes.</p>
      </div>
      <div v-if="data?.classes.length" class="flex gap-2 print:hidden">
        <button class="rounded-xl bg-white px-3 py-2 font-semibold shadow-sm hover:bg-cream" @click="download">Download (Excel)</button>
        <button class="rounded-xl bg-white px-3 py-2 font-semibold shadow-sm hover:bg-cream" @click="printNow">Print</button>
      </div>
    </div>
    <p v-if="error" class="rounded-xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>

    <template v-if="data">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div class="rounded-2xl bg-white p-4 shadow-sm"><p class="text-3xl font-bold">{{ data.teachers }}</p><p class="text-sm text-ink/60">teachers</p></div>
        <div class="rounded-2xl bg-white p-4 shadow-sm"><p class="text-3xl font-bold">{{ data.classes.length }}</p><p class="text-sm text-ink/60">classes</p></div>
        <div class="rounded-2xl bg-white p-4 shadow-sm"><p class="text-3xl font-bold">{{ data.pupils }}</p><p class="text-sm text-ink/60">pupils</p></div>
        <div class="rounded-2xl bg-white p-4 shadow-sm"><p class="text-3xl font-bold">{{ pct(data.active_this_week, data.pupils) }}%</p><p class="text-sm text-ink/60">played this week</p></div>
      </div>

      <div class="overflow-x-auto rounded-3xl bg-white p-5 shadow-sm">
        <table class="w-full min-w-[40rem] text-left">
          <thead class="text-sm text-ink/60">
            <tr><th class="py-2">Class</th><th>Teacher</th><th class="text-right">Pupils</th><th class="text-right">Played this week</th><th class="text-right">Accuracy</th><th class="pl-4">Needs most help with</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in data.classes" :key="c.id" class="border-t border-ink/5 align-top">
              <td class="py-2 font-semibold">{{ c.name }} <span class="block text-sm font-normal text-ink/60">{{ gradeLabel(c.grade) }}</span></td>
              <td class="py-2">{{ c.teacher }}</td>
              <td class="py-2 text-right tabular-nums">{{ c.pupils }}</td>
              <td class="py-2 text-right tabular-nums">{{ c.active_this_week }} <span class="text-sm text-ink/50">({{ pct(c.active_this_week, c.pupils) }}%)</span></td>
              <td class="py-2 text-right tabular-nums">{{ c.accuracy === null ? '–' : `${c.accuracy}%` }}</td>
              <td class="py-2 pl-4 text-sm">
                <span v-for="t in c.weak_topics" :key="t.subject + t.topic" class="mr-1 mb-1 inline-block rounded-full px-2 py-0.5" :class="t.mastery < 70 ? 'bg-cherry/10 text-cherry' : 'bg-sun/30'">
                  {{ subjectLabel(t.subject) }}: {{ t.topic }} {{ t.mastery }}%
                </span>
                <span v-if="!c.weak_topics.length" class="text-ink/50">Not enough practice yet</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!data.classes.length" class="text-ink/60">No classes yet. Each teacher creates their classes and chooses this school under School vs School.</p>
      </div>
      <p class="text-sm text-ink/60">Teachers appear here once they have chosen this school. "Accuracy" is this week's correct answers out of all answered; topics count when at least 2 pupils have practised them.</p>
    </template>
  </section>
</template>
