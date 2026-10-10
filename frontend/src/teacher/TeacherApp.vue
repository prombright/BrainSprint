<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { GRADES, LEVELS, SUBJECTS, type Grade, type Subject } from '../game/types'
import { hasQuestions, topicsOf } from '../game/sprint'
import { TeacherError, session, teacherCall, type ClassDetail, type ClassSummary, type Teacher } from './api'

const signedIn = ref(!!session.get())
const teacher = ref<Teacher | null>(null)
const classes = ref<ClassSummary[]>([])
const openId = ref<number | null>(null)
const detail = ref<ClassDetail | null>(null)
const tab = ref<'pupils' | 'topics' | 'homework' | 'code'>('pupils')
const error = ref('')
const busy = ref(false)
const projector = ref(false)

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  error.value = ''
  busy.value = true
  try {
    return await fn()
  } catch (e) {
    if (e instanceof TeacherError && e.status === 401) signOut()
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

// ---------- account ----------
const mode = ref<'login' | 'register'>('register')
const form = ref({ name: '', phone: '', password: '', school: '' })
async function submitAccount() {
  const r = await run(() =>
    teacherCall<{ token: string; teacher: Teacher }>('POST', mode.value === 'register' ? '/teachers/register' : '/teachers/login', form.value),
  )
  if (!r) return
  session.set(r.token)
  teacher.value = r.teacher
  form.value.password = ''
  signedIn.value = true
  loadClasses()
}
function signOut() {
  teacherCall('POST', '/teachers/logout').catch(() => {})
  session.set(null)
  signedIn.value = false
  teacher.value = null
  detail.value = null
  openId.value = null
}

// ---------- classes ----------
async function loadClasses() {
  const r = await run(() => teacherCall<{ teacher: Teacher; classes: ClassSummary[] }>('GET', '/teacher/classes'))
  if (!r) return
  teacher.value = r.teacher
  classes.value = r.classes
  if (!openId.value && r.classes.length) openId.value = r.classes[0].id
}
onMounted(() => signedIn.value && loadClasses())

const newClass = ref({ name: '', grade: 'P5' as Grade })
const addingClass = ref(false)
async function createClass() {
  const r = await run(() => teacherCall<{ classes: ClassSummary[] }>('POST', '/teacher/classes', newClass.value))
  if (!r) return
  classes.value = r.classes
  openId.value = r.classes.find((c) => c.name === newClass.value.name)?.id ?? openId.value
  newClass.value.name = ''
  addingClass.value = false
  tab.value = 'code'
}

watch(openId, async (id) => {
  detail.value = null
  if (id) detail.value = (await run(() => teacherCall<ClassDetail>('GET', `/teacher/classes/${id}`))) ?? null
})

async function refresh() {
  if (openId.value) detail.value = (await run(() => teacherCall<ClassDetail>('GET', `/teacher/classes/${openId.value}`))) ?? detail.value
}

/** Prints pupils, topics and homework together (the print layout shows every section). */
const printReport = () => window.print()

async function deleteClass() {
  if (!detail.value || !confirm(`Delete ${detail.value.class.name}? Pupils keep their own progress, but this class, its homework and results are removed.`)) return
  const r = await run(() => teacherCall<{ classes: ClassSummary[] }>('POST', `/teacher/classes/${detail.value!.class.id}/delete`))
  if (!r) return
  classes.value = r.classes
  openId.value = r.classes[0]?.id ?? null
}

async function removePupil(id: number, name: string) {
  if (!detail.value || !confirm(`Remove ${name} from this class?`)) return
  detail.value = (await run(() => teacherCall<ClassDetail>('POST', `/teacher/classes/${detail.value!.class.id}/remove`, { player_id: id }))) ?? detail.value
}

// ---------- homework ----------
const tomorrow = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10)
const hw = ref({ title: '', subject: 'maths' as Subject, kind: 'topic' as 'topic' | 'level', topic: '', level: 'medium', due_on: tomorrow() })
const classGrade = computed(() => (detail.value?.class.grade ?? 'P5') as Grade)
const hwSubjects = computed(() => SUBJECTS.filter((s) => s.ready && hasQuestions(s.id, classGrade.value)))
const hwTopics = computed(() => topicsOf(hw.value.subject, classGrade.value, LEVELS.map((l) => l.id)))
watch(
  hwTopics,
  (t) => {
    if (!t.includes(hw.value.topic)) hw.value.topic = t[0] ?? ''
  },
  { immediate: true },
)

function homeworkOn(topic: string, subject: string) {
  hw.value = { ...hw.value, subject: subject as Subject, kind: 'topic', topic, title: `Practise ${topic}` }
  tab.value = 'homework'
}

async function setHomework() {
  if (!detail.value) return
  const h = hw.value
  const body = { title: h.title || (h.kind === 'topic' ? `Practise ${h.topic}` : `${h.level} sprint`), subject: h.subject, due_on: h.due_on, ...(h.kind === 'topic' ? { topic: h.topic } : { level: h.level }) }
  const r = await run(() => teacherCall<ClassDetail>('POST', `/teacher/classes/${detail.value!.class.id}/assignments`, body))
  if (r) {
    detail.value = r
    hw.value.title = ''
  }
}

async function deleteHomework(id: number) {
  if (!confirm('Delete this homework and its results?')) return
  detail.value = (await run(() => teacherCall<ClassDetail>('POST', `/teacher/assignments/${id}/delete`))) ?? detail.value
}

// ---------- helpers ----------
const nice = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const subjectLabel = (s: string) => SUBJECTS.find((x) => x.id === s)?.label ?? s
const gradeLabel = (g: string) => (g === 'TOP' ? 'Top Class' : g)
const seen = (iso: string | null) => {
  if (!iso) return 'never'
  const days = Math.floor((Date.now() - new Date(iso.replace(' ', 'T') + '+03:00').getTime()) / 864e5)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
const masteryColour = (m: number) => (m < 70 ? 'bg-cherry' : m < 85 ? 'bg-sun' : 'bg-leaf')
const notDone = (a: ClassDetail['assignments'][number]) => detail.value!.pupils.filter((p) => !a.results[p.id])
const average = (a: ClassDetail['assignments'][number]) => {
  const r = Object.values(a.results)
  return r.length ? Math.round((r.reduce((t, x) => t + x.correct / x.total, 0) / r.length) * 100) : null
}
</script>

<template>
  <!-- sign up / sign in -->
  <main v-if="!signedIn" class="mx-auto grid min-h-dvh max-w-5xl items-center gap-8 p-4 md:grid-cols-2 md:p-8">
    <div>
      <p class="text-sm font-semibold tracking-widest text-ocean uppercase">BrainSprint for Teachers</p>
      <h1 class="mt-2 text-4xl font-bold">See which topics your class needs help with.</h1>
      <ul class="mt-4 space-y-2 text-lg text-ink/80">
        <li>🏫 Create a class and give pupils a join code</li>
        <li>📊 See each pupil's practice and the class's weak topics</li>
        <li>📝 Set homework on a topic, and see who has done it</li>
        <li>🖨️ Print a report for parents' meetings</li>
      </ul>
      <p class="mt-4 text-sm text-ink/60">Free while BrainSprint is being built. You only see pupils who join your class with its code.</p>
    </div>
    <form class="rounded-3xl bg-white p-6 shadow-sm" @submit.prevent="submitAccount">
      <div class="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
        <button type="button" class="rounded-xl py-2 font-semibold" :class="mode === 'register' ? 'bg-white shadow-sm' : 'text-ink/60'" @click="mode = 'register'">Create account</button>
        <button type="button" class="rounded-xl py-2 font-semibold" :class="mode === 'login' ? 'bg-white shadow-sm' : 'text-ink/60'" @click="mode = 'login'">Sign in</button>
      </div>
      <label v-if="mode === 'register'" class="mb-3 block"><span class="mb-1 block font-semibold">Your name</span><input v-model="form.name" maxlength="80" autocomplete="name" placeholder="e.g. Tr. Nakato Grace" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <label v-if="mode === 'register'" class="mb-3 block"><span class="mb-1 block font-semibold">School <span class="font-normal text-ink/50">(optional)</span></span><input v-model="form.school" maxlength="80" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <label class="mb-3 block"><span class="mb-1 block font-semibold">Phone number</span><input v-model="form.phone" inputmode="tel" autocomplete="tel" placeholder="0772 123456" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <label class="block"><span class="mb-1 block font-semibold">Password <span v-if="mode === 'register'" class="font-normal text-ink/50">(8 or more characters)</span></span><input v-model="form.password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <p v-if="error" class="mt-3 rounded-xl bg-cherry/10 p-2 text-cherry">{{ error }}</p>
      <button type="submit" class="btn-chunky mt-4 w-full bg-ocean py-3 text-lg text-white" :disabled="busy">{{ mode === 'register' ? 'Create account' : 'Sign in' }}</button>
    </form>
  </main>

  <!-- projector view: just the code, huge -->
  <div v-else-if="projector && detail" class="grid min-h-dvh place-items-center bg-ink p-8 text-center text-white" @click="projector = false">
    <div>
      <p class="text-3xl opacity-80">Join <b>{{ detail.class.name }}</b> on BrainSprint</p>
      <p class="my-8 font-mono text-[18vw] leading-none font-bold tracking-[0.15em] text-sun">{{ detail.class.code }}</p>
      <p class="text-2xl opacity-80">Open BrainSprint → 📝 My Class → type the code</p>
      <p class="mt-10 text-sm opacity-50">Click anywhere to go back</p>
    </div>
  </div>

  <div v-else class="mx-auto grid max-w-7xl gap-6 p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:p-8 print:block print:p-0">
    <!-- classes -->
    <aside class="flex flex-col gap-3 print:hidden">
      <div>
        <p class="text-sm font-semibold tracking-widest text-ocean uppercase">BrainSprint for Teachers</p>
        <p class="text-xl font-bold">{{ teacher?.name }}</p>
        <p v-if="teacher?.school" class="text-sm text-ink/60">{{ teacher.school }}</p>
      </div>
      <nav class="flex flex-col gap-1" aria-label="Classes">
        <button
          v-for="c in classes"
          :key="c.id"
          class="flex items-center justify-between rounded-2xl px-3 py-2.5 text-left font-semibold"
          :class="openId === c.id ? 'bg-ink text-white' : 'bg-white hover:bg-white/70'"
          @click="openId = c.id"
        >
          <span>{{ c.name }}</span>
          <span class="text-sm opacity-70">{{ c.pupils }} 🧒</span>
        </button>
      </nav>
      <button v-if="!addingClass" class="rounded-2xl border-2 border-dashed border-ink/20 px-3 py-2.5 font-semibold text-ink/70 hover:bg-white" @click="addingClass = true">+ New class</button>
      <form v-else class="rounded-2xl bg-white p-3 shadow-sm" @submit.prevent="createClass">
        <input v-model="newClass.name" maxlength="40" placeholder="e.g. P5 Blue" class="mb-2 w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
        <select v-model="newClass.grade" class="mb-2 w-full rounded-xl border-2 border-ink/10 px-3 py-2">
          <option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option>
        </select>
        <div class="flex gap-2">
          <button type="button" class="flex-1 rounded-xl bg-cream py-2 font-semibold" @click="addingClass = false">Cancel</button>
          <button type="submit" class="flex-1 rounded-xl bg-ocean py-2 font-semibold text-white" :disabled="!newClass.name.trim()">Create</button>
        </div>
      </form>
      <button class="mt-auto text-left text-sm text-ink/50 underline" @click="signOut">Sign out</button>
    </aside>

    <main class="min-w-0">
      <p v-if="error" class="mb-4 rounded-xl bg-cherry/10 p-3 text-cherry print:hidden">{{ error }}</p>

      <section v-if="!classes.length" class="rounded-3xl bg-white p-8 text-center shadow-sm">
        <p class="text-5xl">🏫</p>
        <h2 class="mt-2 text-2xl font-bold">Create your first class</h2>
        <p class="mt-1 text-ink/70">Click "+ New class", then give your pupils the join code.</p>
      </section>

      <template v-if="detail">
        <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-3xl font-bold">{{ detail.class.name }}</h1>
            <p class="text-ink/60">{{ gradeLabel(detail.class.grade) }} · {{ detail.pupils.length }} pupils · join code <b class="font-mono tracking-widest text-ink">{{ detail.class.code }}</b></p>
          </div>
          <div class="flex gap-2 print:hidden">
            <button class="rounded-xl bg-white px-3 py-2 font-semibold shadow-sm hover:bg-cream" @click="refresh">↻ Refresh</button>
            <button class="rounded-xl bg-white px-3 py-2 font-semibold shadow-sm hover:bg-cream" @click="printReport">🖨️ Print report</button>
          </div>
        </header>

        <nav class="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm print:hidden" aria-label="Class sections">
          <button
            v-for="t in ([['pupils', '🧒 Pupils'], ['topics', '📊 Topics'], ['homework', '📝 Homework'], ['code', '🔑 Join code']] as const)"
            :key="t[0]"
            class="shrink-0 rounded-xl px-4 py-2 font-semibold"
            :class="tab === t[0] ? 'bg-ink text-white' : 'text-ink/70 hover:bg-cream'"
            @click="tab = t[0]"
          >
            {{ t[1] }}
          </button>
        </nav>

        <!-- pupils -->
        <section v-show="tab === 'pupils'" class="print:!block">
          <h2 class="mb-2 hidden text-xl font-bold print:block">Pupils this week</h2>
          <p v-if="!detail.pupils.length" class="rounded-2xl bg-white p-6 text-center text-ink/60 shadow-sm">No pupils yet. Share the join code from the 🔑 tab.</p>
          <div v-else class="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="bg-cream text-ink/60">
                <tr><th class="p-3">Pupil</th><th class="p-3 text-right">Sprints this week</th><th class="p-3 text-right">Correct this week</th><th class="p-3">Needs help with</th><th v-if="['P6', 'P7'].includes(detail.class.grade)" class="p-3 text-right">PLE mock</th><th class="p-3">Last played</th><th class="p-3 print:hidden"></th></tr>
              </thead>
              <tbody>
                <tr v-for="p in detail.pupils" :key="p.id" class="border-t border-ink/5">
                  <td class="p-3 font-semibold"><span class="text-xl">{{ p.avatar }}</span> {{ p.name }}</td>
                  <td class="p-3 text-right tabular-nums" :class="p.week_sprints ? '' : 'text-cherry'">{{ p.week_sprints }}</td>
                  <td class="p-3 text-right tabular-nums">{{ p.week_accuracy === null ? '–' : `${p.week_accuracy}%` }}</td>
                  <td class="p-3">{{ p.weak.map(nice).join(', ') || '–' }}</td>
                  <td v-if="['P6', 'P7'].includes(detail.class.grade)" class="p-3 text-right tabular-nums">{{ p.mock_readiness === null ? '–' : `${p.mock_readiness}%` }}</td>
                  <td class="p-3">{{ seen(p.last_seen_at) }}</td>
                  <td class="p-3 text-right print:hidden"><button class="text-xs text-ink/40 underline" @click="removePupil(p.id, p.name)">Remove</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- topics -->
        <section v-show="tab === 'topics'" class="print:!block print:mt-6">
          <h2 class="mb-2 text-xl font-bold">How the class is doing, topic by topic</h2>
          <p class="mb-3 text-sm text-ink/60">Average of each pupil's last 20 answers in the topic (pupils with at least 5 answers). Weakest first.</p>
          <p v-if="!detail.topics.length" class="rounded-2xl bg-white p-6 text-center text-ink/60 shadow-sm">Not enough practice yet to judge any topic.</p>
          <div v-else class="space-y-2">
            <div v-for="t in detail.topics" :key="t.subject + t.topic" class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <div class="w-40 min-w-0 font-semibold">{{ nice(t.topic) }} <span class="block text-xs font-normal text-ink/50">{{ subjectLabel(t.subject) }}</span></div>
              <div class="flex min-w-40 flex-1 items-center gap-2">
                <div class="h-3 flex-1 overflow-hidden rounded-full bg-ink/10"><div class="h-full rounded-r-[4px]" :class="masteryColour(t.mastery)" :style="{ width: `${t.mastery}%` }" /></div>
                <span class="w-11 text-right font-semibold tabular-nums">{{ t.mastery }}%</span>
              </div>
              <span class="w-36 text-sm" :class="t.struggling ? 'font-semibold text-cherry' : 'text-ink/60'">{{ t.struggling }} of {{ t.pupils }} struggling</span>
              <button class="rounded-xl bg-cream px-3 py-1.5 text-sm font-semibold hover:bg-sun/40 print:hidden" @click="homeworkOn(t.topic, t.subject)">Set homework</button>
            </div>
          </div>
        </section>

        <!-- homework -->
        <section v-show="tab === 'homework'" class="print:!block print:mt-6">
          <form class="mb-4 rounded-2xl bg-white p-4 shadow-sm print:hidden" @submit.prevent="setHomework">
            <h2 class="mb-3 text-lg font-bold">Set homework</h2>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label class="block sm:col-span-2"><span class="mb-1 block text-sm font-semibold">Title</span><input v-model="hw.title" maxlength="80" placeholder="e.g. Fractions before Friday" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
              <label class="block"><span class="mb-1 block text-sm font-semibold">Subject</span>
                <select v-model="hw.subject" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2"><option v-for="s in hwSubjects" :key="s.id" :value="s.id">{{ s.label }}</option></select>
              </label>
              <label class="block"><span class="mb-1 block text-sm font-semibold">Due</span><input v-model="hw.due_on" type="date" :min="new Date().toISOString().slice(0, 10)" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2" /></label>
              <fieldset class="sm:col-span-2">
                <legend class="mb-1 text-sm font-semibold">What to practise</legend>
                <div class="flex gap-2">
                  <label class="flex-1 rounded-xl border-2 p-2 text-center text-sm font-semibold" :class="hw.kind === 'topic' ? 'border-ocean bg-ocean/5' : 'border-ink/10'"><input v-model="hw.kind" type="radio" value="topic" class="sr-only" />One topic</label>
                  <label class="flex-1 rounded-xl border-2 p-2 text-center text-sm font-semibold" :class="hw.kind === 'level' ? 'border-ocean bg-ocean/5' : 'border-ink/10'"><input v-model="hw.kind" type="radio" value="level" class="sr-only" />A level sprint</label>
                </div>
              </fieldset>
              <label v-if="hw.kind === 'topic'" class="block sm:col-span-2"><span class="mb-1 block text-sm font-semibold">Topic</span>
                <select v-model="hw.topic" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2"><option v-for="t in hwTopics" :key="t" :value="t">{{ nice(t) }}</option></select>
              </label>
              <label v-else class="block sm:col-span-2"><span class="mb-1 block text-sm font-semibold">Level</span>
                <select v-model="hw.level" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2"><option v-for="l in LEVELS" :key="l.id" :value="l.id">{{ l.emoji }} {{ l.label }}</option></select>
              </label>
            </div>
            <button type="submit" class="btn-chunky mt-4 bg-ocean px-6 py-2 text-lg text-white" :disabled="busy || (hw.kind === 'topic' && !hw.topic)">Set homework</button>
          </form>

          <h2 class="mb-2 hidden text-xl font-bold print:block">Homework</h2>
          <p v-if="!detail.assignments.length" class="rounded-2xl bg-white p-6 text-center text-ink/60 shadow-sm">No homework set yet.</p>
          <article v-for="a in detail.assignments" :key="a.id" class="mb-2 rounded-2xl bg-white p-4 shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="font-bold">{{ a.title }}</p>
                <p class="text-sm text-ink/60">{{ subjectLabel(a.subject) }} · {{ a.topic ? nice(a.topic) : `${a.level} level` }} · due {{ new Date(a.due_on).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) }}</p>
              </div>
              <button class="text-xs text-ink/40 underline print:hidden" @click="deleteHomework(a.id)">Delete</button>
            </div>
            <div class="mt-2 flex items-center gap-3">
              <div class="h-3 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div class="h-full rounded-r-[4px] bg-leaf" :style="{ width: `${detail.pupils.length ? (Object.keys(a.results).length / detail.pupils.length) * 100 : 0}%` }" />
              </div>
              <span class="text-sm font-semibold tabular-nums">{{ Object.keys(a.results).length }} of {{ detail.pupils.length }} done{{ average(a) !== null ? ` · ${average(a)}% correct on average` : '' }}</span>
            </div>
            <p v-if="notDone(a).length && detail.pupils.length" class="mt-2 text-sm text-ink/70"><b>Not done yet:</b> {{ notDone(a).map((p) => p.name).join(', ') }}</p>
          </article>
        </section>

        <!-- join code -->
        <section v-show="tab === 'code'" class="rounded-3xl bg-white p-8 text-center shadow-sm print:hidden">
          <p class="text-lg text-ink/70">Pupils open BrainSprint → 📝 <b>My Class</b> → type this code:</p>
          <p class="my-4 font-mono text-7xl font-bold tracking-[0.2em] text-sprint-dark">{{ detail.class.code }}</p>
          <button class="btn-chunky bg-ink px-6 py-3 text-lg text-white" @click="projector = true">📽️ Show full screen for the class</button>
          <p class="mt-6 text-sm text-ink/60">Only pupils who join with this code appear in your class. You can remove anyone from the Pupils tab.</p>
          <button class="mt-6 text-sm text-cherry underline" @click="deleteClass">Delete this class</button>
        </section>
      </template>
    </main>
  </div>
</template>
