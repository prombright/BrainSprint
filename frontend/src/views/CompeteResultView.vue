<script setup lang="ts">
// The result of a school contest or a duel, and the child's paper with the answers, once it is over.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AvatarBadge from '../components/AvatarBadge.vue'
import PaperReview from '../components/PaperReview.vue'
import TopBar from '../components/TopBar.vue'
import { api, type Contest, type Duel, type WeeklyData } from '../lib/api'
import { clock, gradeLabel, subjectLabel, timeOnly, until } from '../lib/compete'
import { usePlayer } from '../stores/player'

const route = useRoute()
const router = useRouter()
const player = usePlayer()
const isDuel = route.params.kind === 'duels'
const isWeekly = route.params.kind === 'weekly'
const weekly = ref<WeeklyData | null>(null)
const id = Number(route.params.id)
const contest = ref<Contest | null>(null)
const duel = ref<Duel | null>(null)
const error = ref('')

onMounted(async () => {
  await player.sync()
  if (!player.auth) return void (error.value = 'Connect to the internet to see the results.')
  try {
    if (isWeekly) weekly.value = await api.weekly(player.auth)
    else if (isDuel) duel.value = await api.duel(player.auth, id)
    else contest.value = await api.contest(player.auth, id)
  } catch (e) {
    error.value = (e as Error).message
  }
})

const schoolName = (sid: number) => contest.value?.result?.schools.find((s) => s.id === sid)?.name ?? ''
const headline = computed(() => {
  const r = contest.value?.result
  if (!r) return ''
  if (r.draw) return '🤝 A draw!'
  if (r.winner_id === null) return 'No winner: a school needs at least 3 pupils to count'
  return r.winner_id === contest.value!.my_school_id ? '🏆 Your school won!' : `${schoolName(r.winner_id)} won`
})
function ordinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13
  return n + (teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'))
}
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar :title="isWeekly ? '🌍 Weekly' : isDuel ? '⚔️ Duel' : '🏫 Competition'" :back="isWeekly ? '/compete' : isDuel ? '/compete/duels' : '/compete/schools'" />

    <!-- ======== Weekly Challenge ======== -->
    <template v-if="weekly">
      <!-- this week: play, or what you got -->
      <section v-if="weekly.this_week && weekly.this_week.mine.state !== 'done'" class="rounded-3xl bg-gradient-to-br from-ocean to-berry p-5 text-white">
        <p class="text-sm font-semibold tracking-widest text-sun uppercase">This week · {{ gradeLabel(weekly.this_week.grade) }} · {{ subjectLabel(weekly.this_week.subject) }}</p>
        <p class="mt-1 text-lg">Every {{ gradeLabel(weekly.this_week.grade) }} child in Uganda gets these {{ weekly.this_week.questions }} questions. One go, {{ weekly.this_week.minutes }} minutes.</p>
        <button
          v-if="weekly.this_week.mine.state === 'not_started' || weekly.this_week.mine.state === 'started'"
          class="btn-chunky mt-3 w-full bg-white py-4 text-xl text-ink"
          @click="router.push('/compete/play/weekly/0')"
        >
          {{ weekly.this_week.mine.state === 'started' ? 'Continue my paper →' : 'Start →' }}
        </button>
        <p v-else class="mt-3 opacity-90">Your time for this week's paper is up.</p>
        <p class="mt-2 text-sm opacity-80">{{ weekly.this_week.entrants }} played so far · ends in {{ until(weekly.this_week.ends_at) }}</p>
      </section>
      <section v-else-if="weekly.this_week?.mine.state === 'done'" class="rounded-3xl bg-white p-5 text-center shadow-sm">
        <p class="text-sm text-ink/60">This week</p>
        <p class="text-4xl font-bold">{{ weekly.this_week.mine.correct }}/{{ weekly.this_week.mine.total }}</p>
        <p class="text-ink/70">Handed in ✓ · places and answers come out on Monday ({{ until(weekly.this_week.ends_at) }})</p>
      </section>

      <template v-if="weekly.last_week?.result">
        <section class="rounded-3xl bg-gradient-to-br from-ocean to-berry p-6 text-center text-white">
          <p class="text-sm font-semibold tracking-widest text-sun uppercase">Last week · {{ gradeLabel(weekly.last_week.grade) }} · {{ subjectLabel(weekly.last_week.subject) }}</p>
          <template v-if="weekly.last_week.mine.state === 'done'">
            <p class="mt-1 text-5xl font-bold">{{ ordinal(weekly.last_week.result.my_rank ?? 0) }}</p>
            <p class="text-lg">of {{ weekly.last_week.entrants }} children · {{ weekly.last_week.mine.correct }}/{{ weekly.last_week.mine.total }} in {{ clock(weekly.last_week.mine.seconds ?? 0) }} min</p>
            <p v-if="weekly.last_week.result.my_school_rank" class="mt-1 opacity-90">Your school came {{ ordinal(weekly.last_week.result.my_school_rank) }} 🏫</p>
          </template>
          <p v-else class="mt-1 text-xl">You didn't play last week. This week's challenge is open!</p>
        </section>

        <section class="rounded-3xl bg-white p-5 shadow-sm">
          <h2 class="mb-2 text-xl font-bold">Top 10</h2>
          <ol class="space-y-1">
            <li v-for="p in weekly.last_week.result.top" :key="p.id" class="flex items-center gap-3 rounded-2xl px-3 py-1.5" :class="p.me ? 'bg-sun/30' : 'bg-cream'">
              <span class="w-6 text-center font-bold">{{ p.rank }}</span>
              <AvatarBadge :avatar="p.avatar" size="sm" />
              <span class="min-w-0 flex-1 truncate font-semibold">{{ p.name.split(' ')[0] }}</span>
              <span class="font-bold tabular-nums">{{ p.correct }}/{{ weekly.last_week.questions }}</span>
              <span class="w-12 text-right text-sm text-ink/60 tabular-nums">{{ clock(p.seconds) }}</span>
            </li>
          </ol>
        </section>

        <section v-if="weekly.last_week.result.top_schools.length" class="rounded-3xl bg-white p-5 shadow-sm">
          <h2 class="text-xl font-bold">Top schools</h2>
          <p class="mb-2 text-sm text-ink/60">Average of each school's best 10 (at least 3 must play)</p>
          <ol class="space-y-1">
            <li v-for="(s, i) in weekly.last_week.result.top_schools" :key="s.id" class="flex items-center gap-3 rounded-2xl bg-cream px-3 py-2">
              <span class="w-6 text-center font-bold">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ s.name }}</span><span class="block text-xs text-ink/60">{{ s.district }} · {{ s.players }} played</span></span>
              <span class="font-bold tabular-nums">{{ s.average_percent }}%</span>
            </li>
          </ol>
        </section>

        <PaperReview v-if="weekly.last_week.review" :questions="weekly.last_week.review" />
      </template>
      <p v-else-if="!weekly.this_week" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">The Weekly Challenge isn't ready for your class yet.</p>
    </template>
    <p v-if="error" class="rounded-3xl bg-white p-6 text-center text-ink/70 shadow-sm">{{ error }}</p>

    <!-- ======== school contest ======== -->
    <template v-if="contest">
      <section v-if="contest.phase !== 'finished'" class="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p class="text-5xl">⏳</p>
        <p class="mt-2 text-xl font-bold">{{ contest.mine?.state === 'done' ? 'Handed in ✓' : 'Not finished yet' }}</p>
        <p class="text-ink/70">Results and answers come out when the competition ends at {{ timeOnly(contest.ends_at) }} ({{ until(contest.ends_at) }}).</p>
      </section>

      <template v-else-if="contest.result">
        <section class="rounded-3xl bg-ink p-6 text-center text-white">
          <p class="text-sm font-semibold tracking-widest text-sun uppercase">{{ gradeLabel(contest.grade) }} · {{ subjectLabel(contest.subject) }}</p>
          <p class="mt-1 text-3xl font-bold">{{ headline }}</p>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div v-for="s in contest.result.schools" :key="s.id" class="rounded-2xl p-3" :class="s.id === contest.result.winner_id ? 'bg-sun text-ink' : 'bg-white/10'">
              <p class="font-semibold">{{ s.name }}</p>
              <p class="text-4xl font-bold tabular-nums">{{ s.valid ? `${s.average_percent}%` : '–' }}</p>
              <p class="text-xs opacity-80">{{ s.players }} played · best {{ s.counted }} counted</p>
            </div>
          </div>
          <p class="mt-3 text-xs opacity-70">A school's score is the average of its best 10 pupils, so big and small schools compete fairly.</p>
        </section>

        <section v-if="contest.mine?.state === 'done'" class="rounded-3xl bg-white p-5 text-center shadow-sm">
          <p class="text-sm text-ink/60">You</p>
          <p class="text-4xl font-bold">{{ contest.mine.correct }}/{{ contest.mine.total }}</p>
          <p class="text-ink/70">in {{ clock(contest.mine.seconds ?? 0) }} min</p>
          <p class="mt-2 font-semibold">
            {{ ordinal(contest.result.my_rank ?? 0) }} of {{ contest.result.entrants }} · {{ ordinal(contest.result.my_school_rank ?? 0) }} in your school
          </p>
          <p class="text-sm" :class="contest.result.counted ? 'text-leaf' : 'text-ink/60'">
            {{ contest.result.counted ? '✓ Your score counted for your school' : 'The best 10 in your school counted this time. Keep practising!' }}
          </p>
        </section>
        <p v-else class="rounded-3xl bg-white p-5 text-center text-ink/70 shadow-sm">You didn't hand in a paper this time.</p>

        <section class="rounded-3xl bg-white p-5 shadow-sm">
          <h2 class="mb-2 text-xl font-bold">Top pupils</h2>
          <ol class="space-y-1">
            <li v-for="p in contest.result.top" :key="p.id" class="flex items-center gap-3 rounded-2xl px-3 py-1.5" :class="p.me ? 'bg-sun/30' : 'bg-cream'">
              <span class="w-6 text-center font-bold">{{ p.rank }}</span>
              <AvatarBadge :avatar="p.avatar" size="sm" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ p.name.split(' ')[0] }}</span>
                <span class="block truncate text-xs text-ink/60">{{ schoolName(p.school_id) }}</span>
              </span>
              <span class="font-bold tabular-nums">{{ p.correct }}/{{ contest.questions }}</span>
              <span class="w-12 text-right text-sm text-ink/60 tabular-nums">{{ clock(p.seconds) }}</span>
            </li>
          </ol>
        </section>

        <PaperReview v-if="contest.review" :questions="contest.review" />
      </template>
    </template>

    <!-- ======== duel ======== -->
    <template v-if="duel">
      <section class="rounded-3xl bg-ink p-6 text-center text-white">
        <p class="text-sm font-semibold tracking-widest text-sun uppercase">{{ gradeLabel(duel.grade) }} · {{ subjectLabel(duel.subject) }}</p>
        <p class="mt-1 text-3xl font-bold">
          <template v-if="duel.phase === 'done'">{{ duel.outcome === 'won' ? '🏆 You won!' : duel.outcome === 'lost' ? `${duel.other.name.split(' ')[0]} won this time` : '🤝 A draw!' }}</template>
          <template v-else-if="duel.phase === 'expired'">{{ duel.other.name.split(' ')[0] }} didn't play in time</template>
          <template v-else>Waiting for {{ duel.other.name.split(' ')[0] }}…</template>
        </p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="font-semibold">You</p>
            <p class="text-4xl font-bold tabular-nums">{{ duel.mine.state === 'done' ? `${duel.mine.correct}/${duel.mine.total}` : '–' }}</p>
            <p v-if="duel.mine.seconds" class="text-xs opacity-80">{{ clock(duel.mine.seconds) }} min</p>
          </div>
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="font-semibold">{{ duel.other.avatar }} {{ duel.other.name.split(' ')[0] }}</p>
            <p class="text-4xl font-bold tabular-nums">{{ duel.theirs?.state === 'done' ? `${duel.theirs.correct}/${duel.theirs.total}` : duel.they_played ? '✓' : '…' }}</p>
            <p v-if="duel.theirs?.seconds" class="text-xs opacity-80">{{ clock(duel.theirs.seconds) }} min</p>
          </div>
        </div>
        <p v-if="duel.phase === 'open'" class="mt-3 text-sm opacity-80">You'll see both scores and the answers when your friend has played ({{ until(duel.expires_at) }} left).</p>
      </section>
      <PaperReview v-if="duel.review" :questions="duel.review" />
      <button class="btn-chunky bg-sprint py-3 text-lg text-white" @click="router.push(`/compete/duels?duel=${duel.other.id}`)">⚔️ Duel {{ duel.other.name.split(' ')[0] }} again</button>
    </template>
  </main>
</template>
