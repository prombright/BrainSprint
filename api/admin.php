<?php
// The admin panel's API, the website's contact form and public numbers.
declare(strict_types=1);

// ---------- admins ----------

function requireAdmin(): array
{
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', header_('Authorization'), $m)) respond(401, ['error' => 'Admin sign-in needed']);
    $a = q('SELECT a.id, a.username FROM admin_tokens t JOIN admins a ON a.id = t.admin_id WHERE t.token_hash = ? AND t.created_at > NOW() - INTERVAL 12 HOUR', [tokenHash($m[1])])->fetch();
    if (!$a) respond(401, ['error' => 'Admin sign-in needed']);
    return $a;
}

function adminLogin(array $d): never
{
    $a = q('SELECT * FROM admins WHERE username = ?', [trim((string)($d['username'] ?? ''))])->fetch();
    if ($a && $a['locked_until'] && strtotime($a['locked_until']) > time()) respond(429, ['error' => 'Too many wrong passwords. Try again in 15 minutes.']);
    if (!$a || !password_verify((string)($d['password'] ?? ''), $a['password_hash'])) {
        if ($a) {
            $fails = (int)$a['failed_logins'] + 1;
            $fails >= 5
                ? q('UPDATE admins SET failed_logins = 0, locked_until = NOW() + INTERVAL 15 MINUTE WHERE id = ?', [$a['id']])
                : q('UPDATE admins SET failed_logins = ? WHERE id = ?', [$fails, $a['id']]);
        }
        respond(401, ['error' => 'Wrong username or password']);
    }
    q('UPDATE admins SET failed_logins = 0, locked_until = NULL WHERE id = ?', [$a['id']]);
    q('DELETE FROM admin_tokens WHERE created_at < NOW() - INTERVAL 12 HOUR');
    $token = newToken();
    q('INSERT INTO admin_tokens (token_hash, admin_id) VALUES (?, ?)', [tokenHash($token), $a['id']]);
    respond(200, ['token' => $token, 'username' => $a['username']]);
}

// ---------- names children and schools choose ----------

/** A small first line of defence; admins can rename anything that slips through. */
function looksRude(string $text): bool
{
    // only words that never appear inside real names (so not "dick" → Dickson, "hate" → Hatega)
    $words = ['fuck', 'shit', 'bitch', 'bastard', 'pussy', 'porn', 'nigger', 'nigga', 'cunt', 'whore', 'slut'];
    $plain = strtolower(preg_replace('/[^a-z]/i', '', strtr($text, ['0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '@' => 'a', '$' => 's'])));
    foreach ($words as $w) if (str_contains($plain, $w)) return true;
    return false;
}

// ---------- overview ----------

function adminOverview(): array
{
    $real = 'is_demo = 0';
    $n = fn (string $sql, array $p = []) => (int)q($sql, $p)->fetchColumn();
    $days = q(
        "SELECT DATE(s.played_at) AS day, COUNT(*) AS sprints, COUNT(DISTINCT s.player_id) AS players
         FROM sprints s JOIN players p ON p.id = s.player_id AND p.is_demo = 0
         WHERE s.played_at >= CURDATE() - INTERVAL 13 DAY GROUP BY day ORDER BY day",
    )->fetchAll();
    $grades = q("SELECT grade, COUNT(*) AS players FROM players WHERE $real GROUP BY grade ORDER BY FIELD(grade, 'TOP','P1','P2','P3','P4','P5','P6','P7')")->fetchAll();
    return [
        'players' => $n("SELECT COUNT(*) FROM players WHERE $real"),
        'players_new_7d' => $n("SELECT COUNT(*) FROM players WHERE $real AND created_at >= NOW() - INTERVAL 7 DAY"),
        'active_today' => $n("SELECT COUNT(*) FROM players WHERE $real AND last_seen_at >= CURDATE()"),
        'online_now' => $n("SELECT COUNT(*) FROM players WHERE $real AND last_seen_at > NOW() - INTERVAL 2 MINUTE"),
        'sprints_today' => $n('SELECT COUNT(*) FROM sprints s JOIN players p ON p.id = s.player_id AND p.is_demo = 0 WHERE s.played_at >= CURDATE()'),
        'questions_total' => $n('SELECT COALESCE(SUM(s.total), 0) FROM sprints s JOIN players p ON p.id = s.player_id AND p.is_demo = 0'),
        'parents' => $n('SELECT COUNT(*) FROM parents'),
        'schools_pending' => $n("SELECT COUNT(*) FROM schools WHERE status = 'pending'"),
        'leads_new' => $n("SELECT COUNT(*) FROM leads WHERE status = 'new'"),
        'demo_players' => $n('SELECT COUNT(*) FROM players WHERE is_demo = 1'),
        'days' => array_map(fn ($d) => ['day' => $d['day'], 'sprints' => (int)$d['sprints'], 'players' => (int)$d['players']], $days),
        'grades' => array_map(fn ($g) => ['grade' => $g['grade'], 'players' => (int)$g['players']], $grades),
    ];
}

/** Public numbers for the website, only once they are worth showing. */
function publicStats(): array
{
    $players = (int)q('SELECT COUNT(*) FROM players WHERE is_demo = 0')->fetchColumn();
    if ($players < 100) return ['show' => false];
    return [
        'show' => true,
        'players' => $players,
        'questions' => (int)q('SELECT COALESCE(SUM(s.total), 0) FROM sprints s JOIN players p ON p.id = s.player_id AND p.is_demo = 0')->fetchColumn(),
        'schools' => (int)q("SELECT COUNT(*) FROM schools WHERE status = 'approved' AND name NOT LIKE '%(demo)'")->fetchColumn(),
    ];
}

// ---------- the website's contact form ----------

function saveLead(array $d): void
{
    if (!empty($d['website'])) respond(200, ['ok' => true]); // hidden "honeypot" field: only bots fill it in
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $recent = (int)q('SELECT COUNT(*) FROM leads WHERE ip = ? AND created_at > NOW() - INTERVAL 1 HOUR', [$ip])->fetchColumn();
    if ($recent >= 5) respond(429, ['error' => 'Thanks! We already have your messages and will be in touch.']);
    $phone = ugPhone((string)($d['phone'] ?? '')) ?? respond(422, ['error' => 'Enter a Ugandan phone number, like 0772 123456']);
    $email = trim((string)($d['email'] ?? ''));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) respond(422, ['error' => 'That email address looks wrong']);
    q(
        'INSERT INTO leads (kind, name, organisation, phone, email, message, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [oneOf($d, 'kind', ['school', 'parent', 'other']), text($d, 'name', 80), text($d, 'organisation', 120, false) ?: null, $phone, $email ?: null, text($d, 'message', 2000, false) ?: null, $ip],
    );
}

// ---------- admin lists ----------

function adminSchools(string $status): array
{
    $rows = q(
        'SELECT s.*, (SELECT COUNT(*) FROM players p WHERE p.school_id = s.id) AS members, c.name AS creator
         FROM schools s LEFT JOIN players c ON c.id = s.created_by WHERE s.status = ? ORDER BY s.created_at DESC LIMIT 200',
        [$status],
    )->fetchAll();
    return array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'district' => $r['district'], 'status' => $r['status'], 'members' => (int)$r['members'], 'creator' => $r['creator'], 'created_at' => $r['created_at']], $rows);
}

function adminPlayers(string $search): array
{
    $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
    $rows = q(
        'SELECT p.id, p.name, p.avatar, p.grade, p.xp_total, p.created_at, p.last_seen_at, s.name AS school, p.parent_id IS NOT NULL AS has_parent
         FROM players p LEFT JOIN schools s ON s.id = p.school_id
         WHERE p.is_demo = 0 AND (? = \'\' OR p.name LIKE ? OR p.id = ?) ORDER BY p.created_at DESC LIMIT 100',
        [$search, $like, ctype_digit($search) ? (int)$search : 0],
    )->fetchAll();
    return array_map(fn ($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'avatar' => $r['avatar'], 'grade' => $r['grade'], 'xp_total' => (int)$r['xp_total'], 'created_at' => $r['created_at'], 'last_seen_at' => $r['last_seen_at'], 'school' => $r['school'], 'has_parent' => (bool)$r['has_parent'], 'flagged' => looksRude($r['name'])], $rows);
}
