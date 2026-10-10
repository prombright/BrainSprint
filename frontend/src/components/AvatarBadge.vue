<script setup lang="ts">
// A player's animal inside a ring coloured by their title, with an optional
// "online now" dot and level number.
import { computed } from 'vue'
import { levelFromXp, titleFor } from '../game/progress'

const props = withDefaults(defineProps<{ avatar: string; xp?: number; online?: boolean; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const lvl = computed(() => (props.xp === undefined ? null : levelFromXp(props.xp).level))
const ring = computed(() => (lvl.value ? titleFor(lvl.value).ring : 'transparent'))
const box = { sm: 'size-10 text-2xl border-2', md: 'size-14 text-4xl border-[3px]', lg: 'size-28 text-7xl border-[6px]' }
</script>

<template>
  <span class="relative inline-grid shrink-0 place-items-center rounded-full bg-cream" :class="box[size]" :style="{ borderColor: ring }">
    {{ avatar }}
    <span v-if="online" class="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-white bg-leaf" title="Playing now" />
    <span
      v-if="lvl && size !== 'sm'"
      class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[0.65rem] leading-4 font-bold text-white"
      :style="{ background: ring }"
      >{{ lvl }}</span
    >
  </span>
</template>
