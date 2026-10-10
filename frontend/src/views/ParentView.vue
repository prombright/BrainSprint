<script setup lang="ts">
// Grown-ups area: sign up / sign in with phone + PIN, then see each child's progress.
// Reached only through the ParentGate maths check.
import { computed, onMounted, ref } from 'vue'
import TopBar from '../components/TopBar.vue'
import { SUBJECTS } from '../game/types'
import { tierBadge } from '../lib/league'
import { usePlayer } from '../stores/player'
import { useParent } from '../stores/parent'

const parent = useParent()
const player = usePlayer()

const mode = ref<'login' | 'register'>('register')
const phone = ref('')
const pin = ref('')
const name = ref('')
const busy = ref(false)
const error = ref('')

const thisChildLinked = computed(() => parent.children.some((c) => c.id === player.state.serverId))

onMounted(() => parent.refresh().catch(() => (error.value = 'Could not load. Check the internet connection.')))

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (mode.value === 'register') await parent.register(phone.value, pin.value, name.value)
    else await parent.login(phone.value, pin.value)
    pin.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function run(fn: () => Promise<unknown>) {
  error.value = ''
  busy.value = true
  try {
    await fn()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

const pct = (correct: number, answered: number) => (answered ? Math.round((correct / answered) * 100) : 0)
const subjectLabel = (id: string) => SUBJECTS.find((s) => s.id === id)?.label ?? id
const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso.replace(' ', 'T') + '+03:00').getTime()) / 864e5)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
</script>

<template>
  <main class="flex flex-1 flex-col">
    <TopBar title="👨‍👩‍👧 Grown-ups" back="/" />

    <!-- signed out -->
    <section v-if="!parent.token" class="rounded-3xl bg-white p-5 shadow-sm">
      <div class="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
        <button class="rounded-xl py-2 font-semibold" :class="mode === 'register' ? 'bg-white shadow-sm' : 'text-ink/60'" @click="mode = 'register'">Create account</button>
        <button class="rounded-xl py-2 font-semibold" :class="mode === 'login' ? 'bg-white shadow-sm' : 'text-ink/60'" @click="mode = 'login'">Sign in</button>
      </div>
      <p class="mb-4 text-ink/70">
        {{ mode === 'register' ? 'Follow your child’s learning: what they practise, how they score and where they need help.' : 'Welcome back.' }}
      </p>
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <label v-if="mode === 'register'" class="block">
          <span class="mb-1 block font-semibold">Your name</span>
          <input v-model="name" maxlength="80" autocomplete="name" class="w-full rounded-2xl border-2 border-ink/10 px-4 py-3 text-lg outline-none focus:border-ocean" />
        </label>
        <label class="block">
          <span class="mb-1 block font-semibold">Phone number</span>
          <input v-model="phone" inputmode="tel" autocomplete="tel" placeholder="0772 123456" class="w-full rounded-2xl border-2 border-ink/10 px-4 py-3 text-lg outline-none focus:border-ocean" />
        </label>
        <label class="block">
          <span class="mb-1 block font-semibold">{{ mode === 'register' ? 'Choose a 4-digit PIN' : 'PIN' }}</span>
          <input
            v-model="pin"
            type="password"
            inputmode="numeric"
            maxlength="4"
            autocomplete="current-password"
            class="w-full rounded-2xl border-2 border-ink/10 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-ocean"
          />
        </label>
        <p v-if="error" class="rounded-2xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>
        <button type="submit" class="btn-chunky mt-1 bg-ocean py-3 text-xl text-white" :disabled="busy">
          {{ busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in' }}
        </button>
      </form>
    </section>

    <!-- signed in -->
    <template v-else>
      <section class="mb-4 flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <div class="min-w-0">
          <p class="truncate text-xl font-bold">Hello, {{ parent.parent?.name ?? 'there' }}</p>
          <p class="text-sm text-ink/60">+{{ parent.parent?.phone }}</p>
        </div>
        <button class="rounded-xl bg-ink/5 px-3 py-2 text-sm font-semibold" @click="parent.logout()">Sign out</button>
      </section>

      <p v-if="error" class="mb-3 rounded-2xl bg-cherry/10 p-3 text-cherry">{{ error }}</p>

      <section v-if="player.profile && !thisChildLinked" class="mb-4 rounded-3xl bg-sun/40 p-4">
        <p class="font-semibold">{{ player.profile.avatar }} {{ player.profile.name }} plays on this phone.</p>
        <button class="btn-chunky mt-3 w-full bg-white py-3 text-lg" :disabled="busy" @click="run(parent.linkThisDevice)">
          ➕ Add {{ player.profile.name }} to my account
        </button>
      </section>

      <p v-if="!parent.children.length" class="rounded-3xl bg-white p-5 text-center text-ink/70 shadow-sm">
        No children yet. Open BrainSprint on your child’s phone, go to Grown-ups, sign in, and add them.
      </p>

      <article v-for="c in parent.children" :key="c.id" class="mb-4 rounded-3xl bg-white p-4 shadow-sm">
        <header class="flex items-center gap-3">
          <span class="grid size-14 place-items-center rounded-2xl bg-cream text-4xl">{{ c.avatar }}</span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-2xl font-bold">{{ c.name }}</h2>
            <p class="text-ink/60">{{ c.grade === 'TOP' ? 'Top Class' : c.grade }} · {{ tierBadge(['Bronze', 'Silver', 'Gold', 'Diamond', 'Champion'].indexOf(c.tier_name)).emoji }} {{ c.tier_name }} league</p>
          </div>
        </header>

        <div class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-cream p-2">
            <div class="text-2xl font-bold">{{ c.this_week.sprints }}</div>
            <div class="text-xs text-ink/60">sprints this week</div>
          </div>
          <div class="rounded-2xl bg-cream p-2">
            <div class="text-2xl font-bold">{{ pct(c.this_week.correct, c.this_week.answered) }}%</div>
            <div class="text-xs text-ink/60">correct this week</div>
          </div>
          <div class="rounded-2xl bg-cream p-2">
            <div class="text-2xl font-bold">{{ c.league_rank ? `#${c.league_rank}` : '–' }}</div>
            <div class="text-xs text-ink/60">{{ c.league_size ? `of ${c.league_size} in league` : 'not played this week' }}</div>
          </div>
        </div>

        <p v-if="c.mock_readiness !== null" class="mt-3 rounded-2xl bg-ink p-3 text-white">
          🎓 <b>PLE readiness: {{ c.mock_readiness }}%</b> <span class="opacity-70">(average of the last 3 mock exams)</span>
        </p>

        <div v-if="c.topics.weak.length || c.topics.strong.length" class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl bg-cherry/5 p-3">
            <h3 class="font-bold text-cherry">🎯 Needs practice</h3>
            <p v-if="!c.topics.weak.length" class="text-sm text-ink/60">Nothing worrying right now.</p>
            <p v-for="t in c.topics.weak" :key="t.subject + t.topic" class="text-sm">
              <b>{{ t.topic.charAt(0).toUpperCase() + t.topic.slice(1) }}</b> · {{ subjectLabel(t.subject) }}: {{ t.mastery }}% right lately
            </p>
          </div>
          <div class="rounded-2xl bg-leaf/10 p-3">
            <h3 class="font-bold text-leaf">💪 Strong at</h3>
            <p v-if="!c.topics.strong.length" class="text-sm text-ink/60">Still building up.</p>
            <p v-for="t in c.topics.strong" :key="t.subject + t.topic" class="text-sm">
              <b>{{ t.topic.charAt(0).toUpperCase() + t.topic.slice(1) }}</b> · {{ subjectLabel(t.subject) }}: {{ t.mastery }}%
            </p>
          </div>
        </div>

        <div v-if="c.subjects.length" class="mt-4 space-y-2">
          <h3 class="font-bold">By subject (all time)</h3>
          <div v-for="s in c.subjects" :key="s.subject">
            <div class="flex justify-between text-sm">
              <span>{{ subjectLabel(s.subject) }} · {{ s.sprints }} sprints</span>
              <span class="font-semibold">{{ pct(s.correct, s.answered) }}%</span>
            </div>
            <div class="h-3 overflow-hidden rounded-full bg-ink/10">
              <div
                class="h-full rounded-full"
                :class="pct(s.correct, s.answered) >= 70 ? 'bg-leaf' : pct(s.correct, s.answered) >= 50 ? 'bg-sun' : 'bg-cherry'"
                :style="{ width: `${pct(s.correct, s.answered)}%` }"
              />
            </div>
          </div>
        </div>

        <div v-if="c.recent.length" class="mt-4">
          <h3 class="mb-1 font-bold">Recent sprints</h3>
          <ul class="divide-y divide-ink/5 text-sm">
            <li v-for="(r, i) in c.recent" :key="i" class="flex justify-between py-1.5">
              <span>{{ subjectLabel(r.subject) }} {{ r.grade }} · {{ r.level }}</span>
              <span><b>{{ r.correct }}/{{ r.total }}</b> · {{ ago(r.played_at) }}</span>
            </li>
          </ul>
        </div>
        <p v-else class="mt-3 text-sm text-ink/60">No sprints yet.</p>

        <button class="mt-3 text-sm text-ink/40 underline" @click="run(() => parent.unlink(c.id))">Remove from my account</button>
      </article>
    </template>
  </main>
</template>
