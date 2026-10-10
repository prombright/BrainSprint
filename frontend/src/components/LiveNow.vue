<script setup lang="ts">
// Home-screen block: who's playing right now and the latest news from other players.
import { computed, ref } from 'vue'
import AvatarBadge from './AvatarBadge.vue'
import PlayerCardModal from './PlayerCardModal.vue'
import { ago } from '../lib/activity'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const openId = ref<number | null>(null)
const p = computed(() => player.presence)
const feed = computed(() => p.value?.feed.slice(0, 4) ?? [])
</script>

<template>
  <section v-if="p" class="rounded-3xl bg-white p-4 shadow-sm">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold"><span class="mr-1 inline-block size-2.5 animate-pulse rounded-full bg-leaf align-middle" /> {{ p.online_total }} playing now</h2>
      <span class="text-sm text-ink/60">{{ p.online_same_grade }} in {{ player.profile?.grade === 'TOP' ? 'Top Class' : player.profile?.grade }}</span>
    </div>

    <div v-if="p.online.length" class="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button v-for="o in p.online" :key="o.id" class="flex w-14 shrink-0 flex-col items-center" @click="openId = o.id">
        <AvatarBadge :avatar="o.avatar" online size="sm" />
        <span class="mt-0.5 w-full truncate text-center text-xs">{{ o.name.split(' ')[0] }}</span>
      </button>
    </div>

    <ul v-if="feed.length" class="mt-3 space-y-1.5 border-t border-ink/5 pt-3">
      <li v-for="f in feed" :key="f.id" class="flex items-center gap-2 text-sm">
        <span class="text-xl">{{ f.player.avatar }}</span>
        <button class="min-w-0 flex-1 text-left" @click="openId = f.player.id">
          <b>{{ f.player.name }}</b> {{ f.detail }}
        </button>
        <span class="shrink-0 text-xs text-ink/40">{{ ago(f.at) }}</span>
      </li>
    </ul>

    <PlayerCardModal v-if="openId" :player-id="openId" @close="openId = null" />
  </section>
</template>
