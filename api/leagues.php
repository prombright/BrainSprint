<?php
// Weekly leagues: groups of up to 30 children in the same class and tier.
// At the end of a week the top 5 move up a tier and the bottom 5 move down.
declare(strict_types=1);

const LEAGUE_SIZE = 30;
const PROMOTE = 5;
const DEMOTE = 5;
const TIERS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Champion'];

/** Rank (1 = top) of a player inside a week's group, and the group size. */
function rankInWeek(int $playerId, string $week): ?array
{
    $m = q('SELECT group_id, xp FROM league_members WHERE week_start = ? AND player_id = ?', [$week, $playerId])->fetch();
    if (!$m) return null;
    $ahead = (int)q('SELECT COUNT(*) FROM league_members WHERE group_id = ? AND (xp > ? OR (xp = ? AND player_id < ?))', [$m['group_id'], $m['xp'], $m['xp'], $playerId])->fetchColumn();
    $size = (int)q('SELECT COUNT(*) FROM league_members WHERE group_id = ?', [$m['group_id']])->fetchColumn();
    return ['rank' => $ahead + 1, 'size' => $size, 'xp' => (int)$m['xp']];
}

/**
 * Makes sure the player is in a league group this week, first applying last
 * week's promotion or demotion. Returns ['group_id', 'tier', 'movement'].
 */
function ensureMembership(array $player): array
{
    $week = weekStart();
    $found = q('SELECT group_id FROM league_members WHERE week_start = ? AND player_id = ?', [$week, $player['id']])->fetchColumn();
    if ($found) return ['group_id' => (int)$found, 'tier' => (int)$player['tier'], 'movement' => 0];

    $pdo = db();
    $pdo->beginTransaction();
    try {
        // last week's result decides this week's tier
        $tier = (int)$player['tier'];
        $movement = 0;
        $last = rankInWeek((int)$player['id'], date('Y-m-d', strtotime($week . ' -7 days')));
        if ($last && $last['xp'] > 0) {
            if ($last['rank'] <= PROMOTE && $tier < count(TIERS) - 1) $movement = 1;
            elseif ($last['size'] >= 10 && $last['rank'] > $last['size'] - DEMOTE && $tier > 0) $movement = -1;
        }
        $tier += $movement;
        if ($movement) q('UPDATE players SET tier = ? WHERE id = ?', [$tier, $player['id']]);

        // fill the fullest open group first, so leagues feel busy
        $group = q(
            'SELECT id FROM league_groups WHERE week_start = ? AND grade = ? AND tier = ? AND size < ? ORDER BY size DESC LIMIT 1 FOR UPDATE',
            [$week, $player['grade'], $tier, LEAGUE_SIZE],
        )->fetchColumn();
        if (!$group) {
            q('INSERT INTO league_groups (week_start, grade, tier) VALUES (?, ?, ?)', [$week, $player['grade'], $tier]);
            $group = $pdo->lastInsertId();
        }
        q('INSERT INTO league_members (week_start, player_id, group_id) VALUES (?, ?, ?)', [$week, $player['id'], $group]);
        if ($movement > 0) addEvent((int)$player['id'], 'promoted', 'moved up to the ' . TIERS[$tier] . ' League');
        q('UPDATE league_groups SET size = size + 1 WHERE id = ?', [$group]);
        $pdo->commit();
        return ['group_id' => (int)$group, 'tier' => $tier, 'movement' => $movement];
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function leagueStandings(array $player): array
{
    $m = ensureMembership($player);
    $rows = q(
        'SELECT p.id, p.name, p.avatar, m.xp FROM league_members m JOIN players p ON p.id = m.player_id
         WHERE m.group_id = ? ORDER BY m.xp DESC, p.id ASC',
        [$m['group_id']],
    )->fetchAll();
    $members = array_map(fn ($r, $i) => [
        'rank' => $i + 1,
        'id' => (int)$r['id'],
        'name' => $r['name'],
        'avatar' => $r['avatar'],
        'xp' => (int)$r['xp'],
        'me' => (int)$r['id'] === (int)$player['id'],
    ], $rows, array_keys($rows));

    return [
        'week_start' => weekStart(),
        'ends_at' => weekEndsAt(),
        'tier' => $m['tier'],
        'tier_name' => TIERS[$m['tier']],
        'movement' => $m['movement'], // 1 = just promoted, -1 = just moved down
        'promote' => $m['tier'] < count(TIERS) - 1 ? PROMOTE : 0,
        'demote' => $m['tier'] > 0 && count($members) >= 10 ? DEMOTE : 0,
        'members' => $members,
    ];
}
