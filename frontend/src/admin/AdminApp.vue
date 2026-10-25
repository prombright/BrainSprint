<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { AdminError, adminCall, session, type AdminPlayer, type AdminSchool, type BankItem, type BankList, type FeedEvent, type Lead, type Overview } from './api'
import QuestionEditor from '../shared/QuestionEditor.vue'
import ThemeSwitch from '../shared/ThemeSwitch.vue'
import { emptyDraft, fromSaved, toPayload, type QuestionDraft } from '../shared/questionDraft'
import { csvToQuestions } from '../shared/csv'
import FactSetEditor from './FactSetEditor.vue'
import { emptyFactDraft, factDraftFrom, factPayload, type FactSetDraft, type SavedFactSet } from './factDraft'
import { GRADES, SUBJECTS } from '../game/types'

type Tab = 'overview' | 'questions' | 'facts' | 'schools' | 'players' | 'leads' | 'feed'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'questions', label: 'Questions' },
  { id: 'facts', label: 'Fact tables' },
  { id: 'schools', label: 'Schools' },
  { id: 'players', label: 'Players' },
  { id: 'leads', label: 'Enquiries' },
  { id: 'feed', label: 'Feed' },
]

const signedIn = ref(!!session.get())
const tab = ref<Tab>('overview')
const error = ref('')
const busy = ref(false)

// ---------- sign in ----------
const username = ref('')
const password = ref('')
async function login() {
  error.value = ''
  busy.value = true
  try {
    const r = await adminCall<{ token: string }>('POST', '/admin/login', { username: username.value, password: password.value })
    session.set(r.token)
    password.value = ''
    signedIn.value = true
    load()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
function logout() {
  session.set(null)
  signedIn.value = false
}

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  error.value = ''
  try {
    return await fn()
  } catch (e) {
    if (e instanceof AdminError && e.status === 401) logout()
    error.value = (e as Error).message
  }
}

// ---------- data ----------
const overview = ref<Overview | null>(null)
const schoolStatus = ref<AdminSchool['status']>('pending')
const schools = ref<AdminSchool[]>([])
const playerSearch = ref('')
const players = ref<AdminPlayer[]>([])
const leads = ref<Lead[]>([])
const feed = ref<FeedEvent[]>([])

async function load() {
  if (!signedIn.value) return
  if (tab.value === 'overview') overview.value = (await run(() => adminCall<Overview>('GET', '/admin/overview'))) ?? overview.value
  if (tab.value === 'schools') schools.value = (await run(() => adminCall<{ schools: AdminSchool[] }>('GET', `/admin/schools?status=${schoolStatus.value}`)))?.schools ?? []
  if (tab.value === 'players') players.value = (await run(() => adminCall<{ players: AdminPlayer[] }>('GET', `/admin/players?q=${encodeURIComponent(playerSearch.value)}`)))?.players ?? []
  if (tab.value === 'leads') leads.value = (await run(() => adminCall<{ leads: Lead[] }>('GET', '/admin/leads')))?.leads ?? []
  if (tab.value === 'questions') await loadBank()
  if (tab.value === 'facts') await loadFacts()
  if (tab.value === 'feed') feed.value = (await run(() => adminCall<{ events: FeedEvent[] }>('GET', '/admin/feed')))?.events ?? []
}
watch([tab, schoolStatus], load)

// ---------- question bank ----------
const bank = ref<BankList | null>(null)
const bankFilter = ref({ status: 'draft', subject: '', grade: '', q: '', teacher: false })
const editing = ref<{ id: number | null; draft: QuestionDraft } | null>(null)
const importResult = ref<{ created: number; skipped: number; errors: { row: number; error: string }[] } | null>(null)

async function loadBank() {
  const f = bankFilter.value
  const qs = new URLSearchParams({ status: f.status, subject: f.subject, grade: f.grade, q: f.q, ...(f.teacher ? { teacher: '1' } : {}) })
  bank.value = (await run(() => adminCall<BankList>('GET', `/admin/questions?${qs}`))) ?? bank.value
}
let bankTimer: number | undefined
watch(
  bankFilter,
  () => {
    clearTimeout(bankTimer)
    bankTimer = window.setTimeout(loadBank, 250)
  },
  { deep: true },
)

async function saveQuestion() {
  if (!editing.value) return
  busy.value = true
  const r = await run(() => adminCall('POST', editing.value!.id ? `/admin/questions/${editing.value!.id}` : '/admin/questions', toPayload(editing.value!.draft)))
  busy.value = false
  if (r) {
    editing.value = null
    loadBank()
  }
}

async function setQuestionStatus(item: BankItem, status: BankItem['status'], note?: string) {
  await run(() => adminCall('POST', `/admin/questions/${item.id}`, { status, review_note: note ?? '' }))
  loadBank()
}

function sendBack(item: BankItem) {
  const note = prompt('What should be changed? (the teacher sees this)', item.review_note ?? '')
  if (note !== null) setQuestionStatus(item, 'draft', note)
}

async function approveShown() {
  const drafts = bank.value?.questions.filter((q) => q.status === 'draft') ?? []
  if (!drafts.length || !confirm(`Approve all ${drafts.length} drafts shown? Only do this after checking every one.`)) return
  for (const q of drafts) await run(() => adminCall('POST', `/admin/questions/${q.id}`, { status: 'approved', review_note: '' }))
  loadBank()
}

async function importCsv(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importResult.value = null
  try {
    const questions = csvToQuestions(await file.text())
    busy.value = true
    importResult.value = (await run(() => adminCall<{ created: number; skipped: number; errors: { row: number; error: string }[] }>('POST', '/admin/questions/import', { file: file.name, questions }))) ?? null
    bankFilter.value.status = 'draft'
    loadBank()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    busy.value = false
  }
}

// ---------- fact tables (Fact Engine) ----------
const factSets = ref<SavedFactSet[]>([])
const editingFacts = ref<{ id: number | null; draft: FactSetDraft } | null>(null)
const factImport = ref<{ created: number; skipped: number; errors: { set: string; error: string }[] } | null>(null)

async function loadFacts() {
  factSets.value = (await run(() => adminCall<{ sets: SavedFactSet[] }>('GET', '/admin/facts')))?.sets ?? factSets.value
}

async function editFacts(id: number | null) {
  if (id === null) return void (editingFacts.value = { id: null, draft: emptyFactDraft() })
  const set = await run(() => adminCall<SavedFactSet>('GET', `/admin/facts/${id}`))
  if (set) editingFacts.value = { id, draft: factDraftFrom(set) }
}

async function saveFacts() {
  if (!editingFacts.value) return
  busy.value = true
  const { id, draft } = editingFacts.value
  const status = factSets.value.find((x) => x.id === id)?.status ?? 'draft'
  const r = await run(() => adminCall('POST', id ? `/admin/facts/${id}` : '/admin/facts', { ...factPayload(draft), status }))
  busy.value = false
  if (r) {
    editingFacts.value = null
    loadFacts()
  }
}

async function setFactStatus(id: number, status: 'draft' | 'approved' | 'retired') {
  await run(() => adminCall('POST', `/admin/facts/${id}`, { status }))
  loadFacts()
}

async function importFacts(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const sets = JSON.parse(await file.text())
    factImport.value = (await run(() => adminCall<{ created: number; skipped: number; errors: { set: string; error: string }[] }>('POST', '/admin/facts/import', { file: file.name, sets }))) ?? null
    loadFacts()
  } catch {
    error.value = 'That file is not a fact-set JSON file (see content/fact-sets-starter.json)'
  }
}

const subjectName = (s: string) => SUBJECTS.find((x) => x.id === s)?.label ?? s
const coverageCount = (subject: string, grade: string) => bank.value?.coverage.find((c) => c.subject === subject && c.grade === grade)?.count ?? 0
let searchTimer: number | undefined
watch(playerSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = window.setTimeout(load, 300)
})
onMounted(load)

async function setSchool(s: AdminSchool, status: AdminSchool['status']) {
  await run(() => adminCall('POST', `/admin/schools/${s.id}`, { status }))
  load()
}
async function editSchool(s: AdminSchool) {
  const name = prompt('School name', s.name)?.trim()
  if (!name) return
  const district = prompt('District', s.district)?.trim()
  if (!district) return
  await run(() => adminCall('POST', `/admin/schools/${s.id}`, { name, district }))
  load()
}
async function rename(p: AdminPlayer) {
  const name = prompt(`New name for "${p.name}" (other children will see it)`, `Player ${p.id}`)?.trim()
  if (!name) return
  await run(() => adminCall('POST', `/admin/players/${p.id}/rename`, { name }))
  load()
}
async function setLead(l: Lead, status: Lead['status']) {
  await run(() => adminCall('POST', `/admin/leads/${l.id}`, { status }))
  load()
}
async function removeEvent(e: FeedEvent) {
  if (!confirm(`Remove "${e.name} ${e.detail}" from the live feed?`)) return
  await run(() => adminCall('POST', `/admin/feed/${e.id}/delete`))
  load()
}

// ---------- chart: sprints per day, last 14 days (gaps filled with 0) ----------
const chartDays = computed(() => {
  const byDay = new Map((overview.value?.days ?? []).map((d) => [d.day, d]))
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const row = byDay.get(key)
    return { key, label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }), sprints: row?.sprints ?? 0, players: row?.players ?? 0 }
  })
})
// rounded up to a multiple of 3 so the three gridlines land on whole numbers
const chartMax = computed(() => Math.max(6, Math.ceil(Math.max(...chartDays.value.map((d) => d.sprints)) / 3) * 3))
const hovered = ref<number | null>(null)

const when = (iso: string | null) => (iso ? new Date(iso.replace(' ', 'T') + '+03:00').toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–')
const waLink = (phone: string) => `https://wa.me/${phone}`
</script>

<template>
  <!-- sign in -->
  <main v-if="!signedIn" class="grid min-h-dvh place-items-center p-4">
    <form class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm" @submit.prevent="login">
      <h1 class="text-2xl font-bold">BrainSprint Admin</h1>
      <p class="mb-4 text-ink/60">Staff only.</p>
      <label class="block"><span class="mb-1 block font-semibold">Username</span><input v-model="username" autocomplete="username" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <label class="mt-3 block"><span class="mb-1 block font-semibold">Password</span><input v-model="password" type="password" autocomplete="current-password" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" /></label>
      <p v-if="error" class="mt-3 rounded-xl bg-cherry/10 p-2 text-cherry">{{ error }}</p>
      <button class="btn-chunky mt-4 w-full bg-ink py-3 text-lg text-white" :disabled="busy || !username || !password">Sign in</button>
    </form>
  </main>

  <div v-else class="mx-auto max-w-6xl p-4 md:p-8">
    <header class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">BrainSprint Admin</h1>
      <div class="flex items-center gap-3">
        <button class="rounded-xl bg-white px-3 py-2 font-semibold shadow-sm hover:bg-cream" @click="load">↻ Refresh</button>
        <ThemeSwitch />
        <button class="rounded-xl bg-white px-3 py-2 font-semibold shadow-sm hover:bg-cream" @click="logout">Sign out</button>
      </div>
    </header>

    <nav class="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" aria-label="Sections">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="shrink-0 rounded-xl px-4 py-2 font-semibold"
        :class="tab === t.id ? 'bg-ink text-white' : 'text-ink/70 hover:bg-cream'"
        @click="tab = t.id"
      >
        {{ t.label }}
        <span v-if="t.id === 'schools' && overview?.schools_pending" class="ml-1 rounded-full bg-cherry px-1.5 text-xs text-white">{{ overview.schools_pending }}</span>
        <span v-if="t.id === 'leads' && overview?.leads_new" class="ml-1 rounded-full bg-cherry px-1.5 text-xs text-white">{{ overview.leads_new }}</span>
      </button>
    </nav>

    <p v-if="error" class="mb-4 rounded-xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>

    <!-- overview -->
    <section v-if="tab === 'overview' && overview" class="space-y-5">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="t in [
          { label: 'Children', value: overview.players, sub: `+${overview.players_new_7d} this week` },
          { label: 'Active today', value: overview.active_today, sub: `${overview.online_now} online now` },
          { label: 'Sprints today', value: overview.sprints_today, sub: `${overview.questions_total.toLocaleString()} questions in total` },
          { label: 'Parents', value: overview.parents, sub: 'with accounts' },
        ]" :key="t.label" class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="text-sm font-semibold text-ink/60">{{ t.label }}</p>
          <p class="text-3xl font-bold tabular-nums">{{ t.value.toLocaleString() }}</p>
          <p class="text-sm text-ink/50">{{ t.sub }}</p>
        </div>
      </div>
      <p v-if="overview.demo_players" class="rounded-xl bg-sun/40 p-3 text-sm">
        {{ overview.demo_players }} demo players exist on this server and are left out of every number here. Remove them with <code>php api/dev/seed-demo.php --remove</code>.
      </p>

      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <h2 class="font-bold">Sprints per day · last 14 days</h2>
        <p class="text-sm text-ink/60">Real children only</p>
        <div class="relative mt-4 h-48" @mouseleave="hovered = null">
          <!-- recessive gridlines -->
          <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <div v-for="i in 3" :key="i" class="flex items-center gap-2 border-t border-ink/5 text-[0.65rem] text-ink/40">
              <span class="-mt-2 bg-white pr-1 tabular-nums">{{ (chartMax * (4 - i)) / 3 }}</span>
            </div>
            <div class="border-t border-ink/20" />
          </div>
          <div class="absolute inset-0 flex items-end gap-[2px] pl-7">
            <button
              v-for="(d, i) in chartDays"
              :key="d.key"
              class="group relative flex h-full flex-1 items-end"
              :aria-label="`${d.weekday} ${d.label}: ${d.sprints} sprints by ${d.players} children`"
              @mouseenter="hovered = i"
              @focus="hovered = i"
            >
              <span class="w-full rounded-t-[4px] bg-sprint-dark transition-opacity" :class="hovered !== null && hovered !== i ? 'opacity-50' : ''" :style="{ height: `${(d.sprints / chartMax) * 100}%`, minHeight: d.sprints ? '2px' : '0' }" />
              <span
                v-if="hovered === i"
                class="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg bg-ink px-2 py-1 text-xs whitespace-nowrap text-white"
                :class="i < 3 ? 'left-0' : i > 10 ? 'right-0' : 'left-1/2 -translate-x-1/2'"
                >{{ d.weekday }} {{ d.label }} · <b>{{ d.sprints }}</b> sprints · {{ d.players }} children</span
              >
            </button>
          </div>
        </div>
        <div class="mt-1 flex gap-[2px] pl-7 text-[0.65rem] text-ink/50">
          <span v-for="(d, i) in chartDays" :key="d.key" class="flex-1 text-center">{{ i % 2 === 1 ? d.label : '' }}</span>
        </div>
        <details class="mt-3 text-sm">
          <summary class="font-semibold text-ocean">Show as a table</summary>
          <table class="mt-2 w-full text-left">
            <thead><tr class="text-ink/60"><th>Day</th><th class="text-right">Sprints</th><th class="text-right">Children</th></tr></thead>
            <tbody>
              <tr v-for="d in chartDays" :key="d.key" class="border-t border-ink/5"><td>{{ d.weekday }} {{ d.label }}</td><td class="text-right tabular-nums">{{ d.sprints }}</td><td class="text-right tabular-nums">{{ d.players }}</td></tr>
            </tbody>
          </table>
        </details>
      </div>

      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <h2 class="mb-2 font-bold">Children by class</h2>
        <p v-if="!overview.grades.length" class="text-ink/60">No children yet.</p>
        <div v-for="g in overview.grades" :key="g.grade" class="flex items-center gap-3 py-1">
          <span class="w-16 text-sm font-semibold">{{ g.grade === 'TOP' ? 'Top Class' : g.grade }}</span>
          <span class="h-3 rounded-r-[4px] bg-sprint-dark" :style="{ width: `${(g.players / Math.max(...overview.grades.map((x) => x.players))) * 70}%` }" />
          <span class="text-sm tabular-nums">{{ g.players }}</span>
        </div>
      </div>
    </section>

    <!-- schools -->
    <section v-if="tab === 'schools'">
      <div class="mb-3 flex gap-2">
        <button v-for="s in (['pending', 'approved', 'hidden'] as const)" :key="s" class="rounded-xl px-3 py-1.5 font-semibold capitalize" :class="schoolStatus === s ? 'bg-ocean text-white' : 'bg-white'" @click="schoolStatus = s">{{ s }}</button>
      </div>
      <p v-if="schoolStatus === 'pending'" class="mb-3 text-sm text-ink/60">Schools children added. Approve real schools (check the spelling first), hide anything that isn't a school.</p>
      <p v-if="!schools.length" class="rounded-2xl bg-white p-6 text-center text-ink/60">Nothing here.</p>
      <div v-for="s in schools" :key="s.id" class="mb-2 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div class="min-w-0 flex-1">
          <p class="font-bold">{{ s.name }} <span class="font-normal text-ink/60">· {{ s.district }}</span></p>
          <p class="text-sm text-ink/60">{{ s.members }} players · added {{ when(s.created_at) }}{{ s.creator ? ` by ${s.creator}` : '' }}</p>
        </div>
        <button class="rounded-xl bg-cream px-3 py-1.5 font-semibold" @click="editSchool(s)">Edit</button>
        <button v-if="s.status !== 'approved'" class="rounded-xl bg-leaf px-3 py-1.5 font-semibold text-white" @click="setSchool(s, 'approved')">✓ Approve</button>
        <button v-if="s.status !== 'hidden'" class="rounded-xl bg-cherry/10 px-3 py-1.5 font-semibold text-cherry" @click="setSchool(s, 'hidden')">Hide</button>
      </div>
    </section>

    <!-- players -->
    <section v-if="tab === 'players'">
      <input v-model="playerSearch" placeholder="Search by name or player number" class="mb-3 w-full rounded-xl border-2 border-ink/10 bg-white px-3 py-2 outline-none focus:border-ocean" />
      <p class="mb-3 text-sm text-ink/60">Names are public in leagues and the feed. Rename any that aren't suitable; marks names the word filter flags.</p>
      <div class="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="bg-cream text-ink/60"><tr><th class="p-3">Player</th><th class="p-3">Class</th><th class="p-3">School</th><th class="p-3 text-right">XP</th><th class="p-3">Last seen</th><th class="p-3"></th></tr></thead>
          <tbody>
            <tr v-for="p in players" :key="p.id" class="border-t border-ink/5" :class="p.flagged ? 'bg-cherry/5' : ''">
              <td class="p-3"><span class="text-xl">{{ p.avatar }}</span> <b>{{ p.name }}</b> <span v-if="p.flagged" title="Flagged by the word filter">⚠️</span> <span class="text-ink/40">#{{ p.id }}</span> <span v-if="p.has_parent" title="Linked to a parent">👨‍👩‍👧</span></td>
              <td class="p-3">{{ p.grade }}</td>
              <td class="p-3">{{ p.school ?? '–' }}</td>
              <td class="p-3 text-right tabular-nums">{{ p.xp_total.toLocaleString() }}</td>
              <td class="p-3">{{ when(p.last_seen_at) }}</td>
              <td class="p-3 text-right"><button class="rounded-lg bg-cream px-2 py-1 font-semibold" @click="rename(p)">Rename</button></td>
            </tr>
            <tr v-if="!players.length"><td colspan="6" class="p-6 text-center text-ink/60">No players found.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- enquiries -->
    <section v-if="tab === 'leads'">
      <p v-if="!leads.length" class="rounded-2xl bg-white p-6 text-center text-ink/60">No enquiries yet. They arrive from the contact form on the website.</p>
      <article v-for="l in leads" :key="l.id" class="mb-3 rounded-2xl bg-white p-4 shadow-sm" :class="l.status === 'new' ? 'border-l-8 border-sprint' : ''">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-bold">{{ l.kind === 'school' ? '🏫' : l.kind === 'parent' ? '👨‍👩‍👧' : '💬' }} {{ l.name }}<span v-if="l.organisation" class="font-normal text-ink/60"> · {{ l.organisation }}</span></p>
            <p class="text-sm text-ink/60">{{ when(l.created_at) }}</p>
          </div>
          <select :value="l.status" class="rounded-lg border-2 border-ink/10 px-2 py-1 font-semibold" @change="setLead(l, ($event.target as HTMLSelectElement).value as Lead['status'])">
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <p v-if="l.message" class="mt-2 whitespace-pre-line">{{ l.message }}</p>
        <p class="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
          <a :href="`tel:+${l.phone}`" class="text-ocean">📞 +{{ l.phone }}</a>
          <a :href="waLink(l.phone)" target="_blank" rel="noopener" class="text-leaf">WhatsApp</a>
          <a v-if="l.email" :href="`mailto:${l.email}`" class="text-ocean">✉️ {{ l.email }}</a>
        </p>
      </article>
    </section>

    <!-- question bank -->
    <section v-if="tab === 'questions'" class="space-y-4">
      <div v-if="editing" class="rounded-2xl bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-xl font-bold">{{ editing.id ? 'Edit question' : 'New question' }}</h2>
        <QuestionEditor v-model="editing.draft" :busy="busy" :save-label="editing.id ? 'Save changes' : 'Save as draft'" @save="saveQuestion" @cancel="editing = null" />
      </div>

      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <button v-for="s in (['draft', 'approved', 'retired'] as const)" :key="s" class="rounded-xl px-3 py-1.5 font-semibold capitalize" :class="bankFilter.status === s ? 'bg-ink text-white' : 'bg-white'" @click="bankFilter.status = s">
            {{ s === 'draft' ? 'To review' : s }} <span class="opacity-60">{{ bank?.counts[s] ?? '' }}</span>
          </button>
          <select v-model="bankFilter.subject" class="rounded-xl border-2 border-ink/10 bg-white px-2 py-1.5"><option value="">All subjects</option><option v-for="s in SUBJECTS" :key="s.id" :value="s.id">{{ s.label }}</option></select>
          <select v-model="bankFilter.grade" class="rounded-xl border-2 border-ink/10 bg-white px-2 py-1.5"><option value="">All classes</option><option v-for="g in GRADES" :key="g.id" :value="g.id">{{ g.label }}</option></select>
          <label class="flex items-center gap-1 text-sm font-semibold"><input v-model="bankFilter.teacher" type="checkbox" class="accent-ocean" /> From teachers</label>
          <input v-model="bankFilter.q" placeholder="Search" class="min-w-32 flex-1 rounded-xl border-2 border-ink/10 bg-white px-3 py-1.5" />
          <button class="rounded-xl bg-ocean px-3 py-1.5 font-semibold text-white" @click="editing = { id: null, draft: emptyDraft(bankFilter.grade || 'P5', bankFilter.subject || 'science') }">+ New question</button>
          <label class="cursor-pointer rounded-xl bg-white px-3 py-1.5 font-semibold shadow-sm hover:bg-cream">Import CSV<input type="file" accept=".csv,text/csv" class="sr-only" @change="importCsv" /></label>
        </div>

        <div v-if="importResult" class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="font-semibold">Import: {{ importResult.created }} added as drafts{{ importResult.skipped ? `, ${importResult.skipped} already in the bank` : '' }}{{ importResult.errors.length ? `, ${importResult.errors.length} with problems` : '' }}.</p>
          <ul v-if="importResult.errors.length" class="mt-1 text-sm text-cherry">
            <li v-for="e in importResult.errors" :key="e.row">Row {{ e.row }}: {{ e.error }}</li>
          </ul>
          <p class="mt-1 text-sm text-ink/60">Spreadsheet format: see <code>content/README.md</code>.</p>
        </div>

        <!-- approved questions per subject and class: a subject opens for a class at 4 -->
        <details class="rounded-2xl bg-white p-4 shadow-sm">
          <summary class="font-semibold">Approved questions per class (a subject opens for a class at 4; full sprints need 10+)</summary>
          <table class="mt-2 w-full text-center text-sm">
            <thead><tr class="text-ink/60"><th class="text-left">Subject</th><th v-for="g in GRADES" :key="g.id">{{ g.id === 'TOP' ? 'Top' : g.id }}</th></tr></thead>
            <tbody>
              <tr v-for="s in SUBJECTS.filter((x) => x.id !== 'maths')" :key="s.id" class="border-t border-ink/5">
                <td class="py-1 text-left font-semibold">{{ s.label }}</td>
                <td v-for="g in GRADES" :key="g.id" class="tabular-nums" :class="coverageCount(s.id, g.id) >= 10 ? 'font-bold text-leaf' : coverageCount(s.id, g.id) >= 4 ? 'font-semibold text-sprint-dark' : 'text-ink/30'">
                  {{ coverageCount(s.id, g.id) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="mt-1 text-xs text-ink/50">English Top Class–P3 is generated in the app; bank questions for those classes are not used.</p>
        </details>

        <div v-if="bankFilter.status === 'draft' && bank?.questions.length" class="flex justify-end">
          <button class="text-sm font-semibold text-leaf underline" @click="approveShown">Approve all {{ bank.questions.length }} shown…</button>
        </div>

        <p v-if="bank && !bank.questions.length" class="rounded-2xl bg-white p-6 text-center text-ink/60">No questions here.</p>
        <article v-for="item in bank?.questions" :key="item.id" class="rounded-2xl bg-white p-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <p class="text-sm text-ink/60">
              <b class="text-ink">{{ subjectName(item.subject) }} {{ item.grade }}</b> · {{ item.level }} · {{ item.topic }}
              <span v-if="item.teacher"> · suggested by <b>{{ item.teacher }}</b></span>
              <span v-else-if="item.source"> · {{ item.source }}</span>
            </p>
            <div class="flex flex-wrap gap-2">
              <button class="rounded-lg bg-cream px-2 py-1 text-sm font-semibold" @click="editing = { id: item.id, draft: fromSaved(item) }">Edit</button>
              <button v-if="item.status !== 'approved'" class="rounded-lg bg-leaf px-2 py-1 text-sm font-semibold text-white" @click="setQuestionStatus(item, 'approved')">✓ Approve</button>
              <button v-if="item.status === 'draft' && item.teacher" class="rounded-lg bg-sun/50 px-2 py-1 text-sm font-semibold" @click="sendBack(item)">↩ Send back</button>
              <button v-if="item.status !== 'retired'" class="rounded-lg bg-cherry/10 px-2 py-1 text-sm font-semibold text-cherry" @click="setQuestionStatus(item, 'retired')">Retire</button>
            </div>
          </div>
          <p class="mt-1 text-lg font-semibold">{{ item.prompt }}</p>
          <div class="mt-1 flex flex-wrap gap-2 text-sm">
            <span v-for="c in item.choices" :key="c" class="rounded-lg px-2 py-0.5" :class="c === item.answer ? 'bg-leaf/15 font-semibold text-leaf' : 'bg-ink/5'">{{ c === item.answer ? '✓ ' : '' }}{{ c }}</span>
          </div>
          <p v-if="item.steps.length" class="mt-1 text-sm text-ink/60">💡 {{ item.steps.join(' · ') }}</p>
          <p v-if="item.review_note" class="mt-1 text-sm text-sprint-dark">Note: {{ item.review_note }}</p>
        </article>
      </template>
    </section>

    <!-- fact tables -->
    <section v-if="tab === 'facts'" class="space-y-4">
      <div v-if="editingFacts" class="rounded-2xl bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-xl font-bold">{{ editingFacts.id ? 'Edit fact table' : 'New fact table' }}</h2>
        <FactSetEditor v-model="editingFacts.draft" :busy="busy" @save="saveFacts" @cancel="editingFacts = null" />
      </div>

      <template v-else>
        <div class="rounded-2xl bg-white p-4 text-sm text-ink/80 shadow-sm">
          <p><b>Fact tables</b> turn checked facts into many questions. Write the facts once (e.g. organ · job · body system) with a few question patterns, and the app makes questions from every fact and pattern, taking wrong answers from the other facts and never asking a question two facts could both answer.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="rounded-xl bg-ocean px-3 py-1.5 font-semibold text-white" @click="editFacts(null)">+ New fact table</button>
          <label class="cursor-pointer rounded-xl bg-white px-3 py-1.5 font-semibold shadow-sm hover:bg-cream">Import JSON<input type="file" accept=".json,application/json" class="sr-only" @change="importFacts" /></label>
        </div>
        <div v-if="factImport" class="rounded-2xl bg-white p-4 shadow-sm">
          <p class="font-semibold">Import: {{ factImport.created }} added as drafts{{ factImport.skipped ? `, ${factImport.skipped} already here` : '' }}{{ factImport.errors.length ? `, ${factImport.errors.length} with problems` : '' }}.</p>
          <p v-for="e in factImport.errors" :key="e.set" class="text-sm text-cherry">{{ e.set }}: {{ e.error }}</p>
        </div>
        <p v-if="!factSets.length" class="rounded-2xl bg-white p-6 text-center text-ink/60">No fact tables yet. Import <code>content/fact-sets-starter.json</code> to start.</p>
        <article v-for="f in factSets" :key="f.id" class="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div class="min-w-0 flex-1">
            <p class="font-bold">{{ f.name }} <span class="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold" :class="f.status === 'approved' ? 'bg-leaf/15 text-leaf' : f.status === 'retired' ? 'bg-ink/10 text-ink/60' : 'bg-sun/50'">{{ f.status === 'draft' ? 'to review' : f.status }}</span></p>
            <p class="text-sm text-ink/60">{{ subjectName(f.subject) }} · {{ f.grade_from }}–{{ f.grade_to }} · {{ f.row_count }} facts × {{ f.templates.length }} patterns · {{ f.columns.join(' · ') }}</p>
          </div>
          <button class="rounded-lg bg-cream px-2 py-1 text-sm font-semibold" @click="editFacts(f.id)">Edit & preview</button>
          <button v-if="f.status !== 'approved'" class="rounded-lg bg-leaf px-2 py-1 text-sm font-semibold text-white" @click="setFactStatus(f.id, 'approved')">✓ Approve</button>
          <button v-if="f.status !== 'retired'" class="rounded-lg bg-cherry/10 px-2 py-1 text-sm font-semibold text-cherry" @click="setFactStatus(f.id, 'retired')">Retire</button>
        </article>
      </template>
    </section>

    <!-- feed moderation -->
    <section v-if="tab === 'feed'">
      <p class="mb-3 text-sm text-ink/60">The live feed every child sees. Remove anything that shouldn't be there.</p>
      <div v-for="e in feed" :key="e.id" class="mb-2 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <span class="text-2xl">{{ e.avatar }}</span>
        <p class="min-w-0 flex-1"><b>{{ e.name }}</b> {{ e.detail }} <span v-if="e.is_demo" class="rounded bg-ink/10 px-1 text-xs">demo</span></p>
        <span class="text-xs text-ink/50">{{ when(e.created_at) }}</span>
        <button class="rounded-lg bg-cherry/10 px-2 py-1 text-sm font-semibold text-cherry" @click="removeEvent(e)">Remove</button>
      </div>
    </section>
  </div>
</template>
