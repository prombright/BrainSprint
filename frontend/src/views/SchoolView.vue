<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AvatarBadge from '../components/AvatarBadge.vue'
import PlayerCardModal from '../components/PlayerCardModal.vue'
import TopBar from '../components/TopBar.vue'
import { api, type School, type SchoolBoard } from '../lib/api'
import { useClock } from '../lib/clock'
import { timeLeft } from '../lib/league'
import { usePlayer } from '../stores/player'

const DISTRICTS = ['Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbarara', 'Gulu', 'Lira', 'Mbale', 'Masaka', 'Arua', 'Kabarole', 'Hoima', 'Soroti', 'Kasese', 'Tororo', 'Iganga', 'Luwero', 'Mityana', 'Kabale', 'Masindi']

const player = usePlayer()
const now = useClock()
const board = ref<SchoolBoard | null>(null)
const error = ref('')
const busy = ref(false)
const query = ref('')
const results = ref<School[]>([])
const adding = ref(false)
const newName = ref('')
const newDistrict = ref('')
const openId = ref<number | null>(null)

const ends = computed(() => (board.value ? timeLeft(new Date(board.value.ends_at).getTime() - now.value) : ''))

async function auth() {
  await player.sync()
  if (!player.auth) throw new Error('Connect to the internet to see school rankings')
  return player.auth
}

async function run(fn: () => Promise<SchoolBoard>) {
  error.value = ''
  busy.value = true
  try {
    board.value = await fn()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

onMounted(() => run(async () => api.schoolBoard(await auth())))

let searchTimer: number | undefined
watch(query, (q) => {
  clearTimeout(searchTimer)
  if (q.trim().length < 2) return void (results.value = [])
  searchTimer = window.setTimeout(async () => {
    try {
      results.value = (await api.searchSchools(await auth(), q.trim())).schools
    } catch {
      results.value = []
    }
  }, 300)
})

const join = (id: number) => run(async () => api.joinSchool(await auth(), id))
const add = () => run(async () => api.addSchool(await auth(), newName.value.trim(), newDistrict.value.trim()))
const leave = () => confirm('Leave this school?') && run(async () => api.leaveSchool(await auth()))
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="My School" back="/" />
    <p v-if="error" class="rounded-2xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>

    <!-- choose a school -->
    <section v-if="board && !board.school" class="rounded-3xl bg-white p-4 shadow-sm">
      <h2 class="text-xl font-bold">Which school do you go to?</h2>
      <p class="mb-3 text-ink/60">Earn points for your school and climb the school rankings together!</p>
      <input v-model="query" placeholder="Type your school's name" class="w-full rounded-2xl border-2 border-ink/10 px-4 py-3 text-lg outline-none focus:border-ocean" />
      <ul v-if="results.length" class="mt-2 divide-y divide-ink/5">
        <li v-for="s in results" :key="s.id">
          <button class="flex w-full items-center justify-between gap-2 py-3 text-left" :disabled="busy" @click="join(s.id)">
            <span><b>{{ s.name }}</b> <span class="text-sm text-ink/60">· {{ s.district }}</span></span>
            <span class="shrink-0 text-sm text-ink/50">{{ s.members }} players ›</span>
          </button>
        </li>
      </ul>
      <p v-else-if="query.trim().length >= 2" class="mt-2 text-ink/60">No school found with that name.</p>

      <button v-if="!adding" class="mt-3 text-sm font-semibold text-ocean underline" @click="adding = true">My school isn't on the list</button>
      <form v-else class="mt-3 space-y-2 rounded-2xl bg-cream p-3" @submit.prevent="add">
        <input v-model="newName" maxlength="80" placeholder="Full school name, e.g. Kitante Primary School" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
        <input v-model="newDistrict" maxlength="40" list="districts" placeholder="District" class="w-full rounded-xl border-2 border-ink/10 px-3 py-2 outline-none focus:border-ocean" />
        <datalist id="districts"><option v-for="d in DISTRICTS" :key="d" :value="d" /></datalist>
        <p class="text-xs text-ink/60">A grown-up from BrainSprint checks new schools before they join the public rankings.</p>
        <button type="submit" class="btn-chunky w-full bg-ocean py-2 text-lg text-white" :disabled="busy || newName.trim().length < 4 || !newDistrict.trim()">Add my school</button>
      </form>
    </section>

    <div class="grid items-start gap-4" :class="board?.school ? 'lg:grid-cols-2' : ''">
    <div class="flex flex-col gap-4">
    <!-- my school -->
    <template v-if="board?.school">
      <section class="rounded-3xl bg-ink p-5 text-center text-white">
        <div class="text-5xl">🏫</div>
        <h2 class="mt-1 text-2xl font-bold">{{ board.school.name }}</h2>
        <p class="opacity-70">{{ board.school.district }}</p>
        <p v-if="board.school.rank" class="mt-2 text-lg">#{{ board.school.rank }} of {{ board.board.length }} schools this week · {{ (board.school.xp ?? 0).toLocaleString() }} XP</p>
        <p v-else-if="!board.school.approved" class="mt-2 rounded-xl bg-white/10 p-2 text-sm">Waiting to be checked. Your points count already and appear in the rankings once it's approved.</p>
        <p class="mt-1 text-sm opacity-60">{{ ends }} left this week</p>
      </section>

      <section class="rounded-3xl bg-white p-4 shadow-sm">
        <h3 class="mb-2 text-lg font-bold">Top players at my school</h3>
        <ol class="space-y-1.5">
          <li
            v-for="(p, i) in board.top_players"
            :key="p.id"
            class="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-1.5"
            :class="p.me ? 'bg-sprint text-white' : 'bg-cream'"
            @click="!p.me && (openId = p.id)"
          >
            <span class="w-6 text-center font-bold">{{ p.me && i >= 10 ? '…' : i + 1 }}</span>
            <AvatarBadge :avatar="p.avatar" size="sm" />
            <span class="min-w-0 flex-1 truncate font-semibold">{{ p.name }}{{ p.me ? ' (you)' : '' }} <span class="text-xs font-normal opacity-70">{{ p.grade }}</span></span>
            <span class="font-bold tabular-nums">{{ p.week_xp.toLocaleString() }}</span>
          </li>
        </ol>
      </section>
    </template>

    </div>
    <section v-if="board?.board.length" class="rounded-3xl bg-white p-4 shadow-sm">
      <h3 class="mb-2 text-lg font-bold">School rankings this week</h3>
      <ol class="space-y-1.5">
        <li
          v-for="s in board.board"
          :key="s.id"
          class="flex items-center gap-3 rounded-2xl px-3 py-2"
          :class="s.id === board.school?.id ? 'bg-sprint text-white' : 'bg-cream'"
        >
          <span class="w-7 text-center text-lg font-bold">{{ s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ s.name }}</span>
            <span class="text-xs opacity-70">{{ s.district }} · {{ s.players }} players</span>
          </span>
          <span class="font-bold tabular-nums">{{ s.xp.toLocaleString() }}</span>
        </li>
      </ol>
    </section>

    </div>

    <button v-if="board?.school" class="text-sm text-ink/40 underline" @click="leave">Leave this school</button>
    <PlayerCardModal v-if="openId" :player-id="openId" @close="openId = null" />
  </main>
</template>
