<?php
// Topic mastery: how each child is doing topic by topic, weighted towards recent answers.
declare(strict_types=1);

const RECENT_WINDOW = 20;   // mastery looks at about the last 20 answers in a topic
const WEAK_BELOW = 70;      // % : below this, a topic needs practice
const MIN_ATTEMPTS = 5;     // don't judge a topic on fewer answers than this

/** {"fractions": [3, 4], …} from a sprint: validated so a bad client can't skew anything. */
function sprintTopics(array $d, int $total): array
{
    $topics = $d['topics'] ?? [];
    if (!is_array($topics) || count($topics) > 30) return [];
    $out = [];
    $sum = 0;
    foreach ($topics as $name => $pair) {
        if (!validTopic($name) || !is_array($pair) || count($pair) !== 2) continue;
        [$c, $t] = array_map('intval', array_values($pair));
        if ($t < 1 || $c < 0 || $c > $t) continue;
        $sum += $t;
        $out[$name] = [$c, $t];
    }
    return $sum <= $total ? $out : [];
}

function recordTopics(int $playerId, string $subject, string $grade, array $topics): void
{
    foreach ($topics as $topic => [$c, $t]) {
        $row = q('SELECT recent_correct, recent_total FROM topic_stats WHERE player_id = ? AND subject = ? AND grade = ? AND topic = ?', [$playerId, $subject, $grade, $topic])->fetch();
        $rc = (float)($row['recent_correct'] ?? 0);
        $rt = (int)($row['recent_total'] ?? 0);
        // slide the window: older answers count for less once it is full
        if ($rt + $t > RECENT_WINDOW && $rt > 0) {
            $keep = max(0, RECENT_WINDOW - $t);
            $rc = $rc * $keep / $rt;
            $rt = $keep;
        }
        $rc = (int)round($rc + $c);
        $rt = min(RECENT_WINDOW, $rt + $t);
        q(
            'INSERT INTO topic_stats (player_id, subject, grade, topic, correct, total, recent_correct, recent_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE correct = correct + VALUES(correct), total = total + VALUES(total), recent_correct = VALUES(recent_correct), recent_total = VALUES(recent_total)',
            [$playerId, $subject, $grade, $topic, $c, $t, min($rc, $rt), $rt],
        );
    }
}

/** Every topic a child has met, with mastery %, weakest first. */
function topicReport(int $playerId): array
{
    $rows = q('SELECT subject, grade, topic, correct, total, recent_correct, recent_total FROM topic_stats WHERE player_id = ?', [$playerId])->fetchAll();
    $out = array_map(fn ($r) => [
        'subject' => $r['subject'],
        'grade' => $r['grade'],
        'topic' => $r['topic'],
        'total' => (int)$r['total'],
        'mastery' => $r['recent_total'] ? (int)round($r['recent_correct'] / $r['recent_total'] * 100) : 0,
    ], $rows);
    usort($out, fn ($a, $b) => $a['mastery'] <=> $b['mastery']);
    return $out;
}

/** The parent's view: up to 3 topics that need work and up to 3 strengths. */
function weakAndStrong(int $playerId): array
{
    $judged = array_values(array_filter(topicReport($playerId), fn ($t) => $t['total'] >= MIN_ATTEMPTS));
    return [
        'weak' => array_slice(array_values(array_filter($judged, fn ($t) => $t['mastery'] < WEAK_BELOW)), 0, 3),
        'strong' => array_slice(array_reverse(array_values(array_filter($judged, fn ($t) => $t['mastery'] >= 85))), 0, 3),
    ];
}

// ---------- PLE-style mock exams ----------

const MOCK_QUESTIONS = 30;

/** A finished mock: saved with its topic breakdown, and worth XP like a long sprint. */
function saveMock(array $p, array $d): array
{
    $total = intIn($d, 'total', 10, MOCK_QUESTIONS);
    $correct = intIn($d, 'correct', 0, $total);
    $minutes = intIn($d, 'minutes_used', 1, 60);
    $taken = strtotime((string)($d['taken_at'] ?? ''));
    if ($taken === false || $taken > time() + 300) respond(422, ['error' => 'Invalid taken_at']);
    // a real mock takes a while: refuse a second one finished within 10 minutes of another
    if (q('SELECT 1 FROM mock_results WHERE player_id = ? AND ABS(TIMESTAMPDIFF(MINUTE, taken_at, ?)) < 10', [$p['id'], date('Y-m-d H:i:s', $taken)])->fetchColumn()) {
        respond(422, ['error' => 'Mocks finished too close together']);
    }
    $topics = sprintTopics($d, $total);
    q(
        'INSERT INTO mock_results (player_id, grade, correct, total, minutes_used, topics, taken_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$p['id'], oneOf($d, 'grade', GRADES), $correct, $total, $minutes, json_encode($topics, JSON_FORCE_OBJECT), date('Y-m-d H:i:s', $taken)],
    );
    recordTopics((int)$p['id'], 'maths', $d['grade'], $topics);
    // 10 XP per correct answer, into the total and this week's league
    $xp = $correct * 10;
    q('UPDATE players SET xp_total = xp_total + ? WHERE id = ?', [$xp, $p['id']]);
    if (weekStart($taken) === weekStart()) {
        ensureMembership($p);
        q('UPDATE league_members SET xp = xp + ? WHERE week_start = ? AND player_id = ?', [$xp, weekStart(), $p['id']]);
    }
    return mockHistory((int)$p['id']);
}

/** Past mocks (newest first) and readiness: the average of the last three. */
function mockHistory(int $playerId): array
{
    $rows = q('SELECT id, grade, correct, total, minutes_used, taken_at FROM mock_results WHERE player_id = ? ORDER BY taken_at DESC LIMIT 20', [$playerId])->fetchAll();
    $mocks = array_map(fn ($r) => [
        'id' => (int)$r['id'], 'grade' => $r['grade'], 'correct' => (int)$r['correct'], 'total' => (int)$r['total'],
        'percent' => (int)round($r['correct'] / $r['total'] * 100), 'minutes_used' => (int)$r['minutes_used'], 'taken_at' => date('c', strtotime($r['taken_at'])),
    ], $rows);
    $last = array_slice($mocks, 0, 3);
    return ['mocks' => $mocks, 'readiness' => $last ? (int)round(array_sum(array_column($last, 'percent')) / count($last)) : null];
}
