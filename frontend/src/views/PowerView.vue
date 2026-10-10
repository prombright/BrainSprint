<script setup lang="ts">
// Shown when Brain Power runs out: explains it refills for free, and when.
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '../components/TopBar.vue'
import { BRAIN_POWER_MAX, BRAIN_POWER_REFILL_MINUTES, PAYWALL_ENABLED } from '../game/scoring'
import { countdown } from '../lib/clock'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()

// as soon as one ⚡ is back, the child can play again
watch(
  () => player.power,
  (p) => {
    if (p > 0) router.replace('/')
  },
)
</script>

<template>
  <main class="flex flex-1 flex-col">
    <TopBar title="⚡ Brain Power" back="/" />
    <section class="rounded-3xl bg-white p-6 text-center shadow-sm">
      <div class="animate-float text-7xl">🔋</div>
      <h2 class="mt-3 text-3xl font-bold">Your brain needs a rest!</h2>
      <p class="mt-2 text-lg text-ink/70">Every wrong answer uses one ⚡. It comes back by itself, for free.</p>
      <div class="mt-5 rounded-2xl bg-ocean/10 p-4">
        <p class="text-ink/70">Next ⚡ in</p>
        <p class="text-5xl font-bold text-ocean tabular-nums">{{ countdown(player.nextPowerIn) }}</p>
        <p class="mt-2 text-sm text-ink/60">Full ({{ BRAIN_POWER_MAX }} ⚡) in {{ countdown(player.fullPowerIn) }}</p>
      </div>
    </section>

    <section class="mt-4 rounded-3xl bg-sun/40 p-5">
      <h3 class="text-xl font-bold">While you wait</h3>
      <ul class="mt-2 space-y-2 text-lg">
        <li>📖 Look back at the steps for questions you missed</li>
        <li>🏆 Check your place in the <button class="font-semibold text-ocean underline" @click="router.push('/league')">league</button></li>
        <li>🏅 See which <button class="font-semibold text-ocean underline" @click="router.push('/badges')">badges</button> are next</li>
      </ul>
    </section>

    <p class="mt-auto pt-6 text-center text-sm text-ink/50">
      One ⚡ comes back every {{ BRAIN_POWER_REFILL_MINUTES }} minutes.
      <template v-if="PAYWALL_ENABLED">Grown-ups: a Sprint Pass gives unlimited Brain Power.</template>
    </p>
  </main>
</template>
