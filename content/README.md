# Question content

Spreadsheets of questions for the question bank (Science, SST, English P4–P7 …).
Import them in the admin panel → **Questions** → **Import CSV**. Every row arrives as a **draft**,
and nothing reaches children until someone approves it.

## Columns

| Column | Example | Notes |
|---|---|---|
| subject | `science` | maths, english, science or sst |
| grade | `P5` | TOP, P1 … P7 |
| level | `medium` | simple, medium, hard or pro |
| topic | `food and nutrition` | lowercase words; questions on the same topic are grouped for practice and reports |
| prompt | `Which food group helps the body grow?` | the question |
| choice1 … choice4 | `proteins` | 2–4 choices; leave the extra ones empty |
| answer | `proteins` | must match one choice exactly |
| steps | `Proteins are body-building foods. \| Examples: beans, fish` | optional working, steps separated by `\|` |

Write it in Excel or Google Sheets and save or download it as **CSV (UTF-8)**.

`starter-science-sst.csv` is a first set of 40 P3–P7 Science and SST questions. **Have a teacher
check every one before approving**, especially anything about history or government.

## `fact-sets-draft-2.json`: 11 more fact tables (drafts)

Science: food values, deficiency diseases, sense organs, states of matter, measuring instruments, immunisable
diseases. SST: national parks, minerals of Uganda, events in Uganda's history, African capital cities, compass
directions. Together with the first 8 tables and the 40 starter questions, approving everything gives P4–P7 about
160–210 Science and 70–110 SST questions per class.

They are already loaded in the admin panel (**Fact tables**) as drafts. Import them again only on a new server.
A teacher should check each table, preview it, and approve it. Points to look at closely:

| Table | Check |
|---|---|
| food values | Fats and oils are taught as "keep the body warm"; carbohydrates as energy. Groundnuts and milk were left out on purpose (rich in more than one food value). |
| deficiency diseases | The signs, e.g. kwashiorkor "a swollen stomach and reddish-brown hair", marasmus "a very thin body". Rickets is given as lack of vitamin D (calcium is not offered as a wrong choice). |
| immunisable diseases | Uganda now gives the **pentavalent** vaccine (DPT + hepatitis B + Hib). The table says DPT, as most textbooks do. Change it if your syllabus uses pentavalent. |
| national parks | What each park is "famous for" matches what pupils are taught (Lake Mburo: impalas; Kidepo: ostriches and cheetahs). Mgahinga was left out because Bwindi also has gorillas. |
| minerals of Uganda | Kilembe (copper), Hima (limestone; Tororo also has limestone), Sukulu hills (phosphates), Kikagati (tin), Lake Katwe (salt), Albertine region (oil). Check these are still taught as the main places. |
| events in Uganda's history | 1886 Martyrs, 1894 protectorate, 1900 Buganda Agreement, 1962 independence, 1963 republic, 1971 and 1979 Amin, 1986 NRM, 1995 constitution. History and government need the most careful check. |
| African capital cities | Burundi was left out (its capital moved to Gitega in 2019; older books say Bujumbura). South Africa was left out (it has three capitals). |
