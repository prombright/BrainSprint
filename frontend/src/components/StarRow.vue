<script setup lang="ts">
withDefaults(defineProps<{ stars: number; size?: string; animate?: boolean }>(), { size: 'text-xl' })
</script>

<template>
  <div class="flex gap-0.5" :class="size" :aria-label="`${stars} of 3 stars`">
    <span
      v-for="i in 3"
      :key="i"
      :class="[i <= stars ? '' : 'opacity-25 grayscale', animate && i <= stars ? 'animate-pop' : '']"
      :style="animate ? { animationDelay: `${i * 250}ms` } : undefined"
      >⭐</span
    >
  </div>
</template>
