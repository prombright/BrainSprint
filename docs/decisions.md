# Decision log

Each entry records a choice that shapes the project: the situation (**Context**), what was chosen (**Decision**),
the reasons (**Why**) and what follows from it, good and bad (**Consequences**). When a decision changes, add a new
entry that replaces the old one rather than rewriting history.

| # | Decision |
|---|---|
| [001](#adr-001-generated-questions-for-maths-instead-of-a-stored-bank) | Generated questions for Maths instead of a stored bank |
| [002](#adr-002-offline-first-one-codebase-for-web-pwa-and-android) | Offline-first, one codebase for web, PWA and Android |
| [003](#adr-003-a-safe-economy-brain-power-points-never-bought-sponsored-prizes) | A safe economy: Brain Power, points never bought, sponsored prizes |
| [004](#adr-004-everything-free-for-now) | Everything free for now |
| [005](#adr-005-children-have-no-login-the-device-is-the-account) | Children have no login: the device is the account |
| [006](#adr-006-friends-only-by-code-no-chat-first-names-only) | Friends only by code, no chat, first names only |
| [007](#adr-007-teachers-only-see-pupils-who-joined-with-their-code) | Teachers only see pupils who joined with their code |
| [008](#adr-008-moderation-pending-schools-and-a-name-word-filter) | Moderation: pending schools and a name word filter |
| [009](#adr-009-question-bank-with-human-approval) | Question bank with human approval |
| [010](#adr-010-leagues-by-class-and-tier-groups-of-30) | Leagues by class and tier, groups of 30 |
| [011](#adr-011-readiness-bands-instead-of-uneb-grades) | Readiness bands instead of UNEB grades |
| [012](#adr-012-plain-php--mysql-on-cheap-shared-hosting-first) | Plain PHP + MySQL on cheap shared hosting first |
| [013](#adr-013-java-21-for-android-builds) | Java 21 for Android builds |
| [014](#adr-014-hash-routing) | Hash routing |
| [015](#adr-015-demo-players-only-through-local-config) | Demo players only through local config |
| [016](#adr-016-a-small-migration-runner) | A small migration runner |

---

## ADR-001: Generated questions for Maths instead of a stored bank

**Context.** Children play many short sprints a day. A fixed list of questions runs out, and every question in it
must be written, typed, checked and downloaded. Many target phones are cheap, with little storage and expensive data.

**Decision.** Maths and English (Top Class to P7) are generated on the device from templates
with random numbers or random picks from word lists. See [Template Engine](algorithms.md#1-template-engine-procedural-question-generation).

**Why.** Practically endless variety (thousands of different questions per level), nothing to store or download,
fully offline, answers computed rather than typed (so always right), worked steps computed from the same numbers,
and a new skill costs one function.

**Consequences.**
- Variety and correctness must be *tested*, not proof-read: `npm run check:questions` does that.
- Knowledge subjects (Science, SST, upper English) can't be generated this way and need the question bank
  ([ADR-009](#adr-009-question-bank-with-human-approval)) or the Fact Engine (in progress).
- The server never sees the questions, which limits anti-cheat (see [ADR-003](#adr-003-a-safe-economy-brain-power-points-never-bought-sponsored-prizes)).

## ADR-002: Offline-first, one codebase for web, PWA and Android

**Context.** Children use shared family phones, school tablets and laptops. Connections in Uganda are often slow,
intermittent or paid per megabyte. One founder must maintain everything.

**Decision.** One Vue + TypeScript project produces the website, an installable web app (PWA, with a service worker
that caches the game) and an Android app (Capacitor wraps the same build). All play happens on the device; results go
into a queue in `localStorage` and are synced when there is a connection.

**Why.** A sprint must never wait for the network. One codebase means one set of bugs and one place to add features.
The PWA works on any phone with no store; the Android app reaches families who expect the Play Store and gives a
downloadable APK.

**Consequences.**
- Progress lives on the device first; a lost or reset phone loses stars and the try-again box (XP and leagues are
  safe on the server).
- The server must accept late, out-of-order and repeated uploads (idempotent `played_at`, last-week sprints count
  only towards the total).
- Code must avoid browser-only assumptions (hash routing, relative paths, a `crypto.randomUUID` fallback for
  non-HTTPS LAN testing).

## ADR-003: A safe economy: Brain Power, points never bought, sponsored prizes

**Context.** Many games for children sell "lives", let players buy points or boosts, or charge to recover a lost
streak. With leagues and possible prizes, paying for points would make rankings pay-to-win, and paying to undo the
cost of a wrong answer is close to a bet: money staked on an uncertain outcome for a reward. Products aimed at children
must also meet app-store family rules.

**Decision.**
- **Brain Power** (25, one back every 15 minutes) is used only by wrong answers; it refills free.
- **Points (XP) are only earned** by answering correctly. They are never sold, gifted or restored for money.
- A future **Sprint Pass**, bought by a parent, only gives *unlimited Brain Power* (more practice time).
- **Prizes** for future competitions are sponsored, free to enter, and go to parents or schools, never cash to
  children.
- Before the first prize event, get a **legal check under Uganda's Lotteries and Gaming Act** (prize competitions can
  fall under gaming rules depending on how entry and winning work). The Android listing must follow **Google Play's
  Families policy** (apps for children: no real-money gambling or simulated-gambling mechanics, restricted ads and data
  collection, parental consent where required). This is not legal advice; it records what needs checking.

**Why.** It keeps the game about learning: rank reflects effort and skill, and money can't change it. Wrong answers
cost time, not money, which also discourages random guessing and nudges tired children to take a break.

**Consequences.** Less obvious revenue than selling lives or points. Revenue has to come from passes bought by
parents, school licences and sponsors. Server-side checks must make sure points really are earned
([anti-cheat](algorithms.md#11-server-side-anti-cheat-checks)); prize competitions will need server-generated
questions.

## ADR-004: Everything free for now

**Context.** The game is still being built, there are no payment integrations yet, and the first goal is real
children playing and coming back.

**Decision.** `PAYWALL_ENABLED = false` in `frontend/src/game/scoring.ts`. The daily limit of 3 free sprints and the
Sprint Pass screen are built but switched off (the router sends `/pass` home). Placeholder prices (UGX 500 a day,
2,500 a week, 8,000 a month) exist only on the hidden screen, and only a development build can "activate" a pass.

**Why.** Charging before the game has proved its value would block growth and feedback. Keeping the code in place
makes switching on a one-line change once MTN MoMo / Airtel Money are integrated.

**Consequences.** Brain Power is the only limit on play. The `subscriptions` and `payments` tables exist but are
unused. Turning payments on needs server-side pass checks (today a pass would be stored on the device only).

## ADR-005: Children have no login: the device is the account

**Context.** Young children can't manage passwords, and asking them for phone numbers or emails is wrong for privacy.

**Decision.** On first sync the device sends a random `device_id`; the server returns a random token, stores only its
SHA-256 hash, and the device sends `X-Player-Id` + `X-Player-Token` on every request. A parent account is optional
and links to the child by proving access to both the parent sign-in and the child's device.

**Why.** Zero friction to start playing, nothing personal collected from the child, and a stolen database doesn't
contain usable tokens.

**Consequences.** Clearing the browser or losing the phone loses access to that player; there is no recovery flow
yet. Re-registering the same `device_id` issues a new token (so the `device_id` itself must stay private; it is never
shown by the API).

## ADR-006: Friends only by code, no chat, first names only

**Context.** Any feature that lets strangers find or message children is a safety risk.

**Decision.**
- Friends are added only with a 6-character **friend code** told in person or shared from the app (letters chosen so
  0/O and 1/I/L can't be confused). There is no search for players and no friend requests from strangers.
- There is **no chat** and no free text between children. The only things one child sees about another are a name,
  an animal avatar, class, level, league, streak, badges and accuracy.
- Sign-up asks for a **first name or nickname** only, because other players see it.

**Why.** Children can still enjoy playing "with" friends (weekly friend ranking, races) without any channel a stranger
could use to contact them.

**Consequences.** Growth through social features is slower. Names must still be moderated
([ADR-008](#adr-008-moderation-pending-schools-and-a-name-word-filter)). Uganda's Data Protection and Privacy Act
should be reviewed before launch for how children's data is held.

## ADR-007: Teachers only see pupils who joined with their code

**Context.** Teachers need class reports, but any adult can create a teacher account.

**Decision.** A teacher creates a class and gets a 6-character join code. A teacher only ever sees children who typed
that code into the game (**📝 My Class**). Every teacher route checks the class belongs to the signed-in teacher.
Children can be in at most 3 classes and can leave a class themselves.

**Why.** The child (or their parent) chooses which teacher sees their data. A fake teacher account can't browse
children.

**Consequences.** Teachers must hand out codes, and a school-wide view needs a separate design (on the roadmap).

## ADR-008: Moderation: pending schools and a name word filter

**Context.** Children type names for themselves and for schools. Some will be rude, some will be jokes, and these
names are shown publicly.

**Decision.**
- A **word filter** (`looksRude` in `api/admin.php`) refuses clearly rude names for players and schools and checks bank
  questions. It looks only for words that never appear inside real names (so "Dickson" and "Hatega" pass), after
  undoing common tricks like `0` → `o` and `@` → `a`.
- New schools are **pending**: members still play for them and see them, but other children can't find or join them
  and they stay off the public ranking until an admin approves (or hides) them.
- Admins can rename any player, correct or hide schools, and delete feed items.

**Why.** A small automatic filter stops the worst at sign-up; a person handles the rest. Pending schools stop a fake or
offensive "school" reaching every child.

**Consequences.** Someone must check the admin panel regularly. The filter is deliberately small and will miss things.

## ADR-009: Question bank with human approval

**Context.** Science, SST and upper-primary English need written questions. Content may come from admins, teachers,
spreadsheets and, in future, AI drafts. A wrong fact taught to a child is worse than no question.

**Decision.** All bank questions live in the `questions` table with a status. Imports and teacher suggestions always
arrive as **drafts**; only an admin can **approve**; only approved questions are downloaded by the game. AI-drafted or
teacher-written content is always reviewed by a person. Starter content (`content/starter-science-sst.csv`) must be
checked by a teacher before approval.

**Why.** Keeps quality and accuracy in human hands while letting many people contribute.

**Consequences.** Review is a bottleneck; the admin panel provides coverage counts, filters and send-back notes to
manage it. A subject opens for a class only once it has 4 approved questions.

## ADR-010: Leagues by class and tier, groups of 30

**Context.** Competition motivates, but a P1 child can't compete with a P7 child, and a casual player shouldn't face
someone who plays all day.

**Decision.** Weekly leagues (Monday to Sunday, Kampala time) in groups of up to 30 children of the same class and
tier; top 5 move up, bottom 5 move down (only in groups of 10 or more). See
[leagues](algorithms.md#9-weekly-leagues-live-rank-and-race-ghosts).

**Why.** A small group gives a realistic chance of a top place; tiers sort children by effort over a few weeks; a
weekly reset gives everyone a fresh start.

**Consequences.** League XP rewards both speed and volume of correct play. Brain Power and anti-cheat checks keep it
from being only about volume.

## ADR-011: Readiness bands instead of UNEB grades

**Context.** P6 and P7 families care about the PLE. It's tempting to show "predicted grade: D1".

**Decision.** Show **readiness**: the average percentage of the last 3 mock papers, with a band (Excellent 80+, Good 65+,
Getting there 50+, Needs work).

**Why.** UNEB grades depend on official marking and all four subjects; a Maths-only practice paper generated by an app
can't predict them honestly. A percentage and plain-language band are true and still useful.

**Consequences.** Some parents will ask for a grade; the answer is that the band is guidance, not a prediction.

## ADR-012: Plain PHP + MySQL on cheap shared hosting first

**Context.** One founder, little money, and the most common affordable hosting in Uganda (and worldwide) is cPanel
shared hosting with PHP and MySQL.

**Decision.** A framework-free PHP 8 API (one front controller, a few helper files, prepared statements through PDO)
and MySQL. Deploy by uploading a zip (`npm run release`) and importing `database.sql` in phpMyAdmin if there's no
terminal. Move to a VPS at roughly 10,000 active children (see [data model](data-model.md#plan-to-scale)).

**Why.** Cheapest possible start, nothing to install, easy for any PHP developer to read, and the API is small enough
that a framework would add more than it saves.

**Consequences.** No background jobs (leagues are settled lazily when each child first appears in a new week), no
built-in caching, and hand-written routing and validation. These are fine at the current scale and are the first
things to revisit on a VPS.

## ADR-013: Java 21 for Android builds

**Context.** Capacitor's Android project uses a Gradle version that can't run on Java 25, which is what current
Android Studio ships.

**Decision.** Build Android with a separate **JDK 21** (`C:\Users\HP\.jdks\jdk-21.0.12.1+1`), set as `JAVA_HOME` for
`gradlew` or as the Gradle JDK in Android Studio.

**Why.** It is the supported long-term Java version for this toolchain.

**Consequences.** Anyone building the app must install JDK 21. Revisit when Capacitor / Gradle support newer Java.

## ADR-014: Hash routing

**Context.** The game must run from a web root, a sub-folder on XAMPP, and inside the Capacitor WebView.

**Decision.** Vue Router's hash history (`index.html#/league`) and relative asset paths (`base: './'`).

**Why.** Hash URLs need no server rewrite rules and behave identically everywhere, including in the app and when the
service worker serves the page offline.

**Consequences.** URLs contain `#`. Acceptable for a game; the public landing page (`site.html`) is a separate page with
normal URLs.

## ADR-015: Demo players only through local config

**Context.** Leagues, feeds and races look empty and are hard to test with one real player.

**Decision.** `api/dev/seed-demo.php` creates pretend players (`is_demo = 1`) and demo schools named "(demo)". They only
"come alive" (go online, score points, appear in the feed) when `api/config.local.php` sets `'demo_life' => true`.
`npm run release` never includes `seed-demo.php` or `config.local.php`, and admin counts and public stats exclude demo
players.

**Why.** Realistic local testing without any risk of fake activity being shown to real children or counted as real use.

**Consequences.** Live leagues start genuinely empty; that is intended.

## ADR-016: A small migration runner

**Context.** The database changes over time, and the live host may have no terminal.

**Decision.** `api/schema.sql` is migration `001`, followed by numbered files in `api/migrations/`. `php api/migrate.php`
applies, in order, every file not yet listed in `schema_migrations` (and recognises databases made before the runner
existed). `npm run release` also writes one combined `database.sql` that records all migrations as applied.

**Why.** One safe command to bring any database up to date, and a phpMyAdmin path for hosts without a terminal.

**Consequences.** Migrations are forward-only (no "down"); each file must be safe to run once on the previous state.
Never edit a migration that has already run anywhere; add a new one.

## ADR-017: Fact Engine: checked facts turned into questions by an algorithm

**Context.** Maths never runs out because its questions are computed. Science, SST and upper-primary English are
knowledge: an algorithm cannot know that the kidneys remove urea. Writing every question by hand doesn't scale, and
AI-written questions can contain confident mistakes, which is unacceptable for children.

**Decision.** People write small **fact sets** (a table + question patterns), checked once per fact and approved in
the admin panel. The app turns every fact × pattern into questions, takes wrong choices from other rows, and refuses
any question two rows could both answer (see [algorithms](algorithms.md#14-fact-engine-fact-table-question-generation)).

**Why.** The truth comes from people; the variety comes from the algorithm. One checked fact feeds several questions,
and the "two right answers" risk is handled by a rule that `npm run check:facts` tests.

**Consequences.** Fact sets suit facts that fit a table (organs, animal groups, diseases, symbols, places).
Explanations, reasoning and open questions still come from the hand-written bank. Values must be written so they read
well inside the patterns (articles like "a"/"an" go in the data). Approving a set is a content decision, like
approving a question.

## ADR-018: Bank downloads by daily random sample

**Context.** The game first downloaded every approved bank question for a class + subject. A bank of thousands would
be too large for phones on paid data.

**Decision.** Up to 400 questions are sent whole. Above that, the server sends a random 400 chosen with today's date
as the seed, so it is the same sample all day and a new one tomorrow.

**Why.** Downloads stay small and fixed whatever the bank size; the same sample all day means at most one download a
day; and over a week children still meet many different questions.

**Consequences.** On a very large bank a child may not see a particular question for a while. `ORDER BY RAND(seed)`
is fine for tens of thousands of rows; for millions it would need a cheaper sampling method.

## ADR-019: A device must prove itself to change its player

**Context.** A review found that re-registering an existing `device_id` issued a new token without asking for the old
one, so anyone who learnt a device id could take over that child's player.

**Decision.** `POST /players` for a device that already has a token now requires that token (`X-Player-Token`), or
answers 409. The app sends its token when the child changes name, animal or class (it no longer discards it). If its
token is truly lost, the app continues as a new player under a new device id, keeping progress saved on the device.

**Why.** Device ids are never shown by the API, but security shouldn't depend on a secret staying secret by accident.

**Consequences.** A device whose stored token is lost appears as a new player on the server (leagues and dashboards
start again); its local progress is kept.

## ADR-020: Competitions are built, timed and marked by the server

**Context.** Practice sprints are made on the phone, which knows the answers. For competitions between schools (and
later, sponsored prizes) results must be trustworthy, and no child, parent or teacher may see the answers early. At
first we planned for an admin to set each competition by hand; the user suggested the system should do it.

**Decision.** Two schools agree (one challenges, the other accepts) and the server does everything else: it builds
one paper for both, opens it at the agreed time, times every child with its own clock, marks it, and only then shows
results and answers. The PHP server cannot run the TypeScript generators, so a release-time script exports a large
checked **Paper Pool** from them, and the server draws papers from that pool plus approved bank questions.

**Why.** No person is needed per competition, so any two schools can compete any week; no teacher sees the paper
before it ends, so no school can be tipped off; and the same generators as the game keep questions at the right level.

**Consequences.** The pool is a few MB, made fresh for every release (not kept in git); a release must be built
before competitions work on a new server. Fact-set questions reach papers through a PHP copy of the Fact Engine, which must change whenever `facts.ts` does. Whether children play supervised
in class is up to the school; a fixed window during lessons is the advice in the teacher screen.

## ADR-021: A school's score is the average of its best 10

**Context.** A school with 80 pupils playing would win any "total points" contest against a school with 15.

**Decision.** Each school's score is the average percentage of its best 10 pupils (at least 3 must play to count).
Ties go to the faster average time. Every child still sees their own score and places.

**Why.** Small and big schools compete fairly; children who are still learning cannot pull their school down (only the
best 10 count), so nobody is discouraged from entering.

**Consequences.** A school gains nothing from more than 10 pupils playing, except that more children take part and
each gets their own result and review. The numbers (10 and 3) are constants in `api/compete.php`.

## ADR-022: Children compete one-to-one through duels with friends only

**Context.** Children also wanted to compete as individuals, not only as a school.

**Decision.** A **duel**: a child challenges a friend (friends are added only by a code shared in person) to the same
server-built 10-question paper; each plays once within 48 hours; most correct wins, then the faster. Until both have
played, neither sees the other's score or any answers.

**Why.** It reuses the Paper Engine, keeps strangers out (no searching for opponents, no chat), and cannot be won by
passing on answers. Race ghosts stay as the quick, casual way to compete; duels are the fair, marked one.

**Consequences.** Friends in different classes play the younger class's paper. Limits: 5 duels a day per child, one
open duel per pair. A wider individual competition (e.g. a national weekly paper per class) can reuse the same engine
later.

## ADR-023: The whole-school view shows classes, not pupils

**Context.** Head teachers want to see the whole school, but [ADR-007](#adr-007-teachers-only-see-pupils-who-joined-with-their-code)
says a teacher only sees pupils who joined their class with its code. There is no way yet to verify who really is a
head teacher.

**Decision.** Any teacher who has chosen a school sees every class of that school: teacher, pupils, how many played this
week, sprints, accuracy and the weakest topics. **No pupil names.** Names stay with each class's own teacher.

**Why.** It answers the head teacher's real questions ("which classes use it, which topics are weak") without having to
verify roles, and without giving any teacher names of children they don't teach.

**Consequences.** Someone who wrongly claims to teach at a school sees only class-level numbers. If head teachers later
need names (e.g. for reports to parents), that needs a verified head-teacher role first.

## ADR-024: Data saver, and download only what changed

**Context.** Many families pay for mobile data by the megabyte. The app re-downloaded every Science/SST/English question
on every start just to compare versions, and refreshed the league and "playing now" often.

**Decision.** The coverage call now carries each subject's content version, so unchanged content is never downloaded
(for everyone). A **data saver** setting (on automatically when the phone's own data saver is on) also refreshes the
league at most every 10 minutes, the "playing now" heartbeat every 5 minutes instead of 45 seconds, and looks for new
questions once a day.

**Why.** Playing never needs the internet (questions are made or stored on the phone); only the social parts do, and
they are fine slightly out of date.

**Consequences.** With data saver on, "playing now" and league places can be a few minutes old.

## ADR-025: Green, white and black; Lexend; emojis only as pictures

**Context.** The first look was orange with many emojis in titles and buttons, and the Fredoka font. The owner's
brand colours are green, white and black, and the screens felt busy and slow.

**Decision.** The theme tokens in `frontend/src/style.css` now carry the brand: green for main buttons and
highlights, near-black for text and dark cards, a light background with white cards. Red still means wrong or
urgent and yellow still means stars and coins, because children read those as meanings. The font is **Lexend**,
designed to make reading easier, in three weights. Emojis stay only where they are pictures (subject tiles, avatars,
badges, the Boss, the menu icons, icon + number counters); emojis in front of words or at the end of sentences were
removed. Waits were shortened: the 3-2-1 before a sprint (1.35 s), the pause after a right answer (0.6 s) and page
changes (0.1 s).

**Why.** One brand everywhere (game, teacher and admin sites, icons, splash screen), calmer screens, text that is
easier for young readers, and less waiting between taps.

**Consequences.** New screens should use the tokens (`bg-sprint`, `bg-ink`, `text-ocean` …), not new colours, and
should not put emojis in front of words. The four subject tiles are green, black, deep green and white with a green
edge, so they still look different from one another.

## ADR-026: Diagrams are data, and Pro maths is typed

**Context.** Many PLE maths questions are about a picture (a clock, a shape with measurements, a Venn diagram, a
graph), and PLE answers are written, not picked. Emoji pictures and four choices could not match that.

**Decision.** A question can carry a `diagram` described as data, which the app draws as SVG. At Maths Pro and in
PLE mocks, number answers are typed on a fixed keypad; elsewhere children still choose (young children need choices,
and competitions are marked by the server against a choice).

**Why.** Data is tiny, works offline, travels through the server unchanged for competition papers, can be checked by
the same tests as text, and draws crisply in light and dark. Typing removes guessing where it matters most.

**Consequences.** A new kind of diagram needs a few lines in `QuestionDiagram.vue`. Typed answers accept the same
number written differently, but fractions must be in simplest form, matching PLE marking.
