<?php
// Fact Engine, server side: stores fact sets and checks them with the same rules as
// frontend/src/game/facts.ts (checkFactSet). The app turns approved sets into questions.
declare(strict_types=1);

function gradeIndex(string $g): int
{
    return (int)array_search($g, GRADES, true);
}

/** Checks a whole fact set and returns [clean set, problems]. */
function cleanFactSet(array $d): array
{
    $problems = [];
    $subject = (string)($d['subject'] ?? '');
    if (!in_array($subject, SUBJECTS, true)) $problems[] = 'Subject must be maths, english, science or sst';
    $name = mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string)($d['name'] ?? ''))));
    if (!preg_match("/^[a-z][a-z' \\-]{2,58}$/u", $name)) $problems[] = 'Name: 3–59 letters, e.g. "body organs"';
    $from = strtoupper((string)($d['grade_from'] ?? ''));
    $to = strtoupper((string)($d['grade_to'] ?? ''));
    if (!in_array($from, GRADES, true) || !in_array($to, GRADES, true) || gradeIndex($from) > gradeIndex($to)) $problems[] = 'Choose the classes, from … to';

    $columns = array_values(array_map(fn ($c) => strtolower(trim((string)$c)), is_array($d['columns'] ?? null) ? $d['columns'] : []));
    if (count($columns) < 2 || count($columns) > 6) $problems[] = 'A fact set has 2–6 columns';
    foreach ($columns as $c) if (!preg_match('/^[a-z][a-z_]{0,19}$/', $c)) $problems[] = "Column \"$c\": lowercase letters and _ only";
    if (count(array_unique($columns)) !== count($columns)) $problems[] = 'Two columns have the same name';
    $isCol = fn ($c) => in_array($c, $columns, true);
    $gaps = fn (string $t) => preg_match_all('/\{([a-z_]+)\}/', $t, $m) ? $m[1] : [];

    $templates = [];
    foreach (is_array($d['templates'] ?? null) ? $d['templates'] : [] as $i => $t) {
        $n = $i + 1;
        $ask = trim((string)($t['ask'] ?? ''));
        $answer = (string)($t['answer'] ?? '');
        $level = (string)($t['level'] ?? '');
        $not = isset($t['not']) && $t['not'] !== '' ? (string)$t['not'] : null;
        if (mb_strlen($ask) < 5 || mb_strlen($ask) > 200) $problems[] = "Pattern $n: 5–200 characters";
        foreach ($gaps($ask) as $g) if (!$isCol($g)) $problems[] = "Pattern $n uses {{$g}}, which is not a column";
        if (!$isCol($answer)) $problems[] = "Pattern $n: the answer column \"$answer\" does not exist";
        if (!in_array($level, BANK_LEVELS, true)) $problems[] = "Pattern $n: level must be simple, medium, hard or pro";
        if ($not !== null && !$isCol($not)) $problems[] = "Pattern $n: the group column \"$not\" does not exist";
        if ($not === null && in_array($answer, $gaps($ask), true)) $problems[] = "Pattern $n gives the answer away: it shows {{$answer}}";
        $templates[] = ['ask' => $ask, 'answer' => $answer, 'level' => $level] + ($not !== null ? ['not' => $not] : []);
    }
    if (!$templates || count($templates) > 8) $problems[] = 'Give 1–8 question patterns';

    $explain = trim((string)($d['explain'] ?? ''));
    if (mb_strlen($explain) > 255) $problems[] = 'The explanation is too long';
    foreach ($gaps($explain) as $g) if (!$isCol($g)) $problems[] = "The explanation uses {{$g}}, which is not a column";

    $rows = [];
    $seen = [];
    foreach (is_array($d['rows'] ?? null) ? $d['rows'] : [] as $i => $r) {
        $vals = array_map(fn ($v) => trim(preg_replace('/\s+/u', ' ', (string)$v)), is_array($r) ? array_values($r) : []);
        if (count($vals) !== count($columns) || in_array('', $vals, true)) {
            $problems[] = 'Row ' . ($i + 1) . ' has an empty cell';
            continue;
        }
        foreach ($vals as $v) if (mb_strlen($v) > 80) $problems[] = 'Row ' . ($i + 1) . ': a cell is longer than 80 characters';
        $key = mb_strtolower(implode('|', $vals));
        if (isset($seen[$key])) continue; // the same fact twice: keep one
        $seen[$key] = true;
        $rows[] = $vals;
    }
    if (count($rows) < 4) $problems[] = 'Add at least 4 rows so there are enough wrong answers';
    if (count($rows) > 300) $problems[] = 'At most 300 rows in one set';
    foreach ($rows as $r) if (looksRude(implode(' ', $r))) { $problems[] = 'Please check the wording'; break; }

    return [['subject' => $subject, 'name' => $name, 'grade_from' => $from, 'grade_to' => $to, 'columns' => $columns, 'templates' => $templates, 'explain' => $explain ?: null, 'rows' => $rows], array_values(array_unique($problems))];
}

function saveFactSet(?int $id, array $set, string $status, string $source): int
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $j = fn ($v) => json_encode($v, JSON_UNESCAPED_UNICODE);
        if ($id) {
            // updated_at is set by hand: MySQL only bumps it when this row's own columns change,
            // and an edit to the facts alone must still reach phones
            q('UPDATE fact_sets SET subject = ?, name = ?, grade_from = ?, grade_to = ?, columns = ?, templates = ?, `explain` = ?, status = ?, updated_at = NOW() WHERE id = ?',
                [$set['subject'], $set['name'], $set['grade_from'], $set['grade_to'], $j($set['columns']), $j($set['templates']), $set['explain'], $status, $id]);
            q('DELETE FROM facts WHERE set_id = ?', [$id]);
        } else {
            q('INSERT INTO fact_sets (subject, name, grade_from, grade_to, columns, templates, `explain`, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$set['subject'], $set['name'], $set['grade_from'], $set['grade_to'], $j($set['columns']), $j($set['templates']), $set['explain'], $status, mb_substr($source, 0, 80)]);
            $id = (int)$pdo->lastInsertId();
        }
        foreach ($set['rows'] as $i => $r) q('INSERT INTO facts (set_id, `values`, position) VALUES (?, ?, ?)', [$id, $j($r), $i]);
        $pdo->commit();
        return $id;
    } catch (Throwable $e) {
        $pdo->rollBack();
        if ($e instanceof PDOException && $e->getCode() === '23000') respond(409, ['error' => 'There is already a fact set with this name in this subject']);
        throw $e;
    }
}

function factSetOut(array $s, bool $withRows = true): array
{
    $out = [
        'id' => (int)$s['id'], 'subject' => $s['subject'], 'name' => $s['name'], 'grade_from' => $s['grade_from'], 'grade_to' => $s['grade_to'],
        'columns' => json_decode($s['columns'], true), 'templates' => json_decode($s['templates'], true), 'explain' => $s['explain'],
    ];
    if (isset($s['status'])) $out += ['status' => $s['status'], 'source' => $s['source'], 'updated_at' => $s['updated_at']];
    if ($withRows) $out['rows'] = array_map(fn ($v) => json_decode($v, true), q('SELECT `values` FROM facts WHERE set_id = ? ORDER BY position, id', [$s['id']])->fetchAll(PDO::FETCH_COLUMN));
    return $out;
}

/** Approved sets taught in a class: what the app downloads alongside bank questions. */
function publishedFactSets(string $subject, string $grade): array
{
    $i = gradeIndex($grade);
    $sets = array_filter(
        q("SELECT * FROM fact_sets WHERE subject = ? AND status = 'approved' ORDER BY id", [$subject])->fetchAll(),
        fn ($s) => gradeIndex($s['grade_from']) <= $i && $i <= gradeIndex($s['grade_to']),
    );
    return array_values(array_map(
        fn ($s) => factSetOut(['id' => $s['id'], 'subject' => $s['subject'], 'name' => $s['name'], 'grade_from' => $s['grade_from'], 'grade_to' => $s['grade_to'], 'columns' => $s['columns'], 'templates' => $s['templates'], 'explain' => $s['explain']])
            + ['updated' => $s['updated_at']], // so an edited fact reaches phones
        $sets,
    ));
}

function adminFactSets(): array
{
    return array_map(function ($s) {
        $o = factSetOut($s, false);
        $o['row_count'] = (int)q('SELECT COUNT(*) FROM facts WHERE set_id = ?', [$s['id']])->fetchColumn();
        return $o;
    }, q('SELECT * FROM fact_sets ORDER BY status, subject, name')->fetchAll());
}
