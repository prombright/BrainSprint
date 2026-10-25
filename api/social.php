<?php
// Who's online, the live activity feed, public player cards and race opponents.
declare(strict_types=1);

const ONLINE_SECONDS = 120; // seen in the last 2 minutes = playing now
const SUBJECT_NAMES = ['maths' => 'Maths', 'english' => 'English', 'science' => 'Science', 'sst' => 'SST'];

function gradeName(string $g): string
{
    return $g === 'TOP' ? 'Top Class' : $g;
}

function addEvent(int $playerId, string $kind, string $detail): void
{
    // the feed only shows recent news: now and then, clear items older than 30 days
    if (random_int(1, 200) === 1) q('DELETE FROM events WHERE created_at < NOW() - INTERVAL 30 DAY');
    q('INSERT INTO events (player_id, kind, detail) VALUES (?, ?, ?)', [$playerId, $kind, mb_substr($detail, 0, 120)]);
}

/** The one piece of news a finished sprint is worth, if any. */
function sprintEvent(int $playerId, array $s): void
{
    $where = gradeName($s['grade']) . ' ' . (SUBJECT_NAMES[$s['subject']] ?? $s['subject']);
    if ($s['total'] >= 10 && $s['correct'] === $s['total']) addEvent($playerId, 'perfect', "got every answer right in $where");
    elseif ($s['score'] >= 200) addEvent($playerId, 'big_score', "scored {$s['score']} points in $where");
    elseif ($s['best_streak'] >= 8) addEvent($playerId, 'streak', "answered {$s['best_streak']} in a row in $where");
}

function touchPresence(array $p, ?string $activity, int $dayStreak, int $badges): void
{
    q(
        'UPDATE players SET last_seen_at = NOW(), activity = ?, day_streak = ?, badges = ? WHERE id = ?',
        [$activity, min($dayStreak, 9999), min($badges, 255), $p['id']],
    );
}

function isOnline(?string $lastSeen): bool
{
    return $lastSeen !== null && strtotime($lastSeen) > time() - ONLINE_SECONDS;
}

function presenceSummary(array $me): array
{
    $since = date('Y-m-d H:i:s', time() - ONLINE_SECONDS);
    $total = (int)q('SELECT COUNT(*) FROM players WHERE last_seen_at > ?', [$since])->fetchColumn();
    $sameGrade = (int)q('SELECT COUNT(*) FROM players WHERE last_seen_at > ? AND grade = ?', [$since, $me['grade']])->fetchColumn();
    // classmates first, then everyone else
    $online = q(
        'SELECT id, name, avatar, grade, activity FROM players WHERE last_seen_at > ? AND id <> ?
         ORDER BY (grade = ?) DESC, last_seen_at DESC LIMIT 12',
        [$since, $me['id'], $me['grade']],
    )->fetchAll();
    $feed = q(
        'SELECT e.id, e.kind, e.detail, e.created_at, p.id AS player_id, p.name, p.avatar, p.grade
         FROM events e JOIN players p ON p.id = e.player_id ORDER BY e.id DESC LIMIT 15',
    )->fetchAll();
    return [
        'online_total' => $total,
        'online_same_grade' => $sameGrade,
        'online' => array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'avatar' => $r['avatar'], 'grade' => $r['grade'], 'activity' => $r['activity']], $online),
        'feed' => array_map(fn ($e) => [
            'id' => (int)$e['id'], 'kind' => $e['kind'], 'detail' => $e['detail'], 'at' => date('c', strtotime($e['created_at'])),
            'player' => ['id' => (int)$e['player_id'], 'name' => $e['name'], 'avatar' => $e['avatar'], 'grade' => $e['grade']],
        ], $feed),
    ];
}

/** What other children may see about a player: no phone, no parent, no device. */
function playerCard(int $id): ?array
{
    $p = q('SELECT * FROM players WHERE id = ?', [$id])->fetch();
    if (!$p) return null;
    $week = (int)q('SELECT xp FROM league_members WHERE week_start = ? AND player_id = ?', [weekStart(), $id])->fetchColumn();
    $stats = q('SELECT COUNT(*) AS sprints, COALESCE(SUM(correct), 0) AS correct, COALESCE(SUM(total), 0) AS answered, COALESCE(MAX(best_streak), 0) AS best_streak FROM sprints WHERE player_id = ?', [$id])->fetch();
    return [
        'id' => (int)$p['id'],
        'name' => $p['name'],
        'avatar' => $p['avatar'],
        'grade' => $p['grade'],
        'xp_total' => (int)$p['xp_total'],
        'week_xp' => $week,
        'tier' => (int)$p['tier'],
        'tier_name' => TIERS[(int)$p['tier']],
        'day_streak' => (int)$p['day_streak'],
        'badges' => (int)$p['badges'],
        'sprints' => (int)$stats['sprints'],
        'accuracy' => $stats['answered'] ? (int)round($stats['correct'] / $stats['answered'] * 100) : null,
        'best_streak' => (int)$stats['best_streak'],
        'online' => isOnline($p['last_seen_at']),
        'activity' => isOnline($p['last_seen_at']) ? $p['activity'] : null,
    ];
}

/**
 * How a rival plays a level, for the ghost in a race: their best recent sprint at that level,
 * else their usual pace and accuracy anywhere, else a fair default.
 */
function raceStats(int $rivalId, string $subject, string $grade, string $level): array
{
    $best = q(
        'SELECT score, correct, total, avg_ms FROM sprints WHERE player_id = ? AND subject = ? AND grade = ? AND level = ?
         ORDER BY score DESC LIMIT 1',
        [$rivalId, $subject, $grade, $level],
    )->fetch();
    if ($best) return ['source' => 'this level'] + array_map('intval', $best);
    $avg = q('SELECT AVG(score) AS score, AVG(correct) AS correct, AVG(total) AS total, AVG(avg_ms) AS avg_ms FROM sprints WHERE player_id = ?', [$rivalId])->fetch();
    if ($avg && $avg['total']) return ['source' => 'usual'] + array_map(fn ($v) => (int)round((float)$v), $avg);
    $rival = q('SELECT is_demo FROM players WHERE id = ?', [$rivalId])->fetch();
    // demo players and children who haven't played yet race at a steady, beatable pace
    $c = $rival && $rival['is_demo'] ? random_int(5, 9) : 6;
    return ['source' => 'default', 'score' => $c * 15, 'correct' => $c, 'total' => 10, 'avg_ms' => random_int(4500, 8000)];
}

/**
 * LOCAL TESTING ONLY (config 'demo_life'): makes the demo players act alive:
 * some are online, a few earn points, and now and then one does something worth a feed item.
 */
function demoLife(array $me): void
{
    if (empty($GLOBALS['config']['demo_life'])) return;
    $activities = ['maths:simple', 'maths:medium', 'maths:hard', 'maths:pro', 'english:simple', 'english:medium'];
    $demos = q('SELECT id, grade FROM players WHERE is_demo = 1 ORDER BY (grade = ?) DESC, RAND() LIMIT 18', [$me['grade']])->fetchAll();
    foreach ($demos as $i => $d) {
        if (random_int(0, 99) < 55) {
            [$s, $l] = explode(':', $activities[array_rand($activities)]);
            q('UPDATE players SET last_seen_at = NOW(), activity = ? WHERE id = ?', ["$s:{$d['grade']}:$l", $d['id']]);
        }
    }
    // classmates in the same league keep scoring, so the race for places stays alive
    if (random_int(0, 99) < 45) {
        $rival = q(
            'SELECT p.id, p.grade FROM league_members m JOIN players p ON p.id = m.player_id
             WHERE m.week_start = ? AND p.is_demo = 1 AND m.group_id = (SELECT group_id FROM league_members WHERE week_start = ? AND player_id = ?)
             ORDER BY RAND() LIMIT 1',
            [weekStart(), weekStart(), $me['id']],
        )->fetch();
        if ($rival) {
            $score = random_int(60, 230);
            q('UPDATE league_members SET xp = xp + ? WHERE week_start = ? AND player_id = ?', [$score, weekStart(), $rival['id']]);
            q('UPDATE players SET xp_total = xp_total + ? WHERE id = ?', [$score, $rival['id']]);
            $correct = $score >= 220 ? 10 : random_int(6, 9);
            sprintEvent((int)$rival['id'], ['subject' => 'maths', 'grade' => $rival['grade'], 'score' => $score, 'correct' => $correct, 'total' => 10, 'best_streak' => random_int(3, 10)]);
        }
    }
}
