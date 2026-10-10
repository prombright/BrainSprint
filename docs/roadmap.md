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
- [ ] **Queue boss and race results offline.** Sprints and mocks are queued when offline, but boss damage and race
  results are sent once and lost if the phone is offline. *Needs:* adding them to the sync queue.
- [ ] **AI-drafted questions with review.** Use an AI model to draft bank questions and steps in bulk, which then
  arrive as drafts for human approval ([ADR-009](decisions.md#adr-009-question-bank-with-human-approval)). *Needs:* an
  AI provider account and budget, a prompt aligned to the Uganda syllabus, and reviewers' time.
- [ ] **Luganda / local-language read-aloud for nursery.** Many Top Class children understand a local language better
  than English. Browsers' built-in voices don't speak Luganda well. *Needs:* recorded audio or a text-to-speech service
  that supports Luganda (and later other languages), a decision on which languages first, and native speakers to check.
- [ ] **School-vs-school timed competitions.** Events where every child gets the same questions at the same time and the
  server marks them, so results can be trusted for prizes. *Needs:* server-generated questions and server-side marking,
  a sponsor, and the legal check in [ADR-003](decisions.md#adr-003-a-safe-economy-brain-power-points-never-bought-sponsored-prizes).
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
- [ ] **Head-teacher whole-school view and CSV export.** One view of every class in a school, and spreadsheet export of
  class reports. *Needs:* a decision on how a head teacher is verified and linked to a school without weakening
  [ADR-007](decisions.md#adr-007-teachers-only-see-pupils-who-joined-with-their-code).
- [ ] **Dark mode.** Colour tokens for a dark theme across the game, teacher and admin pages. *Needs:* design time only.
- [ ] **Data-saver mode.** A setting that cuts background traffic (fewer heartbeats, no live feed, bank refresh only on
  Wi-Fi or on request). *Needs:* decisions on what to switch off by default.
- [ ] **Per-answer analytics.** Record which question and which wrong choice, to find confusing questions and common
  mistakes. *Needs:* a short retention period and a summary job (see [data model](data-model.md#plan-to-scale)), and a
  privacy review.
- [ ] **Smaller items from the documentation review.**
  - Topic mastery on the server approximates "the last 20 answers" (it scales old counts), while the device keeps the
    exact last 20, so the two can differ slightly. The 85% "strong" line is also hard-coded in PHP.
  - Bank questions with subject *maths* are accepted by the admin panel but the game doesn't download them (Maths is
    generated). Decide whether to allow them (e.g. for hand-written word problems).
  - During a sprint the live rank breaks ties differently from the server.
  - Children who scored 0 XP last week aren't demoted. Decide if that is the rule we want.
