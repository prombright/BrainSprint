<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import StarRow from '../components/StarRow.vue'
import { badgeById } from '../game/badges'
import { LEVELS } from '../game/types'
import { BOSS_HP, capFirst } from '../game/boss'
import { usePlayer } from '../stores/player'

const player = usePlayer()
const router = useRouter()
const r = player.lastResult
if (!r) router.replace('/')

const cheer = computed(() => {
  if (!r) return ''
  return ['Keep practising!', 'Good try!', 'Well done!', 'Amazing!'][r.stars]
})
const missed = computed(() => r?.answers.filter((a) => !a.correct) ?? [])
const levelLabel = LEVELS.find((l) => l.id === r?.level)?.label
const nextLevel = computed(() => {
  if (!r || r.mode) return null
  const i = LEVELS.findIndex((l) => l.id === r.level)
  const next = LEVELS[i + 1]
  return next && player.isUnlocked(r.subject, r.grade, next.id) && player.starsOf(r.subject, r.grade, next.id) === 0 ? next : null
})

function raceAgain() {
  if (r?.race) router.push({ path: `/sprint/${r.subject}/${r.grade}/${r.level}`, query: { race: String(r.race.rivalId) } })
}

function again(level = r?.level) {
  if (!r) return
  if (!player.canPlay) return router.push(player.outOfPower ? '/power' : '/pass')
  if (r.mode === 'homework') return router.push('/class')
  router.push(r.mode === 'boss' ? '/boss/fight' : r.mode === 'practice' ? { path: '/practice', query: { subject: r.subject } } : `/sprint/${r.subject}/${r.grade}/${level}`)
}
</script>

<template>
  <main v-if="r" class="flex flex-1 flex-col gap-4 text-center">
    <section class="rounded-3xl bg-white p-6 shadow-sm">
      <p class="text-ink/60">{{ r.grade === 'TOP' ? 'Top Class' : r.grade }} · {{ r.mode === 'boss' ? 'Boss Battle' : r.mode === 'practice' ? 'Practice' : r.mode === 'homework' ? `Homework: ${r.homeworkTitle}` : levelLabel }}</p>
      <h1 class="mt-1 text-4xl font-bold">{{ cheer }}</h1>
      <div class="my-4 flex justify-center"><StarRow :stars="r.stars" size="text-6xl" animate /></div>
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-2xl bg-cream p-3">
          <div class="text-3xl font-bold">{{ r.score }}</div>
          <div class="text-sm text-ink/60">points</div>
        </div>
        <div class="rounded-2xl bg-cream p-3">
          <div class="text-3xl font-bold">{{ r.correct }}/{{ r.total }}</div>
          <div class="text-sm text-ink/60">correct</div>
        </div>
        <div class="rounded-2xl bg-cream p-3">
          <div class="text-3xl font-bold">{{ (r.avgMs / 1000).toFixed(1) }}s</div>
          <div class="text-sm text-ink/60">per question</div>
        </div>
      </div>
    </section>

    <section v-if="r.boss" class="animate-pop rounded-3xl p-4" :class="r.boss.defeated ? 'bg-leaf text-white' : 'bg-ink text-white'">
      <div class="text-6xl">{{ r.boss.defeated ? '🏆' : r.boss.emoji }}</div>
      <h2 class="mt-1 text-2xl font-bold">{{ r.boss.defeated ? `You defeated ${r.boss.name}!` : `${capFirst(r.boss.name)} survived… this time` }}</h2>
      <p class="text-lg">⚔️ {{ r.boss.damage }} damage{{ r.boss.defeated ? '' : ` · ${Math.max(0, BOSS_HP - r.boss.damage)} HP left` }}</p>
      <button class="btn-chunky mt-3 w-full bg-white py-3 text-xl text-ink" @click="router.push(player.canPlay ? '/boss/fight' : '/power')">Fight again</button>
    </section>

    <section
      v-if="r.race"
      class="animate-pop rounded-3xl p-4"
      :class="r.race.outcome === 'won' ? 'bg-leaf text-white' : r.race.outcome === 'draw' ? 'bg-sun/60' : 'bg-white shadow-sm'"
    >
      <div class="text-5xl">{{ r.race.outcome === 'won' ? '🏆' : r.race.outcome === 'draw' ? '🤝' : r.race.rivalAvatar }}</div>
      <h2 class="mt-1 text-2xl font-bold">
        {{ r.race.outcome === 'won' ? `You beat ${r.race.rivalName}!` : r.race.outcome === 'draw' ? `A draw with ${r.race.rivalName}!` : `${r.race.rivalName} won this time` }}
      </h2>
      <p class="text-lg">You {{ r.score }} · {{ r.race.rivalName }} {{ r.race.rivalScore }}</p>
      <button class="btn-chunky mt-3 w-full bg-white py-3 text-xl text-ink" @click="raceAgain">Race {{ r.race.rivalName }} again</button>
    </section>

    <section v-if="r.mode === 'homework'" class="rounded-3xl bg-leaf/15 p-4 font-semibold text-leaf">
      Homework done! Your teacher can see your result ({{ r.correct }}/{{ r.total }}).
      <button class="mt-2 block w-full rounded-xl bg-white py-2 text-ink" @click="router.push('/class')">Back to My Class</button>
    </section>

    <section v-if="r.endedEarly" class="rounded-3xl bg-ocean/10 p-4 font-semibold text-ocean">
      Your Brain Power ran out, so this sprint ended early. It refills by itself. Come back soon!
    </section>

    <section v-if="r.newBadges.length" class="rounded-3xl bg-sun/40 p-4">
      <h2 class="text-xl font-bold">New badge!</h2>
      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <div v-for="(id, i) in r.newBadges" :key="id" class="animate-pop" :style="{ animationDelay: `${600 + i * 200}ms` }">
          <div class="text-5xl">{{ badgeById(id)?.emoji }}</div>
          <div class="font-semibold">{{ badgeById(id)?.name }}</div>
        </div>
      </div>
    </section>

    <section v-if="nextLevel" class="rounded-3xl bg-leaf/15 p-4 font-semibold text-leaf">
      🔓 {{ nextLevel.emoji }} {{ nextLevel.label }} is open for you!
    </section>

    <!-- learning moment: show what was missed -->
    <section v-if="missed.length" class="rounded-3xl bg-white p-4 text-left shadow-sm">
      <h2 class="mb-2 text-xl font-bold">Let's learn these</h2>
      <ul class="flex flex-col gap-2">
        <li v-for="(a, i) in missed" :key="i" class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-cream px-3 py-2">
          <span class="min-w-0">
            <span v-if="a.question.visual && a.question.visual.length <= 4" class="mr-1">{{ a.question.visual }}</span>
            <span v-if="a.question.big" class="mr-1 font-semibold text-ocean">{{ a.question.big }}</span>
            {{ a.question.prompt }}
          </span>
          <span class="shrink-0 text-xl font-bold text-leaf">{{ a.question.answer }}</span>
          <details v-if="a.question.steps?.length" class="basis-full text-sm text-ink/80">
            <summary class="cursor-pointer font-semibold text-ocean">See the steps</summary>
            <ol class="mt-1 list-decimal space-y-1 pl-5">
              <li v-for="(st, j) in a.question.steps" :key="j">{{ st }}</li>
            </ol>
          </details>
        </li>
      </ul>
    </section>

    <div class="mt-auto flex flex-col gap-3 pt-2">
      <button v-if="nextLevel" class="btn-chunky bg-leaf py-4 text-2xl text-white" @click="again(nextLevel.id)">
        Try {{ nextLevel.label }} {{ nextLevel.emoji }}
      </button>
      <button class="btn-chunky bg-sprint py-4 text-2xl text-white" @click="again()">Play again</button>
      <button class="btn-chunky bg-white py-3 text-xl" @click="router.push('/')">Home</button>
    </div>
  </main>
</template>
