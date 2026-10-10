<?php
// Friends, schools and the weekly Boss Battle.
declare(strict_types=1);

// ---------- friends ----------

const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L: easy to read out loud

/** The player's 6-character friend code, created the first time it is needed. */
function friendCode(array $p): string
{
    if (!empty($p['friend_code'])) return $p['friend_code'];
    for ($try = 0; $try < 20; $try++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= CODE_LETTERS[random_int(0, strlen(CODE_LETTERS) - 1)];
        try {
            q('UPDATE players SET friend_code = ? WHERE id = ? AND friend_code IS NULL', [$code, $p['id']]);
            return q('SELECT friend_code FROM players WHERE id = ?', [$p['id']])->fetchColumn();
        } catch (PDOException $e) {
            // code already taken: try another
        }
    }
    respond(500, ['error' => 'Could not make a friend code']);
}

function friendsList(array $me): array
{
    $rows = q(
        'SELECT p.id, p.name, p.avatar, p.grade, p.xp_total, p.day_streak, p.last_seen_at, p.activity, COALESCE(m.xp, 0) AS week_xp
         FROM friends f JOIN players p ON p.id = f.friend_id
         LEFT JOIN league_members m ON m.player_id = p.id AND m.week_start = ?
         WHERE f.player_id = ? ORDER BY week_xp DESC, p.name',
        [weekStart(), $me['id']],
    )->fetchAll();
    return array_map(fn ($r) => [
        'id' => (int)$r['id'], 'name' => $r['name'], 'avatar' => $r['avatar'], 'grade' => $r['grade'],
        'xp_total' => (int)$r['xp_total'], 'week_xp' => (int)$r['week_xp'], 'day_streak' => (int)$r['day_streak'],
        'online' => isOnline($r['last_seen_at']), 'activity' => isOnline($r['last_seen_at']) ? $r['activity'] : null,
    ], $rows);
}

const MAX_FRIENDS = 50;

function addFriend(array $me, string $code): array
{
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
    $friend = q('SELECT id, name FROM players WHERE friend_code = ?', [$code])->fetch();
    if (!$friend) respond(404, ['error' => 'No player has that code. Check the letters and try again.']);
    if ((int)$friend['id'] === (int)$me['id']) respond(422, ['error' => "That's your own code!"]);
    $count = (int)q('SELECT COUNT(*) FROM friends WHERE player_id = ?', [$me['id']])->fetchColumn();
    if ($count >= MAX_FRIENDS) respond(422, ['error' => 'You already have ' . MAX_FRIENDS . ' friends']);
    q('INSERT IGNORE INTO friends (player_id, friend_id) VALUES (?, ?), (?, ?)', [$me['id'], $friend['id'], $friend['id'], $me['id']]);
    return ['name' => $friend['name']];
}

function removeFriend(array $me, int $friendId): void
{
    q('DELETE FROM friends WHERE (player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?)', [$me['id'], $friendId, $friendId, $me['id']]);
}

// ---------- schools ----------

function schoolRow(?array $s): ?array
{
    return $s ? ['id' => (int)$s['id'], 'name' => $s['name'], 'district' => $s['district'], 'approved' => $s['status'] === 'approved'] : null;
}

function searchSchools(array $me, string $q): array
{
    $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
    $rows = q(
        "SELECT s.*, (SELECT COUNT(*) FROM players p WHERE p.school_id = s.id) AS members FROM schools s
         WHERE (s.status = 'approved' OR s.created_by = ?) AND (s.name LIKE ? OR s.district LIKE ?)
         ORDER BY members DESC, s.name LIMIT 20",
        [$me['id'], $like, $like],
    )->fetchAll();
    return array_map(fn ($r) => schoolRow($r) + ['members' => (int)$r['members']], $rows);
}

function createSchool(array $me, string $name, string $district): array
{
    // tidy the capitals so "st mary's ps" and "St Mary's PS" are the same school
    $name = preg_replace('/\s+/', ' ', $name);
    $existing = q('SELECT * FROM schools WHERE name = ? AND district = ?', [$name, $district])->fetch();
    if (!$existing) {
        q('INSERT INTO schools (name, district, created_by) VALUES (?, ?, ?)', [$name, $district, $me['id']]);
        $existing = q('SELECT * FROM schools WHERE id = ?', [db()->lastInsertId()])->fetch();
    }
    q('UPDATE players SET school_id = ? WHERE id = ?', [$existing['id'], $me['id']]);
    return schoolRow($existing);
}

/** This week's school ranking (approved schools), my school's place, and my school's top players. */
function schoolBoard(array $me): array
{
    $week = weekStart();
    $board = q(
        "SELECT s.id, s.name, s.district, COUNT(DISTINCT p.id) AS players, COALESCE(SUM(m.xp), 0) AS xp
         FROM schools s JOIN players p ON p.school_id = s.id
         LEFT JOIN league_members m ON m.player_id = p.id AND m.week_start = ?
         WHERE s.status = 'approved' GROUP BY s.id ORDER BY xp DESC, players DESC LIMIT 50",
        [$week],
    )->fetchAll();
    $board = array_map(fn ($r, $i) => ['rank' => $i + 1, 'id' => (int)$r['id'], 'name' => $r['name'], 'district' => $r['district'], 'players' => (int)$r['players'], 'xp' => (int)$r['xp']], $board, array_keys($board));

    $mine = null;
    $top = [];
    if ($me['school_id']) {
        $s = q('SELECT * FROM schools WHERE id = ?', [$me['school_id']])->fetch();
        $mine = schoolRow($s);
        foreach ($board as $b) if ($b['id'] === $mine['id']) $mine += ['rank' => $b['rank'], 'xp' => $b['xp'], 'players' => $b['players']];
        $top = q(
            'SELECT p.id, p.name, p.avatar, p.grade, p.xp_total, COALESCE(m.xp, 0) AS week_xp FROM players p
             LEFT JOIN league_members m ON m.player_id = p.id AND m.week_start = ?
             WHERE p.school_id = ? ORDER BY week_xp DESC, p.name LIMIT 10',
            [$week, $me['school_id']],
        )->fetchAll();
        $top = array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'avatar' => $r['avatar'], 'grade' => $r['grade'], 'xp_total' => (int)$r['xp_total'], 'week_xp' => (int)$r['week_xp'], 'me' => (int)$r['id'] === (int)$me['id']], $top);
        // a child outside the top 10 still sees their own line at the bottom
        if (!array_filter($top, fn ($t) => $t['me'])) {
            $myXp = (int)q('SELECT xp FROM league_members WHERE week_start = ? AND player_id = ?', [$week, $me['id']])->fetchColumn();
            $top[] = ['id' => (int)$me['id'], 'name' => $me['name'], 'avatar' => $me['avatar'], 'grade' => $me['grade'], 'xp_total' => (int)$me['xp_total'], 'week_xp' => $myXp, 'me' => true];
        }
    }
    return ['school' => $mine, 'board' => $board, 'top_players' => $top, 'ends_at' => weekEndsAt()];
}

// ---------- weekly Boss Battle ----------

const BOSS_HP = 180;
const BOSSES = [
    ['name' => 'Times-Rex', 'emoji' => '🦖'],
    ['name' => 'the Fraction Shark', 'emoji' => '🦈'],
    ['name' => 'Robo-Ruler', 'emoji' => '🤖'],
    ['name' => 'the Minus Monster', 'emoji' => '👹'],
    ['name' => 'Octo-Algebra', 'emoji' => '🐙'],
    ['name' => 'the Division Dragon', 'emoji' => '🐲'],
];

function thisBoss(): array
{
    $n = (int)floor(strtotime(weekStart()) / (7 * 86400)); // same boss all week, a new one each Monday
    return BOSSES[$n % count(BOSSES)] + ['hp' => BOSS_HP, 'week_start' => weekStart(), 'ends_at' => weekEndsAt()];
}

function bossBoard(array $me): array
{
    $rows = q(
        'SELECT p.id, p.name, p.avatar, b.damage, b.defeated FROM boss_results b JOIN players p ON p.id = b.player_id
         WHERE b.week_start = ? AND b.grade = ? ORDER BY b.damage DESC, b.updated_at ASC LIMIT 10',
        [weekStart(), $me['grade']],
    )->fetchAll();
    $mine = q('SELECT damage, defeated FROM boss_results WHERE week_start = ? AND player_id = ?', [weekStart(), $me['id']])->fetch();
    $defeatedBy = (int)q('SELECT COUNT(*) FROM boss_results WHERE week_start = ? AND grade = ? AND defeated = 1', [weekStart(), $me['grade']])->fetchColumn();
    return [
        'boss' => thisBoss(),
        'mine' => $mine ? ['damage' => (int)$mine['damage'], 'defeated' => (bool)$mine['defeated']] : null,
        'defeated_by' => $defeatedBy,
        'top' => array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'avatar' => $r['avatar'], 'damage' => (int)$r['damage'], 'defeated' => (bool)$r['defeated'], 'me' => (int)$r['id'] === (int)$me['id']], $rows),
    ];
}

function saveBoss(array $me, int $damage, ?int $playedAt = null): array
{
    $week = weekStart($playedAt ?? time());
    $defeated = $damage >= BOSS_HP ? 1 : 0;
    $before = q('SELECT defeated FROM boss_results WHERE week_start = ? AND player_id = ?', [$week, $me['id']])->fetchColumn();
    q(
        'INSERT INTO boss_results (week_start, player_id, grade, damage, defeated) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE damage = GREATEST(damage, VALUES(damage)), defeated = GREATEST(defeated, VALUES(defeated))',
        [$week, $me['id'], $me['grade'], $damage, $defeated],
    );
    // only this week's boss makes the news (a result from last week, uploaded late, stays quiet)
    if ($defeated && !$before && $week === weekStart()) {
        $b = thisBoss();
        addEvent((int)$me['id'], 'boss', "defeated {$b['name']} {$b['emoji']} in the Weekly Boss Battle");
    }
    return bossBoard($me);
}
