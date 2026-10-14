// Talks to the PHP API. The game is offline-first: every call may fail and
// the caller keeps its data locally until a later sync succeeds.
const BASE = import.meta.env.VITE_API_URL ?? '/brainsprint/api'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface PlayerAuth {
  id: number
  token: string
}

async function call<T>(method: 'GET' | 'POST', path: string, opts: { body?: unknown; player?: PlayerAuth; parentToken?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.player) {
    headers['X-Player-Id'] = String(opts.player.id)
    headers['X-Player-Token'] = opts.player.token
  }
  if (opts.parentToken) headers.Authorization = `Bearer ${opts.parentToken}`
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  } catch {
    throw new ApiError('No internet connection', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `Something went wrong (${res.status})`, res.status)
  return data as T
}

export interface PlayerSummary {
  id: number
  xp_total: number
  week_xp: number
  tier: number
  tier_name: string
  has_parent: boolean
}

export interface SprintPayload {
  subject: string
  grade: string
  level: string
  score: number
  correct: number
  total: number
  avg_ms: number
  best_streak: number
  played_at: string
  topics?: Record<string, [number, number]> // correct / asked per topic in this sprint
  assignment_id?: number // played as homework
}

export interface MockPayload {
  grade: string
  correct: number
  total: number
  minutes_used: number
  taken_at: string
  topics: Record<string, [number, number]>
}

export interface MockHistory {
  mocks: { id: number; grade: string; correct: number; total: number; percent: number; minutes_used: number; taken_at: string }[]
  readiness: number | null
}

export interface Homework {
  id: number
  title: string
  subject: string
  level: string | null
  topic: string | null
  due_on: string
  done: { correct: number; total: number } | null
}

export interface MyClass {
  id: number
  name: string
  grade: string
  teacher: string
  homework: Homework[]
}

export interface LeagueMember {
  rank: number
  id: number
  name: string
  avatar: string
  xp: number
  me: boolean
  online?: boolean
}

export interface League {
  week_start: string
  ends_at: string
  tier: number
  tier_name: string
  movement: number
  promote: number
  demote: number
  members: LeagueMember[]
}

export interface Parent {
  id: number
  name: string
  phone: string
}

export interface ChildReport {
  id: number
  name: string
  avatar: string
  grade: string
  xp_total: number
  tier_name: string
  league_rank: number | null
  league_size: number | null
  this_week: { sprints: number; correct: number; answered: number }
  subjects: { subject: string; sprints: number; correct: number; answered: number }[]
  recent: { subject: string; grade: string; level: string; score: number; correct: number; total: number; played_at: string }[]
  mock_readiness: number | null
  topics: {
    weak: { subject: string; grade: string; topic: string; total: number; mastery: number }[]
    strong: { subject: string; grade: string; topic: string; total: number; mastery: number }[]
  }
}

export interface PlayerCard {
  id: number
  name: string
  avatar: string
  grade: string
  xp_total: number
  week_xp: number
  tier: number
  tier_name: string
  day_streak: number
  badges: number
  sprints: number
  accuracy: number | null
  best_streak: number
  online: boolean
  activity: string | null
}

export interface FeedItem {
  id: number
  kind: string
  detail: string
  at: string
  player: { id: number; name: string; avatar: string; grade: string }
}

export interface Presence {
  online_total: number
  online_same_grade: number
  online: { id: number; name: string; avatar: string; grade: string; activity: string | null }[]
  feed: FeedItem[]
}

export interface RaceGhost {
  rival: PlayerCard
  stats: { source: string; score: number; correct: number; total: number; avg_ms: number }
}

export interface Friend {
  id: number
  name: string
  avatar: string
  grade: string
  xp_total: number
  week_xp: number
  day_streak: number
  online: boolean
  activity: string | null
}

export interface FriendsData {
  code: string
  friends: Friend[]
  added?: string
}

export interface School {
  id: number
  name: string
  district: string
  approved: boolean
  members?: number
  rank?: number
  xp?: number
  players?: number
}

export interface SchoolBoard {
  school: School | null
  board: { rank: number; id: number; name: string; district: string; players: number; xp: number }[]
  top_players: { id: number; name: string; avatar: string; grade: string; xp_total: number; week_xp: number; me: boolean }[]
  ends_at: string
}

export interface BossBoard {
  boss: { name: string; emoji: string; hp: number; week_start: string; ends_at: string }
  mine: { damage: number; defeated: boolean } | null
  defeated_by: number
  top: { id: number; name: string; avatar: string; damage: number; defeated: boolean; me: boolean }[]
}

// ---------- competitions (server-marked) ----------

export interface PaperQuestion {
  subject: string
  topic: string
  prompt: string
  speak: string
  visual?: string
  big?: string
  choices: string[]
  answer?: string // only once the results are out
  steps?: string[]
  picked?: string | null
}

export interface AttemptState {
  state: 'not_started' | 'started' | 'missed' | 'done'
  deadline?: string
  correct?: number
  total?: number
  seconds?: number
}

export interface SchoolSide { id: number; name: string; district: string }
export interface SchoolScore extends SchoolSide { players: number; counted: number; valid: boolean; average_percent: number; average_seconds: number }
export interface ContestPupil { rank: number; id: number; name: string; avatar: string; school_id: number; correct: number; seconds: number; me?: boolean }

export interface Contest {
  id: number
  phase: 'pending' | 'expired' | 'declined' | 'cancelled' | 'upcoming' | 'live' | 'finished'
  grade: string
  subject: string
  school_a: SchoolSide
  school_b: SchoolSide
  starts_at: string
  ends_at: string
  questions: number
  minutes: number
  my_school_id?: number | null
  mine?: AttemptState
  played_so_far?: number
  summary?: { winner_id: number | null; draw: boolean; schools?: SchoolScore[] }
  result?: {
    schools: SchoolScore[]
    winner_id: number | null
    draw: boolean
    top: ContestPupil[]
    my_rank: number | null
    my_school_rank: number | null
    counted: boolean
    entrants: number
  }
  review?: PaperQuestion[]
}

export interface Duel {
  id: number
  phase: 'open' | 'declined' | 'done' | 'expired'
  i_challenged: boolean
  grade: string
  subject: string
  other: { id: number; name: string; avatar: string }
  questions: number
  minutes: number
  expires_at: string
  mine: AttemptState
  they_played: boolean
  theirs?: AttemptState
  outcome?: 'won' | 'lost' | 'draw'
  review?: PaperQuestion[]
}

export interface CompeteData {
  contests: Contest[]
  duels: Duel[]
  duel_subjects: string[]
}

export interface WeeklyWeek {
  week_start: string
  grade: string
  subject: string
  questions: number
  minutes: number
  ends_at: string
  mine: AttemptState
  entrants: number
  result?: {
    top: (ContestPupil & { me: boolean })[]
    my_rank: number | null
    top_schools: { id: number; name: string; district: string; players: number; average_percent: number; average_seconds: number }[]
    my_school_rank: number | null
  }
  review?: PaperQuestion[]
}

export interface WeeklyData {
  this_week: WeeklyWeek | null
  last_week: WeeklyWeek | null
}

/** Where a paper lives: a school contest or duel (by id), or this week's Weekly Challenge. */
export type PaperKind = 'contests' | 'duels' | 'weekly'
const paperPath = (kind: PaperKind, id: number) => (kind === 'weekly' ? '/weekly' : `/${kind}/${id}`)

export interface PaperStart {
  questions: PaperQuestion[]
  seconds_left: number
  deadline: string
}

export const api = {
  compete: (player: PlayerAuth) => call<CompeteData>('GET', '/compete', { player }),
  contest: (player: PlayerAuth, id: number) => call<Contest>('GET', `/contests/${id}`, { player }),
  duel: (player: PlayerAuth, id: number) => call<Duel>('GET', `/duels/${id}`, { player }),
  newDuel: (player: PlayerAuth, friendId: number, subject: string) => call<Duel>('POST', '/duels', { player, body: { friend_id: friendId, subject } }),
  declineDuel: (player: PlayerAuth, id: number) => call<{ duels: Duel[] }>('POST', `/duels/${id}/decline`, { player }),
  weekly: (player: PlayerAuth) => call<WeeklyData>('GET', '/weekly', { player }),
  startPaper: (player: PlayerAuth, kind: PaperKind, id: number) => call<PaperStart>('POST', `${paperPath(kind, id)}/start`, { player }),
  submitPaper: (player: PlayerAuth, kind: PaperKind, id: number, picks: (string | null)[]) =>
    call<{ correct: number }>('POST', `${paperPath(kind, id)}/submit`, { player, body: { picks } }),
  mocks: (player: PlayerAuth) => call<MockHistory>('GET', '/mocks', { player }),
  saveMock: (player: PlayerAuth, m: MockPayload) => call<MockHistory>('POST', '/mocks', { player, body: m }),
  myClasses: (player: PlayerAuth) => call<{ classes: MyClass[] }>('GET', '/my/classes', { player }),
  joinClass: (player: PlayerAuth, code: string) => call<{ joined: { name: string; teacher: string }; classes: MyClass[] }>('POST', '/classes/join', { player, body: { code } }),
  leaveClass: (player: PlayerAuth, classId: number) => call<{ classes: MyClass[] }>('POST', '/classes/leave', { player, body: { class_id: classId } }),
  friends: (player: PlayerAuth) => call<FriendsData>('GET', '/friends', { player }),
  addFriend: (player: PlayerAuth, code: string) => call<FriendsData>('POST', '/friends', { player, body: { code } }),
  removeFriend: (player: PlayerAuth, friendId: number) => call<FriendsData>('POST', '/friends/remove', { player, body: { friend_id: friendId } }),
  searchSchools: (player: PlayerAuth, q: string) => call<{ schools: School[] }>('GET', `/schools?q=${encodeURIComponent(q)}`, { player }),
  addSchool: (player: PlayerAuth, name: string, district: string) => call<SchoolBoard>('POST', '/schools', { player, body: { name, district } }),
  joinSchool: (player: PlayerAuth, schoolId: number) => call<SchoolBoard>('POST', '/schools/join', { player, body: { school_id: schoolId } }),
  leaveSchool: (player: PlayerAuth) => call<SchoolBoard>('POST', '/schools/leave', { player }),
  schoolBoard: (player: PlayerAuth) => call<SchoolBoard>('GET', '/schools/board', { player }),
  boss: (player: PlayerAuth) => call<BossBoard>('GET', '/boss', { player }),
  saveBoss: (player: PlayerAuth, damage: number, playedAt?: string) => call<BossBoard>('POST', '/boss', { player, body: { damage, played_at: playedAt } }),

  /** Creates this device's player, or (with `player`) updates its name, animal or class. */
  registerPlayer: (p: { device_id: string; name: string; avatar: string; grade: string }, player?: PlayerAuth) =>
    call<PlayerSummary & { token: string }>('POST', '/players', { body: p, player }),
  me: (player: PlayerAuth) => call<PlayerSummary>('GET', '/players/me', { player }),
  saveSprint: (player: PlayerAuth, s: SprintPayload) => call<PlayerSummary>('POST', '/sprints', { body: s, player }),
  league: (player: PlayerAuth) => call<League>('GET', '/league', { player }),
  presence: (player: PlayerAuth, b: { activity: string | null; day_streak: number; badges: number }) => call<Presence>('POST', '/presence', { body: b, player }),
  card: (player: PlayerAuth, id: number) => call<PlayerCard>('GET', `/players/${id}/card`, { player }),
  race: (player: PlayerAuth, id: number, q: { subject: string; grade: string; level: string }) =>
    call<RaceGhost>('GET', `/race/${id}?subject=${q.subject}&grade=${q.grade}&level=${q.level}`, { player }),
  raceDone: (player: PlayerAuth, b: { rival_id: number; won: boolean; subject: string; grade: string; level: string }) => call<{ ok: true }>('POST', '/races', { body: b, player }),

  parentRegister: (b: { phone: string; pin: string; name: string }) => call<{ token: string; parent: Parent }>('POST', '/parents/register', { body: b }),
  parentLogin: (b: { phone: string; pin: string }) => call<{ token: string; parent: Parent }>('POST', '/parents/login', { body: b }),
  parentLogout: (parentToken: string) => call<{ ok: true }>('POST', '/parents/logout', { parentToken }),
  parentMe: (parentToken: string) => call<{ parent: Parent; children: ChildReport[] }>('GET', '/parents/me', { parentToken }),
  linkChild: (parentToken: string, player: PlayerAuth) => call<{ ok: true }>('POST', '/parents/children', { parentToken, player }),
  unlinkChild: (parentToken: string, playerId: number) => call<{ ok: true }>('POST', '/parents/children/unlink', { parentToken, body: { player_id: playerId } }),
}
