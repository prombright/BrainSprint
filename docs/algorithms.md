# Algorithms

This is the heart of BrainSprint: how questions are made, how a sprint is put together, how points,
mastery, reviews, mocks and leagues are worked out, and why each rule is the way it is.

Every number below is a constant in the code. When you change one, change this page too.

| Algorithm | Where it lives |
|---|---|
| [1. Template Engine](#1-template-engine-procedural-question-generation) | `frontend/src/game/maths.ts`, `maths-upper.ts`, `english.ts`, `mathskit.ts`, `random.ts` |
| [2. Sprint assembly](#2-sprint-assembly) | `frontend/src/game/sprint.ts` (`makeSprint`), `stores/player.ts` (`rememberQuestions`) |
| [3. Scoring and stars](#3-scoring-and-stars) | `frontend/src/game/scoring.ts`, `views/SprintView.vue` |
| [4. Brain Power](#4-brain-power) | `frontend/src/game/scoring.ts`, `stores/player.ts` |
| [5. Topic mastery](#5-topic-mastery) | `frontend/src/game/practice.ts`, `api/learning.php` |
| [6. Spaced repetition (try-again box)](#6-spaced-repetition-the-try-again-box-leitner-system) | `frontend/src/game/practice.ts` |
| [7. Weak-spot practice builder](#7-weak-spot-practice-builder) | `frontend/src/game/practice.ts` (`buildPractice`) |
| [8. PLE mock builder and readiness](#8-ple-mock-builder-and-readiness) | `frontend/src/game/mock.ts`, `api/learning.php` |
| [9. Weekly leagues, live rank and race ghosts](#9-weekly-leagues-live-rank-and-race-ghosts) | `api/leagues.php`, `lib/league.ts`, `api/social.php`, `views/SprintView.vue` |
| [10. Question bank in the game](#10-the-question-bank-in-the-game) | `frontend/src/game/sprint.ts` (`registerBank`), `lib/bank.ts`, `api/bank.php` |
| [11. Server-side anti-cheat](#11-server-side-anti-cheat-checks) | `api/index.php` (`POST /sprints`), `api/learning.php`, `api/community.php` |
| [12. Weekly Boss Battle](#12-weekly-boss-battle) | `frontend/src/game/boss.ts`, `api/community.php` |
| [13. Player level, titles and badges](#13-player-level-titles-and-badges) | `frontend/src/game/progress.ts`, `badges.ts` |
| [14. Fact Engine](#14-fact-engine-fact-table-question-generation) | `frontend/src/game/facts.ts`, `api/facts.php` |
| [15. Paper Engine (server-marked competitions)](#15-paper-engine-server-marked-competitions) | `frontend/scripts/export-pool.ts`, `api/compete.php` |

---

## 1. Template Engine (procedural question generation)

**What it is.** Maths and English (Top Class to P7) questions are not stored
anywhere. Each question is *built on the device* by a small function called a **template**. A
template picks random numbers (or random words from a hand-picked list), writes the question text,
computes the right answer, makes believable wrong choices and, for most of them, writes the worked
steps. There are about 30 templates in `maths.ts` (Top Class to P3), 50 in `maths-upper.ts` (P4 to P7)
and 12 in `english.ts`.

Every template returns a `Question` (see `game/types.ts`):

| Field | Meaning |
|---|---|
| `topic` | e.g. `fractions`, `word problem`; used by mastery, practice, homework and reports |
| `prompt` / `speak` | the text shown, and the text read aloud (they can differ) |
| `visual`, `big` | optional emoji picture, or a big letter/number/sequence |
| `choices`, `answer` | 2 to 4 choices; the answer is always one of them |
| `steps` | optional worked solution, shown after a wrong answer |
| `extraSeconds` | added to the level's time for long questions (word problems) |

### A worked example

`wordShare([3, 4, 5, 6])` from `maths.ts`, used in P3 Pro:

1. Pick a thing (`🥭 mangoes`), a number of children from the list (`4`) and how many each gets (`randInt(2, 10)` → `7`).
2. Build the numbers *backwards from the answer*: total = 4 × 7 = 28. This guarantees a whole-number answer.
3. Text: *"28 mangoes are shared equally among 4 children. How many does each child get?"*
4. Answer `7`. Wrong choices from `numberChoices(7)`: nearby numbers such as 6, 9, 5.
5. Steps: `"Shared equally" means we divide.` → `28 ÷ 4 = 7` → `Check: 4 × 7 = 28 ✓`.
6. `extraSeconds: 10`, because reading a story takes longer than reading `28 ÷ 4`.

Building backwards from the answer is the common pattern: division, missing numbers, "think of a
number", ages, heads-and-legs and coin puzzles all choose the answer first and derive the question from it,
so there are never remainders, negative results or impossible puzzles.

### Believable wrong choices

A multiple-choice question is only as good as its wrong answers. Two helpers in `random.ts` do this:

- **`numberChoices(answer, step = 1, min = 0)`**: collects answer ± 1·step … ± 4·step, plus answer ± 10
  when `step` is 1 and the answer is 10 or more (the "off by ten" slip, e.g. forgetting to carry).
  It drops anything below `min`, picks 3 at random, adds the answer and shuffles.
  The `step` matters: `mul(tables, …)` passes the times table as the step, so for 7 × 6 = 42 from the
  6 times table (P3 Medium) the wrong choices come from 36, 48, 30, 54… : the answers a child gets by counting
  one group too many or too few, not random noise.
- **`choicesFrom(answer, wrong)`**: picks up to 3 distinct wrong options from a pool of *typical
  mistakes* the template supplies. Examples:
  - Clock: for "half past 3" the pool is "3 o'clock", "half past 4", "half past 1", "4 o'clock".
  - Plurals: for "child" the pool is "childs", "childes", "childies", "children" … built by applying the
    regular rules to irregular words.
  - Spelling (`misspell` in `english.ts`): drop a letter, swap two letters, double a letter, or swap a vowel.
  - Opposites: never offers a wrong choice that means nearly the same as the answer (the `SIMILAR` groups).
    For "the opposite of *tall*" (answer *short*), *small* and *little* are left out, because a child who picks
    them isn't really wrong.
  - First sounds: `lettersExcept` never offers both `c` and `k` (they sound the same at the start of a word).
  - Picture words: wrong words have the same length, so the child must read rather than guess by length.

`english.ts` has its own small copy of `choicesFrom`; it behaves the same apart from not filtering empty strings.

### Plans: what each class and level practises

At the bottom of each engine file is a **plan**: for every class and each of the four levels, the list of
templates that level draws from.

```ts
P3: {
  simple: [add(99, 99), sub(99), mul([2, 3, 4, 5], 10), oddEven(200), clock(true)],
  medium: [add(500, 400, 100), sub(999, 100), mul([2..10], 10), placeValue(), measures()],
  hard:   [div(...), wordMul(...), money(...), fractionOf([2, 4], 40), smallRoman(20), change([500, 1000])],
  pro:    [mixed(), fractionOf([2, 3, 4], 90), money(...), missingMul(...), wordShare(...), change(...)],
}
```

The arguments set the difficulty (number sizes, which tables, which fractions), so the same template
serves several classes. `sprint.ts` joins the plans into one table: `PLANS = { maths, english }`, where
`MATHS_PLAN` is `maths.ts`'s Top–P3 plan merged with `UPPER_MATHS_PLAN` (P4–P7, following the Uganda
primary syllabus and PLE topics). A subject is playable for a class when that class has a plan
(`hasQuestions(subject, grade)`).

### Why generated instead of stored

- **Practically endless.** A stored list runs out; a child who plays all day would start seeing repeats. Most
  Maths levels from P1 up produce 5,000 to 13,000+ different questions (measured, see below).
- **No storage and no download.** The whole engine is a few hundred kilobytes of code. Nothing to fetch, nothing to
  keep in sync, works on cheap phones with no data bundle.
- **Fully offline.** Questions are made on the phone, so a sprint never waits for the network.
- **Always correct.** The answer is computed, not typed, so there are no typos in answers; the steps are computed
  from the same numbers.
- **Cheap to extend.** A new skill is one function and one line in a plan.

The trade-off: some subjects (Science, SST, upper-primary English) are knowledge, not computation, and can't be
generated this way. Those come from the human-written [question bank](#10-the-question-bank-in-the-game) and from the
[Fact Engine](#14-fact-engine-fact-table-question-generation), which generates questions from checked fact tables.
See also [decision 1](decisions.md#adr-001-generated-questions-for-maths-instead-of-a-stored-bank).

### The quality check: `npm run check:questions`

`frontend/scripts/check-questions.ts` exercises every generated subject, class and level. For each level it builds
20,000 questions (2,000 sprints of 10; the number can be passed as an argument) and:

- fails the run if the answer is not among the choices, choices repeat, there are fewer than 2 or more than 4
  choices, or any text contains `NaN`, `Infinity` or `undefined`;
- fails if a P4–P7 Maths question has no steps;
- fails if a question has steps whose text (commas removed) does not contain the answer. This is how
  "the steps reach the answer" is checked: it is a text check, not a proof, but it catches steps built from
  the wrong variable;
- reports how many **different** questions it saw (by question key): `∞` when at least 90% of the 20,000 were
  different, `✓` when more than 500 (about a full day of play: 8 hours × 6 sprints an hour × 10 questions),
  `⚠` when fewer, meaning a child would see repeats within a day.

Top Class levels show `⚠` by design: "count up to 5 mangoes" only has so many forms. The recent-question memory
(next section) lets old ones back in for those levels.

It does not test bank questions (they come from the server); `cleanQuestion` in `api/bank.php` checks those.

---

**English P4–P7** (`english-upper.ts`) uses the same idea for upper-primary grammar: plurals (with each spelling
rule), past tense and past participles (60 irregular verbs, 21 regular ones grouped by how -ed is spelt), comparing
(-er/-est, more/most, good/better/best), adverbs, masculine and feminine, young ones of animals, collective nouns,
contractions, the apostrophe for owning (the boy's, the boys', the children's), alphabetical order, question tags,
nouns and adjectives made from other words, and one word for many. Every question has exactly one right choice:
wrong choices break the rule ("goed", "biger", "do'nt"), and where a broken form could be a real word ("seed",
"goodly", "beauteous"), the wrong choices are written by hand. Words that could also be right are kept out of the
wrong choices (a swarm or a colony of bees; a crowd of pupils). Each question explains its rule.

**English in sentences** (`english-sentences.ts`, P2–P7): choose the right verb form inside a real sentence. 33
verbs (every form: base, -s, past, -ing, past participle) × 26 kinds of person (Amina, he, the children, I, you …) ×
sentence endings × eight patterns (every day, yesterday, now, tomorrow, did not, has/have, the helping verb is/are/am,
and Does/Do questions) give tens of thousands of different questions, each right by the rules of agreement and tense.

**Reading comprehension** (`english-stories.ts`, P3–P7): the app writes a short story (a trip to the market, a sports
day, a child's home and farm, a school trip) from lists of Ugandan names, towns, foods, crops and places, and asks one
question whose answer is in the text (who, what, where, when, how many). Wrong choices are the same kind of thing,
including names and numbers from elsewhere in the story, so the child has to read rather than guess. The story is
stored in the question's `passage` and shown above it, with extra reading time (about a second per 12 letters, up to
45 s). Because the story is part of the question's fingerprint (`questionKey`), different stories with the same
question are different questions.

With these, English P3–P7 levels make thousands of different questions each (Top Class–P2 stay smaller: letters
and first words are a short list by nature).

## 2. Sprint assembly

A **sprint** is 10 questions (`QUESTIONS_PER_SPRINT`) from one subject, class and level.
`makeSprint(subject, grade, level, count, recent)` in `sprint.ts` builds it:

```
repeat until we have `count` questions, at most count × 60 tries:
  pick a random template from the level's plan and run it
  key = prompt | big | visual          (questionKey)
  if key already in this sprint and tries < count × 40:   skip
  if key already in this sprint and this is a bank subject: stop (shorter sprint)
  if key in `recent` and tries < count × 20:               skip
  keep it
```

- **No repeats inside a sprint**, as long as the level has enough variety (the first 400 tries).
- **Recent memory.** `recent` is the list of question keys the child saw in earlier sprints, kept on the device
  (`state.recent`), capped at the last **800** keys (`RECENT_LIMIT`, roughly a full day of play).
  Questions are remembered when the sprint *starts* (`rememberQuestions`), so quitting doesn't reset it.
- **Graceful fallback.** The limits are staged: after 200 tries recently-seen questions are allowed back, after 400
  in-sprint repeats are allowed (generated subjects only). Small levels therefore still produce a full sprint
  instead of hanging or coming back empty.

Example: Top Class Simple ("count 1 to 5", "tap the number", …) has only a few hundred different questions. A
child who has played it a lot has most of them in `recent`; the first 200 tries skip them and find the few fresh ones,
then old ones are let back in to fill the sprint.

`sampleQuestions(...)` is a sibling used by practice and mocks: it draws from several levels at once and accepts only
topics that pass a filter, giving up after 3,000 tries (so it can return fewer than asked).
`topicsOf(...)` runs each template 4 times to list the topic names a class can produce (used for the topic lists
in Progress and in the teacher's homework form).

---

## 3. Scoring and stars

### Points for one answer

`pointsFor(correct, msTaken, msAllowed, streak)`:

| Part | Rule |
|---|---|
| Base | 10 for a correct answer |
| Speed bonus | `round(10 × time left ÷ time allowed)`, 0 to 10 |
| Streak bonus | +5 when this is the 3rd (or later) correct answer in a row |
| Wrong or out of time | **0**, and the streak resets |

So one answer is worth at most 25 points, and a 10-question sprint at most 250.

**Time allowed** per question is the level's time (Simple 20 s, Medium 15 s, Hard 12 s, Pro 10 s), plus the
question's `extraSeconds`, and **doubled for Top Class** (nursery children).

Example (Medium, 15 s): a correct answer after 6 s leaves 9/15 = 60% of the time → speed bonus 6 → 16 points.
If it is the 4th right answer in a row, 21 points.

**Why wrong answers earn 0.** If a wrong answer earned anything, tapping randomly and fast would pay. With 0
for wrong and a bonus that only exists on correct answers, the best strategy is always to think and answer right.
The streak bonus rewards accuracy over a run, not one lucky tap. Combined with [Brain Power](#4-brain-power),
random tapping actively ends the game sooner.

### Stars

`starsFor(correct, total)`: 90%+ → 3 ⭐, 70%+ → 2 ⭐, 50%+ → 1 ⭐, otherwise 0. The sprint screen passes the number of
questions the sprint *was built with* as `total`, not the number answered, so a sprint cut short by Brain Power
can't earn 3 stars from 2 answers. A level keeps its best stars ever. A level **unlocks** when the level before it
has 2 stars (`STARS_TO_UNLOCK`). Boss, practice and homework sprints don't change level stars.

---

## 4. Brain Power

**What it is.** ⚡ Brain Power is a meter of 25 (`BRAIN_POWER_MAX`). Every **wrong** answer uses 1. One comes back
free every **15 minutes** (`BRAIN_POWER_REFILL_MINUTES`), so empty to full takes 25 × 15 = 375 minutes, about 6¼ hours.
At 0 the current sprint ends after that answer and new sprints are blocked (the router sends the child to the
Power screen with a countdown). A Sprint Pass (future, bought by a parent) makes it unlimited. PLE mocks don't use it.

### The refill maths

Only two numbers are stored: `power = { value, at }`, "Brain Power was `value` at time `at`". Nothing ticks in
the background; the current value is computed whenever it's needed:

```
power now  = min(25, value + floor((now − at) / 15 min))
```

When a wrong answer spends one (`spendPower`):

```
refills = floor((now − at) / 15 min)
current = min(25, value + refills)
at'     = now                       if current was already full (the refill clock starts now)
        = at + refills × 15 min     otherwise (keep the partial progress towards the next refill)
value'  = max(0, current − 1)
```

Example: `{ value: 10, at: 09:00 }`. At 09:40 the meter shows 10 + floor(40/15) = 12. A wrong answer at 09:40 stores
`{ value: 11, at: 09:30 }`, so the next ⚡ still arrives at 09:45, not 09:55. The child never loses the time already
waited.

Because it is computed from timestamps, it works offline, survives the app being closed, and needs no server.

### Why it exists

- **Healthy breaks.** A child who is getting most answers wrong is tired or guessing. Running out of power means
  "take a break"; it refills while they do something else.
- **Anti-guessing.** Guessing costs power and earns nothing (see scoring).
- **A safe economy.** Points (XP) are only ever earned by answering correctly, and can never be bought. Money (a
  future Sprint Pass, bought by a parent) only buys *more time to practise*, never points, rank or prizes. There is
  nothing to win by paying, and nothing a child can lose that money brings back, so it is not gambling and not
  pay-to-win. See [decision 3](decisions.md#adr-003-a-safe-economy-brain-power-points-never-bought-sponsored-prizes).

---

## 5. Topic mastery

**What it is.** For every class + subject + topic (e.g. `maths:P5:fractions`) the app keeps how the child has done
**recently**, and turns that into a mastery percentage and a label.

On the device (`practice.ts`), each `TopicStat` holds lifetime `correct`/`total` and `recent`: the last
**20** answers as 1s and 0s (`RECENT`). After every answer `addResult` appends and keeps the last 20.

```
mastery = round(100 × (right answers in recent) ÷ (answers in recent))
label   = 'new'    if total < 5          (MIN_ATTEMPTS: don't judge on fewer)
          'weak'   if mastery < 70       (WEAK_BELOW)
          'ok'     if mastery < 85       (STRONG_FROM)
          'strong' otherwise
```

Example: 1 right out of the first 5 → 20%, weak. Then 20 right in a row → the old misses fall out of the window,
mastery 100%, strong (lifetime total 25). This is exactly what `npm run check:practice` asserts.

**Why a sliding window.** A lifetime average punishes a child forever for early mistakes; a child who has
*now* learnt fractions should see "strong". 20 answers is about two sprints on one topic: long enough not to flip on
one slip, short enough to notice improvement within a day or two. Waiting for 5 answers avoids calling a topic weak
after one bad question.

**On the server** (`recordTopics` in `api/learning.php`) each sprint sends per-topic counts
(`{"fractions": [3, 4]}`: 3 right of 4 asked). The server doesn't store individual answers, so it keeps
`recent_correct` / `recent_total` and *approximates* the window: when adding `t` new answers would exceed 20, it
scales the old counts down to `20 − t` answers before adding the new ones.

Example: stored 15/20; a sprint brings 3/4 → old part scaled to 15 × 16/20 = 12 of 16, plus 3/4 → 15/20 = 75%.

The server copy feeds parents' "needs work / strengths" (up to 3 each, same 70/85 thresholds, judged after 5 answers)
and the teacher's class topic table. The two copies use the same thresholds but the server's window is an
approximation, so the device and the dashboards can differ by a few percent.

---

## 6. Spaced repetition: the try-again box (Leitner system)

**What it is.** Every question a child gets wrong goes into a **try-again box** and comes back later, at growing
intervals, until it has been answered right several times. This is the Leitner system: flash cards move up through
numbered boxes, and each box is reviewed less often.

`updateCard` in `practice.ts`, after every answer in any sprint or mock:

| Situation | What happens |
|---|---|
| Wrong, not in the box | Added in box 0, due in **1 day** |
| Wrong, already in the box | Back to box 0, due in 1 day |
| Right, not in the box | Nothing |
| Right, in the box but **not yet due** | Nothing (reviewing early doesn't count) |
| Right, in the box and due | Moves up a box: due again in **3**, then **7**, then **14** days |
| Right in box 3 when due | Learnt: removed from the box |

The intervals are `INTERVALS = [1, 3, 7, 14]` days, indexed by box. A question needs four on-time right answers
(after roughly 1 + 3 + 7 + 14 = 25 days) to leave the box. The box holds at most 60 cards (`REVIEW_LIMIT`); when a new
miss would exceed that, the oldest card is dropped. Cards are stored on the device with the full question, so the
exact same question (same numbers) comes back.

Due cards (`dueCards`) are those for the class + subject whose `due` time has passed. They are served by
[practice sprints](#7-weak-spot-practice-builder).

**Why.** Memory research consistently shows that reviewing just as you're about to forget is the most efficient way
to make something stick, and that growing gaps beat cramming. The Leitner system is the simplest form of it: no
per-card difficulty maths, easy to explain to a teacher ("missed questions come back tomorrow, then in 3 days, then a
week, then two weeks"), and cheap to run on a phone. "Early answers don't count" stops a card being cleared by
seeing it twice in one evening.

---

## 7. Weak-spot practice builder

`buildPractice({ subject, grade, levels, weak, topic?, due })` makes a 10-question **practice sprint**:

1. **Reviews first:** up to **4** random due cards from the try-again box (skipped when one topic is chosen).
2. **Focus:** questions from the child's **weak topics** (or the single `topic` asked for), drawn by
   `sampleQuestions` from the given levels, avoiding the review questions.
3. **Top-up:** if there aren't enough, any question from those levels.
4. The reviews come first; the focus and top-up questions are shuffled together after them.

Which levels: for "Practise my weak spots" it is the levels the child has **unlocked** (so practice never jumps
ahead of what they've opened); for topic homework from a teacher it is all four levels. Practice sprints run on
Medium timing (15 s), are saved with level `mixed`, and don't change level stars.

Example (`check:practice`): P5 Maths, weak topics fractions and decimals, 6 cards due → 4 reviews + 6 fraction/decimal
questions. Asking for one topic, `algebra`, gives 10 algebra questions. A weak topic that doesn't exist in the open
levels is topped up to 10 from other topics.

**Why.** Children (and parents) don't know what to practise. Aiming practice at the weakest topics, with yesterday's
mistakes mixed in, turns the mastery and review data into action in one tap.

---

## 8. PLE mock builder and readiness

**What it is.** For P6 and P7, a **mock** is a 30-question Maths paper (`MOCK_QUESTIONS`) with one 45-minute timer
for the whole paper (`MOCK_MINUTES`), like the Primary Leaving Examination. Answers can be changed and are only
marked at the end, with working shown for every miss.

`buildMock(grade)` in `mock.ts` draws from three **sources**:

| Paper | Source | Questions |
|---|---|---|
| P7 | P7 Hard + Pro | 18 |
| | P7 Medium | 6 |
| | P6 Hard + Pro (revision from the year below) | 6 |
| P6 | P6 Hard + Pro / P6 Medium / P5 Hard + Pro | 18 / 6 / 6 |

**Topic caps.** No topic may take more than **3** questions, so the paper covers the syllabus instead of being
20 word problems. For each source it asks `sampleQuestions` for 3× as many candidates as it needs, keeps those whose
topic is under the cap, and if the source still runs short it loosens the cap to 4, then 6. No question repeats.
The result is shuffled.

Finishing a mock gives 10 XP per correct answer (into the total and the week's league), updates topic mastery and the
try-again box for every question, and saves the result (queued if offline).

### Readiness

**Readiness = the average percentage of the last 3 mocks** (computed the same way on the device and in
`mockHistory` on the server). It is shown with a band:

| Readiness | Band |
|---|---|
| 80%+ | Excellent |
| 65–79% | Good |
| 50–64% | Getting there |
| below 50% | Needs work |

**Why the last 3.** One paper is noisy (a bad day, a lucky set of topics). Three smooths that out but still moves
when the child improves. **Why bands, not UNEB grades:** the real PLE grade (Distinction 1, 2 …) depends on UNEB's
marking and all four subjects; claiming "you will get a D1" from a Maths-only practice paper would be misleading.
See [decision 11](decisions.md#adr-011-readiness-bands-instead-of-uneb-grades).

---

## 9. Weekly leagues, live rank and race ghosts

### Weeks run Monday to Sunday, Kampala time

PHP sets `Africa/Kampala` and MySQL `+03:00`. `weekStart()` is the date of "Monday this week". Everything weekly
(leagues, the boss, school ranking, "this week" for parents and teachers) keys on that date, so the week changes at
midnight Sunday in Uganda regardless of where the server is.

### Groups

A **league group** is up to **30** children (`LEAGUE_SIZE`) in the same **class** and **tier**
(0 Bronze, 1 Silver, 2 Gold, 3 Diamond, 4 Champion) for one week. Ranking inside a group is by this week's XP; ties go
to the lower player id (the child who joined earlier).

`ensureMembership(player)` runs the first time a child needs a group in a week (their first sprint or opening the
league screen):

1. **Apply last week's result** to the stored tier. If the child scored more than 0 XP last week:
   - rank 1–5 (`PROMOTE`) and not already Champion → up one tier (and a "moved up" feed item);
   - otherwise, if their group had at least 10 children, they were in the bottom 5 (`DEMOTE`) and not Bronze → down one tier.
   A child who didn't play last week, or scored 0, stays where they are.
2. **Find a group:** the *fullest* open group (size < 30) for this week + class + tier, inside a transaction
   (`FOR UPDATE`) so two children can't overfill it. If none exists, create one.
3. Add the child with 0 XP.

**Why fill the fullest group first:** in the early days most groups would otherwise be nearly empty; filling one
group before starting the next makes leagues feel busy. **Why demotion needs 10+ members:** in a group of 6,
"bottom 5" would be almost everyone. **Why same class:** a P1 child should never be ranked against a P7 child; the
tier then separates keen players from casual ones within a class.

Every accepted sprint and mock adds its points to this week's group XP (only if it was played this week; an old
offline backlog counts towards the lifetime total only).

### Live rank during a sprint

At sprint start the app fetches the league table. After each answer `liveRank(league, sprintScoreSoFar)`
(`lib/league.ts`) works out:

```
mine   = my week XP + points so far in this sprint
rank   = 1 + number of others with XP > mine
passed = the highest other player whose XP is ≤ mine but > my week XP before the sprint
```

When the rank improves, the sprint shows "You passed Amina! Now #4 🚀". It is purely local (no request per answer) and
uses the table as it was when the sprint started. On equal XP the child is shown ahead, which can differ from the
server's tie-break by player id.

### Race ghosts

From a player card a child can **race** another player on a level. The rival isn't online; a **ghost** plays their
part, based on how they really play. The server (`raceStats` in `api/social.php`) picks:

1. the rival's **best sprint** (highest score) on that subject, class and level; else
2. their **average** sprint anywhere; else
3. a fair **default**: 6 of 10 right, 90 points, 4.5–8 s per answer (demo players: 5–9 right).

The app (`SprintView.vue`) turns that into a ghost:

- `correct` and `finalScore` are scaled to a 10-question sprint; average time per answer at least 1.5 s.
- Which questions the ghost gets right is a random shuffle of `correct` trues and the rest falses.
- The ghost's clock only runs while the child is answering a question (not during feedback or worked steps), and it
  finishes one question every `avgMs`. Its displayed score grows by `finalScore ÷ correct` per right answer and ends
  exactly at `finalScore`.
- The race is won, lost or drawn by comparing the child's score with the ghost's `finalScore`. A win is posted to the
  feed and counts towards the Racer badges.

**Why a ghost:** real-time multiplayer needs both children online at once and a reliable connection, which most
Ugandan children don't have. A ghost gives the feel of racing a friend, offline-tolerant, against a fair copy of their
real pace and accuracy.

---

## 10. The question bank in the game

Subjects that can't be generated (Science and SST) come from the **question bank**: questions written
by people, stored in the `questions` table, and only sent to children once **approved** (see
[decision 9](decisions.md#adr-009-question-bank-with-human-approval)).

**Download and offline cache** (`lib/bank.ts`, run when the app opens and when the child's class changes):

1. Load any saved banks for the child's class from `localStorage` (`bsk:bank:<subject>:<grade>`) straight away, so
   play works offline.
2. In the background, `GET /questions/coverage?grade=` says which subject + class pairs have approved questions, and
   for the child's class the **content version** of each subject: the bank's version (latest `updated_at` and the
   approved count) and each approved fact set's `id@updated`, built by `contentVersion()` exactly as the app builds it.
3. If the saved copy already has that version, **nothing is downloaded**. Otherwise the app fetches
   `GET /questions?subject=&grade=` and `GET /facts?subject=&grade=` (approved
   [fact sets](#14-fact-engine-fact-table-question-generation)), saves the new copy and registers it. (Before this
   check the app downloaded everything on every start just to compare versions.) With **data saver** on, the app
   looks for new content at most once a day.
   **Sampling:** up to 400 approved questions are sent whole. Above that (`BANK_SAMPLE` in `api/bank.php`) the server
   sends a random 400 that stays the same all day (MySQL `RAND(seed)` with today's date as the seed, and the date in
   the version), so a phone downloads at most one new sample a day however big the bank grows
   ([ADR-018](decisions.md#adr-018-bank-downloads-by-daily-random-sample)).
4. A subject with no approved questions any more is forgotten.

**Plugging into plans** (`registerBank` in `sprint.ts`): the bank becomes a plan just like a generated subject, so
sprints, practice, homework, mastery and the try-again box all work with it unchanged.

- A class + subject opens once it has at least **4** approved questions (`BANK_MIN`).
- Generated plans always win: a bank never replaces Maths or English (so bank English questions are not used in sprints).
- **Borrowing levels:** each level has one "template" that picks a random question from a pool. While a level has
  fewer than **10** of its own questions, the pool is *all* of the class's questions in that subject, so a small bank
  still gives full sprints on every level.
- **Short sprints instead of repeats:** in `makeSprint`, a bank subject stops as soon as it would have to repeat a
  question, giving e.g. a 7-question sprint rather than one with a question twice. Stars are then out of 7.
- Choices are shuffled each time; long questions get extra reading time: `min(15, floor(prompt length ÷ 12))` seconds.

---

## 11. Server-side anti-cheat checks

The game runs on the child's device, so the server can't see the questions; it checks that each result is
*possible* (`POST /sprints` in `api/index.php`):

| Check | Rule |
|---|---|
| Identity | `X-Player-Id` + `X-Player-Token` must match the stored SHA-256 hash of the token |
| Size | `total` 1–50 questions; `correct` and `best_streak` ≤ `total` |
| Maximum score | `score` ≤ `total` × 25 (10 base + 10 speed + 5 streak per answer) |
| Speed | a scoring sprint with an average answer time under 250 ms is refused |
| Time | `played_at` must parse and be at most 5 minutes in the future |
| Duplicate | the same player + `played_at` again is accepted **once** (a retry after a dropped connection) |
| Too close | another sprint within 15 seconds of this one's `played_at` is refused |
| Topics | per-topic counts must be well-formed and add up to no more than `total`, or they are ignored |
| Old weeks | a sprint played in an earlier week adds to the lifetime XP only, not this week's league |
| News | only sprints played in the last hour create feed items |

The 15-second rule is checked against *when the sprints were played*, not when they arrived, so a phone uploading a
backlog of offline sprints isn't refused. The app drops a sprint the server refuses with 422 rather than retrying it
forever. Similar checks exist for mocks (10–30 questions, 1–60 minutes, no two within 10 minutes) and boss damage
(at most 300 = 12 × 25, best result per week kept).

These checks stop accidental double counting and casual tampering. They cannot stop a determined person who rewrites
the app and sends plausible numbers. That is acceptable while prizes don't exist; any competition with real prizes
must use **server-generated questions** marked on the server (on the [roadmap](roadmap.md)).

---

## 12. Weekly Boss Battle

One boss for everyone each week, chosen by counting weeks since 1970 from the Kampala Monday and cycling through six
bosses (`BOSSES` in `community.php` and `boss.ts`, which must stay in the same order). The app computes the same boss
offline. A boss fight is 12 Maths questions (6 Hard + 6 Pro from the child's class), the boss has 180 HP, every point
scored is damage, and the child has 3 hearts (a wrong answer loses one). The fight ends at 0 HP, 0 hearts or the last
question. The best damage per child per week is kept; the board shows the top 10 in the child's class.

---

## 13. Player level, titles and badges

- **Player level** from lifetime XP: level L needs `50 × (L − 1) × L` XP: 100, 300, 600, 1,000, 1,500 … Each level
  needs 100 XP more than the previous step, so early levels come quickly and later ones mark real effort.
- **Titles** by level: Seedling (1), Explorer (3), Thinker (5), Scholar (8), Genius (12), Legend (17). New avatar
  animals unlock at levels 2 to 20.
- **Badges** (`badges.ts`): rules checked after each sprint, e.g. Perfect 10 (all correct), On Fire (5 in a row),
  Lightning (8+ correct, average under 3 s), Every Day (7-day streak), Boss Slayer.
- **Day streak**: days in a row with at least one sprint; still alive today if the last sprint was yesterday.
  **Daily goal**: 3 sprints a day.

---

## 14. Fact Engine (fact-table question generation)

**What it is:** the second question generator, for subjects built on facts rather than sums (Science, SST, later
English vocabulary). People write a **fact set**, a small table of checked facts, plus a few **question patterns**.
The engine (`frontend/src/game/facts.ts`, function `factQuestion`) turns every fact × pattern into questions on the
device. The technique is often called *relational* or *knowledge-table* question generation.

**A fact set** (`content/fact-sets-starter.json`, table `fact_sets` + `facts`):

| organ | job | system |
|---|---|---|
| heart | pumps blood around the body | circulatory |
| kidneys | remove urea from the blood | excretory |
| … 13 more rows | | |

with patterns such as:

| Pattern | Answer column | Level |
|---|---|---|
| `Which part of the body does this job: {job}?` | organ | simple |
| `What is the work of the {organ}?` | job | medium |
| `The {organ} belongs to which body system?` | system | hard |
| `Which of these is NOT part of the {system} system?` (NOT pattern, grouped by `system`) | organ | pro |

and an explanation pattern, `The {organ}: {job}. Body system: {system}.`, shown as the worked step after a wrong
answer.

**How one question is made**

1. Pick a pattern for the level (or any pattern if the set has none for that level), then a row.
2. Fill the `{gaps}` from that row; the row's value in the answer column is the right answer.
3. **Wrong choices** are values of the same column from *other* rows, taking up to 3 different ones at random.
4. **NOT patterns** pick a group with at least 3 different members (e.g. three circulatory organs), show three of them,
   and make the odd one out (a row from another group) the right answer.
5. The explanation pattern is filled from the right answer's row.

**The safety rule (why every question is fair).** A generated question could have two right answers. For example,
with *cholera: dirty water* and *typhoid: dirty water* in one table, "Which disease is spread by dirty water?" has two.
So the engine:

- **refuses a pattern for a row** if another row fills the same gaps but has a different answer (`ambiguous`), and
- **never uses as a wrong choice** a value from a row that would also fit the question.

Fact sets are therefore written so each asked-about value is unique (the starter "diseases and vectors" table lists
one carrier per disease), and the admin editor shows how many questions were skipped as ambiguous.

**Checks before a set can be saved** (`checkFactSet` in the app, `cleanFactSet` in `api/facts.php`, same rules): 2–6
lowercase columns; every `{gap}` and answer column exists; a normal pattern must not show its own answer column
(it would give the answer away); at least 4 facts; no empty cells.

**How much it makes.** The 8 starter sets (87 facts, 19 patterns) make about 400 different question prompts, each
with changing wrong choices. `npm run check:facts` generates 2,000 questions per set and verifies the answer is
always a choice, no choice repeats, no gap is left unfilled, and no wrong choice could also be right.

**In the game.** Approved fact sets are downloaded with the class's bank questions (`GET /facts`), saved for offline
play, and mixed into every level of that class + subject alongside written questions (`registerBank` in
`sprint.ts`). A set covers a range of classes (`grade_from`–`grade_to`). The topic name is the set name (e.g.
"body organs"), so practice, homework and teacher reports work with fact questions unchanged.

**Two question types every table gets for free** (at Hard and Pro, about 4 in 10 questions; the server makes them
for papers too):

- **Which is correctly matched?** Four pairs from one pattern's two columns (e.g. disease — carrier), exactly one
  true. Each wrong pair is checked against every row, so it can never accidentally be true. Mixing four facts at a
  time, a table of 10 facts makes thousands of different questions. Different pairs with the same wording are told
  apart by a hidden `variant`.
- **What do these have in common?** Made from a NOT pattern: "Each of these is part of the ___ system: heart,
  arteries, veins." The three listed share the answer and never share a wrong choice.

`npm run check:facts` tests both: exactly one true pair, and the right shared group.

**Why this design:** an algorithm can do arithmetic but cannot invent facts. Here people decide what is true, once per
fact, and the algorithm multiplies that checked work into hundreds of questions with no risk of a made-up fact.
AI-drafted questions (on the [roadmap](roadmap.md)) would still need a human check; fact sets need one check per fact,
not per question. See [ADR-017](decisions.md#adr-017-fact-engine-checked-facts-turned-into-questions-by-an-algorithm).

## 15. Paper Engine (server-marked competitions)

**What it is.** The engine behind **School vs School** and **Duels**. Everywhere else in BrainSprint the phone makes
the questions and knows the answers, which is fine for practice. In a competition that would let a clever child (or
adult) read the answers out of the phone. So here the **server** builds the paper, keeps the answers, keeps the time
and does the marking. Nobody sees an answer until the competition is over.

**Step 1: the Paper Pool (at release time).** The server is plain PHP and cannot run the TypeScript generators. So
`npm run pool` (also run by `npm run release`) runs the [Template Engine](#1-template-engine-procedural-question-generation)
on the computer and saves **300 different questions per level** for every generated subject and class (Maths
and English Top–P7): 19,200 questions, about 4 MB, in `api/pool/<subject>-<grade>.json`. Every question is checked
on the way (answer among the choices, no repeated choices). The folder is not reachable from the web (`.htaccess` only
exposes `index.php`) and is not stored in git, because each release makes it fresh. Approved **bank** questions are
added to a class's pool from the database at paper time, and so are the questions of the class's approved
[fact sets](#14-fact-engine-fact-table-question-generation): `factPoolQuestions()` in `api/facts.php` is a PHP copy
of the Fact Engine with the same rules (every fair pattern × row, wrong choices from other rows, the ambiguity guard,
plus a few "Which is NOT …" questions per NOT pattern). A test checks that the server makes exactly the questions the
app makes. This is what lets Science and SST into competitions once their content is approved.

**Step 2: building a paper (`buildPaper`).**

| Rule | Value | Why |
|---|---|---|
| Questions | 20 (school contest), 10 (duel) | Long enough to be fair, short enough for one lesson |
| Time | 15 minutes (contest), 6 minutes (duel) from when the child starts | Roughly 45 and 36 seconds a question |
| Level mix | 20% Simple, 30% Medium, 30% Hard, 20% Pro | Everyone can answer something; the best still get separated |
| Order | Easiest first | A gentle start for nervous children |
| Repeats | None (same prompt + picture counts as the same question) | |
| Choices | Shuffled when the paper is made | |
| Mixed subject | Split evenly between the subjects that have enough questions | Needs at least two subjects |
| Enough questions | A subject needs 3× the paper's length in its pool for that class | So papers stay varied |

**Step 3: one go each, timed by the server.** When a child presses Start, the server records `started_at` and a
`deadline`: the paper's minutes, cut short by the competition's end. Pressing Start again (after a refresh) gives
the same deadline, so leaving does not pause the clock. The phone only shows the time left. The child's answers are
saved on the device as they go, so a dropped connection loses nothing. A hand-in is accepted until **2 minutes after
the deadline** (for slow networks), and only once.

**Step 4: marking.** The server counts the answers that match. The tie-break is the time used, measured by the
server's clock (start to hand-in, never more than the deadline).

**School result.** Each school's score is the **average percentage of its best 10 pupils** who handed in. A school
needs **at least 3** to count. Higher average wins; if level, the faster average time wins; if still level, it is a
draw. If only one school has 3, it wins; if neither does, there is no result. Each child sees their own score, their
place overall and in their school, whether they were in their school's counted 10, the top 10 overall, and their
paper with the answers and working.

**Who plays for a school.** Children who are in a teacher's BrainSprint class **for that year** at one of the two
schools. The teacher's class code is the gate, so a child cannot simply claim to be at a school. The side is saved
with the attempt, so moving school later does not change old results.

**Duel result.** Most correct wins; if level, the faster one wins. Friends in different classes get the younger
class's paper. Until both have handed in, a child sees only *that* their friend has played, never the score or the
answers. Otherwise the first player could pass the answers to the second. If the 48 hours run out first, there is no
winner.

**Weekly Challenge.** The third use of the engine: one paper per class per Kampala week (`weekly_challenges`),
built by the first child of that class who opens it, the same for every child in Uganda in that class. Mixed
subjects where the class has two with enough questions, otherwise the one it has; 20 questions, 15 minutes, one go,
any time from Monday to Sunday. During the week a child sees only their own score after handing in and how many have
played; on Monday last week's places, the top 10, the **top schools** (best 10, at least 3, approved schools only) and
their paper with the answers appear. A paper started late on Sunday can still be handed in just after midnight
(within its own deadline). Two children opening a new week at the same moment can't make two papers: the first one
saved wins (`INSERT IGNORE` on the week + class key) and the other is deleted.

**Class vs class.** The fourth use (`api/classcontests.php`): two to six classes of the same year at one school,
set up by any teacher of that school with no accept step. The paper is built when it is set up. Pupils play for
the first of their classes that is in it (`paper_attempts.class_id`). Classes are scored like schools (best 10, at
least 3), ranked by average then speed. A teacher of one of the classes, or whoever set it up, can call it off before
it starts. A school can set up 5 a week. Teachers see every class's score but only their own pupils' names
([ADR-023](decisions.md#adr-023-the-whole-school-view-shows-classes-not-pupils)).

**Limits against spam.** Each school can send 3 challenges a week, and two schools can have only one open challenge
between them at a time. A school can switch challenges off. Each child can start 5 duels a day, with one open duel per
pair of friends. Duels are only between friends (added by code, in person), and children never message each other.

**Why this design:** see [ADR-020](decisions.md#adr-020-competitions-are-built-timed-and-marked-by-the-server) and
[ADR-021](decisions.md#adr-021-a-schools-score-is-the-average-of-its-best-10).
