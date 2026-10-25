<?php
// Teachers, classes and homework. A teacher only ever sees pupils who joined with the class code.
declare(strict_types=1);

const MAX_CLASSES_PER_PUPIL = 3;

function requireTeacher(): array
{
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', header_('Authorization'), $m)) respond(401, ['error' => 'Please sign in']);
    $t = q('SELECT tr.* FROM teacher_tokens tt JOIN teachers tr ON tr.id = tt.teacher_id WHERE tt.token_hash = ? AND tt.created_at > NOW() - INTERVAL 30 DAY', [tokenHash($m[1])])->fetch();
    if (!$t) respond(401, ['error' => 'Please sign in']);
    return $t;
}

function teacherPayload(array $t): array
{
    return ['id' => (int)$t['id'], 'name' => $t['name'], 'phone' => $t['phone'], 'school' => $t['school']];
}

function signInTeacher(array $t): never
{
    q('DELETE FROM teacher_tokens WHERE created_at < NOW() - INTERVAL 30 DAY'); // tidy expired sign-ins
    $token = newToken();
    q('INSERT INTO teacher_tokens (token_hash, teacher_id) VALUES (?, ?)', [tokenHash($token), $t['id']]);
    q('UPDATE teachers SET failed_logins = 0, locked_until = NULL WHERE id = ?', [$t['id']]);
    respond(200, ['token' => $token, 'teacher' => teacherPayload($t)]);
}

function teacherRegister(array $d): never
{
    $phone = ugPhone((string)($d['phone'] ?? '')) ?? respond(422, ['error' => 'Enter a Ugandan phone number, like 0772 123456']);
    $password = (string)($d['password'] ?? '');
    if (strlen($password) < 8) respond(422, ['error' => 'The password must be at least 8 characters']);
    if (q('SELECT 1 FROM teachers WHERE phone = ?', [$phone])->fetchColumn()) respond(409, ['error' => 'This number already has a teacher account. Sign in instead.']);
    q('INSERT INTO teachers (name, phone, password_hash, school) VALUES (?, ?, ?, ?)', [text($d, 'name', 80), $phone, password_hash($password, PASSWORD_DEFAULT), text($d, 'school', 80, false) ?: null]);
    signInTeacher(q('SELECT * FROM teachers WHERE phone = ?', [$phone])->fetch());
}

function teacherLogin(array $d): never
{
    $phone = ugPhone((string)($d['phone'] ?? ''));
    $t = $phone ? q('SELECT * FROM teachers WHERE phone = ?', [$phone])->fetch() : null;
    if ($t && $t['locked_until'] && strtotime($t['locked_until']) > time()) respond(429, ['error' => 'Too many wrong passwords. Try again in 15 minutes.']);
    if (!$t || !password_verify((string)($d['password'] ?? ''), $t['password_hash'])) {
        if ($t) {
            $fails = (int)$t['failed_logins'] + 1;
            $fails >= 5
                ? q('UPDATE teachers SET failed_logins = 0, locked_until = NOW() + INTERVAL 15 MINUTE WHERE id = ?', [$t['id']])
                : q('UPDATE teachers SET failed_logins = ? WHERE id = ?', [$fails, $t['id']]);
        }
        respond(401, ['error' => 'Wrong phone number or password']);
    }
    signInTeacher($t);
}

function newClassCode(): string
{
    for ($try = 0; $try < 20; $try++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= CODE_LETTERS[random_int(0, strlen(CODE_LETTERS) - 1)];
        if (!q('SELECT 1 FROM classes WHERE code = ?', [$code])->fetchColumn()) return $code;
    }
    respond(500, ['error' => 'Could not make a class code']);
}

/** The teacher's own class, or 404: a teacher can never open someone else's class. */
function ownClass(array $teacher, int $classId): array
{
    $c = q('SELECT * FROM classes WHERE id = ? AND teacher_id = ?', [$classId, $teacher['id']])->fetch();
    return $c ?: respond(404, ['error' => 'Class not found']);
}

function teacherClasses(array $teacher): array
{
    $rows = q(
        'SELECT c.*, (SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id) AS pupils FROM classes c WHERE c.teacher_id = ? ORDER BY c.grade, c.name',
        [$teacher['id']],
    )->fetchAll();
    return array_map(fn ($c) => ['id' => (int)$c['id'], 'name' => $c['name'], 'grade' => $c['grade'], 'code' => $c['code'], 'pupils' => (int)$c['pupils']], $rows);
}

function classDetail(array $class): array
{
    $week = weekStart();
    $pupils = q(
        'SELECT p.id, p.name, p.avatar, p.xp_total,
                (SELECT MAX(s.played_at) FROM sprints s WHERE s.player_id = p.id) AS last_played_at,
                (SELECT COUNT(*) FROM sprints s WHERE s.player_id = p.id AND s.played_at >= ?) AS week_sprints,
                (SELECT COALESCE(SUM(s.correct), 0) FROM sprints s WHERE s.player_id = p.id AND s.played_at >= ?) AS week_correct,
                (SELECT COALESCE(SUM(s.total), 0) FROM sprints s WHERE s.player_id = p.id AND s.played_at >= ?) AS week_answered
         FROM class_members m JOIN players p ON p.id = m.player_id WHERE m.class_id = ? ORDER BY p.name',
        [$week, $week, $week, $class['id']],
    )->fetchAll();

    // topics across the class, weakest first: who needs help with what
    $topics = q(
        "SELECT t.subject, t.topic,
                COUNT(*) AS pupils,
                ROUND(AVG(t.recent_correct / NULLIF(t.recent_total, 0)) * 100) AS mastery,
                SUM(t.recent_correct / NULLIF(t.recent_total, 0) < 0.7) AS struggling
         FROM topic_stats t JOIN class_members m ON m.player_id = t.player_id AND m.class_id = ?
         WHERE t.grade = ? AND t.total >= ? GROUP BY t.subject, t.topic ORDER BY mastery ASC",
        [$class['id'], $class['grade'], MIN_ATTEMPTS],
    )->fetchAll();

    $assignments = q('SELECT * FROM assignments WHERE class_id = ? ORDER BY due_on DESC, id DESC LIMIT 30', [$class['id']])->fetchAll();
    $results = q(
        'SELECT r.assignment_id, r.player_id, r.correct, r.total FROM assignment_results r JOIN assignments a ON a.id = r.assignment_id WHERE a.class_id = ?',
        [$class['id']],
    )->fetchAll();
    $byAssignment = [];
    foreach ($results as $r) $byAssignment[(int)$r['assignment_id']][(int)$r['player_id']] = ['correct' => (int)$r['correct'], 'total' => (int)$r['total']];

    return [
        'class' => ['id' => (int)$class['id'], 'name' => $class['name'], 'grade' => $class['grade'], 'code' => $class['code']],
        'pupils' => array_map(fn ($p) => [
            'id' => (int)$p['id'], 'name' => $p['name'], 'avatar' => $p['avatar'], 'xp_total' => (int)$p['xp_total'],
            'last_played_at' => $p['last_played_at'], 'week_sprints' => (int)$p['week_sprints'],
            'week_accuracy' => $p['week_answered'] ? (int)round($p['week_correct'] / $p['week_answered'] * 100) : null,
            'weak' => array_map(fn ($t) => $t['topic'], weakAndStrong((int)$p['id'])['weak']),
            'mock_readiness' => mockHistory((int)$p['id'])['readiness'],
        ], $pupils),
        'topics' => array_map(fn ($t) => ['subject' => $t['subject'], 'topic' => $t['topic'], 'pupils' => (int)$t['pupils'], 'mastery' => (int)$t['mastery'], 'struggling' => (int)$t['struggling']], $topics),
        'assignments' => array_map(fn ($a) => [
            'id' => (int)$a['id'], 'title' => $a['title'], 'subject' => $a['subject'], 'level' => $a['level'], 'topic' => $a['topic'], 'due_on' => $a['due_on'],
            'results' => (object)($byAssignment[(int)$a['id']] ?? []),
        ], $assignments),
    ];
}

function createAssignment(array $class, array $d): void
{
    $level = $d['level'] ?? null;
    $topic = isset($d['topic']) && $d['topic'] !== '' ? (string)$d['topic'] : null;
    if ($level !== null && !in_array($level, LEVELS, true)) respond(422, ['error' => 'Invalid level']);
    if ($topic !== null && !validTopic($topic)) respond(422, ['error' => 'Invalid topic']);
    if (($level === null) === ($topic === null)) respond(422, ['error' => 'Choose a level or a topic']);
    $due = (string)($d['due_on'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $due) || strtotime($due) < strtotime('today')) respond(422, ['error' => 'Choose a due date from today on']);
    q(
        'INSERT INTO assignments (class_id, title, subject, level, topic, due_on) VALUES (?, ?, ?, ?, ?, ?)',
        [$class['id'], text($d, 'title', 80), oneOf($d, 'subject', SUBJECTS), $level, $topic, $due],
    );
}

// ---------- the pupil's side ----------

function joinClass(array $p, string $code): array
{
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
    $class = q('SELECT c.*, t.name AS teacher FROM classes c JOIN teachers t ON t.id = c.teacher_id WHERE c.code = ?', [$code])->fetch();
    if (!$class) respond(404, ['error' => 'No class has that code. Check it with your teacher.']);
    $count = (int)q('SELECT COUNT(*) FROM class_members WHERE player_id = ?', [$p['id']])->fetchColumn();
    if ($count >= MAX_CLASSES_PER_PUPIL && !q('SELECT 1 FROM class_members WHERE class_id = ? AND player_id = ?', [$class['id'], $p['id']])->fetchColumn()) {
        respond(422, ['error' => 'You are already in ' . MAX_CLASSES_PER_PUPIL . ' classes. Leave one first.']);
    }
    q('INSERT IGNORE INTO class_members (class_id, player_id) VALUES (?, ?)', [$class['id'], $p['id']]);
    return ['name' => $class['name'], 'teacher' => $class['teacher']];
}

/** My classes and their homework from the last week onwards, with what I've done. */
function myClasses(array $p): array
{
    $classes = q(
        'SELECT c.id, c.name, c.grade, t.name AS teacher FROM class_members m JOIN classes c ON c.id = m.class_id JOIN teachers t ON t.id = c.teacher_id WHERE m.player_id = ? ORDER BY c.name',
        [$p['id']],
    )->fetchAll();
    $out = [];
    foreach ($classes as $c) {
        $work = q(
            'SELECT a.*, r.correct, r.total FROM assignments a LEFT JOIN assignment_results r ON r.assignment_id = a.id AND r.player_id = ?
             WHERE a.class_id = ? AND a.due_on >= CURDATE() - INTERVAL 7 DAY ORDER BY a.due_on, a.id',
            [$p['id'], $c['id']],
        )->fetchAll();
        $out[] = [
            'id' => (int)$c['id'], 'name' => $c['name'], 'grade' => $c['grade'], 'teacher' => $c['teacher'],
            'homework' => array_map(fn ($a) => [
                'id' => (int)$a['id'], 'title' => $a['title'], 'subject' => $a['subject'], 'level' => $a['level'], 'topic' => $a['topic'], 'due_on' => $a['due_on'],
                'done' => $a['total'] === null ? null : ['correct' => (int)$a['correct'], 'total' => (int)$a['total']],
            ], $work),
        ];
    }
    return $out;
}

/** A sprint played as homework: keep the pupil's best attempt (if they're in that class). */
function recordHomework(array $p, int $assignmentId, int $correct, int $total, int $score, string $playedAt): void
{
    $ok = q('SELECT 1 FROM assignments a JOIN class_members m ON m.class_id = a.class_id AND m.player_id = ? WHERE a.id = ?', [$p['id'], $assignmentId])->fetchColumn();
    if (!$ok) return;
    q(
        'INSERT INTO assignment_results (assignment_id, player_id, correct, total, score, completed_at) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = IF(VALUES(correct) >= correct, VALUES(score), score), completed_at = IF(VALUES(correct) >= correct, VALUES(completed_at), completed_at),
                                 total = IF(VALUES(correct) >= correct, VALUES(total), total), correct = GREATEST(correct, VALUES(correct))',
        [$assignmentId, $p['id'], $correct, $total, $score, $playedAt],
    );
}

/**
 * The whole school at a glance, for any teacher of that school (e.g. the head teacher): every class
 * of every teacher who chose this school, with counts and topics only. No pupil names: those stay
 * with each class's own teacher.
 */
function schoolOverview(array $teacher): array
{
    if (!$teacher['school_id']) respond(422, ['error' => 'First choose your school (under School vs School)']);
    $week = weekStart();
    $classes = q(
        "SELECT c.id, c.name, c.grade, tr.name AS teacher,
                COUNT(DISTINCT m.player_id) AS pupils,
                COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN m.player_id END) AS active,
                COUNT(s.id) AS sprints,
                COALESCE(SUM(s.correct), 0) AS correct, COALESCE(SUM(s.total), 0) AS answered
         FROM classes c JOIN teachers tr ON tr.id = c.teacher_id
         LEFT JOIN class_members m ON m.class_id = c.id
         LEFT JOIN sprints s ON s.player_id = m.player_id AND s.played_at >= ?
         WHERE tr.school_id = ? GROUP BY c.id ORDER BY FIELD(c.grade, 'TOP','P1','P2','P3','P4','P5','P6','P7'), c.name",
        [$week, $teacher['school_id']],
    )->fetchAll();
    $out = [];
    foreach ($classes as $c) {
        $weak = q(
            "SELECT t.subject, t.topic, ROUND(AVG(t.recent_correct / NULLIF(t.recent_total, 0)) * 100) AS mastery, COUNT(*) AS pupils
             FROM topic_stats t JOIN class_members m ON m.player_id = t.player_id AND m.class_id = ?
             WHERE t.grade = ? AND t.total >= ? GROUP BY t.subject, t.topic HAVING pupils >= 2 ORDER BY mastery ASC LIMIT 3",
            [$c['id'], $c['grade'], MIN_ATTEMPTS],
        )->fetchAll();
        $out[] = [
            'id' => (int)$c['id'], 'name' => $c['name'], 'grade' => $c['grade'], 'teacher' => $c['teacher'],
            'pupils' => (int)$c['pupils'], 'active_this_week' => (int)$c['active'], 'sprints_this_week' => (int)$c['sprints'],
            'accuracy' => $c['answered'] ? (int)round($c['correct'] / $c['answered'] * 100) : null,
            'weak_topics' => array_map(fn ($t) => ['subject' => $t['subject'], 'topic' => $t['topic'], 'mastery' => (int)$t['mastery']], $weak),
        ];
    }
    $pupils = array_sum(array_column($out, 'pupils'));
    $active = array_sum(array_column($out, 'active_this_week'));
    return [
        'school' => teacherSchoolRow($teacher),
        'teachers' => (int)q('SELECT COUNT(*) FROM teachers WHERE school_id = ?', [$teacher['school_id']])->fetchColumn(),
        'pupils' => $pupils,
        'active_this_week' => $active,
        'classes' => $out,
    ];
}
