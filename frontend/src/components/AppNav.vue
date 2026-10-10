<script setup lang="ts">
// Navigation: a bottom tab bar on phones, a sidebar on tablets and laptops.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandLogo from './BrandLogo.vue'
import ParentGate from './ParentGate.vue'
import PowerPill from './PowerPill.vue'
import { bossThisWeek } from '../game/boss'
import { usePlayer } from '../stores/player'

const route = useRoute()
const router = useRouter()
const player = usePlayer()
const gateOpen = ref(false)
const boss = bossThisWeek()

const MAIN = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/league', icon: '🏆', label: 'League' },
  { to: '/boss', icon: boss.emoji, label: 'Boss' },
  { to: '/friends', icon: '👫', label: 'Friends' },
  { to: '/profile', icon: '', label: 'Me' }, // shows the child's own animal
]
const MORE_ALL = [
  { to: '/progress', icon: '🎯', label: 'My Progress' },
  { to: '/compete', icon: '⚔️', label: 'Compete' },
  { to: '/mock', icon: '🎓', label: 'PLE Prep', grades: ['P6', 'P7'] },
  { to: '/class', icon: '📝', label: 'My Class' },
  { to: '/school', icon: '🏫', label: 'My School' },
  { to: '/badges', icon: '🏅', label: 'Badges' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

// PLE Prep only appears for the classes it's for
const MORE = computed(() => MORE_ALL.filter((i) => !('grades' in i) || i.grades!.includes(player.profile?.grade ?? '')))

const active = (to: string) => (to === '/' ? route.path === '/' || route.path.startsWith('/subject') : route.path.startsWith(to))
</script>

<template>
  <!-- tablets: a slim rail of icons · laptops: full sidebar with words -->
  <aside class="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center gap-1 border-r border-ink/5 bg-white px-2 py-5 md:flex lg:w-64 lg:items-stretch lg:px-3">
    <button class="mb-4 px-2" aria-label="Home" @click="router.push('/')">
      <span class="hidden lg:block"><BrandLogo /></span>
      <svg class="size-10 lg:hidden" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="var(--color-sprint)" /><path d="M36 6 L16 36 H30 L26 58 L48 26 H34 Z" fill="#fff" stroke="var(--color-ink)" stroke-width="3" stroke-linejoin="round" /></svg>
    </button>
    <div class="mb-4 hidden items-center gap-2 px-2 lg:flex">
      <PowerPill />
      <span class="rounded-full bg-sun px-3 py-1.5 text-lg font-bold">🪙 {{ player.state.totalPoints.toLocaleString() }}</span>
    </div>
    <nav class="flex flex-col gap-1" aria-label="Main">
      <button
        v-for="item in [...MAIN, ...MORE]"
        :key="item.to"
        class="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-lg font-semibold transition hover:bg-cream"
        :class="active(item.to) ? 'bg-sprint/10 text-sprint-dark' : 'text-ink/80'"
        :aria-current="active(item.to) ? 'page' : undefined"
        :title="item.label"
        @click="router.push(item.to)"
      >
        <span class="w-8 text-center text-2xl">{{ item.icon || player.profile?.avatar }}</span>
        <span class="hidden lg:inline">{{ item.label }}</span>
      </button>
    </nav>
    <button class="mt-auto flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-semibold text-ink/60 hover:bg-cream" title="Grown-ups" @click="gateOpen = true">
      <span class="w-8 text-center text-2xl">👨‍👩‍👧</span> <span class="hidden lg:inline">Grown-ups</span>
    </button>
  </aside>

  <!-- phones: bottom tab bar -->
  <nav
    class="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    aria-label="Main"
  >
    <button
      v-for="item in MAIN"
      :key="item.to"
      class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold"
      :class="active(item.to) ? 'text-sprint-dark' : 'text-ink/50'"
      :aria-current="active(item.to) ? 'page' : undefined"
      @click="router.push(item.to)"
    >
      <span class="text-2xl leading-none" :class="active(item.to) ? 'scale-110' : 'opacity-80 grayscale-[40%]'">{{ item.icon || player.profile?.avatar }}</span>
      {{ item.label }}
    </button>
  </nav>

  <ParentGate v-if="gateOpen" @passed="gateOpen = false; router.push('/parent')" @cancel="gateOpen = false" />
</template>
