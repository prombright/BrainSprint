<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BrandLogo from '../components/BrandLogo.vue'
import { GRADES, type Grade } from '../game/types'
import { FREE_AVATARS, LEVEL_AVATARS } from '../game/progress'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const editing = !!player.profile
// the free animals plus any unlocked by levelling up
const AVATARS = [...FREE_AVATARS, ...LEVEL_AVATARS.filter((a) => player.level.level >= a.level).map((a) => a.emoji)]

const name = ref(player.profile?.name ?? '')
const avatar = ref(player.profile?.avatar ?? AVATARS[0])
const grade = ref<Grade>(player.profile?.grade ?? 'P1')
const ready = computed(() => name.value.trim().length > 0)

function start() {
  if (!ready.value) return
  player.setProfile({ name: name.value.trim().slice(0, 20), avatar: avatar.value, grade: grade.value })
  player.startPresence()
  router.push(editing ? '/profile' : '/')
}
</script>

<template>
  <main class="flex flex-1 flex-col">
    <div class="mt-4 mb-6"><BrandLogo size="lg" /></div>

    <form class="flex flex-1 flex-col gap-6" @submit.prevent="start">
      <label class="block">
        <span class="mb-2 block text-xl font-semibold">What is your name?</span>
        <span class="-mt-1 mb-2 block text-sm text-ink/60">Other players will see it, so use your first name or a nickname.</span>
        <input
          v-model="name"
          maxlength="20"
          autocomplete="off"
          placeholder="First name or nickname"
          class="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-2xl outline-none focus:border-sprint"
        />
      </label>

      <fieldset>
        <legend class="mb-2 text-xl font-semibold">Pick your animal</legend>
        <div class="grid grid-cols-5 gap-2">
          <button
            v-for="a in AVATARS"
            :key="a"
            type="button"
            class="grid aspect-square place-items-center rounded-2xl border-4 bg-white text-4xl transition"
            :class="avatar === a ? 'scale-105 border-sprint' : 'border-transparent'"
            :aria-pressed="avatar === a"
            @click="avatar = a"
          >
            {{ a }}
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-2 text-xl font-semibold">Which class are you in?</legend>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="g in GRADES"
            :key="g.id"
            type="button"
            class="btn-chunky py-3 text-lg"
            :class="grade === g.id ? 'bg-ocean text-white' : 'bg-white'"
            :aria-pressed="grade === g.id"
            @click="grade = g.id"
          >
            {{ g.id === 'TOP' ? 'Top' : g.label }}
            <span v-if="g.id === 'TOP'" class="block text-xs font-normal opacity-75">Nursery</span>
          </button>
        </div>
      </fieldset>

      <button type="submit" class="btn-chunky mt-auto bg-sprint py-4 text-3xl text-white" :disabled="!ready">{{ editing ? 'Save ✓' : "Let's go! 🚀" }}</button>
    </form>
  </main>
</template>
