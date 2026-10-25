# Roadmap

## Done

- Maths for Top Class to P7 and English for Top Class to P3, generated on the device, with worked steps for P4–P7
  and for P1–P3 word problems, missing numbers, money, fractions and Roman numerals.
- Four levels per class, stars, level unlocking, read-aloud, sounds and music, keyboard play on laptops.
- Scoring, Brain Power, player levels and titles, avatars, badges, day streak and daily goal.
- Offline play with a sync queue; installable web app (PWA); Android app (debug APK) from the same code.
- Weekly leagues with tiers, live rank during sprints, "playing now" and a live feed, player cards, race ghosts.
- Friends by code, schools with approval, school ranking, the Weekly Boss Battle.
- Topic mastery, the try-again box, weak-spot practice, PLE mock exams with readiness (P6, P7).
- Parent accounts (phone + PIN) with a dashboard; teacher portal with classes, homework, reports and printing.
- Question bank: admin editor, CSV import, teacher suggestions, approval, coverage, offline caching in the game.
- Admin panel: overview, schools, players, enquiries, feed moderation, questions.
- Landing page with contact form; release script and a step-by-step deployment guide (`DEPLOY.md`).
- Test scripts: `check:questions`, `check:practice` and `check:facts`.
- **Simpler phone screens for children**: Home shows only the subjects a child can play and three big buttons (Boss,
  Compete, Practise); everything else is in a menu on the Me tab, the live feed is on the League tab. Compete is a
  menu of three big buttons (Weekly Challenge, Duels, School vs School), each with its own page and a red dot when
  something is waiting; Home's Compete button shows how many things are waiting.
- **Teachers**: class results and topics download for Excel (CSV); a **whole-school view** for any teacher of the
  school (class figures only, no pupil names); per-question results for competition papers.
- **Dark screen** (light / dark / like my phone) and **data saver** (league every 10 minutes, presence every 5,
  new questions once a day; switched on automatically when the phone's own data saver is on). For everyone, question
  content is downloaded only when it changed.
- `npm run build:android-lan`: a test app that talks to this computer over Wi-Fi.
- **Weekly Challenge**: the same server-marked paper for every child in a class across Uganda each week, with a
  national top 10 and top schools on Monday. The base for sponsored prizes later.
- **New look**: green, white and black everywhere, the Lexend font, emojis only as pictures, shorter waits
  ([ADR-025](decisions.md#adr-025-green-white-and-black-lexend-emojis-only-as-pictures)).
- **Dark mode on the teacher and admin websites** too (a ☀️/🌙/💻 switch); printed reports always stay light.
- Teachers' "Last played" now shows the last sprint actually played (it showed when the app was last opened).
- **Class vs class** inside a school: 2–6 classes of one year, set up by any teacher there, scored like schools;
  children find it under School contests.
- **Science and SST in competitions**: the server makes fact-set questions with the same rules as the app, so any
  subject with enough approved content can be a competition paper.
- **School vs School competitions and Duels**, built, timed and marked by the server (the
  [Paper Engine](algorithms.md#15-paper-engine-server-marked-competitions)): teachers challenge and accept in the teacher
  portal; children play a timed paper and see their place, their school's result and the answers afterwards; duels
  between friends. `npm run pool` makes the Paper Pool.
- **Boss and race results join the offline queue** (with sprints and mocks): played offline, they upload on the next
  sync. A late boss result counts for the week it was played in, and only this week's defeat makes the news.
- **Fact Engine**: fact sets with patterns, an admin editor with live preview and JSON import, approval, offline
  download; 8 starter sets in `content/fact-sets-starter.json` (as drafts).
- **Bank downloads by daily random sample** (400 per class + subject).
- Fixes from the documentation review: topic names like "LCM" and "uganda's neighbours" are now recorded; boss
  fights are saved as "mixed" (not as Hard sprints); a perfect score is announced correctly; old sign-ins and feed
  items are cleared; a device must send its own token to change its player.

## Not done yet

Each item: what it is, and what is needed (accounts, money or decisions) to finish it.

- [ ] **Going live.** Put the site and API on a real domain over HTTPS. *Needs:* a domain and cPanel hosting with
  PHP 8.2+ and MySQL; then follow `DEPLOY.md` (everything else is ready). Until then the Android APK points at a
  placeholder API address and its online features show "connect to the internet".
- [ ] **Review and approve the starter content**: the 8 fact sets in `content/fact-sets-starter.json` and the 40
  questions in `content/starter-science-sst.csv` are drafts. *Needs:* a qualified teacher's time; then more fact sets
  (each one is a big content win).
- [ ] **AI-drafted questions with review.** Use an AI model to draft bank questions and steps in bulk, which then
  arrive as drafts for human approval ([ADR-009](decisions.md#adr-009-question-bank-with-human-approval)). *Needs:* an
  AI provider account and budget, a prompt aligned to the Uganda syllabus, and reviewers' time.
- [ ] **Luganda / local-language read-aloud for nursery.** Many Top Class children understand a local language better
  than English. Browsers' built-in voices don't speak Luganda well. *Needs:* recorded audio or a text-to-speech service
  that supports Luganda (and later other languages), a decision on which languages first, and native speakers to check.
- [ ] **Sponsored prizes for competitions.** School vs School works (free entry, server-marked); prizes need a
  sponsor and the legal check in [ADR-003](decisions.md#adr-003-a-safe-economy-brain-power-points-never-bought-sponsored-prizes).
  Class vs class inside a school is done too.
- [ ] **MTN MoMo / Airtel Money payments.** For Sprint Passes and school licences, then switch on `PAYWALL_ENABLED`.
  The pass screen, parent check and the `payments` / `subscriptions` tables exist. *Needs:* merchant accounts with MTN
  and Airtel (or an aggregator), API keys, final prices, and server-side checking of passes.
- [ ] **WhatsApp / SMS weekly parent summaries and phone verification.** Send each parent a short weekly report and
  verify phone numbers with a one-time code (today numbers aren't verified). *Needs:* an Africa's Talking account (or
  similar), sender ID registration, a WhatsApp Business account for WhatsApp, and a budget per message.
- [ ] **Play Store release.** *Needs:* a Google Play developer account (US$25 once), a signed release build, the store
  listing (Families policy, data-safety form, privacy policy), and a **release keystore** kept safe with backups in two
  places: whoever holds it controls app updates forever, and losing it means the app can never be updated. Set
  `VITE_API_URL` in `frontend/.env.android` to the live API first.
- [ ] **English P4–P7 content**, and bigger English word lists for Top Class–P3 (English levels have tens to hundreds of
  different questions, not thousands). *Needs:* writers and reviewers, through the bank or the Fact Engine.
- [ ] **Per-answer analytics for everyday sprints.** Competition papers already show, per question, how many got it
  right and the most common wrong answer. Doing the same for everyday play means recording every answer (today only
  per-topic totals are kept). *Needs:* a short retention period and a summary job (see
  [data model](data-model.md#plan-to-scale)), and a privacy review.
- [ ] **Smaller items from the documentation review.**
  - Topic mastery on the server approximates "the last 20 answers" (it scales old counts), while the device keeps the
    exact last 20, so the two can differ slightly. The 85% "strong" line is also hard-coded in PHP.
  - Bank questions with subject *maths* are accepted by the admin panel but the game doesn't download them (Maths is
    generated). Decide whether to allow them (e.g. for hand-written word problems).
  - During a sprint the live rank breaks ties differently from the server.
  - Children who scored 0 XP last week aren't demoted. Decide if that is the rule we want.
