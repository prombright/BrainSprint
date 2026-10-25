<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'
import { usePlayer } from './stores/player'
import { loadSavedBanks, refreshBanks } from './lib/bank'

const player = usePlayer()
const route = useRoute()

// focus screens (sign-up, sprints) hide the navigation; others size themselves by route
const focus = computed(() => route.meta.layout === 'focus' || !player.profile)
const width = computed(() => (focus.value ? 'max-w-md md:max-w-2xl' : route.meta.layout === 'wide' ? 'max-w-md md:max-w-5xl' : 'max-w-md md:max-w-2xl'))

// push any sprints that were played offline, and say we're here
// bank subjects for the child's class: saved copy first (offline), then any updates
watch(
  () => player.profile?.grade,
  (grade) => {
    if (!grade) return
    loadSavedBanks(grade)
    refreshBanks(grade)
  },
  { immediate: true },
)

onMounted(() => {
  player.sync()
  if (player.profile) player.startPresence()
})
</script>

<template>
  <AppNav v-if="!focus" />
  <div :class="focus ? '' : 'md:pl-20 lg:pl-64'">
    <div
      class="mx-auto flex min-h-dvh w-full flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pt-8"
      :class="[width, focus ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-24 md:pb-8']"
    >
      <RouterView v-slot="{ Component, route: r }">
        <Transition name="page" mode="out-in">
          <component :is="Component" :key="r.fullPath" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition:
    opacity 100ms ease,
    transform 100ms ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
</style>
