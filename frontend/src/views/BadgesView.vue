<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import { BADGES } from '../game/badges'
import { usePlayer } from '../stores/player'

const player = usePlayer()
</script>

<template>
  <main class="flex flex-1 flex-col">
    <TopBar title="My Badges" back="/" />
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <div
        v-for="b in BADGES"
        :key="b.id"
        class="rounded-3xl p-4 text-center"
        :class="player.state.badges.includes(b.id) ? 'bg-white shadow-sm' : 'bg-ink/5'"
      >
        <div class="text-5xl" :class="player.state.badges.includes(b.id) ? '' : 'opacity-30 grayscale'">{{ b.emoji }}</div>
        <div class="mt-1 text-lg font-bold">{{ b.name }}</div>
        <div class="text-sm text-ink/60">{{ b.how }}</div>
      </div>
    </div>
    <p class="mt-6 text-center text-ink/60">You have played {{ player.state.sprintsPlayed }} sprints.</p>
  </main>
</template>
