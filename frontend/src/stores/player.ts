import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Grade, Level, Question, SprintResult, Subject } from '../game/types'
import { LEVELS } from '../game/types'
import {
  BRAIN_POWER_ENABLED,
  BRAIN_POWER_MAX,
  BRAIN_POWER_REFILL_MINUTES,
  FREE_SPRINTS_PER_DAY,
  PAYWALL_ENABLED,
  STARS_TO_UNLOCK,
  levelKey,
} from '../game/scoring'
import { earnedBadges } from '../game/badges'
import { api, ApiError, type League, type MockHistory, type MockPayload, type MyClass, type PlayerAuth, type PlayerSummary, type Presence, type SprintPayload } from '../lib/api'
import { DAILY_GOAL, levelFromXp, titleFor, todayKey, yesterdayKey } from '../game/progress'
import { addResult, dueCards, mastery, topicKey, topicLevel, updateCard, type ReviewCard, type TopicStat } from '../game/practice'
import { useClock } from '../lib/clock'

const STORAGE_KEY = 'bsk:v1'
const REFILL_MS = BRAIN_POWER_REFILL_MINUTES * 60_000

export type PassPlan = 'day' | 'week' | 'month'

export interface Profile {
  name: string
  avatar: string
  grade: Grade
}

interface Saved {
  deviceId: string
  serverId: number | null
  serverToken: string | null // proves to the API that this device owns the player
  profileChanged?: boolean // name, animal or class changed since the server last heard
  profile: Profile | null
  totalPoints: number
  sprintsPlayed: number
  stars: Record<string, number>
  badges: string[]
  daily: { date: string; count: number }
  pass: { plan: PassPlan; expiresAt: string } | null
  pending: SprintPayload[]
  recent: string[] // keys of recently seen questions, so new sprints avoid repeats
  power: { value: number; at: number } // Brain Power at time `at`; refills from there
  summary: PlayerSummary | null // last known XP / league tier from the server
  dayStreak: { count: number; last: string | null } // days in a row with at least one sprint
  goal: { date: string; done: number } // sprints finished today, for the daily goal
  raceWins: number
  topics: Record<string, TopicStat> // "maths:P5:fractions" → recent results
  review: ReviewCard[] // missed questions waiting to come back
  pendingMocks: MockPayload[] // mock results waiting to upload
  pendingBoss: { damage: number; played_at: string }[] // boss fights waiting to upload
  pendingRaces: { rival_id: number; won: boolean; subject: string; grade: string; level: string }[] // finished races waiting to upload
  mockHistory: MockHistory | null // last copy from the server, for offline viewing
}

const today = () => new Date().toISOString().slice(0, 10)

// crypto.randomUUID only exists on https/localhost; phones on a LAN IP need a fallback
const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

function load(): Saved {
  const fresh: Saved = {
    deviceId: newId(),
    serverId: null,
    serverToken: null,
    profile: null,
    totalPoints: 0,
    sprintsPlayed: 0,
    stars: {},
    badges: [],
    daily: { date: today(), count: 0 },
    pass: null,
    pending: [],
    recent: [],
    power: { value: BRAIN_POWER_MAX, at: Date.now() },
    summary: null,
    dayStreak: { count: 0, last: null },
    goal: { date: todayKey(), done: 0 },
    raceWins: 0,
    topics: {},
    review: [],
    pendingMocks: [],
    pendingBoss: [],
    pendingRaces: [],
    mockHistory: null,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...fresh, ...JSON.parse(raw) } : fresh
  } catch {
    return fresh
  }
}

export const usePlayer = defineStore('player', () => {
  const state = ref<Saved>(load())
  const lastResult = ref<SprintResult | null>(null)
  const league = ref<League | null>(null)
  const now = useClock()

  watch(
    state,
    (s) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      } catch {
        // storage blocked: the game still works for this session
      }
    },
    { deep: true },
  )

  const profile = computed(() => state.value.profile)
  const hasPass = computed(() => !!state.value.pass && new Date(state.value.pass.expiresAt).getTime() > now.value)
  const auth = computed<PlayerAuth | null>(() =>
    state.value.serverId && state.value.serverToken ? { id: state.value.serverId, token: state.value.serverToken } : null,
  )

  const sprintsToday = computed(() => (state.value.daily.date === today() ? state.value.daily.count : 0))
  const freeLeft = computed(() => Math.max(0, FREE_SPRINTS_PER_DAY - sprintsToday.value))

  // ---------- ⚡ Brain Power ----------

  const unlimitedPower = computed(() => !BRAIN_POWER_ENABLED || hasPass.value)

  /** Brain Power right now, counting free refills since it was last saved. */
  const power = computed(() => {
    const { value, at } = state.value.power
    return Math.min(BRAIN_POWER_MAX, value + Math.floor((now.value - at) / REFILL_MS))
  })
  /** ms until the next ⚡ comes back (0 when full) */
  const nextPowerIn = computed(() => (power.value >= BRAIN_POWER_MAX ? 0 : REFILL_MS - ((now.value - state.value.power.at) % REFILL_MS)))
  const fullPowerIn = computed(() => (power.value >= BRAIN_POWER_MAX ? 0 : nextPowerIn.value + (BRAIN_POWER_MAX - power.value - 1) * REFILL_MS))

  function spendPower() {
    if (unlimitedPower.value) return
    const t = Date.now()
    const { value, at } = state.value.power
    const refills = Math.floor((t - at) / REFILL_MS)
    const current = Math.min(BRAIN_POWER_MAX, value + refills)
    // keep partial progress towards the next refill, unless it was already full
    const since = current >= BRAIN_POWER_MAX ? t : at + refills * REFILL_MS
    state.value.power = { value: Math.max(0, current - 1), at: since }
  }

  const outOfPower = computed(() => !unlimitedPower.value && power.value <= 0)
  const canPlay = computed(() => (!PAYWALL_ENABLED || hasPass.value || freeLeft.value > 0) && !outOfPower.value)

  // ---------- level, streak, daily goal ----------

  const level = computed(() => levelFromXp(state.value.totalPoints))
  const title = computed(() => titleFor(level.value.level))
  /** Days in a row; still alive today if the last sprint was yesterday. */
  const dayStreak = computed(() => {
    const { count, last } = state.value.dayStreak
    return last === todayKey() || last === yesterdayKey() ? count : 0
  })
  const playedToday = computed(() => state.value.dayStreak.last === todayKey())
  const goalDone = computed(() => (state.value.goal.date === todayKey() ? state.value.goal.done : 0))
  const goalPct = computed(() => Math.min(100, Math.round((goalDone.value / DAILY_GOAL) * 100)))

  function countDay() {
    const s = state.value
    const t = todayKey()
    if (s.dayStreak.last !== t) s.dayStreak = { count: s.dayStreak.last === yesterdayKey() ? s.dayStreak.count + 1 : 1, last: t }
    s.goal = s.goal.date === t ? { date: t, done: s.goal.done + 1 } : { date: t, done: 1 }
  }

  // ---------- topic mastery and the review box ----------

  /** Every answer teaches the app something: topic mastery, and missed questions go in the review box. */
  function noteAnswer(q: Question, correct: boolean, subject: Subject, grade: Grade) {
    const s = state.value
    const key = topicKey(subject, grade, q.topic)
    s.topics[key] = addResult(s.topics[key], correct)
    s.review = updateCard(s.review, q, subject, grade, correct)
  }

  /** Topics met in a class + subject, weakest first. */
  function topicsFor(subject: Subject, grade: Grade) {
    const prefix = `${subject}:${grade}:`
    return Object.entries(state.value.topics)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, st]) => ({ topic: k.slice(prefix.length), stat: st, mastery: mastery(st), level: topicLevel(st) }))
      .sort((a, b) => (a.level === 'new' ? 1 : 0) - (b.level === 'new' ? 1 : 0) || a.mastery - b.mastery)
  }

  const weakTopics = (subject: Subject, grade: Grade) => topicsFor(subject, grade).filter((t) => t.level === 'weak')
  const dueReview = (subject: Subject, grade: Grade) => dueCards(state.value.review, subject, grade, now.value)

  /** Levels the child has opened: practice draws from these. */
  const openLevels = (subject: Subject, grade: Grade) => LEVELS.filter((l) => isUnlocked(subject, grade, l.id)).map((l) => l.id)

  // ---------- levels ----------

  function starsOf(subject: Subject, grade: Grade, level: Level) {
    return state.value.stars[levelKey(subject, grade, level)] ?? 0
  }

  function isUnlocked(subject: Subject, grade: Grade, level: Level) {
    const i = LEVELS.findIndex((l) => l.id === level)
    if (i <= 0) return true
    return starsOf(subject, grade, LEVELS[i - 1].id) >= STARS_TO_UNLOCK
  }

  function setProfile(p: Profile) {
    state.value.profile = p
    state.value.profileChanged = true // sent with the next sync
    sync()
  }

  // Counted when a sprint starts, so quitting halfway doesn't give free sprints back.
  function startSprint() {
    const s = state.value
    if (s.daily.date !== today()) s.daily = { date: today(), count: 0 }
    s.daily.count += 1
  }

  function recordSprint(result: SprintResult) {
    const s = state.value
    s.totalPoints += result.score
    s.sprintsPlayed += 1

    // boss battles and practice sprints don't count towards a level's stars
    if (!result.mode) {
      const key = levelKey(result.subject, result.grade, result.level)
      s.stars[key] = Math.max(s.stars[key] ?? 0, result.stars)
    }

    countDay()
    if (result.race) recordRace(result.race.rivalId, result.race.outcome === 'won', result)
    result.newBadges = earnedBadges({ result, totalPoints: s.totalPoints, sprintsPlayed: s.sprintsPlayed, dayStreak: dayStreak.value, raceWins: s.raceWins }, s.badges)
    s.badges.push(...result.newBadges)
    lastResult.value = result

    s.pending.push({
      subject: result.subject,
      grade: result.grade,
      level: result.mixed ? 'mixed' : result.level,
      score: result.score,
      correct: result.correct,
      total: result.total,
      avg_ms: Math.round(result.avgMs),
      best_streak: result.bestStreak,
      played_at: result.playedAt,
      assignment_id: result.assignmentId,
      topics: result.answers.reduce<Record<string, [number, number]>>((t, a) => {
        const [c, n] = t[a.question.topic] ?? [0, 0]
        t[a.question.topic] = [c + (a.correct ? 1 : 0), n + 1]
        return t
      }, {}),
    })
    sync()
  }

  const RECENT_LIMIT = 800 // roughly a full day of play

  function rememberQuestions(keys: string[]) {
    const s = state.value
    s.recent = [...s.recent.filter((k) => !keys.includes(k)), ...keys].slice(-RECENT_LIMIT)
  }

  // Placeholder until MTN MoMo / Airtel Money are wired in: only used by the dev-only button.
  function activatePass(plan: PassPlan) {
    const days = { day: 1, week: 7, month: 30 }[plan]
    state.value.pass = { plan, expiresAt: new Date(Date.now() + days * 864e5).toISOString() }
  }

  // ---------- server ----------

  async function ensureRegistered(): Promise<PlayerAuth | null> {
    const s = state.value
    if (!s.profile) return null
    if (auth.value && !s.profileChanged) return auth.value
    let r
    try {
      r = await api.registerPlayer({ device_id: s.deviceId, ...s.profile }, auth.value ?? undefined)
    } catch (e) {
      // this device id belongs to a player whose token we no longer have (e.g. the server's copy
      // was reset): carry on as a new player; progress saved on this device is kept
      if (!(e instanceof ApiError && e.status === 409)) throw e
      s.deviceId = newId()
      s.serverId = null
      s.serverToken = null
      r = await api.registerPlayer({ device_id: s.deviceId, ...s.profile })
    }
    s.serverId = r.id
    s.serverToken = r.token
    s.summary = r
    s.profileChanged = false
    return auth.value
  }

  let syncing: Promise<void> | null = null
  function sync(): Promise<void> {
    syncing ??= (async () => {
      const s = state.value
      try {
        if (!(await ensureRegistered())) return
        while (s.pending.length) {
          s.summary = await api.saveSprint(auth.value!, s.pending[0])
          s.pending.shift()
        }
        while (s.pendingMocks.length) {
          s.mockHistory = await api.saveMock(auth.value!, s.pendingMocks[0])
          s.pendingMocks.shift()
        }
        while (s.pendingBoss.length) {
          await api.saveBoss(auth.value!, s.pendingBoss[0].damage, s.pendingBoss[0].played_at)
          s.pendingBoss.shift()
        }
        while (s.pendingRaces.length) {
          await api.raceDone(auth.value!, s.pendingRaces[0])
          s.pendingRaces.shift()
        }
        if (!s.summary) s.summary = await api.me(auth.value!)
      } catch (e) {
        // a lost token (e.g. the server was reset): register again next time
        if (e instanceof ApiError && e.status === 401) s.serverToken = null
        // a sprint the server will never accept: drop it rather than block the queue
        if (e instanceof ApiError && (e.status === 422 || e.status === 404)) {
          // the first non-empty queue holds the item that was refused
          ;[s.pending, s.pendingMocks, s.pendingBoss, s.pendingRaces].find((q) => q.length)?.shift()
        }
        // otherwise offline or API down: keep the queue and try again later
      } finally {
        syncing = null
      }
    })()
    return syncing
  }

  /** Fetches this week's league table. Returns null when offline; `league` keeps the last table seen. */
  async function loadLeague(): Promise<League | null> {
    try {
      await sync()
      const a = await ensureRegistered()
      if (!a) return null
      league.value = await api.league(a)
      return league.value
    } catch {
      return null
    }
  }

  // ---------- who's playing now ----------

  const presence = ref<Presence | null>(null)
  let activity: string | null = null
  let beat: number | undefined

  /** Tells the server this child is here (and what they're playing); gets back who else is. */
  async function heartbeat() {
    try {
      const a = await ensureRegistered()
      if (!a) return
      presence.value = await api.presence(a, { activity, day_streak: dayStreak.value, badges: state.value.badges.length })
    } catch {
      // offline: keep the last picture
    }
  }

  function setActivity(a: string | null) {
    activity = a
    heartbeat()
  }

  /** Heartbeat every 45 s while the app is on screen. */
  function startPresence() {
    if (beat) return
    heartbeat()
    beat = window.setInterval(() => {
      if (document.visibilityState === 'visible') heartbeat()
    }, 45_000)
  }

  function recordRace(rivalId: number, won: boolean, r: SprintResult) {
    if (won) state.value.raceWins++
    state.value.pendingRaces.push({ rival_id: rivalId, won, subject: r.subject, grade: r.grade, level: r.level })
    // (sent by sync, which recordSprint runs straight after)
  }

  /** A boss fight's damage, queued so it isn't lost offline. */
  function recordBoss(damage: number, playedAt: string) {
    state.value.pendingBoss.push({ damage, played_at: playedAt })
    sync()
  }

  // ---------- PLE mock exams ----------

  /** Saves a finished mock (queued if offline) and adds it to the local history straight away. */
  function recordMock(m: MockPayload) {
    const s = state.value
    s.totalPoints += m.correct * 10
    s.pendingMocks.push(m)
    const percent = Math.round((m.correct / m.total) * 100)
    const mocks = [{ id: -Date.now(), grade: m.grade, correct: m.correct, total: m.total, percent, minutes_used: m.minutes_used, taken_at: m.taken_at }, ...(s.mockHistory?.mocks ?? [])]
    const last = mocks.slice(0, 3)
    s.mockHistory = { mocks, readiness: Math.round(last.reduce((t, x) => t + x.percent, 0) / last.length) }
    // (topic mastery and the try-again box are updated per answer, through noteAnswer)
    sync()
  }

  async function loadMocks() {
    try {
      await sync()
      const a = await ensureRegistered()
      if (a && !state.value.pendingMocks.length) state.value.mockHistory = await api.mocks(a)
    } catch {
      /* offline: keep the last copy */
    }
    return state.value.mockHistory
  }

  // ---------- classes and homework ----------

  const classes = ref<MyClass[]>([])

  /** Loads my classes and homework; keeps the last list when offline. */
  async function loadClasses() {
    try {
      const a = await ensureRegistered()
      if (a) classes.value = (await api.myClasses(a)).classes
    } catch {
      /* offline */
    }
    return classes.value
  }

  /** Homework not yet done and not more than a week overdue. */
  const homeworkToDo = computed(() => classes.value.flatMap((c) => c.homework.filter((h) => !h.done).map((h) => ({ ...h, className: c.name }))))

  function resetAll() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    state.value = load()
  }

  return {
    state,
    lastResult,
    league,
    profile,
    auth,
    hasPass,
    freeLeft,
    canPlay,
    power,
    nextPowerIn,
    fullPowerIn,
    unlimitedPower,
    outOfPower,
    spendPower,
    starsOf,
    isUnlocked,
    setProfile,
    startSprint,
    rememberQuestions,
    recordSprint,
    activatePass,
    sync,
    loadLeague,
    resetAll,
    level,
    title,
    dayStreak,
    playedToday,
    goalDone,
    goalPct,
    presence,
    heartbeat,
    setActivity,
    startPresence,
    recordRace,
    recordBoss,
    noteAnswer,
    recordMock,
    loadMocks,
    classes,
    loadClasses,
    homeworkToDo,
    topicsFor,
    weakTopics,
    dueReview,
    openLevels,
  }
})
