# BrainSprint Kids

> **How it all works, and why:** see [`docs/`](docs/README.md): architecture, the algorithms (Template Engine,
> Fact Engine, mastery, spaced repetition, leagues…), data model, API, decision log and roadmap.

Fast, fun academic practice for nursery and primary children. Answer quickly, earn points, collect badges.

- **Subjects:** Maths and English (live), Science and SST (coming)
- **Classes:** Top Class (nursery), P1–P7 for Maths; Top Class–P3 for English
- **Levels:** Simple → Medium → Hard → Pro (a level opens after 2 ⭐ on the one before)
- **Free tier:** everything is free while the game is being built (`PAYWALL_ENABLED = false` in `frontend/src/game/scoring.ts`). When switched on: 3 free sprints a day, then a Sprint Pass (day / week / month)

## Project layout

```
frontend/   Vue 3 + TypeScript + Tailwind app
  src/game/   question engines (maths.ts Top–P3, maths-upper.ts P4–P7, english.ts), scoring, badges; no UI code
  scripts/    check-questions.ts (tests every engine), make-icons.mjs
  src/stores/ player progress, saved on the device and synced to the API
  src/views/  screens
  android/    Android app project (Capacitor), built from the same code
api/        PHP 8 JSON API (runs under XAMPP Apache)
  index.php   routes;  lib.php helpers and sign-in;  leagues.php weekly leagues
  schema.sql  base tables;  migrations/ changes since (run in order)
  dev/        local-only tools (seed-demo.php)
```

## Run it locally

1. Start Apache and MySQL in XAMPP.
2. Create an empty `brainsprint` database (utf8mb4) once, then bring it up to date. Run this again
   whenever new files appear in `api/migrations/`; it skips what's already applied:
   ```
   C:\xampp\mysql\bin\mysql.exe -uroot -e "CREATE DATABASE IF NOT EXISTS brainsprint CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
   C:\xampp\php\php.exe api\migrate.php
   C:\xampp\php\php.exe api\dev\create-admin.php admin      # an account for the admin panel
   ```
   Optional, for local testing only: fill this week's leagues with 25 pretend players per class with
   `C:\xampp\php\php.exe api\dev\seed-demo.php` (remove them again with `--remove`). With
   `api/config.local.php` returning `['demo_life' => true]` (git-ignored, never on a live server)
   the demo players also come online, score points and appear in the live feed.
3. Start the app:
   ```
   cd frontend
   npm install
   npm run dev
   ```
4. Open http://localhost:5173. On a phone on the same Wi-Fi, use the Network address Vite prints.

The game works offline. Finished sprints are queued on the device and sent to the API whenever it is reachable.

## Web: phones, tablets and laptops

One app, three layouts:

| Screen | Navigation | Layout |
|---|---|---|
| Phone (< 768 px) | Bottom tab bar: Home, League, Boss, Friends, Me | One column |
| Tablet (768–1023 px) | Slim icon rail on the left | One wide column, 4 subject tiles across |
| Laptop (≥ 1024 px) | Full sidebar with labels, Brain Power and points | Home in two columns (play on the left, league + "playing now" on the right) |

Sprints and sign-up hide the navigation so children can focus. On a computer, keys **1–4** (or A–D)
answer and **Enter** moves on from the worked steps; small key hints appear only where there is a mouse.

**The built website** (no dev server): `npm run build`, then open **http://localhost/brainsprint/**,
which redirects to `frontend/dist/`. Apache serves only `dist/`: the source code, `node_modules` and the
Android project return 403 (`frontend/.htaccess`). Note that `npm run build:android` also writes
`dist/`, so run `npm run build` again afterwards for the website.

## Put it on a phone

**Installable web app (no Play Store needed):** after `npm run build`, serve `frontend/dist` over **https**.
On an Android phone, open it in Chrome and choose *Add to Home screen*. It then opens like an app and plays offline.

**Android app (APK / Play Store):** needs [Android Studio](https://developer.android.com/studio) for the Android SDK,
and **Java 21**. Android Studio's own Java is version 25, which this Gradle version can't run, so a separate JDK 21
lives in `C:\Users\HP\.jdks\jdk-21.0.12.1+1`.

```
cd frontend
npm run build:android     # builds with .env.android and copies into android/
cd android
set JAVA_HOME=C:\Users\HP\.jdks\jdk-21.0.12.1+1
gradlew assembleDebug     # → android/app/build/outputs/apk/debug/app-debug.apk
```

Or in Android Studio (`npm run open:android`): *Settings → Build, Execution, Deployment → Build Tools → Gradle →
Gradle JDK* → pick the JDK 21 folder, then Run ▶ on a phone, or *Build → Generate Signed App Bundle* for the Play Store.

Set `VITE_API_URL` in `frontend/.env.android` to the live API before a real release.

**Trying the online parts on a phone before the live server exists:** `npm run build:android-lan` builds a test APK that talks to this computer over Wi-Fi (plain http, so only for testing on this network) and prints the address to download it from on the phone. XAMPP must be running, and the phone on the same Wi-Fi.
To redraw the app icons and splash screen: `npm run icons`.

The app id `com.brainsprint.kids` is permanent once published on the Play Store.

## Questions never run out

Questions are not stored: each one is built on the phone from a template with random numbers,
so there is nothing to download and no fixed list to finish. The game also remembers the last
800 questions a child saw and avoids them in new sprints.

`npm run check:questions` tests every class and level: it builds 20,000 questions per level,
checks that the right answer is always among the choices, and reports how many *different*
questions each level has. Every Maths level from P1 up has more than a full day of play
(most have 5,000–13,000+); Top Class has a few hundred, because counting to 10 only has so many forms.

## Worked solutions

Every P4–P7 Maths question, and the P1–P3 word problems, missing numbers, money, fractions and Roman numerals,
carries step-by-step working. After a wrong answer the sprint pauses on a **How to solve it** panel (which can be
read aloud), and the results screen shows the steps again under *Let's learn these*.
`npm run check:questions` fails if a P4–P7 question has no steps, or if its steps don't reach the right answer.

## How scoring works

| | Points |
|---|---|
| Correct answer | 10 |
| Speed bonus | up to +10 (more time left = more points) |
| 3 or more right in a row | +5 |
| Wrong or out of time | 0, and the streak resets |

Stars per sprint: 90%+ = 3 ⭐, 70%+ = 2 ⭐, 50%+ = 1 ⭐, out of the questions in the sprint (10, or fewer when a small question bank gives a shorter sprint). A sprint cut short by Brain Power still counts every question it should have had.

## Brain Power, points and leagues

The rules that keep this a learning game, not a gambling one:

- **⚡ Brain Power**: 25 to start. Each wrong answer uses 1; one comes back free every 15 minutes.
  At 0 the sprint ends and the child waits for the refill. A Sprint Pass (bought by a parent) makes it unlimited.
  Settings are in `frontend/src/game/scoring.ts`.
- **Points (XP)** are only ever earned by answering, never bought. They decide league positions.
- **Weekly leagues**: Monday–Sunday (Kampala time), up to 30 children in the same class and tier
  (Bronze → Silver → Gold → Diamond → Champion). Top 5 move up, bottom 5 move down.
  During a sprint the child sees their live position and who they just overtook.
- **Prizes** (future competitions) are sponsored, have free entry, and go to parents or schools, never cash
  to children. Get a legal check under Uganda's Lotteries and Gaming Act before the first prize event.

The server checks every sprint: the player's token, the maximum possible score, answers not impossibly
fast, no two sprints finishing within 15 seconds, and a sprint sent twice counts once.

## Profile, friends and races

- **Level and title** from total XP (100, 300, 600, 1,000 … XP): 🌱 Seedling, 🧭 Explorer, 💡 Thinker,
  📚 Scholar, 🧠 Genius, 🏆 Legend. The avatar ring takes the title's colour, and new animals unlock
  at levels 2–20 (`frontend/src/game/progress.ts`).
- **Daily goal** of 3 sprints (progress ring on the home screen) and a **🔥 day streak**.
- **Playing now**: the app checks in every 45 seconds; the home screen shows how many children are
  playing (and how many in the same class), their avatars, and a live feed of perfect 10s, big scores,
  long answer streaks, race wins and league promotions.
- **Player cards**: tap anyone in the league or the "playing now" row. Cards show only name, animal,
  class, level, league, streak, badges and accuracy, never a phone number, parent or device.
- **Races**: from a card, race that player on any level you've unlocked. Their ghost runs beside you,
  answering at their real pace and accuracy (their best sprint on that level, or their usual play);
  its clock only runs while you are answering. Wins appear in the live feed and earn badges.
- Name hint on sign-up: first name or nickname only, because other players see it.

## Friends, schools and the Weekly Boss

- **Friends** are added only with a 6-character friend code (no 0/O, 1/I/L), told in person or
  shared from the app: there is no searching for strangers. Up to 50 friends; "This week among
  friends" ranks them by XP, shows who's online and what they're playing, and any friend can be raced.
- **Schools**: search and join your school, or add it. Schools children add are **pending**: their
  members still play for them, but they stay out of the public ranking (and other children can't
  find or join them) until someone approves them:
  `UPDATE schools SET status = 'approved' WHERE id = …;` (or `'hidden'` for a bad name).
  The school ranking adds up members' league XP for the week.
- **Weekly Boss Battle**: one boss for everyone each week (Times-Rex, the Fraction Shark, Robo-Ruler,
  the Minus Monster, Octo-Algebra, the Division Dragon in turn), 180 HP. Twelve questions from the
  child's class Hard + Pro levels; every point is damage; 3 hearts, a wrong answer loses one.
  Best damage per week is kept, with a top-10 board per class, a Boss Slayer badge and a feed item.
  Boss sprints earn XP like any sprint but don't change level stars.
- **Settings** (⚙️ on the home screen): sound effects, soft background music (made in the browser,
  quiet during sprints), when to read questions aloud, and voice speed.

## Grown-ups

Behind a maths check for adults: create an account with a Ugandan phone number and a 4-digit PIN
(5 wrong PINs lock it for 15 minutes), add the child playing on that phone, and see each child's sprints
and accuracy this week, league position, accuracy per subject and recent sprints.
The phone number is not yet verified by SMS.

## API

Child requests send `X-Player-Id` and `X-Player-Token`; parent requests send `Authorization: Bearer <token>`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/health` | anyone | Database check |
| POST | `/api/players` | anyone | Create or update this device's child; returns a new token |
| GET | `/api/players/me` | child | XP, this week's XP, league tier |
| POST | `/api/sprints` | child | Save a finished sprint; adds XP |
| GET | `/api/league` | child | This week's league table |
| POST | `/api/presence` | child | Heartbeat (what I'm playing); returns who's online and the live feed |
| GET | `/api/players/{id}/card` | child | Another player's public card |
| GET | `/api/race/{id}?subject=&grade=&level=` | child | The rival's ghost for a race |
| POST | `/api/races` | child | Finished race; a win goes in the feed |
| GET | `/api/friends` | child | My friend code and friends |
| POST | `/api/friends`, `/friends/remove` | child | Add by code (both ways) / remove |
| GET | `/api/schools?q=` | child | Search approved schools (plus one I added) |
| POST | `/api/schools`, `/schools/join`, `/schools/leave` | child | Add (pending) / join / leave a school |
| GET | `/api/schools/board` | child | Weekly school ranking and my school's top players |
| GET / POST | `/api/boss` | child | This week's boss and board / save my damage |
| POST | `/api/parents/register`, `/login`, `/logout` | parent | Phone + PIN accounts |
| GET | `/api/parents/me` | parent | Dashboard: every linked child's progress |
| POST | `/api/parents/children` | parent **and** child | Link the child on this device |
| POST | `/api/parents/children/unlink` | parent | Remove a child |

## Learning features

- **Weak-spot practice** (`src/game/practice.ts`, **🎯 My Progress**): every answer updates a mastery
  score per topic (last 20 answers; judged after 5). "Practise my weak spots" builds a sprint from the
  weakest topics plus questions due again. Missed questions go in a **try-again box** and come back
  after 1, 3, 7 and 14 days until learnt. Parents see each child's weak and strong topics.
  `npm run check:practice` tests these rules.
- **Teachers** (`teacher.html`): phone + password accounts; create classes (6-letter join code, with a
  full-screen view for the projector); see each pupil's week, weak topics and PLE readiness, the class's
  topics weakest-first, and set homework (one topic, or a level sprint) with who has and hasn't done it.
  Print gives a report with all sections. Teachers only see pupils who joined with their code.
  Pupils join in **📝 My Class**, where their homework is listed.
- **PLE Prep** (P6 and P7, **🎓**): 30-question timed Maths mocks (45 min) drawn from the class's Hard/Pro
  levels plus revision from the year below, at most 3 questions per topic where possible; answers can be
  changed and are only marked at the end, with working for every miss. Readiness = average of the last 3.
  Mocks give XP but don't use Brain Power.

## The question bank (Science, SST, English P4–P7)

Maths and English Top–P3 are generated in the app. Everything else comes from the **question bank**:
questions written by people and **checked before children see them**.

- **Admin panel → Questions**: write questions with a live preview, edit, approve, retire, send a
  teacher's suggestion back with a note, and **import a spreadsheet** (CSV; format in `content/README.md`).
  Imported rows always arrive as drafts. A coverage table shows approved questions per subject and class.
- **Teachers → Suggest questions**: suggestions wait for approval; the teacher sees "In the game",
  "Waiting" or the editor's note.
- **In the game**: a subject opens for a class once it has 4 approved questions. The app downloads the
  class's questions and keeps them for offline play, refreshing when something changes. While a level
  has fewer than 10 questions it borrows from the class's other levels, and a small bank gives a shorter
  sprint rather than repeats. Bank questions work with practice, homework and topic reports like any other.
- `content/starter-science-sst.csv`: 40 P3–P7 Science and SST questions to import as a start.
- **Fact Engine** (admin panel → **Fact tables**): write a small table of checked facts (e.g. organ · job · system)
  with a few question patterns, and the app makes many questions from it, never one that two facts could both answer.
  `content/fact-sets-starter.json` has 8 starter sets (import as JSON; they arrive as drafts). `npm run check:facts`
  tests the engine. Big banks are downloaded as a daily random sample of 400 per class + subject.
  **Have a teacher check them before approving.**

## The website and admin panel

One build makes four pages: `index.html` (the game), `site.html` (the public landing page, the
site's front page), `teacher.html` (teachers) and `admin.html` (the admin panel). Locally: http://localhost/brainsprint/ and
http://localhost/brainsprint/frontend/dist/admin.html.

- **Landing page**: for parents and schools; what BrainSprint covers, safety promises, the Android
  download, FAQ and a contact form. Live player numbers appear only after 100 real players.
- **Admin panel** (staff sign-in, locked for 15 minutes after 5 wrong passwords, signed out after
  12 hours): activity overview and chart, approve / correct / hide schools, search players and rename
  unsuitable names (a word filter also stops clearly rude names at sign-up), school and parent
  enquiries with call / WhatsApp links, and removing items from the live feed.

To put it online, see **DEPLOY.md** (`npm run release` makes the upload package).

## Not built yet

- MTN MoMo / Airtel Money payments (the pass screen has a parent check and placeholder prices)
- SMS check of parents' phone numbers; timed competitions with server-generated questions
- The live server itself (everything is ready: see DEPLOY.md); until then phones using the APK show "connect to the internet" for online features
- Science and SST (they need a reviewed question bank; the `questions` table is ready)
- English for P4–P7, and bigger English word lists (English has tens to hundreds of different questions per level, not thousands)
