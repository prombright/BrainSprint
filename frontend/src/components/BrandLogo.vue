<script setup lang="ts">
defineProps<{ size?: 'sm' | 'lg' }>()
</script>

<template>
  <div class="flex items-center gap-2" :class="size === 'lg' ? 'flex-col gap-3' : ''">
    <svg :class="size === 'lg' ? 'size-24 animate-float' : 'size-9'" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-sprint)" />
      <path d="M36 6 L16 36 H30 L26 58 L48 26 H34 Z" fill="#fff" stroke="var(--color-ink)" stroke-width="3" stroke-linejoin="round" />
    </svg>
    <div :class="size === 'lg' ? 'text-center' : ''">
      <div class="leading-none font-bold tracking-tight" :class="size === 'lg' ? 'text-4xl' : 'text-xl'">
        Brain<span class="text-sprint">Sprint</span>
      </div>
      <div class="font-semibold tracking-[0.3em] text-ocean uppercase" :class="size === 'lg' ? 'mt-1 text-base' : 'text-[0.6rem]'">Kids</div>
    </div>
  </div>
</template>
