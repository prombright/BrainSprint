<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import AvatarBadge from '../components/AvatarBadge.vue'
import LiveNow from '../components/LiveNow.vue'
import PlayerCardModal from '../components/PlayerCardModal.vue'
import TopBar from '../components/TopBar.vue'
import { tierBadge, timeLeft } from '../lib/league'
import { usePlayer } from '../stores/player'
import { useClock } from '../lib/clock'

const player = usePlayer()
const now = useClock()
const loading = ref(true)
const offline = ref(false)
const openId = ref<number | null>(null)

const league = computed(() => player.league)
const ends = computed(() => (league.value ? timeLeft(new Date(league.value.ends_at).getTime() - now.value) : ''))

onMounted(async () => {
  const l = await player.loadLeague()
  loading.value = false
  offline.value = !l
  await nextTick()
  document.querySelector('[data-me]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})

function zone(rank: number) {
  const l = league.value!
  if (rank <= l.promote) return 'up'
  if (l.demote && rank > l.members.length - l.demote) return 'down'
  return ''
}
</script>

<template>
  <main class="flex flex-1 flex-col">
    <TopBar title="🏆 My League" back="/" />

    <div v-if="loading && !league" class="grid flex-1 place-items-center text-xl text-ink/60">Loading your league…</div>

    <section v-else-if="!league" class="rounded-3xl bg-white p-6 text-center shadow-sm">
      <div class="text-6xl">📶</div>
      <h2 class="mt-2 text-2xl font-bold">Connect to the internet</h2>
      <p class="mt-1 text-ink/70">Your league needs the internet to see the other players. Your points are saved and will count when you connect.</p>
    </section>

    <template v-else>
      <section class="mb-4 rounded-3xl bg-white p-4 text-center shadow-sm">
        <div class="text-6xl">{{ tierBadge(league.tier).emoji }}</div>
        <h2 class="text-3xl font-bold">{{ league.tier_name }} League</h2>
        <p class="text-ink/60">{{ player.profile?.grade === 'TOP' ? 'Top Class' : player.profile?.grade }} · {{ ends }} left this week</p>
        <p v-if="offline" class="mt-1 text-sm text-cherry">Offline: showing the last table we saw</p>
        <p v-if="league.movement > 0" class="animate-pop mt-3 rounded-2xl bg-leaf/15 p-2 font-bold text-leaf">🎉 You moved up to {{ league.tier_name }}!</p>
        <p v-else-if="league.movement < 0" class="mt-3 rounded-2xl bg-sun/40 p-2 font-semibold">You're in {{ league.tier_name }} this week. Win your way back up!</p>
        <p class="mt-3 text-sm text-ink/70">
          <span v-if="league.promote">Top {{ league.promote }} move up 🟢</span>
          <span v-if="league.promote && league.demote"> · </span>
          <span v-if="league.demote">Bottom {{ league.demote }} move down 🔴</span>
        </p>
      </section>

      <ol class="flex flex-col gap-2 pb-4">
        <li
          v-for="m in league.members"
          :key="m.id"
          :data-me="m.me ? '' : undefined"
          class="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2"
          @click="openId = m.id"
          :class="[
            m.me ? 'bg-sprint text-white shadow-[0_4px_0_rgb(0_0_0/0.15)]' : 'bg-white',
            !m.me && zone(m.rank) === 'up' ? 'border-l-8 border-leaf' : '',
            !m.me && zone(m.rank) === 'down' ? 'border-l-8 border-cherry' : '',
          ]"
        >
          <span class="w-8 text-center text-xl font-bold tabular-nums">{{ m.rank <= 3 ? ['🥇', '🥈', '🥉'][m.rank - 1] : m.rank }}</span>
          <AvatarBadge :avatar="m.avatar" :online="m.online" size="sm" />
          <span class="min-w-0 flex-1 truncate text-lg font-semibold">{{ m.me ? `${m.name} (you)` : m.name }}</span>
          <span class="text-lg font-bold tabular-nums">{{ m.xp.toLocaleString() }} <span class="text-sm font-medium opacity-70">XP</span></span>
        </li>
      </ol>
      <p class="pb-4 text-center text-sm text-ink/50">Tap a player to see their card or race them 🏁</p>
    </template>

    <PlayerCardModal v-if="openId" :player-id="openId" @close="openId = null" />
    <div class="mt-4 lg:hidden"><LiveNow /></div>
  </main>
</template>
