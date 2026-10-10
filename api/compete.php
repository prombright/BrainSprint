<?php
// Competitions marked by the server: school-vs-school contests and duels between friends.
//
// The Paper Engine: the server builds every paper itself (from the Paper Pool made by the game's
// generators, plus approved bank questions), keeps the answers, times each child with its own
// clock, marks the answers and only shows them once the competition is over. No phone, child or
// teacher sees an answer before then.
declare(strict_types=1);

const CONTEST_QUESTIONS = 20;
const CONTEST_MINUTES = 15;     // each child's time once they start
const DUEL_QUESTIONS = 10;
const DUEL_MINUTES = 6;
const DUEL_HOURS = 48;          // both friends must play within this
const COUNTED_PUPILS = 10;      // a school's score is the average of its best 10…
const MIN_PUPILS = 3;           // …and needs at least 3 to count
const SUBMIT_GRACE = 120;       // seconds after the deadline a hand-in is still accepted (slow networks)
const PAPER_SUBJECTS = ['maths', 'english', 'science', 'sst', 'mixed'];
const LEVEL_SHARE = ['simple' => 0.2, 'medium' => 0.3, 'hard' => 0.3, 'pro' => 0.2];

function at(int $ts): string { return date('Y-m-d H:i:s', $ts); }
function iso(?string $dt): ?string { return $dt ? date('c', strtotime($dt)) : null; }

// ---------- the Paper Engine ----------

/** Every question the server may put on a paper for one subject + class. */
function paperPool(string $subject, string $grade): array
{
    static $cache = [];
    $key = "$subject:$grade";
    if (isset($cache[$key])) return $cache[$key];
    $pool = [];
    $file = __DIR__ . "/pool/$subject-$grade.json";
    if (is_file($file)) $pool = json_decode((string)file_get_contents($file), true) ?: [];
    foreach (q("SELECT * FROM questions WHERE subject = ? AND grade = ? AND status = 'approved'", [$subject, $grade])->fetchAll() as $r) {
        $b = questionOut($r);
        $pool[] = ['level' => $b['level'], 'topic' => $b['topic'], 'prompt' => $b['prompt'], 'speak' => $b['speak'] ?: $b['prompt'], 'choices' => $b['choices'], 'answer' => $b['answer'], 'steps' => $b['steps']];
    }
    return $cache[$key] = $pool;
}

/** Subjects a class has enough questions in for a paper of `$count` (mixed needs two subjects). */
function paperSubjects(string $grade, int $count = CONTEST_QUESTIONS): array
{
    $ok = array_values(array_filter(SUBJECTS, fn ($s) => count(paperPool($s, $grade)) >= $count * 3));
    if (count($ok) >= 2) $ok[] = 'mixed';
    return $ok;
}

/** Builds and saves a paper; easy questions first, choices shuffled. Returns its id. */
function buildPaper(string $subject, string $grade, int $count, int $minutes): int
{
    if (!in_array($subject, paperSubjects($grade, $count), true)) {
        respond(422, ['error' => 'There are not enough checked questions for ' . gradeName($grade) . ' ' . (SUBJECT_NAMES[$subject] ?? 'Mixed') . ' yet']);
    }
    $subjects = $subject === 'mixed' ? array_values(array_diff(paperSubjects($grade, $count), ['mixed'])) : [$subject];
    $picked = [];
    $seen = [];
    foreach ($subjects as $i => $s) {
        // split the paper evenly; the first subjects take any remainder
        $want = intdiv($count, count($subjects)) + ($i < $count % count($subjects) ? 1 : 0);
        $pool = paperPool($s, $grade);
        shuffle($pool);
        $byLevel = [];
        foreach ($pool as $q) $byLevel[$q['level']][] = $q;
        $take = [];
        foreach (LEVEL_SHARE as $level => $share) {
            $n = (int)round($want * $share);
            foreach ($byLevel[$level] ?? [] as $q) {
                if ($n <= 0 || count($take) >= $want) break;
                $k = $q['prompt'] . '|' . ($q['big'] ?? '') . '|' . ($q['visual'] ?? '');
                if (isset($seen[$k])) continue;
                $seen[$k] = true;
                $take[] = $q + ['subject' => $s];
                $n--;
            }
        }
        // a level that ran short is filled from any level
        foreach ($pool as $q) {
            if (count($take) >= $want) break;
            $k = $q['prompt'] . '|' . ($q['big'] ?? '') . '|' . ($q['visual'] ?? '');
            if (isset($seen[$k])) continue;
            $seen[$k] = true;
            $take[] = $q + ['subject' => $s];
        }
        array_push($picked, ...$take);
    }
    $order = array_flip(array_keys(LEVEL_SHARE));
    usort($picked, fn ($a, $b) => $order[$a['level']] <=> $order[$b['level']]);
    foreach ($picked as &$q) shuffle($q['choices']);
    unset($q);
    q('INSERT INTO papers (subject, grade, questions, minutes) VALUES (?, ?, ?, ?)', [$subject, $grade, json_encode($picked, JSON_UNESCAPED_UNICODE), $minutes]);
    return (int)db()->lastInsertId();
}

function paperRow(int $id): array
{
    $p = q('SELECT * FROM papers WHERE id = ?', [$id])->fetch() ?: respond(404, ['error' => 'Paper not found']);
    $p['questions'] = json_decode($p['questions'], true);
    return $p;
}

/** The questions as a child may see them: during the competition without answers or working. */
function paperQuestions(array $paper, bool $withAnswers): array
{
    return array_map(function ($q) use ($withAnswers) {
        $out = ['subject' => $q['subject'], 'topic' => $q['topic'], 'prompt' => $q['prompt'], 'speak' => $q['speak'] ?? $q['prompt'], 'choices' => $q['choices']];
        if (!empty($q['visual'])) $out['visual'] = $q['visual'];
        if (!empty($q['big'])) $out['big'] = $q['big'];
        if ($withAnswers) $out += ['answer' => $q['answer'], 'steps' => $q['steps'] ?? []];
        return $out;
    }, $paper['questions']);
}

function attemptRow(int $paperId, int $playerId): ?array
{
    return q('SELECT * FROM paper_attempts WHERE paper_id = ? AND player_id = ?', [$paperId, $playerId])->fetch() ?: null;
}

/**
 * Starts (or resumes) a child's one go. The deadline is the server's: the paper's minutes from
 * the first start, cut short by the competition's end. Resuming keeps the original deadline.
 */
function startAttempt(array $paper, array $me, int $closesAt, ?int $schoolId = null): array
{
    $a = attemptRow((int)$paper['id'], (int)$me['id']);
    if ($a && $a['submitted_at']) respond(409, ['error' => 'You have already handed in this paper']);
    if (!$a) {
        if ($closesAt <= time()) respond(422, ['error' => 'This competition has closed']);
        $deadline = min(time() + (int)$paper['minutes'] * 60, $closesAt);
        q('INSERT INTO paper_attempts (paper_id, player_id, school_id, started_at, deadline) VALUES (?, ?, ?, ?, ?)', [$paper['id'], $me['id'], $schoolId, at(time()), at($deadline)]);
        $a = attemptRow((int)$paper['id'], (int)$me['id']);
    }
    $left = strtotime($a['deadline']) - time();
    if ($left <= 0) respond(422, ['error' => 'Your time for this paper is up']);
    return ['questions' => paperQuestions($paper, false), 'seconds_left' => $left, 'deadline' => iso($a['deadline'])];
}

/** Marks a hand-in. `picks` holds one chosen answer (or null) per question. */
function submitAttempt(array $paper, array $me, mixed $picks): array
{
    $a = attemptRow((int)$paper['id'], (int)$me['id']) ?? respond(422, ['error' => 'Start the paper first']);
    if ($a['submitted_at']) respond(409, ['error' => 'You have already handed in this paper']);
    if (time() > strtotime($a['deadline']) + SUBMIT_GRACE) respond(422, ['error' => 'Time was up before your paper arrived']);
    $qs = $paper['questions'];
    if (!is_array($picks) || count($picks) !== count($qs)) respond(422, ['error' => 'Send one answer per question']);
    $clean = [];
    $correct = 0;
    foreach (array_values($picks) as $i => $p) {
        $p = is_string($p) && in_array($p, $qs[$i]['choices'], true) ? $p : null;
        $clean[] = $p;
        if ($p === $qs[$i]['answer']) $correct++;
    }
    $seconds = max(1, min(time(), strtotime($a['deadline'])) - strtotime($a['started_at']));
    q('UPDATE paper_attempts SET submitted_at = ?, picks = ?, correct = ?, seconds = ? WHERE paper_id = ? AND player_id = ?',
      [at(time()), json_encode($clean, JSON_UNESCAPED_UNICODE), $correct, $seconds, $paper['id'], $me['id']]);
    return ['correct' => $correct, 'total' => count($qs), 'seconds' => $seconds];
}

/** A child's paper gone through: their picks next to the answers. Only after the results are out. */
function paperReview(array $paper, array $attempt): array
{
    $picks = $attempt['picks'] ? json_decode($attempt['picks'], true) : [];
    $qs = paperQuestions($paper, true);
    foreach ($qs as $i => &$q) $q['picked'] = $picks[$i] ?? null;
    return $qs;
}

function attemptOut(?array $a, int $total): array
{
    if (!$a) return ['state' => 'not_started'];
    if (!$a['submitted_at']) return ['state' => strtotime($a['deadline']) + SUBMIT_GRACE < time() ? 'missed' : 'started', 'deadline' => iso($a['deadline'])];
    return ['state' => 'done', 'correct' => (int)$a['correct'], 'total' => $total, 'seconds' => (int)$a['seconds']];
}

// ---------- school contests ----------

function contestRow(int $id): array
{
    return q('SELECT * FROM school_contests WHERE id = ?', [$id])->fetch() ?: respond(404, ['error' => 'Competition not found']);
}

/** pending · expired (never accepted in time) · declined · cancelled · upcoming · live · finished */
function contestPhase(array $c): string
{
    $now = time();
    if ($c['status'] === 'pending') return strtotime($c['starts_at']) <= $now ? 'expired' : 'pending';
    if ($c['status'] !== 'accepted') return $c['status'];
    if ($now < strtotime($c['starts_at'])) return 'upcoming';
    return $now < strtotime($c['ends_at']) ? 'live' : 'finished';
}

function schoolName(int $id): array
{
    $s = q('SELECT id, name, district FROM schools WHERE id = ?', [$id])->fetch();
    return $s ? ['id' => (int)$s['id'], 'name' => $s['name'], 'district' => $s['district']] : ['id' => $id, 'name' => 'A school', 'district' => ''];
}

/** Which side a child plays for: a class of that year taught by a teacher of one of the two schools. */
function contestSide(array $c, int $playerId): ?int
{
    $s = q('SELECT t.school_id FROM class_members m JOIN classes c ON c.id = m.class_id JOIN teachers t ON t.id = c.teacher_id
            WHERE m.player_id = ? AND c.grade = ? AND t.school_id IN (?, ?) LIMIT 1', [$playerId, $c['grade'], $c['school_a'], $c['school_b']])->fetchColumn();
    return $s ? (int)$s : null;
}

/**
 * The result: each school's average over its best COUNTED_PUPILS (at least MIN_PUPILS to count),
 * ties broken by the faster average time, plus every pupil's place.
 */
function contestResult(array $c): array
{
    $paper = paperRow((int)$c['paper_id']);
    $total = count($paper['questions']);
    $rows = q('SELECT a.player_id, a.school_id, a.correct, a.seconds, p.name, p.avatar FROM paper_attempts a JOIN players p ON p.id = a.player_id
               WHERE a.paper_id = ? AND a.submitted_at IS NOT NULL ORDER BY a.correct DESC, a.seconds ASC, a.submitted_at ASC', [$c['paper_id']])->fetchAll();
    $schools = [];
    foreach ([(int)$c['school_a'], (int)$c['school_b']] as $sid) {
        $mine = array_values(array_filter($rows, fn ($r) => (int)$r['school_id'] === $sid));
        $counted = array_slice($mine, 0, COUNTED_PUPILS);
        $n = count($counted);
        $schools[] = schoolName($sid) + [
            'players' => count($mine),
            'counted' => $n,
            'valid' => $n >= MIN_PUPILS,
            'average_percent' => $n ? round(array_sum(array_column($counted, 'correct')) / $n / $total * 100, 1) : 0,
            'average_seconds' => $n ? (int)round(array_sum(array_column($counted, 'seconds')) / $n) : 0,
        ];
    }
    [$a, $b] = $schools;
    $winner = null;
    if ($a['valid'] && !$b['valid']) $winner = $a['id'];
    elseif ($b['valid'] && !$a['valid']) $winner = $b['id'];
    elseif ($a['valid'] && $b['valid']) {
        $cmp = [$b['average_percent'], $a['average_seconds']] <=> [$a['average_percent'], $b['average_seconds']];
        $winner = $cmp < 0 ? $a['id'] : ($cmp > 0 ? $b['id'] : null); // exactly level: a draw
    }
    $pupils = array_map(fn ($r, $i) => [
        'rank' => $i + 1, 'id' => (int)$r['player_id'], 'name' => $r['name'], 'avatar' => $r['avatar'], 'school_id' => (int)$r['school_id'],
        'correct' => (int)$r['correct'], 'seconds' => (int)$r['seconds'],
    ], $rows, array_keys($rows));
    return ['schools' => $schools, 'winner_id' => $winner, 'draw' => $winner === null && $a['valid'] && $b['valid'], 'total' => $total, 'pupils' => $pupils];
}

function contestOut(array $c): array
{
    return [
        'id' => (int)$c['id'], 'phase' => contestPhase($c), 'grade' => $c['grade'], 'subject' => $c['subject'],
        'school_a' => schoolName((int)$c['school_a']), 'school_b' => schoolName((int)$c['school_b']),
        'starts_at' => iso($c['starts_at']), 'ends_at' => iso($c['ends_at']),
        'questions' => CONTEST_QUESTIONS, 'minutes' => CONTEST_MINUTES,
    ];
}

/** The competitions a child can see: accepted ones for their class at their school, recent first. */
function playerContests(array $me): array
{
    $sides = q('SELECT DISTINCT t.school_id, c.grade FROM class_members m JOIN classes c ON c.id = m.class_id JOIN teachers t ON t.id = c.teacher_id
                WHERE m.player_id = ? AND t.school_id IS NOT NULL', [$me['id']])->fetchAll();
    $found = [];
    foreach ($sides as $s) {
        $rows = q("SELECT * FROM school_contests WHERE status = 'accepted' AND grade = ? AND (school_a = ? OR school_b = ?) AND ends_at > ?",
                  [$s['grade'], $s['school_id'], $s['school_id'], at(time() - 14 * 86400)])->fetchAll();
        foreach ($rows as $c) $found[(int)$c['id']] = $c;
    }
    usort($found, fn ($a, $b) => strcmp($b['starts_at'], $a['starts_at']));
    return array_map(function ($c) use ($me) {
        $o = contestOut($c) + ['my_school_id' => contestSide($c, (int)$me['id'])];
        $o['mine'] = attemptOut(attemptRow((int)$c['paper_id'], (int)$me['id']), CONTEST_QUESTIONS);
        if ($o['phase'] === 'finished') {
            $r = contestResult($c);
            $o['summary'] = ['winner_id' => $r['winner_id'], 'draw' => $r['draw']];
        }
        return $o;
    }, $found);
}

/** One competition for a child: their go, and the results and their paper once it is over. */
function playerContest(array $me, int $id): array
{
    $c = contestRow($id);
    $side = contestSide($c, (int)$me['id']);
    if (!$side || $c['status'] !== 'accepted') respond(404, ['error' => 'Competition not found']);
    $out = contestOut($c) + ['my_school_id' => $side];
    $a = attemptRow((int)$c['paper_id'], (int)$me['id']);
    $out['mine'] = attemptOut($a, CONTEST_QUESTIONS);
    if ($out['phase'] === 'live') {
        $out['played_so_far'] = (int)q('SELECT COUNT(*) FROM paper_attempts WHERE paper_id = ? AND school_id = ? AND submitted_at IS NOT NULL', [$c['paper_id'], $side])->fetchColumn();
    }
    if ($out['phase'] === 'finished') {
        $r = contestResult($c);
        $mine = array_values(array_filter($r['pupils'], fn ($p) => $p['id'] === (int)$me['id']))[0] ?? null;
        $inSchool = array_values(array_filter($r['pupils'], fn ($p) => $p['school_id'] === $side));
        $out['result'] = [
            'schools' => $r['schools'], 'winner_id' => $r['winner_id'], 'draw' => $r['draw'],
            // the top 10 of the whole competition (first names and animals, as in leagues)
            'top' => array_map(fn ($p) => $p + ['me' => $p['id'] === (int)$me['id']], array_slice($r['pupils'], 0, 10)),
            'my_rank' => $mine['rank'] ?? null,
            'my_school_rank' => $mine ? array_search($mine['id'], array_column($inSchool, 'id'), true) + 1 : null,
            'counted' => $mine && array_search($mine['id'], array_column($inSchool, 'id'), true) < COUNTED_PUPILS,
            'entrants' => count($r['pupils']),
        ];
        if ($a && $a['submitted_at']) $out['review'] = paperReview(paperRow((int)$c['paper_id']), $a);
    }
    return $out;
}

// ---------- school contests: teachers ----------

function teacherSchoolRow(array $t): ?array
{
    if (!$t['school_id']) return null;
    $s = q('SELECT * FROM schools WHERE id = ?', [$t['school_id']])->fetch();
    return $s ? schoolRow($s) + ['open_to_challenges' => (bool)$s['open_to_challenges']] : null;
}

function setTeacherSchool(array $t, int $schoolId): array
{
    $s = q("SELECT * FROM schools WHERE id = ? AND status = 'approved'", [$schoolId])->fetch() ?: respond(422, ['error' => 'Choose an approved school']);
    q('UPDATE teachers SET school_id = ?, school = ? WHERE id = ?', [$s['id'], $s['name'], $t['id']]);
    $t['school_id'] = $s['id'];
    return teacherSchoolRow($t);
}

function teacherSearchSchools(string $q): array
{
    $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
    $rows = q("SELECT * FROM schools WHERE status = 'approved' AND (name LIKE ? OR district LIKE ?) ORDER BY name LIMIT 20", [$like, $like])->fetchAll();
    return array_map(fn ($r) => schoolRow($r) + ['open_to_challenges' => (bool)$r['open_to_challenges']], $rows);
}

function requireTeacherSchool(array $t): int
{
    if (!$t['school_id']) respond(422, ['error' => 'First choose your school']);
    return (int)$t['school_id'];
}

function createContest(array $t, array $d): void
{
    $mine = requireTeacherSchool($t);
    $other = intIn($d, 'school_id', 1, PHP_INT_MAX);
    if ($other === $mine) respond(422, ['error' => 'Choose a different school']);
    $s = q("SELECT * FROM schools WHERE id = ? AND status = 'approved'", [$other])->fetch() ?: respond(422, ['error' => 'School not found']);
    if (!$s['open_to_challenges']) respond(422, ['error' => "{$s['name']} is not taking challenges at the moment"]);
    $grade = oneOf($d, 'grade', GRADES);
    $subject = oneOf($d, 'subject', PAPER_SUBJECTS);
    if (!in_array($subject, paperSubjects($grade), true)) respond(422, ['error' => 'There are not enough checked questions for that class and subject yet']);
    $starts = strtotime((string)($d['starts_at'] ?? ''));
    if (!$starts || $starts < time() + 15 * 60 || $starts > time() + 30 * 86400) respond(422, ['error' => 'Choose a start time from 15 minutes to 30 days from now']);
    $window = isset($d['window_minutes']) ? intIn($d, 'window_minutes', CONTEST_MINUTES, 180) : 30;
    // no flooding: three challenges a week per school, and one open challenge between two schools
    if ((int)q('SELECT COUNT(*) FROM school_contests WHERE school_a = ? AND created_at > ?', [$mine, at(time() - 7 * 86400)])->fetchColumn() >= 3) {
        respond(429, ['error' => 'Your school can send 3 challenges a week']);
    }
    $open = q("SELECT 1 FROM school_contests WHERE ((school_a = ? AND school_b = ?) OR (school_a = ? AND school_b = ?))
               AND status IN ('pending', 'accepted') AND ends_at > ?", [$mine, $other, $other, $mine, at(time())])->fetchColumn();
    if ($open) respond(409, ['error' => 'There is already a challenge between your two schools']);
    q('INSERT INTO school_contests (school_a, school_b, created_by, grade, subject, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [$mine, $other, $t['id'], $grade, $subject, at($starts), at($starts + $window * 60)]);
}

function teacherContest(array $t, int $id): array
{
    $c = contestRow($id);
    if (!in_array((int)$t['school_id'], [(int)$c['school_a'], (int)$c['school_b']], true)) respond(404, ['error' => 'Competition not found']);
    return $c;
}

function answerContest(array $t, int $id, bool $accept): void
{
    $c = teacherContest($t, $id);
    if ((int)$c['school_b'] !== (int)$t['school_id'] || contestPhase($c) !== 'pending') respond(422, ['error' => 'This challenge can no longer be answered']);
    if ($accept) {
        // the paper is built now, by the server: the same questions for both schools
        $paper = buildPaper($c['subject'], $c['grade'], CONTEST_QUESTIONS, CONTEST_MINUTES);
        q("UPDATE school_contests SET status = 'accepted', paper_id = ?, answered_by = ? WHERE id = ?", [$paper, $t['id'], $id]);
    } else {
        q("UPDATE school_contests SET status = 'declined', answered_by = ? WHERE id = ?", [$t['id'], $id]);
    }
}

function cancelContest(array $t, int $id): void
{
    $c = teacherContest($t, $id);
    if (!in_array(contestPhase($c), ['pending', 'upcoming'], true)) respond(422, ['error' => 'Only a challenge that has not started can be called off']);
    q("UPDATE school_contests SET status = 'cancelled' WHERE id = ?", [$id]);
}

function teacherContests(array $t): array
{
    $school = teacherSchoolRow($t);
    $list = [];
    if ($school) {
        $rows = q('SELECT * FROM school_contests WHERE (school_a = ? OR school_b = ?) AND created_at > ? ORDER BY starts_at DESC LIMIT 50',
                  [$t['school_id'], $t['school_id'], at(time() - 90 * 86400)])->fetchAll();
        foreach ($rows as $c) {
            $o = contestOut($c) + ['ours' => (int)$c['school_a'] === (int)$t['school_id'] ? 'a' : 'b'];
            if ($o['phase'] === 'finished') {
                $r = contestResult($c);
                $o['summary'] = ['schools' => $r['schools'], 'winner_id' => $r['winner_id'], 'draw' => $r['draw']];
            }
            if ($o['phase'] === 'live') {
                $o['played_so_far'] = (int)q('SELECT COUNT(*) FROM paper_attempts WHERE paper_id = ? AND school_id = ? AND submitted_at IS NOT NULL', [$c['paper_id'], $t['school_id']])->fetchColumn();
            }
            $list[] = $o;
        }
    }
    return ['school' => $school, 'contests' => $list];
}

/** A finished competition for a teacher: both schools, and every one of their own pupils. */
function teacherContestDetail(array $t, int $id): array
{
    $c = teacherContest($t, $id);
    $out = contestOut($c);
    if ($out['phase'] !== 'finished') return $out;
    $r = contestResult($c);
    $out['result'] = ['schools' => $r['schools'], 'winner_id' => $r['winner_id'], 'draw' => $r['draw'], 'total' => $r['total'],
        'top' => array_slice($r['pupils'], 0, 10),
        'our_pupils' => array_values(array_filter($r['pupils'], fn ($p) => $p['school_id'] === (int)$t['school_id']))];
    // the paper, so the class can go through it together
    $out['paper'] = paperQuestions(paperRow((int)$c['paper_id']), true);
    return $out;
}

// ---------- duels between friends ----------

function duelRow(int $id, array $me): array
{
    $d = q('SELECT * FROM duels WHERE id = ? AND (challenger_id = ? OR opponent_id = ?)', [$id, $me['id'], $me['id']])->fetch();
    return $d ?: respond(404, ['error' => 'Duel not found']);
}

/** open · declined · done (both played) · expired */
function duelPhase(array $d): string
{
    if ($d['status'] === 'declined') return 'declined';
    $done = (int)q('SELECT COUNT(*) FROM paper_attempts WHERE paper_id = ? AND submitted_at IS NOT NULL', [$d['paper_id']])->fetchColumn();
    if ($done >= 2) return 'done';
    return strtotime($d['expires_at']) <= time() ? 'expired' : 'open';
}

function createDuel(array $me, int $friendId, string $subject): array
{
    $f = q('SELECT p.* FROM friends fr JOIN players p ON p.id = fr.friend_id WHERE fr.player_id = ? AND fr.friend_id = ?', [$me['id'], $friendId])->fetch();
    if (!$f) respond(422, ['error' => 'You can only challenge your friends']);
    // friends in different classes play the younger class's paper
    $grade = GRADES[min(array_search($me['grade'], GRADES, true), array_search($f['grade'], GRADES, true))];
    if ((int)q('SELECT COUNT(*) FROM duels WHERE challenger_id = ? AND created_at > ?', [$me['id'], at(time() - 86400)])->fetchColumn() >= 5) {
        respond(429, ['error' => 'You can start 5 duels a day']);
    }
    $open = q("SELECT * FROM duels WHERE ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?)) AND status = 'open' AND expires_at > ?",
              [$me['id'], $friendId, $friendId, $me['id'], at(time())])->fetchAll();
    if (array_filter($open, fn ($d) => duelPhase($d) === 'open')) respond(409, ['error' => "You already have a duel with {$f['name']}. Finish that one first"]);
    $paper = buildPaper($subject, $grade, DUEL_QUESTIONS, DUEL_MINUTES);
    q('INSERT INTO duels (paper_id, challenger_id, opponent_id, grade, subject, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [$paper, $me['id'], $friendId, $grade, $subject, at(time() + DUEL_HOURS * 3600)]);
    return duelOut(duelRow((int)db()->lastInsertId(), $me), $me);
}

function duelOut(array $d, array $me, bool $full = false): array
{
    $mine = (int)$d['challenger_id'] === (int)$me['id'];
    $otherId = $mine ? (int)$d['opponent_id'] : (int)$d['challenger_id'];
    $other = q('SELECT id, name, avatar FROM players WHERE id = ?', [$otherId])->fetch();
    $phase = duelPhase($d);
    $myA = attemptRow((int)$d['paper_id'], (int)$me['id']);
    $theirA = attemptRow((int)$d['paper_id'], $otherId);
    $out = [
        'id' => (int)$d['id'], 'phase' => $phase, 'i_challenged' => $mine, 'grade' => $d['grade'], 'subject' => $d['subject'],
        'other' => ['id' => $otherId, 'name' => $other['name'] ?? 'A friend', 'avatar' => $other['avatar'] ?? '🙂'],
        'questions' => DUEL_QUESTIONS, 'minutes' => DUEL_MINUTES, 'expires_at' => iso($d['expires_at']),
        'mine' => attemptOut($myA, DUEL_QUESTIONS),
        // until it is over, a child only learns that their friend has played, never their score
        'they_played' => (bool)($theirA['submitted_at'] ?? null),
    ];
    if (in_array($phase, ['done', 'expired'], true)) {
        $out['theirs'] = attemptOut($theirA, DUEL_QUESTIONS);
        if ($phase === 'done') {
            $cmp = [(int)$myA['correct'], -(int)$myA['seconds']] <=> [(int)$theirA['correct'], -(int)$theirA['seconds']];
            $out['outcome'] = $cmp > 0 ? 'won' : ($cmp < 0 ? 'lost' : 'draw');
        }
        if ($full && $myA && $myA['submitted_at']) $out['review'] = paperReview(paperRow((int)$d['paper_id']), $myA);
    }
    return $out;
}

function myDuels(array $me): array
{
    $rows = q('SELECT * FROM duels WHERE (challenger_id = ? OR opponent_id = ?) AND created_at > ? ORDER BY created_at DESC LIMIT 30',
              [$me['id'], $me['id'], at(time() - 14 * 86400)])->fetchAll();
    return array_map(fn ($d) => duelOut($d, $me), $rows);
}

function declineDuel(array $me, int $id): void
{
    $d = duelRow($id, $me);
    if ((int)$d['opponent_id'] !== (int)$me['id'] || duelPhase($d) !== 'open' || attemptRow((int)$d['paper_id'], (int)$me['id'])) {
        respond(422, ['error' => 'This duel can no longer be declined']);
    }
    q("UPDATE duels SET status = 'declined' WHERE id = ?", [$id]);
}

function startDuel(array $me, int $id): array
{
    $d = duelRow($id, $me);
    if (duelPhase($d) !== 'open') respond(422, ['error' => 'This duel is over']);
    return startAttempt(paperRow((int)$d['paper_id']), $me, strtotime($d['expires_at']));
}

function submitDuel(array $me, int $id, mixed $picks): array
{
    $d = duelRow($id, $me);
    if ($d['status'] === 'declined') respond(422, ['error' => 'This duel was declined']);
    submitAttempt(paperRow((int)$d['paper_id']), $me, $picks);
    $out = duelOut($d, $me, true);
    // the second hand-in decides it: a win makes the news
    if (($out['outcome'] ?? null) === 'won') {
        addEvent((int)$me['id'], 'duel_win', "beat {$out['other']['name']} in a " . gradeName($d['grade']) . ' ' . (SUBJECT_NAMES[$d['subject']] ?? 'mixed') . ' duel ⚔️');
    } elseif (($out['outcome'] ?? null) === 'lost') {
        addEvent($out['other']['id'], 'duel_win', "beat {$me['name']} in a " . gradeName($d['grade']) . ' ' . (SUBJECT_NAMES[$d['subject']] ?? 'mixed') . ' duel ⚔️');
    }
    return $out;
}
