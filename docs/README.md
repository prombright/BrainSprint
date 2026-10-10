# BrainSprint Kids documentation

**What BrainSprint is.** BrainSprint Kids is an academic practice game for nursery and primary children in Uganda,
from Top Class to P7. Children play short timed "sprints" of multiple-choice questions in Maths, English, Science and
SST, earn points, stars and badges, and compete in weekly class leagues, races and a weekly boss battle. Maths and early
English questions are generated on the device, so they never run out and play works offline; other subjects come from a
human-reviewed question bank. Parents see their child's progress, teachers run classes and homework, and P6/P7 children
can sit PLE-style mock papers. It runs in the browser on phones, tablets and laptops, as an installable web app, and as
an Android app, all from one Vue + TypeScript code base with a small PHP + MySQL API. It is built by Bright, a solo
founder.

For setting up and running the project, start with the root [`README.md`](../README.md); for putting it online, see
[`DEPLOY.md`](../DEPLOY.md); for the question spreadsheet format, see [`content/README.md`](../content/README.md).

## Files

| File | What's in it |
|---|---|
| [architecture.md](architecture.md) | The big picture: four pages and an Android app from one project, offline-first design, how the app talks to the API, folder map, and a sprint traced end to end. |
| [algorithms.md](algorithms.md) | How everything is calculated: question generation, sprint assembly, scoring, Brain Power, mastery, the try-again box, practice, mocks, leagues, races, the question bank and anti-cheat. **Read this first.** |
| [data-model.md](data-model.md) | Every database table, how they relate, what other children can see, storage growth and the plan to scale. |
| [api.md](api.md) | Every API endpoint, grouped by who calls it, with rules and limits. |
| [decisions.md](decisions.md) | Decision log: what was chosen and why (generated questions, offline-first, safe economy, child safety, hosting …). |
| [roadmap.md](roadmap.md) | What's done and what's still to do, with what each item needs. |
| [glossary.md](glossary.md) | Short definitions of the words used in the code and these docs. |
