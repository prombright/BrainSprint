<script setup lang="ts">
// Another player's public card: level, league, streak, badges, and a Race button.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarBadge from './AvatarBadge.vue'
import { levelFromXp, titleFor } from '../game/progress'
import { LEVELS, SUBJECTS, type Level, type Subject } from '../game/types'
import { hasQuestions } from '../game/sprint'
import { bankVersion } from '../lib/bank'
import { activityLabel } from '../lib/activity'
import { api, type PlayerCard } from '../lib/api'
import { tierBadge } from '../lib/league'
import { usePlayer } from '../stores/player'

const props = defineProps<{ playerId: number }>()
const emit = defineEmits<{ close: [] }>()
const player = usePlayer()
const router = useRouter()

const card = ref<PlayerCard | null>(null)
const error = ref('')
const choosing = ref(false)
const subject = ref<Subject>('maths')

const isMe = computed(() => props.playerId === player.state.serverId)
const lvl = computed(() => (card.value ? levelFromXp(card.value.xp_total) : null))
const title = computed(() => (lvl.value ? titleFor(lvl.value.level) : null))
const myGrade = computed(() => player.profile!.grade)
const raceSubjects = computed(() => SUBJECTS.filter((s) => (bankVersion.value, hasQuestions(s.id, myGrade.value))))
const raceLevels = computed(() => LEVELS.filter((l) => player.isUnlocked(subject.value, myGrade.value, l.id)))

onMounted(async () => {
  try {
    const a = player.auth
    if (!a) throw new Error('Connect to the internet to see players')
    card.value = await api.card(a, props.playerId)
  } catch (e) {
    error.value = (e as Error).message
  }
})

function race(level: Level) {
  emit('close')
  router.push({ path: `/sprint/${subject.value}/${myGrade.value}/${level}`, query: { race: String(props.playerId) } })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center" @click.self="emit('close')">
    <div class="animate-pop w-full max-w-md rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
      <p v-if="error" class="py-6 text-center text-ink/70">{{ error }}</p>
      <p v-else-if="!card" class="py-10 text-center text-ink/60">Loading…</p>

      <template v-else>
        <div class="flex flex-col items-center text-center">
          <AvatarBadge :avatar="card.avatar" :xp="card.xp_total" :online="card.online" size="lg" />
          <h2 class="mt-3 text-3xl font-bold">{{ card.name }}</h2>
          <p class="font-semibold" :style="{ color: title!.ring }">{{ title!.emoji }} Level {{ lvl!.level }} {{ title!.name }}</p>
          <p class="text-ink/60">{{ card.grade === 'TOP' ? 'Top Class' : card.grade }} · {{ tierBadge(card.tier).emoji }} {{ card.tier_name }} League</p>
          <p v-if="card.online" class="mt-2 rounded-full bg-leaf/15 px-3 py-1 text-sm font-semibold text-leaf">
            Playing now{{ card.activity ? `: ${activityLabel(card.activity)}` : '' }}
          </p>
        </div>

        <div class="mt-4 grid grid-cols-4 gap-2 text-center">
          <div class="rounded-2xl bg-cream p-2"><div class="text-xl font-bold">{{ card.week_xp.toLocaleString() }}</div><div class="text-[0.7rem] text-ink/60">XP this week</div></div>
          <div class="rounded-2xl bg-cream p-2"><div class="text-xl font-bold">🔥{{ card.day_streak }}</div><div class="text-[0.7rem] text-ink/60">day streak</div></div>
          <div class="rounded-2xl bg-cream p-2"><div class="text-xl font-bold">🏅{{ card.badges }}</div><div class="text-[0.7rem] text-ink/60">badges</div></div>
          <div class="rounded-2xl bg-cream p-2"><div class="text-xl font-bold">{{ card.accuracy ?? '–' }}{{ card.accuracy !== null ? '%' : '' }}</div><div class="text-[0.7rem] text-ink/60">correct</div></div>
        </div>

        <template v-if="!isMe">
          <button v-if="!choosing" class="btn-chunky mt-5 w-full bg-sprint py-4 text-2xl text-white" @click="choosing = true">Race {{ card.name.split(' ')[0] }}</button>
          <div v-else class="mt-5">
            <div v-if="raceSubjects.length > 1" class="mb-3 grid grid-cols-2 gap-2">
              <button
                v-for="s in raceSubjects"
                :key="s.id"
                class="rounded-xl py-2 font-semibold"
                :class="subject === s.id ? 'bg-ocean text-white' : 'bg-cream'"
                @click="subject = s.id"
              >
                {{ s.emoji }} {{ s.label }}
              </button>
            </div>
            <p class="mb-2 text-center font-semibold">Pick a level to race on</p>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="l in raceLevels" :key="l.id" class="btn-chunky bg-sun py-3 text-lg" @click="race(l.id)">{{ l.emoji }} {{ l.label }}</button>
            </div>
          </div>
        </template>
      </template>

      <button class="mt-3 w-full py-2 text-ink/50" @click="emit('close')">Close</button>
    </div>
  </div>
</template>
