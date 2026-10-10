<script setup lang="ts">
import { useRouter } from 'vue-router'
import { usePlayer } from '../stores/player'

defineProps<{ title?: string; back?: string }>()
const router = useRouter()
const player = usePlayer()
</script>

<template>
  <header class="mb-4 flex items-center gap-3">
    <button
      v-if="back"
      class="btn-chunky grid size-12 shrink-0 place-items-center bg-white text-2xl"
      aria-label="Go back"
      @click="router.push(back)"
    >
      ←
    </button>
    <h1 class="min-w-0 flex-1 truncate text-2xl font-bold">{{ title }}</h1>
    <div class="flex items-center gap-1 rounded-full bg-sun px-3 py-1.5 text-lg font-bold shadow-[0_3px_0_rgb(0_0_0/0.15)]">
      🪙 {{ player.state.totalPoints.toLocaleString() }}
    </div>
  </header>
</template>
