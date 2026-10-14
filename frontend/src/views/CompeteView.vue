<script setup lang="ts">
// Competitions marked by the server: school-vs-school contests (set up by teachers) and duels
// with friends. Entering is always free; nobody sees the answers until the competition is over.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AvatarBadge from '../components/AvatarBadge.vue'
import TopBar from '../components/TopBar.vue'
import { api, type CompeteData, type Contest, type Duel, type Friend, type WeeklyData } from '../lib/api'
import { gradeLabel, subjectLabel, timeOnly, until, when } from '../lib/compete'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const route = useRoute()
const data = ref<CompeteData | null>(null)
const error = ref('')
const now = ref(Date.now())
let tick: number | undefined

// ---------- challenge a friend ----------
const picking = ref(false)
const friends = ref<Friend[] | null>(null)
const friendId = ref<number | null>(null)
const subject = ref('maths')
const busy = ref(false)
const pickError = ref('')

async function auth() {
  await player.sync()
  if (!player.auth) throw new Error('Connect to the internet to see competitions')
  return player.auth
}

const weekly = ref<WeeklyData | null>(null)

async function load() {
  try {
    const a = await auth()
    api.weekly(a).then((w) => (weekly.value = w)).catch(() => {})
    data.value = await api.compete(a)
    error.value = ''
    if (!data.value.duel_subjects.includes(subject.value)) subject.value = data.value.duel_subjects[0] ?? 'maths'
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function openPicker() {
  picking.value = true
  pickError.value = ''
  if (!friends.value) {
    try {
      friends.value = (await api.friends(await auth())).friends
    } catch (e) {
      pickError.value = (e as Error).message
    }
  }
}

async function challenge() {
  if (!friendId.value) return
  busy.value = true
  pickError.value = ''
  try {
    const d = await api.newDuel(await auth(), friendId.value, subject.value)
    picking.value = false
    friendId.value = null
    await load()
    // the challenger can play straight away
    router.push(`/compete/play/duels/${d.id}`)
  } catch (e) {
    pickError.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function decline(d: Duel) {
  if (!confirm(`Say no to ${d.other.name}'s duel?`)) return
  try {
    const r = await api.declineDuel(await auth(), d.id)
    if (data.value) data.value.duels = r.duels
  } catch (e) {
    alert((e as Error).message)
  }
}

// ---------- what each card says ----------
const live = computed(() => data.value?.contests.filter((c) => c.phase === 'live') ?? [])
const upcoming = computed(() => data.value?.contests.filter((c) => c.phase === 'upcoming').reverse() ?? [])
const finished = computed(() => data.value?.contests.filter((c) => c.phase === 'finished') ?? [])

const us = (c: Contest) => (c.my_school_id === c.school_b.id ? c.school_b : c.school_a)
const them = (c: Contest) => (c.my_school_id === c.school_b.id ? c.school_a : c.school_b)
function contestOutcome(c: Contest) {
  if (!c.summary) return ''
  if (c.summary.draw) return '🤝 A draw!'
  if (c.summary.winner_id === null) return 'Not enough pupils played'
  return c.summary.winner_id === c.my_school_id ? '🏆 Your school won!' : `${them(c).name} won`
}

function duelLine(d: Duel) {
  const name = d.other.name.split(' ')[0]
  if (d.phase === 'declined') return d.i_challenged ? `${name} said no this time` : 'You said no'
  if (d.phase === 'done') return d.outcome === 'won' ? '🏆 You won!' : d.outcome === 'lost' ? `${name} won this time` : '🤝 A draw!'
  if (d.phase === 'expired') return d.mine.state === 'done' ? `${name} didn't play in time` : "Time ran out before you played"
  if (d.mine.state === 'done') return `Waiting for ${name}… (${until(d.expires_at, now.value)} left)`
  if (d.mine.state === 'started') return 'You started: finish your paper!'
  return d.they_played ? `${name} has played. Your turn!` : d.i_challenged ? 'Play your paper' : `${name} challenged you!`
}
const duelCanPlay = (d: Duel) => d.phase === 'open' && (d.mine.state === 'not_started' || d.mine.state === 'started')

onMounted(() => {
  load()
  if (route.query.duel) {
    friendId.value = Number(route.query.duel)
    openPicker()
  }
  // a minute tick keeps countdowns fresh, and notices when a contest opens
  tick = window.setInterval(() => {
    now.value = Date.now()
    if (data.value?.contests.some((c) => c.phase === 'upcoming' && new Date(c.starts_at).getTime() <= now.value)) load()
  }, 30_000)
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="⚔️ Compete" back="/" />

    <p v-if="error && !data" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">📶 {{ error }}</p>

    <template v-if="data">
      <!-- ======== the Weekly Challenge: every child in the class, the same paper ======== -->
      <section v-if="weekly?.this_week" class="rounded-3xl bg-gradient-to-br from-ocean to-berry p-5 text-white">
        <h2 class="text-2xl font-bold">🌍 Weekly Challenge</h2>
        <p class="opacity-90">
          The same {{ weekly.this_week.questions }} questions for every {{ gradeLabel(weekly.this_week.grade) }} child in Uganda this week. One go, {{ weekly.this_week.minutes }} minutes.
        </p>
        <button
          v-if="weekly.this_week.mine.state === 'not_started' || weekly.this_week.mine.state === 'started'"
          class="btn-chunky mt-3 w-full bg-white py-3 text-xl text-ink"
          @click="router.push('/compete/play/weekly/0')"
        >
          {{ weekly.this_week.mine.state === 'started' ? 'Continue my paper →' : 'Take this week\'s challenge →' }}
        </button>
        <p v-else-if="weekly.this_week.mine.state === 'done'" class="mt-3 rounded-2xl bg-white/15 p-3 font-semibold">
          ✓ You got {{ weekly.this_week.mine.correct }}/{{ weekly.this_week.mine.total }}. Places and answers come out on Monday.
        </p>
        <p class="mt-2 text-sm opacity-80">{{ weekly.this_week.entrants }} {{ weekly.this_week.entrants === 1 ? 'child has' : 'children have' }} played · ends in {{ until(weekly.this_week.ends_at, now) }}</p>
        <button v-if="weekly.last_week" class="mt-3 w-full rounded-2xl bg-white/15 p-3 text-left font-semibold hover:bg-white/25" @click="router.push('/compete/weekly/0')">
          🏆 Last week's results<template v-if="weekly.last_week.result?.my_rank">: you came {{ weekly.last_week.result.my_rank }} of {{ weekly.last_week.entrants }}</template> ›
        </button>
      </section>

      <!-- ======== school against school ======== -->
      <section class="rounded-3xl bg-ink p-5 text-white">
        <h2 class="text-2xl font-bold">🏫 School vs School</h2>
        <p class="text-sm opacity-80">Teachers challenge other schools. Everyone answers the same paper at the same time, and the server marks it.</p>

        <div v-for="c in live" :key="c.id" class="mt-4 rounded-2xl bg-white p-4 text-ink">
          <p class="text-sm font-semibold text-cherry"><span class="animate-pulse">🔴</span> Open now · ends {{ timeOnly(c.ends_at) }}</p>
          <p class="text-xl font-bold">{{ us(c).name }} <span class="text-ink/40">vs</span> {{ them(c).name }}</p>
          <p class="text-ink/70">{{ gradeLabel(c.grade) }} · {{ subjectLabel(c.subject) }} · {{ c.questions }} questions · {{ c.minutes }} min</p>
          <button v-if="c.mine?.state === 'not_started' || c.mine?.state === 'started'" class="btn-chunky mt-3 w-full bg-sprint py-3 text-xl text-white" @click="router.push(`/compete/play/contests/${c.id}`)">
            {{ c.mine?.state === 'started' ? 'Continue my paper →' : 'Start my paper →' }}
          </button>
          <p v-else-if="c.mine?.state === 'done'" class="mt-2 font-semibold text-leaf">✓ Handed in. Results at {{ timeOnly(c.ends_at) }}.</p>
          <p v-else class="mt-2 text-ink/60">Your time for this paper is up.</p>
        </div>

        <div v-for="c in upcoming" :key="c.id" class="mt-4 rounded-2xl bg-white/10 p-4">
          <p class="text-sm font-semibold text-sun">📅 {{ when(c.starts_at) }} · starts in {{ until(c.starts_at, now) }}</p>
          <p class="text-xl font-bold">{{ us(c).name }} <span class="opacity-50">vs</span> {{ them(c).name }}</p>
          <p class="opacity-80">{{ gradeLabel(c.grade) }} · {{ subjectLabel(c.subject) }} · {{ c.questions }} questions</p>
        </div>

        <button v-for="c in finished" :key="c.id" class="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white/10 p-3 text-left hover:bg-white/15" @click="router.push(`/compete/contests/${c.id}`)">
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ us(c).name }} vs {{ them(c).name }}</span>
            <span class="block text-sm opacity-80">{{ contestOutcome(c) }} · {{ subjectLabel(c.subject) }}</span>
          </span>
          <span class="text-sm font-semibold text-sun">Results ›</span>
        </button>

        <p v-if="!data.contests.length" class="mt-4 rounded-2xl bg-white/10 p-4 opacity-90">
          No school competitions yet. Your teacher can challenge another school from the teacher website. You take part when you are in their class.
        </p>
      </section>

      <!-- ======== duels with friends ======== -->
      <section class="rounded-3xl bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-2xl font-bold">⚔️ Duels</h2>
            <p class="text-sm text-ink/60">You and a friend get the same 10 questions. Most right wins; if it's level, the faster one wins.</p>
          </div>
          <button class="btn-chunky bg-sprint px-5 py-2 text-lg text-white" @click="openPicker">Challenge a friend</button>
        </div>

        <form v-if="picking" class="mt-4 rounded-2xl bg-cream p-4" @submit.prevent="challenge">
          <p class="mb-2 font-semibold">Who?</p>
          <p v-if="friends && !friends.length" class="text-ink/60">
            Add a friend first, with their friend code.
            <button type="button" class="font-semibold text-ocean underline" @click="router.push('/friends')">Go to Friends</button>
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="f in friends ?? []"
              :key="f.id"
              type="button"
              class="flex items-center gap-2 rounded-full border-2 bg-white py-1 pr-3 pl-1 font-semibold"
              :class="friendId === f.id ? 'border-ocean' : 'border-transparent'"
              :aria-pressed="friendId === f.id"
              @click="friendId = f.id"
            >
              <AvatarBadge :avatar="f.avatar" :xp="f.xp_total" size="sm" /> {{ f.name.split(' ')[0] }}
            </button>
          </div>
          <p class="mt-3 mb-2 font-semibold">Which subject?</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in data.duel_subjects"
              :key="s"
              type="button"
              class="rounded-full border-2 bg-white px-4 py-1 font-semibold"
              :class="subject === s ? 'border-ocean' : 'border-transparent'"
              :aria-pressed="subject === s"
              @click="subject = s"
            >
              {{ subjectLabel(s) }}
            </button>
          </div>
          <p class="mt-2 text-xs text-ink/60">Friends in different classes get the younger class's questions.</p>
          <p v-if="pickError" class="mt-2 text-cherry">{{ pickError }}</p>
          <div class="mt-3 flex gap-2">
            <button type="submit" class="btn-chunky flex-1 bg-ocean py-2 text-lg text-white" :disabled="!friendId || busy">⚔️ Send the challenge</button>
            <button type="button" class="btn-chunky bg-white px-4 py-2" @click="picking = false">Cancel</button>
          </div>
        </form>

        <p v-if="!data.duels.length && !picking" class="mt-3 text-ink/60">No duels yet. Challenge a friend!</p>
        <ul class="mt-3 space-y-2">
          <li v-for="d in data.duels" :key="d.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-cream px-3 py-2">
            <AvatarBadge :avatar="d.other.avatar" size="sm" />
            <span class="min-w-[9rem] flex-1">
              <span class="block font-semibold">{{ d.i_challenged ? 'You' : d.other.name.split(' ')[0] }} vs {{ d.i_challenged ? d.other.name.split(' ')[0] : 'you' }} · {{ subjectLabel(d.subject) }}</span>
              <span class="block text-sm text-ink/70">{{ duelLine(d) }}</span>
            </span>
            <span v-if="duelCanPlay(d)" class="ml-auto flex items-center gap-1">
              <button v-if="!d.i_challenged && d.mine.state === 'not_started'" class="px-2 text-sm text-ink/50 underline" @click="decline(d)">No thanks</button>
              <button class="btn-chunky bg-sprint px-4 py-2 text-white" @click="router.push(`/compete/play/duels/${d.id}`)">Play</button>
            </span>
            <button v-else-if="d.phase === 'done' || (d.phase === 'expired' && d.mine.state === 'done')" class="text-sm font-semibold text-ocean" @click="router.push(`/compete/duels/${d.id}`)">See ›</button>
          </li>
        </ul>
      </section>

      <p class="text-center text-sm text-ink/50">Competitions are free and use no ⚡ Brain Power.</p>
    </template>
  </main>
</template>
