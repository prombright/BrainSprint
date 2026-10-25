<script setup lang="ts">
// Class vs class inside the teacher's school: 2–6 classes of one year, one server-built paper.
// No accept step (it's one school); any teacher of those classes can call it off before it starts.
import { computed, onMounted, ref, watch } from 'vue'
import { GRADES } from '../game/types'
import { gradeLabel, subjectLabel, timeOnly, when } from '../lib/compete'
import { teacherCall } from './api'

const props = defineProps<{ subjects: Record<string, string[]> }>()

interface ClassRow { id: number; name: string; teacher: string; pupils?: number }
interface ClassScore extends ClassRow { players: number; counted: number; valid: boolean; average_percent: number; average_seconds: number }
interface Pupil { rank: number; id: number; name: string; avatar: string; class_id: number; correct: number; seconds: number }
interface ClassContest {
  id: number
  phase: 'cancelled' | 'upcoming' | 'live' | 'finished'
  grade: string
  subject: string
  classes: ClassRow[]
  starts_at: string
  ends_at: string
  can_cancel?: boolean
  summary?: { classes: ClassScore[]; winner_id: number | null; draw: boolean }
}
interface Detail extends ClassContest {
  result?: { classes: ClassScore[]; winner_id: number | null; draw: boolean; total: number; our_pupils: Pupil[] }
  paper?: { prompt: string; big?: string; choices: string[]; answer: string }[]
}

const contests = ref<ClassContest[]>([])
const yearClasses = ref<ClassRow[]>([])
const error = ref('')
const busy = ref(false)

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  error.value = ''
  busy.value = true
  try {
    return await fn()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

// ---------- a new class contest ----------
const making = ref(false)
const inAnHour = () => {
  const d = new Date(Date.now() + 3600_000)
  d.setMinutes(0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`
}
const form = ref({ grade: 'P5', classIds: [] as number[], subject: 'maths', starts: inAnHour(), window: 30 })
const gradeSubjects = computed(() => props.subjects[form.value.grade] ?? [])

async function load() {
  const r = await run(() => teacherCall<{ contests: ClassContest[]; classes: ClassRow[] }>('GET', `/teacher/class-contests?grade=${form.value.grade}`))
  if (r) {
    contests.value = r.contests
    yearClasses.value = r.classes
  }
}
onMounted(load)
watch(
  () => form.value.grade,
  () => {
    form.value.classIds = []
    load()
  },
)
watch(gradeSubjects, (s) => {
  if (!s.includes(form.value.subject)) form.value.subject = s[0] ?? ''
})

function toggle(id: number) {
  const ids = form.value.classIds
  form.value.classIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

async function create() {
  const f = form.value
  const r = await run(() =>
    teacherCall<{ contests: ClassContest[] }>('POST', '/teacher/class-contests', {
      grade: f.grade,
      class_ids: f.classIds,
      subject: f.subject,
      starts_at: new Date(f.starts).toISOString(),
      window_minutes: f.window,
    }),
  )
  if (r) {
    contests.value = r.contests
    making.value = false
    form.value.classIds = []
  }
}

async function cancel(c: ClassContest) {
  if (!confirm('Call off this class contest?')) return
  const r = await run(() => teacherCall<{ contests: ClassContest[] }>('POST', `/teacher/class-contests/${c.id}/cancel`))
  if (r) contests.value = r.contests
}

const detail = ref<Detail | null>(null)
async function open(c: ClassContest) {
  detail.value = (await run(() => teacherCall<Detail>('GET', `/teacher/class-contests/${c.id}`))) ?? null
}

const names = (c: ClassContest) => c.classes.map((x) => x.name).join(' vs ')
const active = computed(() => contests.value.filter((c) => c.phase === 'upcoming' || c.phase === 'live'))
const past = computed(() => contests.value.filter((c) => c.phase === 'finished' || c.phase === 'cancelled'))
function outcome(c: ClassContest) {
  if (c.phase === 'cancelled') return 'Called off'
  const s = c.summary
  if (!s) return ''
  if (s.draw) return '🤝 Draw'
  if (s.winner_id === null) return 'No result (fewer than 3 pupils)'
  return `🏆 ${s.classes.find((x) => x.id === s.winner_id)?.name} won`
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const printNow = () => window.print()
</script>

<template>
  <section class="space-y-4">
    <div>
      <h2 class="text-2xl font-bold">Class vs class</h2>
      <p class="text-ink/70">Classes of the same year at your school answer one paper the server makes and marks. Each class scores the average of its best 10 pupils (at least 3 must play). No one needs to accept, and any teacher of those classes can call it off before it starts.</p>
    </div>
    <p v-if="error" class="rounded-xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>

    <button v-if="!making" class="btn-chunky bg-ocean px-6 py-3 text-lg text-white" @click="making = true">🏫 Set up a class contest</button>
    <form v-else class="space-y-3 rounded-3xl bg-white p-5 shadow-sm" @submit.prevent="create">
      <div class="grid gap-3 sm:grid-cols-2">
        <label><span class="mb-1 block font-semibold">Year</span>
          <select v-model="form.grade" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2">
            <option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
        </label>
        <label><span class="mb-1 block font-semibold">Subject</span>
          <select v-model="form.subject" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2" :disabled="!gradeSubjects.length">
            <option v-for="s in gradeSubjects" :key="s" :value="s">{{ subjectLabel(s) }}</option>
          </select>
          <span v-if="!gradeSubjects.length" class="text-sm text-cherry">No subject has enough checked questions for this year yet.</span>
        </label>
      </div>
      <div>
        <span class="mb-1 block font-semibold">Classes <span class="font-normal text-ink/60">(choose 2 to 6)</span></span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in yearClasses"
            :key="c.id"
            type="button"
            class="rounded-xl border-2 px-3 py-2 text-left"
            :class="form.classIds.includes(c.id) ? 'border-ocean bg-ocean/5' : 'border-ink/10'"
            :aria-pressed="form.classIds.includes(c.id)"
            @click="toggle(c.id)"
          >
            <span class="block font-semibold">{{ c.name }}</span>
            <span class="block text-sm text-ink/60">{{ c.teacher }} · {{ c.pupils }} pupils</span>
          </button>
        </div>
        <p v-if="yearClasses.length < 2" class="mt-1 text-sm text-ink/60">Your school needs at least two {{ gradeLabel(form.grade) }} classes on BrainSprint. Each teacher creates their class and chooses this school.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label><span class="mb-1 block font-semibold">Opens at</span>
          <input v-model="form.starts" type="datetime-local" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2" />
        </label>
        <label><span class="mb-1 block font-semibold">Open for</span>
          <select v-model.number="form.window" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2">
            <option :value="20">20 minutes</option>
            <option :value="30">30 minutes</option>
            <option :value="45">45 minutes</option>
            <option :value="60">1 hour</option>
          </select>
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-chunky bg-ocean px-6 py-2 text-white" :disabled="busy || form.classIds.length < 2 || !form.subject">Set it up</button>
        <button type="button" class="btn-chunky bg-cream px-6 py-2" @click="making = false">Cancel</button>
      </div>
    </form>

    <div v-if="active.length" class="rounded-3xl bg-white p-5 shadow-sm">
      <h3 class="mb-2 text-lg font-bold">Coming up</h3>
      <ul class="divide-y divide-ink/5">
        <li v-for="c in active" :key="c.id" class="flex flex-wrap items-center gap-3 py-2">
          <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="c.phase === 'live' ? 'bg-cherry text-white' : 'bg-leaf/15 text-leaf'">{{ c.phase === 'live' ? '🔴 Live' : '✓ Set' }}</span>
          <span class="min-w-0 flex-1">
            <b>{{ names(c) }}</b> · {{ subjectLabel(c.subject) }}
            <span class="block text-sm text-ink/60">{{ when(c.starts_at) }} to {{ timeOnly(c.ends_at) }}</span>
          </span>
          <button v-if="c.can_cancel" class="text-sm text-ink/60 underline" :disabled="busy" @click="cancel(c)">Call off</button>
        </li>
      </ul>
    </div>

    <div v-if="past.length" class="rounded-3xl bg-white p-5 shadow-sm">
      <h3 class="mb-2 text-lg font-bold">Results</h3>
      <ul class="divide-y divide-ink/5">
        <li v-for="c in past" :key="c.id" class="flex flex-wrap items-center gap-3 py-2">
          <span class="min-w-0 flex-1">
            <b>{{ names(c) }}</b> · {{ gradeLabel(c.grade) }} {{ subjectLabel(c.subject) }}
            <span class="block text-sm text-ink/60">{{ when(c.starts_at) }} · {{ outcome(c) }}</span>
          </span>
          <button v-if="c.phase === 'finished'" class="font-semibold text-ocean" @click="open(c)">Open ›</button>
        </li>
      </ul>
    </div>

    <!-- one result in full -->
    <div v-if="detail?.result" class="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4 print:static print:bg-white print:p-0" @click.self="detail = null">
      <div class="mx-auto max-w-3xl space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-2xl font-bold">{{ names(detail) }}</h3>
            <p class="text-ink/60">{{ gradeLabel(detail.grade) }} · {{ subjectLabel(detail.subject) }} · {{ when(detail.starts_at) }}</p>
          </div>
          <div class="flex gap-2 print:hidden">
            <button class="btn-chunky bg-cream px-4 py-2 whitespace-nowrap" @click="printNow">🖨️ Print</button>
            <button class="btn-chunky bg-cream px-4 py-2" aria-label="Close" @click="detail = null">✕</button>
          </div>
        </div>
        <ol class="space-y-2">
          <li v-for="(c, i) in detail.result.classes" :key="c.id" class="flex items-center gap-3 rounded-2xl p-3" :class="c.id === detail.result.winner_id ? 'bg-sun/40' : 'bg-cream'">
            <span class="w-6 font-bold">{{ i + 1 }}</span>
            <span class="min-w-0 flex-1"><b>{{ c.name }}</b> <span class="text-sm text-ink/60">· {{ c.teacher }} · {{ c.players }} played · best {{ c.counted }} counted</span></span>
            <span class="text-2xl font-bold tabular-nums">{{ c.valid ? `${c.average_percent}%` : '–' }}</span>
          </li>
        </ol>
        <div>
          <h4 class="mb-1 font-bold">Your pupils</h4>
          <table class="w-full text-left text-sm">
            <thead class="text-ink/60"><tr><th class="py-1">Place</th><th>Pupil</th><th class="text-right">Score</th><th class="text-right">Time</th></tr></thead>
            <tbody>
              <tr v-for="p in detail.result.our_pupils" :key="p.id" class="border-t border-ink/5">
                <td class="py-1 tabular-nums">{{ p.rank }}</td>
                <td>{{ p.avatar }} {{ p.name }}</td>
                <td class="text-right tabular-nums">{{ p.correct }}/{{ detail.result.total }}</td>
                <td class="text-right tabular-nums">{{ mmss(p.seconds) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!detail.result.our_pupils.length" class="text-ink/60">None of your pupils took part (you see names for your own classes only).</p>
        </div>
        <details v-if="detail.paper">
          <summary class="cursor-pointer font-bold">The paper, with answers</summary>
          <ol class="mt-2 list-decimal space-y-2 pl-6">
            <li v-for="(q, i) in detail.paper" :key="i">
              {{ q.prompt }} <span v-if="q.big" class="text-ocean">{{ q.big }}</span>
              <span class="block text-sm text-ink/60">{{ q.choices.join(' · ') }} → <b class="text-leaf">{{ q.answer }}</b></span>
            </li>
          </ol>
        </details>
      </div>
    </div>
  </section>
</template>
