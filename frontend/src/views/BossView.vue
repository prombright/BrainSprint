<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarBadge from '../components/AvatarBadge.vue'
import TopBar from '../components/TopBar.vue'
import { BOSS_HEARTS, BOSS_HP, BOSS_QUESTIONS, bossThisWeek, capFirst } from '../game/boss'
import { api, type BossBoard } from '../lib/api'
import { useClock } from '../lib/clock'
import { timeLeft } from '../lib/league'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const now = useClock()
const data = ref<BossBoard | null>(null)

const boss = computed(() => data.value?.boss ?? { ...bossThisWeek(), hp: BOSS_HP, ends_at: '' })
const ends = computed(() => (data.value ? timeLeft(new Date(data.value.boss.ends_at).getTime() - now.value) : ''))
const grade = computed(() => (player.profile?.grade === 'TOP' ? 'Top Class' : player.profile?.grade))

onMounted(async () => {
  try {
    await player.sync()
    if (player.auth) data.value = await api.boss(player.auth)
  } catch {
    // offline: the boss can still be fought, the board waits
  }
})
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="Weekly Boss" back="/" />

    <section class="overflow-hidden rounded-3xl bg-gradient-to-b from-ink to-berry p-5 text-center text-white">
      <div class="animate-float text-8xl">{{ boss.emoji }}</div>
      <h2 class="mt-2 text-3xl font-bold">{{ capFirst(boss.name) }}</h2>
      <p class="opacity-80">This week's boss<span v-if="ends"> · {{ ends }} left</span></p>
      <div class="mx-auto mt-3 h-4 max-w-xs overflow-hidden rounded-full bg-white/20"><div class="h-full w-full rounded-full bg-cherry" /></div>
      <p class="mt-1 text-sm font-semibold">❤️ {{ BOSS_HP }} HP</p>
      <p v-if="data" class="mt-3 text-sm opacity-80">{{ data.defeated_by }} {{ grade }} {{ data.defeated_by === 1 ? 'player has' : 'players have' }} beaten it so far</p>
    </section>

    <section class="rounded-3xl bg-white p-4 shadow-sm">
      <h3 class="text-lg font-bold">How to win</h3>
      <ul class="mt-1 space-y-1 text-ink/80">
        <li>Every point you score hits the boss. Answer fast for big hits!</li>
        <li>You have {{ BOSS_HEARTS }} hearts. A wrong answer loses one.</li>
        <li>🧠 {{ BOSS_QUESTIONS }} tough questions from {{ grade }} Hard and Pro.</li>
        <li>Beat it to earn the Boss Slayer badge and a spot in the news.</li>
      </ul>
      <p v-if="data?.mine" class="mt-3 rounded-2xl p-3 text-center font-semibold" :class="data.mine.defeated ? 'bg-leaf/15 text-leaf' : 'bg-sun/40'">
        {{ data.mine.defeated ? `You beat ${boss.name} this week! Best hit: ${data.mine.damage}` : `Your best this week: ${data.mine.damage} of ${BOSS_HP} damage` }}
      </p>
      <button class="btn-chunky mt-4 w-full bg-cherry py-4 text-3xl text-white" @click="router.push('/boss/fight')">Fight!</button>
    </section>

    <section v-if="data?.top.length" class="rounded-3xl bg-white p-4 shadow-sm">
      <h3 class="mb-2 text-lg font-bold">Top fighters in {{ grade }}</h3>
      <ol class="space-y-1.5">
        <li v-for="(t, i) in data.top" :key="t.id" class="flex items-center gap-3 rounded-2xl px-3 py-1.5" :class="t.me ? 'bg-sprint text-white' : 'bg-cream'">
          <span class="w-6 text-center font-bold">{{ i + 1 }}</span>
          <AvatarBadge :avatar="t.avatar" size="sm" />
          <span class="min-w-0 flex-1 truncate font-semibold">{{ t.name }}</span>
          <span class="font-bold tabular-nums">{{ t.damage }} {{ t.defeated ? '🏆' : '' }}</span>
        </li>
      </ol>
    </section>
  </main>
</template>
