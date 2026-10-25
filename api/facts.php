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

// ---------- the Fact Engine on the server, for competition papers ----------
// The same rules as frontend/src/game/facts.ts (factQuestion, ambiguous, notQuestion), so a paper's
// Science and SST questions are exactly the kind children meet in practice. Papers are built by the
// server because the phone must never hold competition answers.

function factFill(string $text, array $row): string
{
    return preg_replace_callback('/\{([a-z_]+)\}/', fn ($m) => $row[$m[1]] ?? $m[0], $text);
}

function factSentence(string $s): string
{
    return mb_strtoupper(mb_substr($s, 0, 1)) . mb_substr($s, 1);
}

function factSameOn(array $a, array $b, array $cols): bool
{
    foreach ($cols as $c) if (mb_strtolower($a[$c]) !== mb_strtolower($b[$c])) return false;
    return true;
}

/** Another row fills the gaps the same way but has a different answer: the question would have two right answers. */
function factAmbiguous(array $rows, int $i, array $t, array $gaps): bool
{
    foreach ($rows as $j => $o) {
        if ($j !== $i && factSameOn($o, $rows[$i], $gaps) && mb_strtolower($o[$t['answer']]) !== mb_strtolower($rows[$i][$t['answer']])) return true;
    }
    return false;
}

function factBuilt(array $set, array $row, string $prompt, string $answer, array $wrong, string $level): array
{
    return [
        'level' => $level, 'topic' => mb_strtolower($set['name']), 'prompt' => $prompt, 'speak' => $prompt,
        'choices' => array_merge([$answer], $wrong), 'answer' => $answer,
        'steps' => $set['explain'] ? [factSentence(factFill($set['explain'], $row))] : [],
    ];
}

/**
 * Every fair question the approved fact sets of a class can ask (each pattern × each row), with
 * wrong choices taken from other rows, plus a few "Which is NOT …" questions per NOT pattern.
 */
function factPoolQuestions(string $subject, string $grade): array
{
    $out = [];
    foreach (publishedFactSets($subject, $grade) as $set) {
        $rows = array_map(fn ($r) => array_combine($set['columns'], $r), $set['rows']);
        // matched pairs mix four facts at a time, so a few dozen per table give papers plenty of variety
        for ($k = 0; $k < 24; $k++) if ($q = factMatchedPair($set, $rows)) $out[] = $q;
        foreach ($set['templates'] as $t) {
            if (!empty($t['not'])) {
                for ($k = 0; $k < 6; $k++) if ($q = factNotQuestion($set, $rows, $t)) $out[] = $q;
                for ($k = 0; $k < 6; $k++) if ($q = factCommonGroup($set, $rows, $t)) $out[] = $q;
                continue;
            }
            preg_match_all('/\{([a-z_]+)\}/', $t['ask'], $m);
            $gaps = $m[1];
            foreach ($rows as $i => $row) {
                if (factAmbiguous($rows, $i, $t, $gaps)) continue;
                $right = $row[$t['answer']];
                $wrong = [];
                foreach ($rows as $o) {
                    if (!factSameOn($o, $row, $gaps) && mb_strtolower($o[$t['answer']]) !== mb_strtolower($right)) $wrong[mb_strtolower($o[$t['answer']])] = $o[$t['answer']];
                }
                if (!$wrong) continue;
                $wrong = array_values($wrong);
                shuffle($wrong);
                $out[] = factBuilt($set, $row, factSentence(factFill($t['ask'], $row)), $right, array_slice($wrong, 0, 3), $t['level']);
            }
        }
    }
    return $out;
}

/** "Which of these is NOT a mammal?": three answers from one group and one from another. */
function factNotQuestion(array $set, array $rows, array $t): ?array
{
    $group = $t['not'];
    $groups = [];
    foreach ($rows as $r) $groups[mb_strtolower($r[$group])][] = $r;
    $big = array_values(array_filter($groups, fn ($g) => count(array_unique(array_map(fn ($r) => mb_strtolower($r[$t['answer']]), $g))) >= 3));
    if (!$big) return null;
    $inGroup = $big[array_rand($big)];
    $g = mb_strtolower($inGroup[0][$group]);
    $inside = array_map(fn ($r) => mb_strtolower($r[$t['answer']]), $inGroup);
    // the odd one out must not also belong to the group under another row
    $outside = array_values(array_filter($rows, fn ($r) => mb_strtolower($r[$group]) !== $g && !in_array(mb_strtolower($r[$t['answer']]), $inside, true)));
    if (!$outside) return null;
    $odd = $outside[array_rand($outside)];
    $three = [];
    foreach ($inGroup as $r) $three[mb_strtolower($r[$t['answer']])] = $r[$t['answer']];
    $three = array_values($three);
    shuffle($three);
    return factBuilt($set, $odd, factSentence(factFill($t['ask'], $inGroup[0])), $odd[$t['answer']], array_slice($three, 0, 3), $t['level']);
}

/** "Which is correctly matched?": four pairs, exactly one true (same rules as matchedPair in facts.ts). */
function factMatchedPair(array $set, array $rows): ?array
{
    $pairs = [];
    foreach ($set['templates'] as $t) {
        if (!empty($t['not'])) continue;
        preg_match_all('/\{([a-z_]+)\}/', $t['ask'], $m);
        if (count($m[1]) === 1) $pairs[] = [$m[1][0], $t['answer']];
    }
    if (!$pairs || count($rows) < 4) return null;
    [$a, $b] = $pairs[array_rand($pairs)];
    $right = $rows[array_rand($rows)];
    $isTrue = function (string $x, string $y) use ($rows, $a, $b): bool {
        foreach ($rows as $r) if (mb_strtolower($r[$a]) === mb_strtolower($x) && mb_strtolower($r[$b]) === mb_strtolower($y)) return true;
        return false;
    };
    $answer = "{$right[$a]} — {$right[$b]}";
    $options = [$answer];
    $usedA = [mb_strtolower($right[$a]) => true];
    $order = $rows;
    shuffle($order);
    foreach ($order as $o) {
        if (count($options) === 4) break;
        if (isset($usedA[mb_strtolower($o[$a])])) continue;
        $ys = array_column($rows, $b);
        shuffle($ys);
        $y = null;
        foreach ($ys as $v) if (!$isTrue($o[$a], $v)) { $y = $v; break; }
        if ($y === null) continue;
        $usedA[mb_strtolower($o[$a])] = true;
        $options[] = "{$o[$a]} — $y";
    }
    if (count($options) < 3) return null;
    $label = fn ($c) => str_replace('_', ' ', $c);
    $sorted = $options;
    sort($sorted);
    $steps = ["The true pair: $answer."];
    if ($set['explain']) $steps[] = factSentence(factFill($set['explain'], $right));
    return ['level' => 'pro', 'topic' => mb_strtolower($set['name']), 'prompt' => "Which is correctly matched? ({$label($a)} — {$label($b)})",
        'speak' => 'Which is correctly matched? ' . implode('. ', $options) . '.', 'choices' => $options, 'answer' => $answer,
        'variant' => implode('|', $sorted), 'steps' => $steps];
}

/** "Each of these is part of the ___ system: heart, lungs, kidneys" from a NOT pattern (as commonGroup in facts.ts). */
function factCommonGroup(array $set, array $rows, array $t): ?array
{
    $group = $t['not'];
    $stem = preg_replace('/^Which of these( [a-z]+)? is NOT /i', 'Each of these$1 is ', $t['ask']);
    if ($stem === $t['ask'] || !str_contains($stem, '{' . $group . '}') || preg_match_all('/\{([a-z_]+)\}/', $stem) !== 1) return null;
    $groups = [];
    foreach ($rows as $r) $groups[mb_strtolower($r[$group])][] = $r;
    $big = array_values(array_filter($groups, fn ($g) => count(array_unique(array_map(fn ($r) => mb_strtolower($r[$t['answer']]), $g))) >= 3));
    if (!$big || count($groups) < 2) return null;
    $inGroup = $big[array_rand($big)];
    $three = [];
    foreach ($inGroup as $r) $three[mb_strtolower($r[$t['answer']])] = $r[$t['answer']];
    $three = array_values($three);
    shuffle($three);
    $three = array_slice($three, 0, 3);
    $answer = $inGroup[0][$group];
    $list = implode(', ', $three);
    $prompt = factSentence(rtrim(str_replace('{' . $group . '}', '___', $stem), '?')) . ": $list.";
    $wrong = [];
    foreach ($groups as $g) if (mb_strtolower($g[0][$group]) !== mb_strtolower($answer)) $wrong[] = $g[0][$group];
    shuffle($wrong);
    $label = str_replace('_', ' ', $group);
    return ['level' => 'hard', 'topic' => mb_strtolower($set['name']), 'prompt' => $prompt, 'speak' => str_replace('___', 'blank', $prompt),
        'choices' => array_merge([$answer], array_slice($wrong, 0, 3)), 'answer' => $answer, 'steps' => ["$list: each one's $label is $answer."]];
}
