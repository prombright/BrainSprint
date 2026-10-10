<script setup lang="ts">
// A grown-up check before anything to do with money. Young children can't
// solve a two-digit multiplication; parents can.
import { ref } from 'vue'
import { randInt } from '../game/random'

const emit = defineEmits<{ passed: []; cancel: [] }>()

const a = randInt(6, 9)
const b = randInt(12, 19)
const typed = ref('')
const wrong = ref(false)

function check() {
  if (Number(typed.value) === a * b) emit('passed')
  else {
    wrong.value = true
    typed.value = ''
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" @click.self="emit('cancel')">
    <form class="animate-pop w-full max-w-sm rounded-3xl bg-white p-6 text-center" @submit.prevent="check">
      <div class="text-4xl">👨‍👩‍👧</div>
      <h2 class="mt-2 text-2xl font-bold">Ask a grown-up</h2>
      <p class="mt-1 text-ink/70">Parents: answer this to continue.</p>
      <p class="mt-4 text-3xl font-bold">{{ a }} × {{ b }} = ?</p>
      <input
        v-model="typed"
        inputmode="numeric"
        autofocus
        class="mt-3 w-full rounded-2xl border-2 border-ink/15 px-4 py-3 text-center text-2xl outline-none focus:border-ocean"
        :class="wrong ? 'animate-shake border-cherry' : ''"
        @input="wrong = false"
      />
      <div class="mt-4 flex gap-3">
        <button type="button" class="btn-chunky flex-1 bg-ink/10 py-3 text-lg" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="btn-chunky flex-1 bg-ocean py-3 text-lg text-white">Continue</button>
      </div>
    </form>
  </div>
</template>
