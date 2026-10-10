<script setup lang="ts">
// "Bronze League · You're #4 of 26" button, shown on the home screen.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useClock } from '../lib/clock'
import { tierBadge, timeLeft } from '../lib/league'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const now = useClock()

const myRank = computed(() => player.league?.members.find((m) => m.me))
const leagueEnds = computed(() => (player.league ? timeLeft(new Date(player.league.ends_at).getTime() - now.value) : ''))
</script>

<template>
  <button class="btn-chunky flex w-full items-center gap-3 bg-ink p-4 text-left text-white hover:brightness-110" @click="router.push('/league')">
    <span class="text-5xl">{{ tierBadge(player.league?.tier ?? player.state.summary?.tier ?? 0).emoji }}</span>
    <span class="min-w-0 flex-1">
      <span class="block text-xl">{{ player.league?.tier_name ?? player.state.summary?.tier_name ?? 'Bronze' }} League</span>
      <span v-if="myRank" class="text-sm font-normal opacity-80">You're #{{ myRank.rank }} of {{ player.league!.members.length }} · {{ leagueEnds }} left</span>
      <span v-else class="text-sm font-normal opacity-80">Play a sprint to join this week's race</span>
    </span>
    <span class="text-2xl">›</span>
  </button>
</template>
