<script setup lang="ts">
// Duels with friends: the same 10 server-marked questions; most right wins, then the faster.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AvatarBadge from '../components/AvatarBadge.vue'
import TopBar from '../components/TopBar.vue'
import { api, type Duel, type Friend } from '../lib/api'
import { subjectLabel, until } from '../lib/compete'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const route = useRoute()
const duels = ref<Duel[] | null>(null)
const subjects = ref<string[]>([])
const error = ref('')
const now = ref(Date.now())
let tick: number | undefined

const picking = ref(false)
const friends = ref<Friend[] | null>(null)
const friendId = ref<number | null>(null)
const subject = ref('maths')
const busy = ref(false)
const pickError = ref('')

async function auth() {
  await player.sync()
  if (!player.auth) throw new Error('Connect to the internet to duel')
  return player.auth
}

async function load() {
  try {
    const c = await api.compete(await auth())
    duels.value = c.duels
    subjects.value = c.duel_subjects
    if (!subjects.value.includes(subject.value)) subject.value = subjects.value[0] ?? 'maths'
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
    // the challenger plays straight away
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
    duels.value = (await api.declineDuel(await auth(), d.id)).duels
  } catch (e) {
    alert((e as Error).message)
  }
}

const first = (name: string) => name.split(' ')[0]
function line(d: Duel) {
  const name = first(d.other.name)
  if (d.phase === 'declined') return d.i_challenged ? `${name} said no this time` : 'You said no'
  if (d.phase === 'done') return d.outcome === 'won' ? '🏆 You won!' : d.outcome === 'lost' ? `${name} won this time` : '🤝 A draw!'
  if (d.phase === 'expired') return d.mine.state === 'done' ? `${name} didn't play in time` : 'Time ran out before you played'
  if (d.mine.state === 'done') return `Waiting for ${name}… (${until(d.expires_at, now.value)} left)`
  if (d.mine.state === 'started') return 'Finish your paper!'
  return d.they_played ? `${name} has played. Your turn!` : d.i_challenged ? 'Play your paper' : `${name} challenged you!`
}
const canPlay = (d: Duel) => d.phase === 'open' && (d.mine.state === 'not_started' || d.mine.state === 'started')

onMounted(() => {
  load()
  if (route.query.duel) {
    friendId.value = Number(route.query.duel)
    openPicker()
  }
  tick = window.setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => clearInterval(tick))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="⚔️ Duels" back="/compete" />
    <p v-if="error && !duels" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">📶 {{ error }}</p>

    <template v-if="duels">
      <button v-if="!picking" class="btn-chunky bg-sprint py-4 text-xl text-white" @click="openPicker">⚔️ Challenge a friend</button>

      <form v-else class="rounded-3xl bg-white p-4 shadow-sm" @submit.prevent="challenge">
        <p class="mb-2 text-lg font-semibold">Who?</p>
        <p v-if="friends && !friends.length" class="text-ink/60">
          Add a friend first, with their friend code.
          <button type="button" class="font-semibold text-ocean underline" @click="router.push('/friends')">Go to Friends</button>
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="f in friends ?? []"
            :key="f.id"
            type="button"
            class="flex items-center gap-2 rounded-full border-2 bg-cream py-1 pr-3 pl-1 font-semibold"
            :class="friendId === f.id ? 'border-ocean' : 'border-transparent'"
            :aria-pressed="friendId === f.id"
            @click="friendId = f.id"
          >
            <AvatarBadge :avatar="f.avatar" :xp="f.xp_total" size="sm" /> {{ first(f.name) }}
          </button>
        </div>
        <p class="mt-4 mb-2 text-lg font-semibold">Which subject?</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in subjects"
            :key="s"
            type="button"
            class="rounded-full border-2 bg-cream px-4 py-1 font-semibold"
            :class="subject === s ? 'border-ocean' : 'border-transparent'"
            :aria-pressed="subject === s"
            @click="subject = s"
          >
            {{ subjectLabel(s) }}
          </button>
        </div>
        <p v-if="pickError" class="mt-2 text-cherry">{{ pickError }}</p>
        <div class="mt-4 flex gap-2">
          <button type="submit" class="btn-chunky flex-1 bg-ocean py-3 text-lg text-white" :disabled="!friendId || busy">Send the challenge</button>
          <button type="button" class="btn-chunky bg-cream px-4 py-3" @click="picking = false">Cancel</button>
        </div>
      </form>

      <ul v-if="duels.length" class="space-y-2">
        <li v-for="d in duels" :key="d.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white px-3 py-3 shadow-sm">
          <AvatarBadge :avatar="d.other.avatar" size="sm" />
          <span class="min-w-[9rem] flex-1">
            <span class="block font-semibold">{{ first(d.other.name) }} · {{ subjectLabel(d.subject) }}</span>
            <span class="block text-sm text-ink/70">{{ line(d) }}</span>
          </span>
          <span v-if="canPlay(d)" class="ml-auto flex items-center gap-1">
            <button v-if="!d.i_challenged && d.mine.state === 'not_started'" class="px-2 text-sm text-ink/50 underline" @click="decline(d)">No thanks</button>
            <button class="btn-chunky bg-sprint px-5 py-2 text-white" @click="router.push(`/compete/play/duels/${d.id}`)">Play</button>
          </span>
          <button v-else-if="d.phase === 'done' || (d.phase === 'expired' && d.mine.state === 'done')" class="font-semibold text-ocean" @click="router.push(`/compete/duels/${d.id}`)">See ›</button>
        </li>
      </ul>
      <p v-else-if="!picking" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">No duels yet. Challenge a friend!</p>

      <p class="mt-auto text-center text-sm text-ink/50">You both get the same 10 questions. Most right wins; if it's level, the faster one wins.</p>
    </template>
  </main>
</template>
