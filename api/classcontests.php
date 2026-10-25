<?php
// Class vs class inside one school, on the Paper Engine (api/compete.php): two to six classes of the
// same year answer one server-built paper in a time window. Scored like School vs School: each class's
// average over its best COUNTED_PUPILS, at least MIN_PUPILS to count.
declare(strict_types=1);

const CLASS_CONTESTS_PER_WEEK = 5; // per school

function classContestRow(int $id): array
{
    return q('SELECT * FROM class_contests WHERE id = ?', [$id])->fetch() ?: respond(404, ['error' => 'Competition not found']);
}

/** cancelled · upcoming · live · finished */
function classContestPhase(array $c): string
{
    if ($c['status'] === 'cancelled') return 'cancelled';
    if (time() < strtotime($c['starts_at'])) return 'upcoming';
    return time() < strtotime($c['ends_at']) ? 'live' : 'finished';
}

/** The classes taking part, with their teachers. */
function classContestClasses(array $c): array
{
    $rows = q('SELECT cl.id, cl.name, cl.teacher_id, t.name AS teacher FROM class_contest_classes cc JOIN classes cl ON cl.id = cc.class_id
               JOIN teachers t ON t.id = cl.teacher_id WHERE cc.contest_id = ? ORDER BY cl.name', [$c['id']])->fetchAll();
    return array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'teacher' => $r['teacher'], 'teacher_id' => (int)$r['teacher_id']], $rows);
}

/** The class a child plays for (the first of their classes that is taking part). */
function classContestSide(array $c, int $playerId): ?int
{
    $id = q('SELECT m.class_id FROM class_members m JOIN class_contest_classes cc ON cc.class_id = m.class_id AND cc.contest_id = ?
             WHERE m.player_id = ? ORDER BY m.class_id LIMIT 1', [$c['id'], $playerId])->fetchColumn();
    return $id ? (int)$id : null;
}

/** Classes ranked (best average first, then faster), and every pupil's place. */
function classContestResult(array $c): array
{
    $total = count(paperRow((int)$c['paper_id'])['questions']);
    $rows = q('SELECT a.player_id, a.class_id, a.correct, a.seconds, p.name, p.avatar FROM paper_attempts a JOIN players p ON p.id = a.player_id
               WHERE a.paper_id = ? AND a.submitted_at IS NOT NULL ORDER BY a.correct DESC, a.seconds ASC, a.submitted_at ASC', [$c['paper_id']])->fetchAll();
    $pupils = array_map(fn ($r, $i) => ['rank' => $i + 1, 'id' => (int)$r['player_id'], 'name' => $r['name'], 'avatar' => $r['avatar'],
        'class_id' => (int)$r['class_id'], 'correct' => (int)$r['correct'], 'seconds' => (int)$r['seconds']], $rows, array_keys($rows));
    $classes = [];
    foreach (classContestClasses($c) as $cl) {
        $mine = array_values(array_filter($pupils, fn ($p) => $p['class_id'] === $cl['id']));
        $counted = array_slice($mine, 0, COUNTED_PUPILS);
        $n = count($counted);
        $classes[] = ['id' => $cl['id'], 'name' => $cl['name'], 'teacher' => $cl['teacher'], 'players' => count($mine), 'counted' => $n, 'valid' => $n >= MIN_PUPILS,
            'average_percent' => $n ? round(array_sum(array_column($counted, 'correct')) / $n / $total * 100, 1) : 0,
            'average_seconds' => $n ? (int)round(array_sum(array_column($counted, 'seconds')) / $n) : 0];
    }
    // classes that count first, then best average, then faster
    usort($classes, fn ($a, $b) => [$b['valid'], $b['average_percent'], $a['average_seconds']] <=> [$a['valid'], $a['average_percent'], $b['average_seconds']]);
    $top = $classes[0] ?? null;
    $second = $classes[1] ?? null;
    $draw = $top && $second && $top['valid'] && $second['valid'] && $top['average_percent'] === $second['average_percent'] && $top['average_seconds'] === $second['average_seconds'];
    return ['classes' => $classes, 'winner_id' => $top && $top['valid'] && !$draw ? $top['id'] : null, 'draw' => $draw, 'total' => $total, 'pupils' => $pupils];
}

function classContestOut(array $c): array
{
    $paper = paperRow((int)$c['paper_id']);
    return [
        'id' => (int)$c['id'], 'phase' => classContestPhase($c), 'grade' => $c['grade'], 'subject' => $c['subject'],
        'classes' => array_map(fn ($cl) => ['id' => $cl['id'], 'name' => $cl['name'], 'teacher' => $cl['teacher']], classContestClasses($c)),
        'starts_at' => iso($c['starts_at']), 'ends_at' => iso($c['ends_at']),
        'questions' => count($paper['questions']), 'minutes' => (int)$paper['minutes'],
    ];
}

// ---------- teachers ----------

/** Classes of one year at the teacher's school (any teacher's), to choose from. */
function schoolClassesOfYear(array $t, string $grade): array
{
    $school = requireTeacherSchool($t);
    $rows = q('SELECT cl.id, cl.name, t.name AS teacher, (SELECT COUNT(*) FROM class_members m WHERE m.class_id = cl.id) AS pupils
               FROM classes cl JOIN teachers t ON t.id = cl.teacher_id WHERE t.school_id = ? AND cl.grade = ? ORDER BY cl.name', [$school, $grade])->fetchAll();
    return array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'teacher' => $r['teacher'], 'pupils' => (int)$r['pupils']], $rows);
}

function createClassContest(array $t, array $d): void
{
    $school = requireTeacherSchool($t);
    $grade = oneOf($d, 'grade', GRADES);
    $subject = oneOf($d, 'subject', PAPER_SUBJECTS);
    $ids = array_values(array_unique(array_map('intval', is_array($d['class_ids'] ?? null) ? $d['class_ids'] : [])));
    if (count($ids) < 2 || count($ids) > 6) respond(422, ['error' => 'Choose 2 to 6 classes']);
    $allowed = array_column(schoolClassesOfYear($t, $grade), 'id');
    foreach ($ids as $id) if (!in_array($id, $allowed, true)) respond(422, ['error' => 'Choose classes of that year at your school']);
    if (!in_array($subject, paperSubjects($grade), true)) respond(422, ['error' => 'There are not enough checked questions for that class and subject yet']);
    $starts = strtotime((string)($d['starts_at'] ?? ''));
    if (!$starts || $starts < time() + 5 * 60 || $starts > time() + 30 * 86400) respond(422, ['error' => 'Choose a start time from 5 minutes to 30 days from now']);
    $window = isset($d['window_minutes']) ? intIn($d, 'window_minutes', CONTEST_MINUTES, 180) : 30;
    if ((int)q('SELECT COUNT(*) FROM class_contests WHERE school_id = ? AND created_at > ?', [$school, at(time() - 7 * 86400)])->fetchColumn() >= CLASS_CONTESTS_PER_WEEK) {
        respond(429, ['error' => 'Your school can set up ' . CLASS_CONTESTS_PER_WEEK . ' class contests a week']);
    }
    // built now: no teacher can see it, and the server keeps the answers until it ends
    $paper = buildPaper($subject, $grade, CONTEST_QUESTIONS, CONTEST_MINUTES);
    q('INSERT INTO class_contests (school_id, grade, subject, starts_at, ends_at, paper_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [$school, $grade, $subject, at($starts), at($starts + $window * 60), $paper, $t['id']]);
    $cid = (int)db()->lastInsertId();
    foreach ($ids as $id) q('INSERT INTO class_contest_classes (contest_id, class_id) VALUES (?, ?)', [$cid, $id]);
}

function teacherClassContest(array $t, int $id): array
{
    $c = classContestRow($id);
    if ((int)$c['school_id'] !== (int)$t['school_id']) respond(404, ['error' => 'Competition not found']);
    return $c;
}

/** Called off before it starts, by the teacher who set it up or a teacher of one of the classes. */
function cancelClassContest(array $t, int $id): void
{
    $c = teacherClassContest($t, $id);
    $teachers = array_column(classContestClasses($c), 'teacher_id');
    if ((int)$c['created_by'] !== (int)$t['id'] && !in_array((int)$t['id'], $teachers, true)) respond(403, ['error' => 'Only the teachers of these classes can call it off']);
    if (classContestPhase($c) !== 'upcoming') respond(422, ['error' => 'Only a contest that has not started can be called off']);
    q("UPDATE class_contests SET status = 'cancelled' WHERE id = ?", [$id]);
}

function teacherClassContests(array $t): array
{
    if (!$t['school_id']) return [];
    $rows = q('SELECT * FROM class_contests WHERE school_id = ? AND created_at > ? ORDER BY starts_at DESC LIMIT 50', [$t['school_id'], at(time() - 90 * 86400)])->fetchAll();
    return array_map(function ($c) use ($t) {
        $o = classContestOut($c);
        $o['can_cancel'] = $o['phase'] === 'upcoming'
            && ((int)$c['created_by'] === (int)$t['id'] || in_array((int)$t['id'], array_column(classContestClasses($c), 'teacher_id'), true));
        if ($o['phase'] === 'finished') {
            $r = classContestResult($c);
            $o['summary'] = ['classes' => $r['classes'], 'winner_id' => $r['winner_id'], 'draw' => $r['draw']];
        }
        return $o;
    }, $rows);
}

/** A finished class contest for a teacher: every class's score, and names only of their own pupils. */
function teacherClassContestDetail(array $t, int $id): array
{
    $c = teacherClassContest($t, $id);
    $out = classContestOut($c);
    if ($out['phase'] !== 'finished') return $out;
    $r = classContestResult($c);
    $own = array_column(array_filter(classContestClasses($c), fn ($cl) => $cl['teacher_id'] === (int)$t['id']), 'id');
    $out['result'] = ['classes' => $r['classes'], 'winner_id' => $r['winner_id'], 'draw' => $r['draw'], 'total' => $r['total'],
        'our_pupils' => array_values(array_filter($r['pupils'], fn ($p) => in_array($p['class_id'], $own, true)))];
    $out['paper'] = paperQuestions(paperRow((int)$c['paper_id']), true);
    return $out;
}

// ---------- children ----------

/** Class contests a child takes part in (their classes are in it), recent first. */
function playerClassContests(array $me): array
{
    $rows = q("SELECT DISTINCT c.* FROM class_contests c JOIN class_contest_classes cc ON cc.contest_id = c.id
               JOIN class_members m ON m.class_id = cc.class_id AND m.player_id = ?
               WHERE c.status = 'on' AND c.ends_at > ? ORDER BY c.starts_at DESC", [$me['id'], at(time() - 14 * 86400)])->fetchAll();
    return array_map(function ($c) use ($me) {
        $o = classContestOut($c) + ['my_class_id' => classContestSide($c, (int)$me['id'])];
        $o['mine'] = attemptOut(attemptRow((int)$c['paper_id'], (int)$me['id']), $o['questions']);
        if ($o['phase'] === 'finished') {
            $r = classContestResult($c);
            $o['summary'] = ['winner_id' => $r['winner_id'], 'draw' => $r['draw']];
        }
        return $o;
    }, $rows);
}

function playerClassContest(array $me, int $id): array
{
    $c = classContestRow($id);
    $side = classContestSide($c, (int)$me['id']);
    if (!$side || $c['status'] !== 'on') respond(404, ['error' => 'Competition not found']);
    $out = classContestOut($c) + ['my_class_id' => $side];
    $a = attemptRow((int)$c['paper_id'], (int)$me['id']);
    $out['mine'] = attemptOut($a, $out['questions']);
    if ($out['phase'] === 'finished') {
        $r = classContestResult($c);
        $mine = array_values(array_filter($r['pupils'], fn ($p) => $p['id'] === (int)$me['id']))[0] ?? null;
        $inClass = array_column(array_values(array_filter($r['pupils'], fn ($p) => $p['class_id'] === $side)), 'id');
        $at = $mine ? array_search($mine['id'], $inClass, true) : false;
        $out['result'] = [
            'classes' => $r['classes'], 'winner_id' => $r['winner_id'], 'draw' => $r['draw'],
            'top' => array_map(fn ($p) => $p + ['me' => $p['id'] === (int)$me['id']], array_slice($r['pupils'], 0, 10)),
            'my_rank' => $mine['rank'] ?? null,
            'my_class_rank' => $at === false ? null : $at + 1,
            'counted' => $at !== false && $at < COUNTED_PUPILS,
            'entrants' => count($r['pupils']),
        ];
        if ($a && $a['submitted_at']) $out['review'] = paperReview(paperRow((int)$c['paper_id']), $a);
    }
    return $out;
}

function startClassContest(array $me, int $id): array
{
    $c = classContestRow($id);
    $side = classContestSide($c, (int)$me['id']);
    if (!$side || $c['status'] !== 'on') respond(404, ['error' => 'Competition not found']);
    $phase = classContestPhase($c);
    if ($phase !== 'live') respond(422, ['error' => $phase === 'upcoming' ? 'It has not started yet' : 'This competition has closed']);
    return startAttempt(paperRow((int)$c['paper_id']), $me, strtotime($c['ends_at']), null, $side);
}

function submitClassContest(array $me, int $id, mixed $picks): array
{
    $c = classContestRow($id);
    if (!classContestSide($c, (int)$me['id']) || $c['status'] !== 'on') respond(404, ['error' => 'Competition not found']);
    return submitAttempt(paperRow((int)$c['paper_id']), $me, $picks);
}

/** Live class contests this child hasn't handed in (for the dot on Home). */
function classContestsWaiting(array $me): int
{
    $now = at(time());
    return (int)q("SELECT COUNT(DISTINCT c.id) FROM class_contests c JOIN class_contest_classes cc ON cc.contest_id = c.id
                   JOIN class_members m ON m.class_id = cc.class_id AND m.player_id = ?
                   WHERE c.status = 'on' AND c.starts_at <= ? AND c.ends_at > ?
                   AND NOT EXISTS (SELECT 1 FROM paper_attempts a WHERE a.paper_id = c.paper_id AND a.player_id = ? AND a.submitted_at IS NOT NULL)",
                  [$me['id'], $now, $now, $me['id']])->fetchColumn();
}
