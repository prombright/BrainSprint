<script setup lang="ts">
import TopBar from '../components/TopBar.vue'
import { settings } from '../lib/settings'
import { playCorrect } from '../lib/sounds'
import { speak } from '../lib/speech'

const READ_OPTIONS = [
  { id: 'always', label: 'Always', hint: 'Every question is read out' },
  { id: 'young', label: 'Top Class & P1', hint: 'Read out for the youngest; others tap the speaker' },
  { id: 'tap', label: 'When I tap the speaker', hint: 'Only when you ask' },
  { id: 'off', label: 'Off', hint: 'No reading out' },
] as const
</script>

<template>
  <main class="flex flex-1 flex-col gap-4">
    <TopBar title="Settings" back="/" />

    <section class="divide-y divide-ink/5 rounded-3xl bg-white px-4 shadow-sm">
      <label class="flex items-center justify-between gap-3 py-4">
        <span>
          <span class="block text-lg font-semibold">Sound effects</span>
          <span class="text-sm text-ink/60">Dings for right and wrong answers</span>
        </span>
        <input v-model="settings.sound" type="checkbox" class="size-7 accent-sprint" @change="settings.sound && playCorrect()" />
      </label>
      <label class="flex items-center justify-between gap-3 py-4">
        <span>
          <span class="block text-lg font-semibold">Background music</span>
          <span class="text-sm text-ink/60">Soft music on the menus, quiet during sprints</span>
        </span>
        <input v-model="settings.music" type="checkbox" class="size-7 accent-sprint" />
      </label>
      <label class="flex items-center justify-between gap-3 py-4">
        <span>
          <span class="block text-lg font-semibold">Data saver</span>
          <span class="text-sm text-ink/60">Uses less internet: updates the league and new questions less often. Playing never needs data.</span>
        </span>
        <input v-model="settings.dataSaver" type="checkbox" class="size-7 shrink-0 accent-sprint" />
      </label>
    </section>

    <section class="rounded-3xl bg-white p-4 shadow-sm">
      <h2 class="text-lg font-semibold">Screen</h2>
      <p class="text-sm text-ink/60">A dark screen is easier on the eyes at night.</p>
      <div class="mt-2 grid grid-cols-3 gap-2">
        <button
          v-for="t in ([['light', 'Light'], ['dark', 'Dark'], ['auto', 'Like my phone']] as const)"
          :key="t[0]"
          class="rounded-2xl py-3 font-semibold"
          :class="settings.theme === t[0] ? 'bg-ocean text-white' : 'bg-cream'"
          :aria-pressed="settings.theme === t[0]"
          @click="settings.theme = t[0]"
        >
          {{ t[1] }}
        </button>
      </div>
    </section>

    <section class="rounded-3xl bg-white p-4 shadow-sm">
      <h2 class="text-lg font-semibold">Read questions aloud</h2>
      <div class="mt-2 space-y-2">
        <label
          v-for="o in READ_OPTIONS"
          :key="o.id"
          class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3"
          :class="settings.readAloud === o.id ? 'border-ocean bg-ocean/5' : 'border-ink/10'"
        >
          <input v-model="settings.readAloud" type="radio" :value="o.id" class="size-5 accent-ocean" />
          <span>
            <span class="block font-semibold">{{ o.label }}</span>
            <span class="text-sm text-ink/60">{{ o.hint }}</span>
          </span>
        </label>
      </div>

      <h3 class="mt-4 font-semibold">Voice speed</h3>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button
          v-for="v in (['slow', 'normal'] as const)"
          :key="v"
          class="rounded-xl py-2 font-semibold"
          :class="settings.voiceSpeed === v ? 'bg-ocean text-white' : 'bg-cream'"
          @click="settings.voiceSpeed = v; speak('Seven plus five is twelve.')"
        >
          {{ v === 'slow' ? 'Slow' : 'Normal' }}
        </button>
      </div>
    </section>
  </main>
</template>
