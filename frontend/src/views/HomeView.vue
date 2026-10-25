<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AvatarBadge from '../components/AvatarBadge.vue'
import BrandLogo from '../components/BrandLogo.vue'
import LeagueCard from '../components/LeagueCard.vue'
import LiveNow from '../components/LiveNow.vue'
import PowerPill from '../components/PowerPill.vue'
import { DAILY_GOAL } from '../game/progress'
import { bossThisWeek } from '../game/boss'
import { FREE_SPRINTS_PER_DAY, PAYWALL_ENABLED } from '../game/scoring'
import { SUBJECTS, type Subject } from '../game/types'
import { hasQuestions } from '../game/sprint'
import { bankVersion } from '../lib/bank'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const boss = bossThisWeek()
// a subject opens for this class once it has questions (bank subjects arrive from the server)
const available = (subject: Subject) => (bankVersion.value, !!player.profile && hasQuestions(subject, player.profile.grade))
// only subjects a child can play are shown: a locked "coming soon" tile is just noise to a child
const playable = computed(() => SUBJECTS.filter((s) => available(s.id)))

// the first subject this class has questions for (Maths for everyone today)
const weak = computed(() => (player.profile ? player.weakTopics('maths', player.profile.grade) : []))
const due = computed(() => (player.profile ? player.dueReview('maths', player.profile.grade).length + (hasQuestions('english', player.profile.grade) ? player.dueReview('english', player.profile.grade).length : 0) : 0))

const TILE_COLOURS: Record<string, string> = {
  maths: 'bg-sprint',
  english: 'bg-ink',
  science: 'bg-ocean',
  sst: 'bg-white !text-ink ring-2 ring-sprint',
}

onMounted(() => {
  player.loadLeague()
  player.loadClasses()
  player.loadWaiting()
  player.setActivity(null)
})
</script>

<template>
  <main v-if="player.profile" class="flex flex-1 flex-col gap-4">
    <!-- phones only: the sidebar shows these on bigger screens -->
    <header class="flex items-center justify-between gap-2 lg:hidden">
      <BrandLogo />
      <div class="flex items-center gap-2">
        <PowerPill />
        <div class="flex items-center gap-1 rounded-full bg-sun px-3 py-1.5 text-lg font-bold whitespace-nowrap shadow-[0_3px_0_rgb(0_0_0/0.15)]">
          🪙 {{ player.state.totalPoints.toLocaleString() }}
        </div>
      </div>
    </header>

    <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <!-- main column -->
      <div class="flex min-w-0 flex-col gap-4">
        <section class="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm md:p-5">
          <button class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="router.push('/profile')">
            <AvatarBadge :avatar="player.profile.avatar" :xp="player.state.totalPoints" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-2xl font-bold md:text-3xl">Hi, {{ player.profile.name }}!</span>
              <span class="block text-sm font-semibold" :style="{ color: player.title.ring }">{{ player.title.emoji }} Level {{ player.level.level }} {{ player.title.name }}</span>
              <span class="mt-1 block h-2 max-w-sm overflow-hidden rounded-full bg-ink/10"><span class="block h-full rounded-full" :style="{ width: `${player.level.pct}%`, background: player.title.ring }" /></span>
              <span v-if="PAYWALL_ENABLED && !player.hasPass" class="block text-xs text-ink/60">{{ player.freeLeft }} of {{ FREE_SPRINTS_PER_DAY }} free sprints left today</span>
            </span>
          </button>
          <!-- daily goal ring + streak -->
          <div class="flex flex-col items-center" :title="`Daily goal: ${player.goalDone} of ${DAILY_GOAL} sprints`">
            <div class="relative grid size-14 place-items-center rounded-full" :style="{ background: `conic-gradient(var(--color-sprint) ${player.goalPct}%, color-mix(in oklab, var(--color-ink) 12%, transparent) 0)` }">
              <div class="grid size-11 place-items-center rounded-full bg-white text-lg font-bold">{{ player.goalPct >= 100 ? '✅' : `${player.goalDone}/${DAILY_GOAL}` }}</div>
            </div>
            <span class="mt-1 text-sm font-bold" :class="player.playedToday ? 'text-sprint' : 'text-ink/40'">🔥 {{ player.dayStreak }}</span>
          </div>
        </section>

        <p v-if="!player.playedToday && player.dayStreak > 0" class="-mt-2 rounded-2xl bg-sprint/10 px-4 py-2 text-center font-semibold text-sprint-dark">
          Play a sprint today to keep your {{ player.dayStreak }}-day streak!
        </p>

        <!-- homework from a teacher -->
        <button
          v-if="player.homeworkToDo.length"
          class="btn-chunky flex items-center gap-3 bg-ocean p-4 text-left text-white hover:brightness-105"
          @click="router.push('/class')"
        >
          <span class="text-4xl">📝</span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg">Homework: {{ player.homeworkToDo[0].title }}</span>
            <span class="block truncate text-sm font-normal opacity-90">
              {{ player.homeworkToDo[0].className }}{{ player.homeworkToDo.length > 1 ? ` · and ${player.homeworkToDo.length - 1} more` : '' }}
            </span>
          </span>
          <span class="text-2xl">›</span>
        </button>

        <!-- PLE Prep (P6 and P7) -->
        <button
          v-if="player.profile.grade === 'P6' || player.profile.grade === 'P7'"
          class="btn-chunky flex items-center gap-3 bg-ink p-4 text-left text-white hover:brightness-110"
          @click="router.push('/mock')"
        >
          <span class="text-4xl">🎓</span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg">PLE Prep</span>
            <span class="block text-sm font-normal opacity-80">
              {{ player.state.mockHistory?.readiness != null ? `Readiness ${player.state.mockHistory.readiness}% · take another mock` : 'Take a timed mock exam' }}
            </span>
          </span>
          <span class="text-2xl">›</span>
        </button>

        <!-- adaptive practice -->
        <button class="btn-chunky hidden items-center gap-3 bg-white p-4 text-left hover:bg-cream md:flex" @click="router.push('/progress')">
          <span class="text-4xl">🎯</span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg">My weak spots</span>
            <span v-if="weak.length" class="block truncate text-sm font-normal text-ink/70">Practise {{ weak.slice(0, 2).map((t) => t.topic).join(' and ') }}{{ due ? ` · ${due} to try again` : '' }}</span>
            <span v-else-if="due" class="block text-sm font-normal text-ink/70">{{ due }} question{{ due === 1 ? '' : 's' }} to try again</span>
            <span v-else class="block text-sm font-normal text-ink/70">See how you're doing in every topic</span>
          </span>
          <span v-if="weak.length || due" class="rounded-full bg-cherry px-2.5 py-0.5 text-sm font-bold text-white">{{ weak.length + due }}</span>
          <span class="text-2xl text-ink/40">›</span>
        </button>

        <!-- phones have the League tab; tablets show the card here -->
        <div class="hidden md:block lg:hidden"><LeagueCard /></div>

        <section>
          <h2 class="mb-3 text-2xl font-bold">Let's play!</h2>
          <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            <button
              v-for="s in playable"
              :key="s.id"
              class="btn-chunky relative flex aspect-[4/3] flex-col items-center justify-center gap-1 text-white hover:brightness-105 md:aspect-square"
              :class="TILE_COLOURS[s.id]"
              @click="router.push(`/subject/${s.id}`)"
            >
              <span class="text-6xl md:text-5xl">{{ s.emoji }}</span>
              <span class="text-2xl">{{ s.label }}</span>
            </button>
          </div>
        </section>

        <!-- weekly boss, competitions, practice (phones) · friends and school (bigger screens) -->
        <div class="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
          <button class="btn-chunky flex flex-col items-center gap-1 bg-gradient-to-b from-ink to-berry py-5 text-white hover:brightness-110 md:py-5" @click="router.push('/boss')">
            <span class="animate-float text-5xl">{{ boss.emoji }}</span>
            <span class="text-lg leading-tight md:text-lg">Boss Battle</span>
          </button>
          <button class="btn-chunky relative flex flex-col items-center gap-1 bg-gradient-to-b from-sprint to-sprint-dark py-5 text-white hover:brightness-110 md:py-5" @click="router.push('/compete')">
            <span class="text-5xl">⚔️</span>
            <span class="text-lg leading-tight md:text-lg">Compete</span>
            <span
              v-if="player.competeWaiting"
              class="absolute top-1.5 right-1.5 grid min-w-6 place-items-center rounded-full bg-white px-1.5 text-sm font-bold text-cherry"
              :aria-label="`${player.competeWaiting} waiting for you`"
            >{{ player.competeWaiting }}</span>
          </button>
          <button class="btn-chunky relative flex flex-col items-center gap-1 bg-white py-5 hover:bg-cream md:hidden" @click="router.push('/progress')">
            <span class="text-5xl">🎯</span>
            <span class="text-lg leading-tight">Practise</span>
            <span v-if="weak.length || due" class="absolute top-1.5 right-1.5 grid min-w-6 place-items-center rounded-full bg-cherry px-1.5 text-sm font-bold text-white">{{ weak.length + due }}</span>
          </button>
          <button class="btn-chunky hidden flex-col items-center gap-1 bg-white py-5 hover:bg-cream md:flex md:py-5" @click="router.push('/friends')">
            <span class="text-5xl">👫</span>
            <span class="text-lg leading-tight md:text-lg">Friends</span>
          </button>
          <button class="btn-chunky hidden flex-col items-center gap-1 bg-white py-5 hover:bg-cream md:flex md:py-5" @click="router.push('/school')">
            <span class="text-5xl">🏫</span>
            <span class="text-lg leading-tight md:text-lg">My School</span>
          </button>
        </div>

        <div class="hidden md:block lg:hidden"><LiveNow /></div>
      </div>

      <!-- side column on tablets and laptops -->
      <aside class="hidden flex-col gap-4 lg:sticky lg:top-8 lg:flex">
        <LeagueCard />
        <LiveNow />
      </aside>
    </div>

  </main>
</template>
