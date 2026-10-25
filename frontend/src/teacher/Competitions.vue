<script setup lang="ts">
// School vs School: a teacher challenges another school, the other school's teacher accepts, and
// the server builds one paper for both, opens it at the agreed time and marks it.
import { computed, onMounted, ref, watch } from 'vue'
import { GRADES } from '../game/types'
import { gradeLabel, subjectLabel, timeOnly, when } from '../lib/compete'
import { teacherCall } from './api'
import ClassContests from './ClassContests.vue'

interface SchoolLite { id: number; name: string; district: string; open_to_challenges?: boolean }
interface SchoolScore extends SchoolLite { players: number; counted: number; valid: boolean; average_percent: number; average_seconds: number }
interface Pupil { rank: number; id: number; name: string; avatar: string; school_id: number; correct: number; seconds: number }
interface Contest {
  id: number
  phase: 'pending' | 'expired' | 'declined' | 'cancelled' | 'upcoming' | 'live' | 'finished'
  grade: string
  subject: string
  school_a: SchoolLite
  school_b: SchoolLite
  starts_at: string
  ends_at: string
  questions: number
  minutes: number
  ours?: 'a' | 'b'
  played_so_far?: number
  summary?: { schools: SchoolScore[]; winner_id: number | null; draw: boolean }
}
interface Detail extends Contest {
  result?: { schools: SchoolScore[]; winner_id: number | null; draw: boolean; total: number; top: Pupil[]; our_pupils: Pupil[] }
  paper?: {
    prompt: string
    big?: string
    choices: string[]
    answer: string
    topic: string
    stats?: { answered: number; right: number; blank: number; percent: number | null; common_wrong: { answer: string; pupils: number } | null }
  }[]
}

const school = ref<SchoolLite | null>(null)
const subjects = ref<Record<string, string[]>>({})
const contests = ref<Contest[]>([])
const error = ref('')
const busy = ref(false)
const loaded = ref(false)

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

async function load() {
  const s = await run(() => teacherCall<{ school: SchoolLite | null; subjects: Record<string, string[]> }>('GET', '/teacher/school'))
  if (s) {
    school.value = s.school
    subjects.value = s.subjects
  }
  const c = await run(() => teacherCall<{ contests: Contest[] }>('GET', '/teacher/contests'))
  if (c) contests.value = c.contests
  loaded.value = true
}
onMounted(load)

// ---------- finding schools ----------
const query = ref('')
const found = ref<SchoolLite[]>([])
let searchTimer: number | undefined
function search(q: string, into = found) {
  clearTimeout(searchTimer)
  searchTimer = window.setTimeout(async () => {
    into.value = q.trim().length < 2 ? [] : ((await run(() => teacherCall<{ schools: SchoolLite[] }>('GET', `/teacher/schools?q=${encodeURIComponent(q.trim())}`)))?.schools ?? [])
  }, 300)
}
watch(query, (q) => search(q))

async function chooseSchool(s: SchoolLite) {
  const r = await run(() => teacherCall<{ school: SchoolLite }>('POST', '/teacher/school', { school_id: s.id }))
  if (r) {
    school.value = r.school
    query.value = ''
    load()
  }
}

async function setOpen(open: boolean) {
  const r = await run(() => teacherCall<{ school: SchoolLite }>('POST', '/teacher/school/open', { open }))
  if (r) school.value = r.school
}

// ---------- a new challenge ----------
const challenging = ref(false)
const otherQuery = ref('')
const others = ref<SchoolLite[]>([])
watch(otherQuery, (q) => search(q, others))
const inTwoDays = () => {
  const d = new Date(Date.now() + 2 * 864e5)
  d.setHours(10, 0, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T10:00`
}
const form = ref({ school: null as SchoolLite | null, grade: 'P5', subject: 'maths', starts: inTwoDays(), window: 30 })
const gradeSubjects = computed(() => subjects.value[form.value.grade] ?? [])
watch(gradeSubjects, (s) => {
  if (!s.includes(form.value.subject)) form.value.subject = s[0] ?? ''
})

async function sendChallenge() {
  const f = form.value
  if (!f.school) return
  const r = await run(() =>
    teacherCall<{ contests: Contest[] }>('POST', '/teacher/contests', {
      school_id: f.school!.id,
      grade: f.grade,
      subject: f.subject,
      starts_at: new Date(f.starts).toISOString(),
      window_minutes: f.window,
    }),
  )
  if (r) {
    contests.value = r.contests
    challenging.value = false
    form.value.school = null
    otherQuery.value = ''
  }
}

async function act(c: Contest, action: 'accept' | 'decline' | 'cancel') {
  const other = c.ours === 'a' ? c.school_b.name : c.school_a.name
  const ask = { accept: `Accept the challenge from ${other}? The paper is made now and opens ${when(c.starts_at)}.`, decline: `Say no to ${other}?`, cancel: 'Call off this competition?' }
  if (!confirm(ask[action])) return
  const r = await run(() => teacherCall<{ contests: Contest[] }>('POST', `/teacher/contests/${c.id}/${action}`))
  if (r) contests.value = r.contests
}

// ---------- results ----------
const detail = ref<Detail | null>(null)
async function openResult(c: Contest) {
  detail.value = (await run(() => teacherCall<Detail>('GET', `/teacher/contests/${c.id}`))) ?? null
}

const otherSchool = (c: Contest) => (c.ours === 'a' ? c.school_b : c.school_a)
const incoming = computed(() => contests.value.filter((c) => c.phase === 'pending' && c.ours === 'b'))
const active = computed(() => contests.value.filter((c) => ['pending', 'upcoming', 'live'].includes(c.phase) && !(c.phase === 'pending' && c.ours === 'b')))
const past = computed(() => contests.value.filter((c) => ['finished', 'declined', 'cancelled', 'expired'].includes(c.phase)))
function outcome(c: Contest) {
  if (c.phase !== 'finished') return { declined: 'Declined', cancelled: 'Called off', expired: 'Not answered in time' }[c.phase as 'declined'] ?? ''
  const s = c.summary
  if (!s) return ''
  if (s.draw) return '🤝 Draw'
  if (s.winner_id === null) return 'No result (fewer than 3 pupils)'
  return s.winner_id === school.value?.id ? '🏆 We won' : `${otherSchool(c).name} won`
}
const printNow = () => window.print()
// the questions our pupils found hardest (at least 2 pupils answered)
const hardest = computed(() =>
  (detail.value?.paper ?? [])
    .map((q, i) => ({ ...q, n: i + 1 }))
    .filter((q) => q.stats && q.stats.answered >= 2 && q.stats.percent !== null)
    .sort((a, b) => a.stats!.percent! - b.stats!.percent!)
    .slice(0, 3),
)
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
</script>

<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-3xl font-bold">School vs School</h1>
      <p class="text-ink/70">
        Challenge another school. When they accept, BrainSprint makes one paper for both schools. No teacher sees the questions or answers before it ends. It opens at the agreed
        time and the server marks it. Each school's score is the <b>average of its best 10 pupils</b> (at least 3 must play), so big and small schools compete fairly.
      </p>
    </div>
    <p v-if="error" class="rounded-xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>

    <!-- which school am I? -->
    <div v-if="loaded && !school" class="rounded-3xl bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold">First, choose your school</h2>
      <input v-model="query" placeholder="Type your school's name or district" class="mt-2 w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
      <ul class="mt-2 divide-y divide-ink/5">
        <li v-for="s in found" :key="s.id"><button class="w-full py-2 text-left font-semibold hover:text-ocean" @click="chooseSchool(s)">{{ s.name }} <span class="font-normal text-ink/60">· {{ s.district }}</span></button></li>
      </ul>
      <p class="mt-2 text-sm text-ink/60">Only checked schools are listed. If yours is missing, have a pupil add it in the app (🏫 My School); it appears here once BrainSprint has checked it.</p>
    </div>

    <template v-if="school">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <div>
          <p class="text-lg font-bold">🏫 {{ school.name }}</p>
          <p class="text-sm text-ink/60">Pupils take part if they are in one of your school's BrainSprint classes for that year.</p>
        </div>
        <label class="flex items-center gap-2 font-semibold">
          <input type="checkbox" :checked="school.open_to_challenges" class="size-5" @change="setOpen(($event.target as HTMLInputElement).checked)" />
          Other schools may challenge us
        </label>
      </div>

      <!-- challenges waiting for our answer -->
      <div v-for="c in incoming" :key="c.id" class="rounded-3xl border-2 border-sun bg-sun/15 p-5">
        <p class="text-sm font-semibold text-sprint-dark">New challenge!</p>
        <p class="text-xl font-bold">{{ c.school_a.name }} challenges you</p>
        <p>{{ gradeLabel(c.grade) }} · {{ subjectLabel(c.subject) }} · {{ when(c.starts_at) }} to {{ timeOnly(c.ends_at) }}</p>
        <div class="mt-3 flex gap-2">
          <button class="btn-chunky bg-leaf px-5 py-2 text-white" :disabled="busy" @click="act(c, 'accept')">Accept</button>
          <button class="btn-chunky bg-white px-5 py-2" :disabled="busy" @click="act(c, 'decline')">No thanks</button>
        </div>
      </div>

      <!-- new challenge -->
      <button v-if="!challenging" class="btn-chunky bg-sprint px-6 py-3 text-lg text-white" @click="challenging = true">⚔️ Challenge a school</button>
      <form v-else class="space-y-3 rounded-3xl bg-white p-5 shadow-sm" @submit.prevent="sendChallenge">
        <h2 class="text-lg font-bold">Challenge a school</h2>
        <div>
          <span class="mb-1 block font-semibold">School</span>
          <p v-if="form.school" class="flex items-center gap-2">
            <b>{{ form.school.name }}</b> <span class="text-ink/60">{{ form.school.district }}</span>
            <button type="button" class="text-sm text-ocean underline" @click="form.school = null">change</button>
          </p>
          <template v-else>
            <input v-model="otherQuery" placeholder="Search by name or district" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
            <ul class="mt-1 divide-y divide-ink/5">
              <li v-for="s in others.filter((o) => o.id !== school!.id)" :key="s.id">
                <button type="button" class="w-full py-2 text-left font-semibold enabled:hover:text-ocean disabled:text-ink/40" :disabled="!s.open_to_challenges" @click="form.school = s">
                  {{ s.name }} <span class="font-normal text-ink/60">· {{ s.district }}{{ s.open_to_challenges ? '' : ' · not taking challenges' }}</span>
                </button>
              </li>
            </ul>
          </template>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label><span class="mb-1 block font-semibold">Class</span>
            <select v-model="form.grade" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2">
              <option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option>
            </select>
          </label>
          <label><span class="mb-1 block font-semibold">Subject</span>
            <select v-model="form.subject" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2" :disabled="!gradeSubjects.length">
              <option v-for="s in gradeSubjects" :key="s" :value="s">{{ subjectLabel(s) }}</option>
            </select>
            <span v-if="!gradeSubjects.length" class="text-sm text-cherry">No subject has enough checked questions for this class yet.</span>
          </label>
          <label><span class="mb-1 block font-semibold">Opens at</span>
            <input v-model="form.starts" type="datetime-local" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2" />
          </label>
          <label><span class="mb-1 block font-semibold">Open for</span>
            <select v-model.number="form.window" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2">
              <option :value="20">20 minutes</option>
              <option :value="30">30 minutes</option>
              <option :value="45">45 minutes</option>
              <option :value="60">1 hour</option>
              <option :value="120">2 hours</option>
            </select>
          </label>
        </div>
        <p class="text-sm text-ink/60">Each pupil gets 20 questions and 15 minutes from when they start, inside that time. Tip: pick a lesson time so pupils play in class, supervised.</p>
        <div class="flex gap-2">
          <button type="submit" class="btn-chunky bg-ocean px-6 py-2 text-white" :disabled="busy || !form.school || !form.subject">Send challenge</button>
          <button type="button" class="btn-chunky bg-cream px-6 py-2" @click="challenging = false">Cancel</button>
        </div>
      </form>

      <!-- coming up and running -->
      <div v-if="active.length" class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="mb-2 text-lg font-bold">Coming up</h2>
        <ul class="divide-y divide-ink/5">
          <li v-for="c in active" :key="c.id" class="flex flex-wrap items-center gap-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="c.phase === 'live' ? 'bg-cherry text-white' : c.phase === 'pending' ? 'bg-ink/10' : 'bg-leaf/15 text-leaf'">
              {{ c.phase === 'live' ? '🔴 Live' : c.phase === 'pending' ? 'Waiting for reply' : '✓ Accepted' }}
            </span>
            <span class="min-w-0 flex-1">
              <b>vs {{ otherSchool(c).name }}</b> · {{ gradeLabel(c.grade) }} {{ subjectLabel(c.subject) }}
              <span class="block text-sm text-ink/60">{{ when(c.starts_at) }} to {{ timeOnly(c.ends_at) }}<template v-if="c.phase === 'live'"> · {{ c.played_so_far }} of our pupils have handed in</template></span>
            </span>
            <button v-if="c.phase !== 'live'" class="text-sm text-ink/60 underline" :disabled="busy" @click="act(c, 'cancel')">Call off</button>
          </li>
        </ul>
      </div>

      <!-- past -->
      <div v-if="past.length" class="rounded-3xl bg-white p-5 shadow-sm">
        <h2 class="mb-2 text-lg font-bold">Results</h2>
        <ul class="divide-y divide-ink/5">
          <li v-for="c in past" :key="c.id" class="flex flex-wrap items-center gap-3 py-2">
            <span class="min-w-0 flex-1">
              <b>vs {{ otherSchool(c).name }}</b> · {{ gradeLabel(c.grade) }} {{ subjectLabel(c.subject) }}
              <span class="block text-sm text-ink/60">{{ when(c.starts_at) }} · {{ outcome(c) }}</span>
            </span>
            <span v-if="c.summary" class="text-sm tabular-nums">
              <span v-for="s in c.summary.schools" :key="s.id" class="ml-2">{{ s.id === school.id ? 'Us' : 'Them' }} {{ s.valid ? `${s.average_percent}%` : '–' }}</span>
            </span>
            <button v-if="c.phase === 'finished'" class="font-semibold text-ocean" @click="openResult(c)">Open ›</button>
          </li>
        </ul>
      </div>

      <p v-if="loaded && !contests.length" class="text-ink/60">No competitions yet. Challenge a nearby school to get started!</p>

      <hr class="my-8 border-ink/10" />
      <ClassContests :subjects="subjects" />
    </template>

    <!-- one result in full -->
    <div v-if="detail?.result" class="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4 print:static print:bg-white print:p-0" @click.self="detail = null">
      <div class="mx-auto max-w-3xl space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">{{ detail.school_a.name }} vs {{ detail.school_b.name }}</h2>
            <p class="text-ink/60">{{ gradeLabel(detail.grade) }} · {{ subjectLabel(detail.subject) }} · {{ when(detail.starts_at) }}</p>
          </div>
          <div class="flex gap-2 print:hidden">
            <button class="btn-chunky bg-cream px-4 py-2 whitespace-nowrap" @click="printNow">🖨️ Print</button>
            <button class="btn-chunky bg-cream px-4 py-2" aria-label="Close" @click="detail = null">✕</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="s in detail.result.schools" :key="s.id" class="rounded-2xl p-4" :class="s.id === detail.result.winner_id ? 'bg-sun/40' : 'bg-cream'">
            <p class="font-semibold">{{ s.id === detail.result.winner_id ? '🏆 ' : '' }}{{ s.name }}</p>
            <p class="text-3xl font-bold tabular-nums">{{ s.valid ? `${s.average_percent}%` : '–' }}</p>
            <p class="text-sm text-ink/60">{{ s.players }} played · best {{ s.counted }} counted{{ s.valid ? '' : ' · needed 3' }}</p>
          </div>
        </div>
        <div>
          <h3 class="mb-1 font-bold">Our pupils</h3>
          <table class="w-full text-left text-sm">
            <thead class="text-ink/60"><tr><th class="py-1">Place</th><th>Pupil</th><th class="text-right">Score</th><th class="text-right">Time</th><th class="text-right">Counted</th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in detail.result.our_pupils" :key="p.id" class="border-t border-ink/5">
                <td class="py-1 tabular-nums">{{ p.rank }}</td>
                <td>{{ p.avatar }} {{ p.name }}</td>
                <td class="text-right tabular-nums">{{ p.correct }}/{{ detail.result.total }}</td>
                <td class="text-right tabular-nums">{{ mmss(p.seconds) }}</td>
                <td class="text-right">{{ i < 10 ? '✓' : '' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!detail.result.our_pupils.length" class="text-ink/60">None of our pupils handed in a paper.</p>
        </div>
        <div v-if="hardest.length" class="rounded-2xl bg-cherry/5 p-4">
          <h3 class="mb-1 font-bold">Worth going over in class</h3>
          <ul class="space-y-1">
            <li v-for="q in hardest" :key="q.n">
              <b>Q{{ q.n }}.</b> {{ q.prompt }} <span v-if="q.big" class="text-ocean">{{ q.big }}</span>
              <span class="block text-sm text-ink/70">
                {{ q.stats!.percent }}% of our pupils got it right (answer {{ q.answer }}).
                <template v-if="q.stats!.common_wrong && q.stats!.common_wrong.pupils >= 2">{{ q.stats!.common_wrong.pupils }} chose "{{ q.stats!.common_wrong.answer }}".</template>
              </span>
            </li>
          </ul>
        </div>
        <details v-if="detail.paper">
          <summary class="cursor-pointer font-bold">The paper, with answers and how our pupils did</summary>
          <ol class="mt-2 list-decimal space-y-2 pl-6">
            <li v-for="(q, i) in detail.paper" :key="i">
              {{ q.prompt }} <span v-if="q.big" class="text-ocean">{{ q.big }}</span>
              <span class="block text-sm text-ink/60">{{ q.choices.join(' · ') }} → <b class="text-leaf">{{ q.answer }}</b></span>
              <span v-if="q.stats?.answered" class="block text-sm" :class="(q.stats.percent ?? 0) < 50 ? 'text-cherry' : 'text-ink/70'">
                {{ q.stats.right }} of {{ q.stats.answered }} right ({{ q.stats.percent }}%)<template v-if="q.stats.common_wrong"> · most common wrong answer: "{{ q.stats.common_wrong.answer }}" ({{ q.stats.common_wrong.pupils }})</template><template v-if="q.stats.blank"> · {{ q.stats.blank }} left blank</template>
              </span>
            </li>
          </ol>
        </details>
      </div>
    </div>
  </section>
</template>
