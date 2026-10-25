<script setup lang="ts">
// Light / dark / like this device, for the teacher and admin websites (the game has it in Settings).
// The choice is saved in this browser, shared with the game when it runs on the same site.
import { computed } from 'vue'
import { settings } from '../lib/settings'

const ORDER = ['light', 'dark', 'auto'] as const
const LABEL = { light: 'Light', dark: 'Dark', auto: 'Like my device' }
const label = computed(() => LABEL[settings.theme])
const next = () => (settings.theme = ORDER[(ORDER.indexOf(settings.theme) + 1) % ORDER.length])
</script>

<template>
  <button class="rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-cream print:hidden" :title="`Screen: ${label}. Click to change.`" @click="next">{{ label }}</button>
</template>
