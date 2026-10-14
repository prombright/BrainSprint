# Glossary

| Term | Meaning |
|---|---|
| **Sprint** | One round of play: normally 10 multiple-choice questions from one subject, class and level, each against a clock. A boss fight is 12; a bank sprint can be shorter if the bank is small. |
| **Level** | Difficulty inside a class: Simple (20 s per question), Medium (15 s), Hard (12 s), Pro (10 s). A level opens after 2 stars on the one before. |
| **Class / grade** | The child's school year: Top Class (nursery), P1 to P7. In code it is `grade` (`TOP`, `P1` … `P7`). |
| **Stars** | 0–3 per sprint from accuracy (50% / 70% / 90%). A level keeps its best. |
| **Points / XP** | The same thing: earned only by correct answers (10 + speed bonus + streak bonus). Lifetime XP gives the player level; this week's XP decides league position. Never bought. |
| **Player level, title** | Level from lifetime XP (100, 300, 600, 1,000 … XP) and its title (Seedling … Legend). Not the same as a sprint level. |
| **Brain Power (⚡)** | 25 points of energy; each wrong answer uses 1; one refills every 15 minutes. At 0 the child must wait. |
| **Streak** | Correct answers in a row inside a sprint (3+ earns a bonus). **Day streak**: days in a row with at least one sprint. |
| **Daily goal** | 3 sprints a day. |
| **Tier** | League rank level: Bronze, Silver, Gold, Diamond, Champion (stored as 0–4). |
| **League group** | Up to 30 children of the same class and tier competing on XP for one week (Monday–Sunday, Kampala time). Top 5 move up a tier, bottom 5 move down. |
| **Live rank** | The position a child would have if the sprint ended now, shown during the sprint. |
| **Ghost** | A stand-in that "plays" a race for a rival who isn't online, using their real pace and accuracy. |
| **Weekly Boss** | A shared weekly challenge: deal 180 damage with 12 Maths questions and 3 hearts. |
| **Template** | A function that builds one kind of question (e.g. "share N things among K children") with random numbers, answer, wrong choices and steps. |
| **Plan** | For a subject and class, the list of templates each level draws from. A subject is available for a class when it has a plan. |
| **Question key** | The question's prompt, big text and picture joined together: how the game tells whether two questions are the same. |
| **Recent memory** | The last 800 question keys a child has seen, avoided in new sprints. |
| **Steps** | The worked solution shown after a wrong answer ("How to solve it"). |
| **Topic** | The skill a question practises (`fractions`, `word problem`, `plurals` …). Used for mastery, practice, homework and reports. |
| **Mastery** | Percentage right in the last 20 answers on a topic; labelled weak (< 70%), ok, or strong (85%+) after 5 answers. |
| **Try-again box** | The Leitner spaced-repetition box: missed questions come back after 1, 3, 7 and 14 days until learnt. A **card** is one question in it; a card is **due** when its time has come. |
| **Practice sprint** | A sprint built from due cards and weak topics, across the levels the child has opened. Saved with level `mixed`. |
| **Homework / assignment** | A teacher-set task: a sprint at a level, or practice on one topic, by a due date. |
| **Mock** | A 30-question, 45-minute PLE-style Maths paper for P6 and P7, marked at the end. |
| **Readiness** | Average percentage of the last 3 mocks, shown with a band (Excellent / Good / Getting there / Needs work). Not a UNEB grade. |
| **PLE / UNEB** | Primary Leaving Examination, set by the Uganda National Examinations Board at the end of P7. |
| **Bank / question bank** | Human-written questions in the `questions` table (Science, SST, English P4–P7), statuses draft → approved → retired. Only approved ones reach children. |
| **Coverage** | How many approved bank questions exist per subject and class. A subject opens for a class at 4. |
| **Fact Engine** | The generator that turns fact sets into questions on the device (`game/facts.ts`). |
| **Fact set** | A small table of checked facts (e.g. organ · job · system) plus question patterns; approved like a question. |
| **Pattern** | A question with `{column}` gaps, e.g. "What is the work of the {organ}?", and the column holding its answer. A **NOT pattern** shows three facts from one group and one from another. |
| **Ambiguous** | A pattern + fact that another fact could also answer; the Fact Engine never asks it. |
| **Sample** | For a big bank, the random 400 questions a phone downloads for the day. |
| **Sprint Pass** | A future paid pass (day / week / month), bought by a parent, giving unlimited Brain Power. Switched off (`PAYWALL_ENABLED = false`). |
| **Device id / player token** | The random id a device registers with, and the secret it sends (`X-Player-Token`) to prove it owns its player. |
| **Sync / queue** | Finished sprints and mocks wait in a queue on the device (`pending`) and are uploaded when there is a connection. |
| **Friend code / class code** | 6-character codes: one to add a friend, one to join a teacher's class. |
| **Pending school** | A school a child added; usable by its members but hidden from others until an admin approves it. |
| **Feed** | The live list of achievements ("got a perfect 10 in P5 Maths 💯") shown on the home screen. |
| **Presence / heartbeat** | The app tells the server every 45 s that the child is here and what they're playing; "online" means seen in the last 2 minutes. |
| **Demo players** | Pretend players for local testing only (`is_demo = 1`), brought to life by `demo_life` in `api/config.local.php`. Never on a live server. |
| **Migration** | A numbered SQL file in `api/migrations/` that changes the database; `migrate.php` applies new ones. |
| **PWA** | Progressive Web App: the website installed on a phone's home screen, working offline through a service worker. |
| **Capacitor** | The tool that wraps the web game into an Android app. |
| **Kampala week** | Monday 00:00 to Sunday 23:59 in Uganda time (UTC+3), used for everything weekly. |
| **Paper Engine** | The server code that builds, times and marks competition papers (`api/compete.php`). |
| **Paper Pool** | Questions exported from the game's generators at release time (`api/pool/`), which the server builds papers from. |
| **School vs School** | A competition one school's teacher sets up and another's accepts; one paper, one time window, scored on the best 10 pupils. |
| **Duel** | A one-to-one competition between two friends on the same server-marked paper. |
| **Window** | The time a school competition is open; each child also has 15 minutes from when they start. |
| **Weekly Challenge** | One server-marked paper a week for every child in a class across Uganda; places, top schools and answers on Monday. |
