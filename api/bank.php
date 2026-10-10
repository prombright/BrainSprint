<?php
// The question bank: questions written by people (Science, SST, English P4–P7 …), checked by an
// admin before children see them. Maths and lower English are generated in the app instead.
declare(strict_types=1);

const BANK_LEVELS = ['simple', 'medium', 'hard', 'pro'];

/**
 * Checks one question and returns [clean row, null] or [null, "what's wrong"].
 * Used for the editor, for imports (where errors are collected, not thrown) and for teacher suggestions.
 */
function cleanQuestion(array $d): array
{
    $str = fn (string $k) => trim(preg_replace('/\s+/u', ' ', (string)($d[$k] ?? '')));
    $subject = $str('subject');
    $grade = strtoupper($str('grade'));
    $level = strtolower($str('level'));
    $topic = strtolower($str('topic'));
    $prompt = $str('prompt');
    $speak = $str('speak');
    $answer = $str('answer');
    $choices = array_values(array_filter(array_map(fn ($c) => trim(preg_replace('/\s+/u', ' ', (string)$c)), is_array($d['choices'] ?? null) ? $d['choices'] : []), fn ($c) => $c !== ''));
    $steps = array_values(array_filter(array_map(fn ($s) => trim((string)$s), is_array($d['steps'] ?? null) ? $d['steps'] : []), fn ($s) => $s !== ''));

    if (!in_array($subject, SUBJECTS, true)) return [null, 'Subject must be maths, english, science or sst'];
    if (!in_array($grade, GRADES, true)) return [null, 'Class must be TOP or P1 … P7'];
    if (!in_array($level, BANK_LEVELS, true)) return [null, 'Level must be simple, medium, hard or pro'];
    if (!preg_match('/^[a-z][a-z \-]{1,38}$/', $topic)) return [null, 'Topic: 2–39 letters, e.g. "plants" or "our district"'];
    if (mb_strlen($prompt) < 3 || mb_strlen($prompt) > 400) return [null, 'The question must be 3–400 characters'];
    if (mb_strlen($speak) > 400) return [null, 'Read-aloud text is too long'];
    if (count($choices) < 2 || count($choices) > 4) return [null, 'Give 2, 3 or 4 answer choices'];
    if (count(array_unique(array_map('mb_strtolower', $choices))) !== count($choices)) return [null, 'Two choices are the same'];
    foreach ($choices as $c) if (mb_strlen($c) > 100) return [null, 'A choice is longer than 100 characters'];
    if (!in_array($answer, $choices, true)) return [null, 'The answer must be exactly one of the choices'];
    if (count($steps) > 8) return [null, 'At most 8 steps'];
    foreach ($steps as $s) if (mb_strlen($s) > 300) return [null, 'A step is longer than 300 characters'];
    if (looksRude($prompt . ' ' . implode(' ', $choices))) return [null, 'Please check the wording'];

    return [[
        'subject' => $subject, 'grade' => $grade, 'level' => $level, 'topic' => $topic, 'prompt' => $prompt,
        'speak' => $speak ?: null, 'choices' => $choices, 'answer' => $answer, 'steps' => $steps ?: null,
    ], null];
}

function insertQuestion(array $row, string $status, string $source, ?int $teacherId = null): int
{
    q(
        'INSERT INTO questions (subject, grade, level, topic, prompt, speak, choices, answer, steps, status, source, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$row['subject'], $row['grade'], $row['level'], $row['topic'], $row['prompt'], $row['speak'],
            json_encode($row['choices'], JSON_UNESCAPED_UNICODE), $row['answer'], $row['steps'] ? json_encode($row['steps'], JSON_UNESCAPED_UNICODE) : null,
            $status, mb_substr($source, 0, 80), $teacherId],
    );
    return (int)db()->lastInsertId();
}

function questionOut(array $r): array
{
    return [
        'id' => (int)$r['id'], 'subject' => $r['subject'], 'grade' => $r['grade'], 'level' => $r['level'], 'topic' => $r['topic'],
        'prompt' => $r['prompt'], 'speak' => $r['speak'], 'choices' => json_decode($r['choices'], true), 'answer' => $r['answer'],
        'steps' => $r['steps'] ? json_decode($r['steps'], true) : [],
    ];
}

const BANK_SAMPLE = 400; // most questions one phone downloads per class + subject

/**
 * What the game downloads for one class + subject: every approved question, or, once there are
 * more than BANK_SAMPLE, a random BANK_SAMPLE that changes each day (the same sample all day, so
 * phones download it once a day at most). This keeps downloads small however big the bank grows.
 */
function publishedQuestions(string $subject, string $grade): array
{
    $total = (int)q("SELECT COUNT(*) FROM questions WHERE subject = ? AND grade = ? AND status = 'approved'", [$subject, $grade])->fetchColumn();
    $changed = (string)q("SELECT COALESCE(MAX(updated_at), '0') FROM questions WHERE subject = ? AND grade = ?", [$subject, $grade])->fetchColumn();
    if ($total <= BANK_SAMPLE) {
        $rows = q("SELECT * FROM questions WHERE subject = ? AND grade = ? AND status = 'approved' ORDER BY id", [$subject, $grade])->fetchAll();
        return ['version' => "$changed:$total", 'sampled' => false, 'questions' => array_map('questionOut', $rows)];
    }
    $seed = (int)date('Ymd'); // RAND(seed) gives the same order all day
    $rows = q("SELECT * FROM questions WHERE subject = ? AND grade = ? AND status = 'approved' ORDER BY RAND($seed) LIMIT " . BANK_SAMPLE, [$subject, $grade])->fetchAll();
    return ['version' => "$changed:$total:" . date('Y-m-d'), 'sampled' => true, 'total' => $total, 'questions' => array_map('questionOut', $rows)];
}

/**
 * Which class + subject pairs have approved content (the game turns those subjects on):
 * bank questions, plus approved fact sets counted as facts × patterns.
 */
function bankCoverage(): array
{
    $count = [];
    foreach (q("SELECT subject, grade, COUNT(*) AS n FROM questions WHERE status = 'approved' GROUP BY subject, grade")->fetchAll() as $r) {
        $count[$r['subject'] . ':' . $r['grade']] = ['questions' => (int)$r['n'], 'facts' => 0];
    }
    $sets = q("SELECT s.subject, s.grade_from, s.grade_to, JSON_LENGTH(s.templates) AS patterns, COUNT(f.id) AS facts
               FROM fact_sets s JOIN facts f ON f.set_id = s.id WHERE s.status = 'approved' GROUP BY s.id")->fetchAll();
    foreach ($sets as $s) {
        for ($i = gradeIndex($s['grade_from']); $i <= gradeIndex($s['grade_to']); $i++) {
            $k = $s['subject'] . ':' . GRADES[$i];
            $count[$k] ??= ['questions' => 0, 'facts' => 0];
            $count[$k]['facts'] += (int)$s['facts'] * (int)$s['patterns'];
        }
    }
    $out = [];
    foreach ($count as $k => $c) {
        [$subject, $grade] = explode(':', $k);
        $out[] = ['subject' => $subject, 'grade' => $grade, 'count' => $c['questions'] + $c['facts'], 'questions' => $c['questions'], 'fact_questions' => $c['facts']];
    }
    return $out;
}

// ---------- admin ----------

function adminQuestions(array $f): array
{
    $where = ['1 = 1'];
    $params = [];
    foreach (['subject' => SUBJECTS, 'grade' => GRADES, 'status' => ['draft', 'approved', 'retired']] as $key => $allowed) {
        if (in_array($f[$key] ?? '', $allowed, true)) {
            $where[] = "q.$key = ?";
            $params[] = $f[$key];
        }
    }
    if (!empty($f['teacher'])) $where[] = 'q.teacher_id IS NOT NULL';
    $search = trim((string)($f['q'] ?? ''));
    if ($search !== '') {
        $where[] = '(q.prompt LIKE ? OR q.topic LIKE ?)';
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
        array_push($params, $like, $like);
    }
    $rows = q(
        'SELECT q.*, t.name AS teacher FROM questions q LEFT JOIN teachers t ON t.id = q.teacher_id WHERE ' . implode(' AND ', $where) . ' ORDER BY q.updated_at DESC LIMIT 300',
        $params,
    )->fetchAll();
    $counts = q('SELECT status, COUNT(*) AS n FROM questions GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
    return [
        'questions' => array_map(fn ($r) => questionOut($r) + ['status' => $r['status'], 'source' => $r['source'], 'teacher' => $r['teacher'], 'review_note' => $r['review_note'], 'updated_at' => $r['updated_at']], $rows),
        'counts' => ['draft' => (int)($counts['draft'] ?? 0), 'approved' => (int)($counts['approved'] ?? 0), 'retired' => (int)($counts['retired'] ?? 0)],
        'coverage' => bankCoverage(),
    ];
}

function adminSaveQuestion(array $admin, ?int $id, array $d): array
{
    // status-only change (approve / retire / send back) needs no other fields
    if ($id && isset($d['status']) && count(array_diff(array_keys($d), ['status', 'review_note'])) === 0) {
        q('UPDATE questions SET status = ?, review_note = ? WHERE id = ?', [oneOf($d, 'status', ['draft', 'approved', 'retired']), mb_substr(trim((string)($d['review_note'] ?? '')), 0, 255) ?: null, $id]);
        return ['ok' => true];
    }
    [$row, $err] = cleanQuestion($d);
    if ($err) respond(422, ['error' => $err]);
    $status = in_array($d['status'] ?? '', ['draft', 'approved', 'retired'], true) ? $d['status'] : 'draft';
    if (!$id) return ['id' => insertQuestion($row, $status, 'admin:' . $admin['username'])];
    q(
        'UPDATE questions SET subject = ?, grade = ?, level = ?, topic = ?, prompt = ?, speak = ?, choices = ?, answer = ?, steps = ?, status = ? WHERE id = ?',
        [$row['subject'], $row['grade'], $row['level'], $row['topic'], $row['prompt'], $row['speak'], json_encode($row['choices'], JSON_UNESCAPED_UNICODE), $row['answer'],
            $row['steps'] ? json_encode($row['steps'], JSON_UNESCAPED_UNICODE) : null, $status, $id],
    );
    return ['id' => $id];
}

/** Import many questions at once (from a spreadsheet). Good rows are saved as drafts; bad rows are reported. */
function adminImport(array $admin, array $d): array
{
    $rows = $d['questions'] ?? null;
    if (!is_array($rows) || count($rows) > 1000) respond(422, ['error' => 'Send up to 1000 questions']);
    $file = mb_substr(preg_replace('/[^\w.\- ]/u', '', (string)($d['file'] ?? 'import')), 0, 60);
    $created = 0;
    $skipped = 0;
    $errors = [];
    foreach (array_values($rows) as $i => $r) {
        [$row, $err] = cleanQuestion(is_array($r) ? $r : []);
        if ($err) {
            $errors[] = ['row' => $i + 2, 'error' => $err]; // +2: spreadsheet row numbers, after the heading row
            continue;
        }
        // the same question twice (e.g. a file imported again) is skipped
        if (q('SELECT 1 FROM questions WHERE subject = ? AND grade = ? AND prompt = ?', [$row['subject'], $row['grade'], $row['prompt']])->fetchColumn()) {
            $skipped++;
            continue;
        }
        insertQuestion($row, 'draft', "import:$file by {$admin['username']}");
        $created++;
    }
    return ['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 100)];
}

// ---------- teachers ----------

function teacherSuggest(array $teacher, array $d): array
{
    [$row, $err] = cleanQuestion($d);
    if ($err) respond(422, ['error' => $err]);
    $today = (int)q('SELECT COUNT(*) FROM questions WHERE teacher_id = ? AND created_at >= CURDATE()', [$teacher['id']])->fetchColumn();
    if ($today >= 100) respond(429, ['error' => 'That is 100 suggestions today: thank you! Please continue tomorrow.']);
    insertQuestion($row, 'draft', 'teacher:' . $teacher['name'], (int)$teacher['id']);
    return teacherSuggestions($teacher);
}

function teacherSuggestions(array $teacher): array
{
    $rows = q('SELECT * FROM questions WHERE teacher_id = ? ORDER BY id DESC LIMIT 200', [$teacher['id']])->fetchAll();
    return ['questions' => array_map(fn ($r) => questionOut($r) + ['status' => $r['status'], 'review_note' => $r['review_note']], $rows)];
}
