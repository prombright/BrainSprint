<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { makeSprint } from '../game/sprint'
import { QUESTIONS_PER_SPRINT, bestStreak, pointsFor, starsFor } from '../game/scoring'
import { LEVELS, type AnswerRecord, type Grade, type Level, type Question, type Subject } from '../game/types'
import { playCorrect, playFinish, playWrong } from '../lib/sounds'
import { canSpeak, speak, stopSpeaking } from '../lib/speech'
import { usePlayer } from '../stores/player'
import { liveRank } from '../lib/league'
import { autoReadFor } from '../lib/settings'
import { pauseMusic, resumeMusic } from '../lib/music'
import { api } from '../lib/api'
import { shuffle } from '../game/random'
import { BOSS_HEARTS, BOSS_HP, BOSS_QUESTIONS, bossThisWeek, capFirst } from '../game/boss'
import { buildPractice } from '../game/practice'
import { seenQuestions } from '../lib/seen'

const route = useRoute()
const router = useRouter()
const player = usePlayer()

// the weekly Boss Battle reuses this screen: Maths, the child's own class, Hard + Pro questions
const isBoss = route.name === 'boss-fight'
// practice sprints: the child's weak topics and due reviews (or one topic from ?topic=), any open level
const isPractice = route.name === 'practice'
// homework from a teacher: either one topic (like practice) or a sprint at a level
const isHomework = route.name === 'homework'
const homeworkId = isHomework ? Number(route.params.id) : undefined
const practiceTopic = typeof route.query.topic === 'string' ? route.query.topic : undefined
const fromQuery = isPractice || isHomework
const subject = (isBoss ? 'maths' : fromQuery ? (route.query.subject ?? 'maths') : route.params.subject) as Subject
const grade = (isBoss || fromQuery ? (player.profile?.grade ?? 'P1') : route.params.grade) as Grade
const level = (isBoss ? 'hard' : isPractice || (isHomework && practiceTopic) ? 'medium' : isHomework ? route.query.level : route.params.level) as Level
const mixed = isPractice || (isHomework && !!practiceTopic)
const levelInfo = LEVELS.find((l) => l.id === level)

const questions = ref<Question[]>([])
const answers = ref<AnswerRecord[]>([])
const index = ref(0)
const phase = ref<'countdown' | 'question' | 'feedback'>('countdown')
const countdown = ref(3)
const picked = ref<string | null>(null)
const streak = ref(0)
const score = ref(0)
const lastPoints = ref(0)
const msLeft = ref(0)

// ---------- race: the rival's ghost answers at their real pace ----------
interface Ghost {
  id: number
  name: string
  avatar: string
  avgMs: number
  answers: boolean[] // which questions the ghost gets right
  perCorrect: number
  finalScore: number
}
const raceId = Number(route.query.race) || null
const ghost = ref<Ghost | null>(null)
const ghostMs = ref(0) // the ghost's clock only runs while the child is answering
const ghostDone = computed(() => (ghost.value ? Math.min(QUESTIONS_PER_SPRINT, Math.floor(ghostMs.value / ghost.value.avgMs)) : 0))
const ghostScore = computed(() => {
  const g = ghost.value
  if (!g) return 0
  return ghostDone.value >= QUESTIONS_PER_SPRINT ? g.finalScore : g.answers.slice(0, ghostDone.value).filter(Boolean).length * g.perCorrect
})

async function loadGhost() {
  const a = player.auth
  if (!raceId || !a) return
  try {
    const r = await api.race(a, raceId, { subject, grade, level })
    const correct = Math.min(QUESTIONS_PER_SPRINT, Math.round((r.stats.correct / r.stats.total) * QUESTIONS_PER_SPRINT))
    const finalScore = Math.round((r.stats.score / r.stats.total) * QUESTIONS_PER_SPRINT)
    ghost.value = {
      id: r.rival.id,
      name: r.rival.name.split(' ')[0],
      avatar: r.rival.avatar,
      avgMs: Math.max(1500, r.stats.avg_ms),
      answers: shuffle(Array.from({ length: QUESTIONS_PER_SPRINT }, (_, i) => i < correct)),
      perCorrect: correct ? Math.round(finalScore / correct) : 0,
      finalScore,
    }
  } catch {
    // offline: play a normal sprint
  }
}
const showSteps = ref(false) // worked solution open after a wrong answer
const passedToast = ref<string | null>(null)

// live league position: where the child would stand if the sprint ended now
const live = computed(() => (player.league ? liveRank(player.league, score.value) : null))
let toastTimer: number | undefined
let lastRank = Infinity
function checkOvertake() {
  const l = live.value
  if (!l) return
  if (l.rank < lastRank && lastRank !== Infinity && l.passed) {
    passedToast.value = `You passed ${l.passed}! Now #${l.rank} 🚀`
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (passedToast.value = null), 2200)
  }
  lastRank = l.rank
}

const current = computed(() => questions.value[index.value])

// ---------- boss battle ----------
const boss = ref(bossThisWeek())
const hearts = ref(BOSS_HEARTS)
const bossHp = computed(() => Math.max(0, BOSS_HP - score.value))
const bossHit = ref(0) // changes on every hit, to replay the shake
const bossOver = computed(() => isBoss && (bossHp.value <= 0 || hearts.value <= 0))
// nursery children get double time; word problems get extra
const msAllowed = computed(() => {
  const base = (levelInfo?.seconds ?? 15) + (current.value?.extraSeconds ?? 0)
  return base * (grade === 'TOP' ? 2 : 1) * 1000
})
const timePct = computed(() => (msAllowed.value ? (msLeft.value / msAllowed.value) * 100 : 0))
const autoRead = autoReadFor(grade)

// longer words need smaller text to fit two buttons side by side
const choiceSize = computed(() => {
  const longest = Math.max(...(current.value?.choices ?? ['']).map((c) => c.length))
  return longest <= 4 ? 'text-4xl' : longest <= 7 ? 'text-3xl' : 'text-2xl'
})

// split emoji pictures into single characters so they wrap nicely
const pictures = computed(() => {
  const v = current.value?.visual
  if (!v) return []
  if ('Segmenter' in Intl) return [...new Intl.Segmenter().segment(v)].map((s) => s.segment).filter((s) => s.trim())
  return Array.from(v).filter((s) => s.trim())
})

let timer: number | undefined
let startedAt = 0

function startQuestion() {
  phase.value = 'question'
  picked.value = null
  startedAt = performance.now()
  msLeft.value = msAllowed.value
  if (autoRead && current.value) speak(current.value.speak)
  clearInterval(timer)
  timer = window.setInterval(() => {
    ghostMs.value += 100
    msLeft.value = Math.max(0, msAllowed.value - (performance.now() - startedAt))
    if (msLeft.value === 0) answer(null)
  }, 100)
}

function answer(choice: string | null) {
  if (phase.value !== 'question' || !current.value) return
  clearInterval(timer)
  stopSpeaking()
  const ms = Math.min(performance.now() - startedAt, msAllowed.value)
  const correct = choice === current.value.answer
  streak.value = correct ? streak.value + 1 : 0
  if (isBoss) {
    if (correct) bossHit.value++
    else hearts.value--
  }
  const points = pointsFor(correct, ms, msAllowed.value, streak.value)
  score.value += points
  lastPoints.value = points
  picked.value = choice
  answers.value.push({ question: current.value, picked: choice, correct, ms, points })
  player.noteAnswer(current.value, correct, subject, grade)
  phase.value = 'feedback'
  if (!correct) player.spendPower()
  checkOvertake()
  if (correct) playCorrect()
  else {
    playWrong()
    // say the right answer out loud so the child learns it
    if (autoRead) speak(`The answer is ${current.value.answer}`)
  }
  // a wrong answer with a worked solution waits for the child to read it
  if (!correct && current.value.steps?.length) showSteps.value = true
  else window.setTimeout(next, correct ? 600 : 1600) // a wrong answer stays up longer so the right one is seen
}

function readSteps() {
  if (current.value?.steps) speak(`The answer is ${current.value.answer}. ${current.value.steps.join('. ')}`)
}

// ---------- difficulty that follows the child ----------
// In a normal sprint, three right answers in a row bring a Challenge question from the level above,
// and two wrong in a row bring a Warm-up from the level below. Boss fights, homework, practice and
// races stay exactly as set. At most four swaps a sprint, so a sprint stays mostly at its level.
const ORDER = LEVELS.map((l) => l.id)
const adaptive = !isBoss && !isPractice && !isHomework && !raceId
let swaps = 0
function adaptNext() {
  if (!adaptive || swaps >= 4 || index.value + 1 >= questions.value.length) return
  const at = ORDER.indexOf(level)
  const last3 = answers.value.slice(-3)
  const last2 = answers.value.slice(-2)
  let to: Level | null = null
  let tag: 'challenge' | 'warmup' = 'challenge'
  if (last3.length === 3 && last3.every((a) => a.correct) && at < ORDER.length - 1) to = ORDER[at + 1]
  else if (last2.length === 2 && last2.every((a) => !a.correct) && at > 0) {
    to = ORDER[at - 1]
    tag = 'warmup'
  }
  if (!to) return
  const inSprint = new Set(questions.value.map((q) => q.key))
  const [q] = makeSprint(subject, grade, to, 1, { has: (k) => inSprint.has(k) || seenQuestions.has(k) })
  if (!q) return
  questions.value[index.value + 1] = { ...q, adapt: tag, extraSeconds: (q.extraSeconds ?? 0) + (tag === 'challenge' ? 5 : 0) }
  player.rememberQuestions([q.key])
  swaps++
}

function next() {
  showSteps.value = false
  stopSpeaking()
  if (player.outOfPower) finish(true)
  else if (bossOver.value) finish()
  else if (index.value + 1 < questions.value.length) {
    adaptNext()
    index.value++
    startQuestion()
  } else finish()
}

function finish(endedEarly = false) {
  const list = answers.value
  const correct = list.filter((a) => a.correct).length
  const g = ghost.value
  const race = g
    ? { rivalId: g.id, rivalName: g.name, rivalAvatar: g.avatar, rivalScore: g.finalScore, outcome: (score.value > g.finalScore ? 'won' : score.value < g.finalScore ? 'lost' : 'draw') as 'won' | 'lost' | 'draw' }
    : undefined
  player.recordSprint({
    subject,
    grade,
    level,
    answers: list,
    score: score.value,
    correct,
    total: list.length,
    avgMs: list.reduce((t, a) => t + a.ms, 0) / list.length,
    bestStreak: bestStreak(list),
    // stars always out of the full sprint, so a sprint cut short can't earn 3 stars from 2 answers
    stars: starsFor(correct, questions.value.length),
    newBadges: [],
    playedAt: new Date().toISOString(),
    endedEarly,
    race,
    mode: isBoss ? 'boss' : isPractice ? 'practice' : isHomework ? 'homework' : undefined,
    mixed: mixed || isBoss,
    assignmentId: homeworkId,
    homeworkTitle: isHomework ? String(route.query.title ?? 'Homework') : undefined,
    boss: isBoss ? { ...boss.value, damage: Math.min(300, score.value), defeated: score.value >= BOSS_HP } : undefined,
  })
  if (isBoss) player.recordBoss(Math.min(300, score.value), new Date().toISOString())
  playFinish()
  router.replace('/result')
}

function choiceClass(c: string) {
  if (phase.value !== 'feedback') return 'bg-white'
  if (c === current.value?.answer) return 'bg-leaf text-white animate-pop'
  if (c === picked.value) return 'bg-cherry text-white animate-shake'
  return 'bg-white opacity-50'
}

function quit() {
  router.push(isBoss ? '/boss' : isPractice ? '/progress' : isHomework ? '/class' : `/subject/${subject}`)
}

onMounted(() => {
  // questions this child has seen (the last 20,000), so a sprint gives new ones
  const recent = seenQuestions
  const allLevels = LEVELS.map((l) => l.id)
  questions.value = isHomework
    ? practiceTopic
      ? buildPractice({ subject, grade, levels: allLevels, weak: [], topic: practiceTopic, due: [] })
      : makeSprint(subject, grade, level, QUESTIONS_PER_SPRINT, recent)
    : isPractice
    ? buildPractice({
        subject,
        grade,
        levels: player.openLevels(subject, grade),
        weak: player.weakTopics(subject, grade).map((t) => t.topic),
        topic: practiceTopic,
        due: player.dueReview(subject, grade),
      })
    : isBoss
    ? shuffle([...makeSprint('maths', grade, 'hard', BOSS_QUESTIONS / 2, recent), ...makeSprint('maths', grade, 'pro', BOSS_QUESTIONS / 2, recent)])
    : levelInfo && player.isUnlocked(subject, grade, level)
      ? makeSprint(subject, grade, level, QUESTIONS_PER_SPRINT, recent)
      : []
  if (isBoss && player.auth) api.boss(player.auth).then((b) => (boss.value = b.boss)).catch(() => {})
  if (!questions.value.length) {
    router.replace('/')
    return
  }
  player.startSprint()
  player.rememberQuestions(questions.value.map((q) => q.key))
  player.loadLeague().then(() => checkOvertake())
  player.setActivity(`${subject}:${grade}:${level}`)
  pauseMusic()
  loadGhost()
  const tick = window.setInterval(() => {
    countdown.value--
    if (countdown.value === 0) {
      clearInterval(tick)
      startQuestion()
    }
  }, 450) // a quick 3-2-1: long enough to get ready, short enough not to wait
})

// laptops: keys 1–4 (or A–D) answer, Enter / Space moves on from the steps
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (showSteps.value && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    next()
    return
  }
  if (phase.value !== 'question' || !current.value) return
  const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase())
  const choice = current.value.choices[i]
  if (choice !== undefined) {
    e.preventDefault()
    answer(choice)
  }
}
window.addEventListener('keydown', onKey)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(timer)
  clearTimeout(toastTimer)
  stopSpeaking()
  player.setActivity(null)
  resumeMusic()
})
</script>

<template>
  <main class="flex flex-1 flex-col">
    <!-- 3, 2, 1 -->
    <div v-if="phase === 'countdown'" class="grid flex-1 place-items-center">
      <div :key="countdown" class="animate-pop text-center">
        <div class="text-9xl font-bold text-sprint">{{ countdown || 'Go!' }}</div>
        <p class="mt-4 text-2xl text-ink/60">Get ready…</p>
      </div>
    </div>

    <template v-else-if="current">
      <header class="mb-3 flex items-center gap-3">
        <button class="btn-chunky grid size-12 shrink-0 place-items-center bg-white text-xl" aria-label="Stop sprint" @click="quit">✕</button>
        <div class="flex flex-1 gap-1" aria-label="Progress">
          <span
            v-for="(q, i) in questions"
            :key="q.key + i"
            class="h-3 flex-1 rounded-full"
            :class="i < answers.length ? (answers[i].correct ? 'bg-leaf' : 'bg-cherry') : i === index ? 'bg-sprint' : 'bg-ink/10'"
          />
        </div>
        <div class="rounded-full bg-sun px-3 py-1.5 text-lg font-bold tabular-nums">🪙 {{ score }}</div>
      </header>

      <!-- boss: HP bar and hearts -->
      <div v-if="isBoss" class="mb-2 flex items-center gap-3 rounded-2xl bg-ink p-3 text-white">
        <span :key="bossHit" class="text-5xl" :class="bossHit ? 'animate-shake' : 'animate-float'">{{ boss.emoji }}</span>
        <div class="min-w-0 flex-1">
          <div class="flex justify-between text-sm font-semibold">
            <span class="truncate">{{ capFirst(boss.name) }}</span>
            <span class="tabular-nums">{{ bossHp }} HP</span>
          </div>
          <div class="mt-1 h-4 overflow-hidden rounded-full bg-white/20">
            <div class="h-full rounded-full bg-cherry transition-all duration-500" :style="{ width: `${(bossHp / BOSS_HP) * 100}%` }" />
          </div>
          <div class="mt-1 text-lg">
            <span v-for="h in BOSS_HEARTS" :key="h">{{ h <= hearts ? '❤️' : '🤍' }}</span>
          </div>
        </div>
      </div>

      <!-- race lanes: me against the rival's ghost -->
      <div v-if="ghost" class="mb-2 space-y-1 rounded-2xl bg-white p-2 shadow-sm">
        <div v-for="lane in [
          { who: 'You', avatar: player.profile!.avatar, done: answers.length, score, colour: 'bg-sprint' },
          { who: ghost.name, avatar: ghost.avatar, done: ghostDone, score: ghostScore, colour: 'bg-ink/40' },
        ]" :key="lane.who" class="flex items-center gap-2 text-sm font-semibold">
          <span class="w-16 truncate">{{ lane.who }}</span>
          <div class="relative h-6 flex-1 rounded-full bg-ink/5">
            <div class="h-full rounded-full transition-all duration-500" :class="lane.colour" :style="{ width: `${(lane.done / QUESTIONS_PER_SPRINT) * 100}%` }" />
            <span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl transition-all duration-500" :style="{ left: `max(0.75rem, ${(lane.done / QUESTIONS_PER_SPRINT) * 100}%)` }">{{ lane.avatar }}</span>
            <span v-if="lane.done >= QUESTIONS_PER_SPRINT" class="absolute top-1/2 right-1 -translate-y-1/2">🏁</span>
          </div>
          <span class="w-10 text-right tabular-nums">{{ lane.score }}</span>
        </div>
      </div>

      <!-- live league position + Brain Power -->
      <div class="mb-2 flex items-center justify-between text-sm font-semibold">
        <span v-if="live" class="rounded-full bg-ink px-3 py-1 text-white">🏆 #{{ live.rank }} in your league</span>
        <span v-else />
        <span v-if="!player.unlimitedPower" class="rounded-full px-3 py-1" :class="player.power <= 3 ? 'bg-cherry text-white' : 'bg-ocean/10 text-ocean'">⚡ {{ player.power }}</span>
      </div>
      <div v-if="passedToast" class="animate-pop fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-full bg-leaf px-5 py-2 text-lg font-bold whitespace-nowrap text-white shadow-lg">
        {{ passedToast }}
      </div>

      <!-- time bar -->
      <div class="mb-4 h-4 overflow-hidden rounded-full bg-ink/10">
        <div
          class="h-full rounded-full transition-[width] duration-100 ease-linear"
          :class="timePct > 50 ? 'bg-leaf' : timePct > 20 ? 'bg-sun' : 'bg-cherry'"
          :style="{ width: `${timePct}%` }"
        />
      </div>

      <section class="relative flex flex-1 flex-col items-center justify-center rounded-3xl bg-white p-5 text-center shadow-sm">
        <span v-if="streak >= 3" class="absolute top-3 left-3 rounded-full bg-sprint/15 px-3 py-1 font-semibold text-sprint-dark">
          🔥 {{ streak }} in a row
        </span>
        <span v-if="current.review" class="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-berry/15 px-3 py-1 text-sm font-semibold text-berry" title="You missed this one before">
          Try again
        </span>
        <button
          v-if="canSpeak()"
          class="absolute top-3 right-3 grid size-12 place-items-center rounded-full bg-ocean/10 text-2xl"
          aria-label="Read the question aloud"
          @click="speak(current.speak)"
        >
          🔊
        </button>

        <span
          v-if="current.adapt"
          class="absolute top-4 left-4 rounded-full px-3 py-1 text-sm font-semibold"
          :class="current.adapt === 'challenge' ? 'bg-sun text-ink' : 'bg-leaf/15 text-leaf'"
        >{{ current.adapt === 'challenge' ? 'Challenge' : 'Warm-up' }}</span>
        <div v-if="pictures.length" class="mt-8 mb-4 flex max-w-xs flex-wrap justify-center gap-1" :class="pictures.length === 1 ? 'text-8xl' : pictures.length > 12 ? 'text-3xl' : 'text-4xl'">
          <span v-for="(p, i) in pictures" :key="i">{{ p }}</span>
        </div>
        <p v-if="current.big" class="mb-3 font-medium tracking-wide text-ocean" :class="current.big.length <= 2 ? 'text-8xl' : 'text-5xl'">{{ current.big }}</p>
        <!-- reading comprehension: the story, then a smaller question -->
        <p v-if="current.passage" class="mt-10 mb-4 rounded-2xl bg-cream p-4 text-left text-lg leading-relaxed font-normal">{{ current.passage }}</p>
        <p class="font-bold" :class="current.passage ? 'text-xl leading-snug' : current.prompt.length > 40 ? 'text-2xl leading-snug' : current.prompt.length > 20 ? 'text-3xl leading-tight' : 'text-5xl'">
          {{ current.prompt }}
        </p>

        <!-- feedback -->
        <div class="mt-4 h-10 text-2xl font-bold">
          <template v-if="phase === 'feedback'">
            <span v-if="answers[answers.length - 1]?.correct" class="animate-pop inline-block text-leaf">+{{ lastPoints }} 🎉</span>
            <span v-else-if="picked === null" class="text-cherry">Time's up! It's {{ current.answer }}</span>
            <span v-else class="text-cherry">The answer is {{ current.answer }}</span>
          </template>
        </div>
      </section>

      <!-- worked solution -->
      <div v-if="showSteps && current.steps" class="animate-pop mt-4 rounded-3xl border-4 border-ocean/20 bg-white p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xl font-bold text-ocean">How to solve it</h2>
          <button v-if="canSpeak()" class="grid size-10 place-items-center rounded-full bg-ocean/10 text-xl" aria-label="Read the steps aloud" @click="readSteps">🔊</button>
        </div>
        <ol class="max-h-56 space-y-2 overflow-y-auto text-left text-lg">
          <li v-for="(s, i) in current.steps" :key="i" class="flex gap-2">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-ocean text-sm font-bold text-white">{{ i + 1 }}</span>
            <span>{{ s }}</span>
          </li>
        </ol>
        <p class="mt-3 rounded-2xl bg-leaf/15 px-3 py-2 text-center text-lg font-bold text-leaf">Answer: {{ current.answer }}</p>
        <button class="btn-chunky mt-3 w-full bg-ocean py-4 text-2xl text-white" @click="next">
          Got it! Next ➜ <span class="hidden text-sm font-normal opacity-70 pointer-fine:inline">(Enter)</span>
        </button>
      </div>

      <div v-else class="mt-4 grid grid-cols-2 gap-4">
        <button
          v-for="(c, i) in current.choices"
          :key="c"
          class="btn-chunky relative px-2 py-6 tabular-nums break-words md:py-8"
          :class="[choiceSize, choiceClass(c)]"
          @click="answer(c)"
        >
          <!-- keyboard hint, only on computers with a mouse -->
          <span class="absolute top-2 left-3 hidden text-sm font-semibold opacity-40 pointer-fine:inline">{{ i + 1 }}</span>
          {{ c }}
        </button>
      </div>
    </template>
  </main>
</template>
