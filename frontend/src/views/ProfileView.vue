<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AvatarBadge from '../components/AvatarBadge.vue'
import TopBar from '../components/TopBar.vue'
import { BADGES } from '../game/badges'
import { FREE_AVATARS, LEVEL_AVATARS, TITLES } from '../game/progress'
import { tierBadge } from '../lib/league'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()

const p = computed(() => player.profile!)
const nextTitle = computed(() => TITLES.find((t) => t.from > player.level.level))
const myBadges = computed(() => BADGES.filter((b) => player.state.badges.includes(b.id)))

function chooseAvatar(a: string) {
  player.setProfile({ ...p.value, avatar: a })
}
</script>

<template>
  <main v-if="player.profile" class="flex flex-1 flex-col gap-4">
    <TopBar title="My Profile" back="/" />

    <section class="flex flex-col items-center rounded-3xl bg-white p-5 text-center shadow-sm">
      <AvatarBadge :avatar="p.avatar" :xp="player.state.totalPoints" size="lg" />
      <h1 class="mt-3 text-3xl font-bold">{{ p.name }}</h1>
      <p class="text-lg font-semibold" :style="{ color: player.title.ring }">{{ player.title.emoji }} Level {{ player.level.level }} {{ player.title.name }}</p>
      <p class="text-ink/60">{{ p.grade === 'TOP' ? 'Top Class' : p.grade }} · {{ tierBadge(player.league?.tier ?? player.state.summary?.tier ?? 0).emoji }} {{ player.league?.tier_name ?? 'Bronze' }} League</p>

      <div class="mt-4 w-full">
        <div class="mb-1 flex justify-between text-sm text-ink/60">
          <span>Level {{ player.level.level }}</span>
          <span>{{ player.level.into.toLocaleString() }} / {{ player.level.needed.toLocaleString() }} XP</span>
          <span>Level {{ player.level.level + 1 }}</span>
        </div>
        <div class="h-4 overflow-hidden rounded-full bg-ink/10">
          <div class="h-full rounded-full transition-all" :style="{ width: `${player.level.pct}%`, background: player.title.ring }" />
        </div>
        <p v-if="nextTitle" class="mt-1 text-sm text-ink/60">Reach level {{ nextTitle.from }} to become {{ nextTitle.emoji }} {{ nextTitle.name }}</p>
      </div>

      <button class="mt-4 rounded-xl bg-cream px-4 py-2 font-semibold" @click="router.push('/welcome')">✏️ Change name or class</button>
    </section>

    <section class="grid grid-cols-3 gap-2 text-center">
      <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold">🪙 {{ player.state.totalPoints.toLocaleString() }}</div><div class="text-xs text-ink/60">total XP</div></div>
      <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold">🔥 {{ player.dayStreak }}</div><div class="text-xs text-ink/60">days in a row</div></div>
      <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold">🏃 {{ player.state.sprintsPlayed }}</div><div class="text-xs text-ink/60">sprints</div></div>
      <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold">🏁 {{ player.state.raceWins }}</div><div class="text-xs text-ink/60">races won</div></div>
      <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold">🏅 {{ myBadges.length }}</div><div class="text-xs text-ink/60">badges</div></div>
      <div class="rounded-2xl bg-white p-3 shadow-sm"><div class="text-2xl font-bold">⭐ {{ Object.values(player.state.stars).reduce((t, s) => t + s, 0) }}</div><div class="text-xs text-ink/60">stars</div></div>
    </section>

    <section class="rounded-3xl bg-white p-4 shadow-sm">
      <h2 class="mb-2 text-xl font-bold">Choose your animal</h2>
      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="a in FREE_AVATARS"
          :key="a"
          class="grid aspect-square place-items-center rounded-2xl border-4 bg-cream text-3xl"
          :class="p.avatar === a ? 'border-sprint' : 'border-transparent'"
          @click="chooseAvatar(a)"
        >
          {{ a }}
        </button>
        <button
          v-for="a in LEVEL_AVATARS"
          :key="a.emoji"
          class="relative grid aspect-square place-items-center rounded-2xl border-4 text-3xl"
          :class="[p.avatar === a.emoji ? 'border-sprint' : 'border-transparent', player.level.level >= a.level ? 'bg-sun/40' : 'bg-ink/5']"
          :disabled="player.level.level < a.level"
          @click="chooseAvatar(a.emoji)"
        >
          <span :class="player.level.level < a.level ? 'opacity-30 grayscale' : ''">{{ a.emoji }}</span>
          <span v-if="player.level.level < a.level" class="absolute bottom-0.5 rounded-full bg-ink px-1.5 text-[0.6rem] font-bold text-white">🔒 Lv {{ a.level }}</span>
        </button>
      </div>
      <p class="mt-2 text-sm text-ink/60">Level up to unlock the special animals.</p>
    </section>

    <section class="rounded-3xl bg-white p-4 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-xl font-bold">My badges</h2>
        <button class="text-sm font-semibold text-ocean" @click="router.push('/badges')">See all ›</button>
      </div>
      <div v-if="myBadges.length" class="flex flex-wrap gap-3">
        <div v-for="b in myBadges" :key="b.id" class="text-center"><div class="text-4xl">{{ b.emoji }}</div><div class="text-xs">{{ b.name }}</div></div>
      </div>
      <p v-else class="text-ink/60">Finish a sprint to earn your first badge!</p>
    </section>
  </main>
</template>
