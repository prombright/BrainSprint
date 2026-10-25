# API reference

The API is one PHP front controller, `api/index.php`. Locally it is at `http://localhost/brainsprint/api`, live at
`https://<domain>/api`. Every request and response body is JSON. Errors look like `{ "error": "Human message" }`.

**Common status codes:** `400` body isn't JSON · `401` not signed in / bad token · `404` not found · `409` already
exists / already linked · `422` invalid input or refused by a rule · `429` locked out or rate-limited · `500` database
error (details only in the PHP error log).

**Authentication** (see [architecture](architecture.md#how-the-frontend-talks-to-the-api)):

- **Child:** headers `X-Player-Id` and `X-Player-Token`.
- **Parent / teacher / admin:** `Authorization: Bearer <64 hex characters>`. Each role has its own token table, so a
  parent token never works for teacher or admin routes.

Input is validated with a few helpers in `api/lib.php`: `oneOf` (value from a fixed list), `intIn` (integer in a
range), `text` (trimmed, required, maximum length). Any failure is a `422 Invalid <field>`.

CORS: browsers may only call the API from the origins listed in `config['cors_origins']` (the Vite dev server, the
Capacitor app, and the live domain). The website itself is same-origin.

## Public (no sign-in)

| Method | Path | Purpose | Rules |
|---|---|---|---|
| GET | `/health` | Database check: `{"ok": true}` | |
| GET | `/questions?subject=&grade=` | Every **approved** bank question for one subject + class, and a `version` for caching | |
| GET | `/questions?subject=&grade=` | Approved bank questions for one class + subject: all of them up to 400, otherwise a random 400 that stays the same all day (`sampled: true`, `total`) | |
| GET | `/facts?subject=&grade=` | Approved fact sets taught in that class (with their facts and an `updated` time) for the Fact Engine | |
| GET | `/questions/coverage?grade=` | Approved content per subject + class: `questions` (bank) + `fact_questions` (facts × patterns) = `count`; the game opens a subject at 4. With `grade`, entries for that class also carry `version`, so the app skips downloads it already has | |
| GET | `/stats` | Public numbers for the landing page | `{"show": false}` until 100 real players |
| POST | `/leads` | Landing-page contact form `{kind, name, organisation?, phone, email?, message?}` | Ugandan phone required; 5 per IP per hour; a filled hidden `website` field (honeypot) is silently ignored |
| POST | `/players` | Register or update this device's child `{device_id, name, avatar, grade}`; returns `id`, a new `token` and the XP summary | Name ≤ 30 chars and must pass the word filter; re-registering replaces the token |
| POST | `/parents/register` | `{phone, pin, name}` → `{token, parent}` | Ugandan mobile number; PIN exactly 4 digits; `409` if the number exists |
| POST | `/parents/login` | `{phone, pin}` → `{token, parent}` | 5 wrong PINs lock the account for 15 min (`429`) |
| POST | `/teachers/register` | `{name, phone, password, school?}` → `{token, teacher}` | Password 8+ characters; `409` if the number exists |
| POST | `/teachers/login` | `{phone, password}` → `{token, teacher}` | 5 wrong passwords lock for 15 min |
| POST | `/admin/login` | `{username, password}` → `{token, username}` | 5 wrong passwords lock for 15 min; token valid 12 h |

## Child (X-Player-Id + X-Player-Token)

| Method | Path | Purpose | Rules |
|---|---|---|---|
| GET | `/players/me` | XP total, this week's XP, tier, whether a parent is linked | |
| POST | `/sprints` | Save a finished sprint; adds XP and league XP; returns the XP summary | All the [anti-cheat checks](algorithms.md#11-server-side-anti-cheat-checks); optional `topics` and `assignment_id` |
| GET | `/league` | This week's league group: members, ranks, who's online, promote/demote counts, time left | Puts the child in a group if they aren't yet |
| POST | `/presence` | Heartbeat `{activity?, day_streak, badges}` every 45 s; returns how many are online, up to 12 online players (classmates first) and the last 15 feed items | `activity` must look like `maths:P5:hard`; "online" = seen in the last 2 min |
| GET | `/players/{id}/card` | Another player's public card | Only game data: never phone, parent, device |
| GET | `/race/{id}?subject=&grade=&level=` | The rival's card and ghost stats for a race | |
| POST | `/races` | Finished race `{rival_id, won, subject, grade, level}` | A win becomes a feed item |
| GET | `/friends` | My friend code and friends with this week's XP and online status | |
| POST | `/friends` | Add a friend by code `{code}`; added both ways | Max 50 friends; not yourself |
| POST | `/friends/remove` | `{friend_id}`; removed both ways | |
| GET | `/schools?q=` | Search approved schools (plus a pending one I added) | 20 results |
| POST | `/schools` | Add a school `{name, district}` and join it | Name 4–80 chars; word filter; new schools are `pending` |
| POST | `/schools/join` | `{school_id}` | Only approved schools, or one I added |
| POST | `/schools/leave` | Leave my school | |
| GET | `/schools/board` | This week's school ranking (approved schools, top 50), my school's place and its top 10 players (plus me) | |
| GET | `/boss` | This week's boss, my best damage, how many in my class defeated it, top 10 in my class | |
| POST | `/boss` | Save boss damage `{damage, played_at?}` | 0–300; counts for the week of `played_at` (default now; within 30 days); best of that week kept; first defeat this week posts a feed item |
| GET | `/compete` | My school contests (accepted ones for my class's year at my school, last 14 days) with my attempt, my duels, and `duel_subjects` | |
| GET | `/contests/{id}` | One contest: my attempt; while live, how many of my school have handed in; once finished, both schools' scores, top 10, my places and my paper with answers | Only pupils of the two schools' classes for that year |
| POST | `/contests/{id}/start` | Start (or resume) my paper: questions **without answers**, `seconds_left`, `deadline` | Only while live; one go; resuming keeps the deadline |
| POST | `/contests/{id}/submit` | Hand in `{picks: [answer or null, …]}`; returns `{correct, total, seconds}` | Once; up to 2 min after the deadline |
| GET | `/compete/waiting` | How many competitions wait for me: duels I haven't played, live school contests I can play, and this week's paper; `total` is the number on Home's Compete button | Light: builds nothing, works out no results |
| GET | `/class-contests/{id}` | One class contest: my attempt; once finished the classes ranked, top 10, my places and my paper with answers | Only pupils of the classes in it |
| POST | `/class-contests/{id}/start`, `/submit` | As for school contests | Only while live; one go |
| GET | `/weekly` | This week's Weekly Challenge for my class (built on first request) with my attempt and how many have played; last week's with my place, top 10, top schools and my paper with answers | |
| POST | `/weekly/start`, `/weekly/submit` | As for contests | One go a week; open Monday to Sunday |
| POST | `/duels` | Challenge a friend `{friend_id, subject}` (`subject` may be `mixed`); the paper is built now | Friends only; 5 a day; one open duel per pair |
| GET | `/duels/{id}` | One duel; scores and my paper with answers only once both have played (or it expired) | |
| POST | `/duels/{id}/start`, `/duels/{id}/submit` | As for contests | Within 48 hours of the challenge |
| POST | `/duels/{id}/decline` | Say no | Only the challenged friend, before playing |
| GET | `/mocks` | My mock history (last 20) and readiness (average of last 3) | |
| POST | `/mocks` | Save a mock `{grade, correct, total, minutes_used, taken_at, topics}` | 10–30 questions, 1–60 minutes, no two within 10 min; 10 XP per correct answer |
| POST | `/classes/join` | Join a teacher's class `{code}` | Max 3 classes per child |
| GET | `/my/classes` | My classes and their homework (due from a week ago onwards) with what I've done | |
| POST | `/classes/leave` | `{class_id}` | |

## Parent (Authorization: Bearer)

| Method | Path | Purpose | Rules |
|---|---|---|---|
| POST | `/parents/logout` | Delete this token | |
| GET | `/parents/me` | Dashboard: every linked child with this week's sprints and accuracy, league rank, accuracy per subject, last 5 sprints, 3 weak and 3 strong topics, mock readiness | |
| POST | `/parents/children` | Link the child playing on this device | Needs the parent token **and** the child's `X-Player-*` headers; `409` if linked to another parent |
| POST | `/parents/children/unlink` | `{player_id}` | Only own children |

## Teacher (Authorization: Bearer)

A teacher can only open their own classes (`ownClass` returns 404 otherwise) and only sees children who joined with
the class code.

| Method | Path | Purpose | Rules |
|---|---|---|---|
| POST | `/teachers/logout` | Delete this token | |
| GET | `/teacher/classes` | Teacher profile and classes with pupil counts | |
| POST | `/teacher/classes` | Create a class `{name, grade}`; a join code is generated | Max 20 classes |
| GET | `/teacher/classes/{id}` | Class detail: pupils (this week's sprints and accuracy, weak topics, mock readiness, last seen), the class's topics weakest-first (with how many pupils struggle), homework and results | |
| POST | `/teacher/classes/{id}/delete` | Delete a class (and its homework) | |
| POST | `/teacher/classes/{id}/remove` | Remove a pupil `{player_id}` | |
| POST | `/teacher/classes/{id}/assignments` | Set homework `{title, subject, level \| topic, due_on}` | Exactly one of level or topic; due today or later |
| POST | `/teacher/assignments/{id}/delete` | Delete homework | Own classes only |
| GET | `/teacher/questions` | My question suggestions and their status / review notes | |
| POST | `/teacher/questions` | Suggest a bank question (same fields as the admin editor) | Saved as a draft; 100 per day |
| GET | `/teacher/school` | My school (and whether it takes challenges) and, for every class, the subjects with enough questions for a paper | |
| POST | `/teacher/school` | Choose my school `{school_id}` | Approved schools only |
| GET | `/teacher/class-contests?grade=` | My school's class contests (last 90 days; finished ones with every class's score, `can_cancel` for mine), and with `grade` the school's classes of that year to choose from | |
| POST | `/teacher/class-contests` | Set one up `{grade, class_ids[2–6], subject, starts_at, window_minutes?}`; the paper is built now | Classes of that year at my school; 5 minutes to 30 days ahead; 5 a week per school |
| GET | `/teacher/class-contests/{id}` | A finished one: every class's score, my own pupils by name, the paper with answers | |
| POST | `/teacher/class-contests/{id}/cancel` | Call it off | Before it starts; whoever set it up or a teacher of one of the classes |
| GET | `/teacher/school/overview` | Whole school: every class of every teacher of my school, with pupils, how many played this week, sprints, accuracy and the 3 weakest topics | **No pupil names**; any teacher of the school |
| POST | `/teacher/school/open` | `{open: true \| false}`: may other schools challenge us | |
| GET | `/teacher/schools?q=` | Search approved schools | |
| GET | `/teacher/contests` | My school's competitions (last 90 days) with their phase; finished ones with both scores | |
| POST | `/teacher/contests` | Challenge `{school_id, grade, subject, starts_at, window_minutes?}` | 15 min to 30 days ahead; window 15–180 min (default 30); 3 a week per school; one open challenge per pair of schools |
| POST | `/teacher/contests/{id}/accept` | Accept: the server builds the paper now | Only the challenged school, before the start |
| POST | `/teacher/contests/{id}/decline`, `/cancel` | Say no / call off | Cancel only before it starts |
| GET | `/teacher/contests/{id}` | A finished competition: both schools, top 10, all our pupils, and the paper with answers and, per question, how many of our pupils got it right, left it blank, and the most common wrong answer | |

## Admin (Authorization: Bearer, 12-hour token)

| Method | Path | Purpose | Rules |
|---|---|---|---|
| GET | `/admin/overview` | Players, new this week, active today, online now, sprints today, questions answered, parents, pending schools, new enquiries, demo players, 14-day chart, players per class | Demo players excluded from counts |
| GET | `/admin/schools?status=` | Schools by status (`pending` default, `approved`, `hidden`) with member counts and who added them | |
| POST | `/admin/schools/{id}` | `{status?, name?, district?}`: approve, hide or correct a school | |
| GET | `/admin/players?q=` | Search real players by name or id (100 newest); flags names the word filter dislikes | |
| POST | `/admin/players/{id}/rename` | Replace an unsuitable name `{name}` | Not demo players |
| GET | `/admin/leads` | Last 200 enquiries, new first | |
| POST | `/admin/leads/{id}` | `{status}`: new / contacted / closed | |
| GET | `/admin/questions?subject=&grade=&status=&teacher=&q=` | Bank questions (300 most recently changed), counts per status, coverage | |
| POST | `/admin/questions` | Create a question | Full validation (`cleanQuestion`); status defaults to draft |
| POST | `/admin/questions/{id}` | Edit a question, or change only `{status, review_note?}` (approve / retire / send back) | |
| POST | `/admin/questions/import` | `{file, questions: [...]}` from a CSV | Up to 1,000 rows; good rows become **drafts**; exact duplicates skipped; errors reported with spreadsheet row numbers |
| GET | `/admin/feed` | Last 100 feed items | |
| POST | `/admin/feed/{id}/delete` | Remove a feed item | |

| GET | `/admin/facts` | All fact sets (no rows) with row counts | |
| GET | `/admin/facts/{id}` | One fact set with its facts | |
| POST | `/admin/facts`, `/admin/facts/{id}` | Create or replace a whole fact set (checked by `cleanFactSet`; 422 lists every problem), or `{status}` alone to approve / retire | |
| POST | `/admin/facts/import` | A JSON array of fact sets (like `content/fact-sets-starter.json`); each arrives as a draft; same-name sets are skipped | |

## Bank question rules (`cleanQuestion` in `api/bank.php`)

Used for the admin editor, CSV import and teacher suggestions:

- subject `maths` / `english` / `science` / `sst`; class `TOP`, `P1`–`P7`; level `simple` / `medium` / `hard` / `pro`;
- topic: 2–39 lowercase letters, spaces or hyphens (e.g. `food and nutrition`);
- prompt 3–400 characters; read-aloud text ≤ 400;
- 2–4 choices, all different (ignoring case), each ≤ 100 characters; the answer must be exactly one of them;
- up to 8 steps of ≤ 300 characters;
- prompt and choices must pass the word filter.

CSV format: see `content/README.md`.

## Command-line tools (not reachable from the web)

| Command | Purpose |
|---|---|
| `php api/migrate.php` | Create / update the database (safe to run any time) |
| `php api/dev/create-admin.php <name> [--sql]` | Create an admin or reset a password; `--sql` only prints the SQL for phpMyAdmin |
| `php api/dev/seed-demo.php [--remove \| --extras]` | **Local only:** 25 demo players per class, demo schools and boss scores; never included in a release |
