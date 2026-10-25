<?php
// BrainSprint Kids API: one small front controller.
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/leagues.php';
require __DIR__ . '/social.php';
require __DIR__ . '/community.php';
require __DIR__ . '/admin.php';
require __DIR__ . '/learning.php';
require __DIR__ . '/teachers.php';
require __DIR__ . '/bank.php';
require __DIR__ . '/facts.php';
require __DIR__ . '/compete.php';
require __DIR__ . '/classcontests.php';

header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $config['cors_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Player-Id, X-Player-Token');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Vary: Origin');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// path after .../api
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$path = '/' . trim(substr($path, strlen($base)), '/');
$method = $_SERVER['REQUEST_METHOD'];
$route = "$method $path";

function playerSummary(array $p): array
{
    $week = (int)q('SELECT xp FROM league_members WHERE week_start = ? AND player_id = ?', [weekStart(), $p['id']])->fetchColumn();
    return [
        'id' => (int)$p['id'],
        'xp_total' => (int)$p['xp_total'],
        'week_xp' => $week,
        'tier' => (int)$p['tier'],
        'tier_name' => TIERS[(int)$p['tier']],
        'has_parent' => $p['parent_id'] !== null,
    ];
}

function parentPayload(array $parent): array
{
    return ['id' => (int)$parent['id'], 'name' => $parent['name'], 'phone' => $parent['phone']];
}

function signInParent(array $parent): never
{
    q('DELETE FROM parent_tokens WHERE last_used_at < NOW() - INTERVAL 180 DAY'); // tidy old sign-ins
    $token = newToken();
    q('INSERT INTO parent_tokens (token_hash, parent_id) VALUES (?, ?)', [tokenHash($token), $parent['id']]);
    q('UPDATE parents SET failed_logins = 0, locked_until = NULL WHERE id = ?', [$parent['id']]);
    respond(200, ['token' => $token, 'parent' => parentPayload($parent)]);
}

try {
    switch (true) {
        case $route === 'GET /health':
            q('SELECT 1');
            respond(200, ['ok' => true]);

        // ---------- the public website ----------

        // approved bank questions for one class + subject (the game caches them for offline play)
        case $route === 'GET /questions':
            respond(200, publishedQuestions(oneOf($_GET, 'subject', SUBJECTS), oneOf($_GET, 'grade', GRADES)));

        // approved fact sets taught in one class (the app turns them into questions)
        case $route === 'GET /facts':
            respond(200, ['sets' => publishedFactSets(oneOf($_GET, 'subject', SUBJECTS), oneOf($_GET, 'grade', GRADES))]);

        case $route === 'GET /questions/coverage':
            // ?grade= adds each subject's content version for that class, so phones download only what changed
            $cov = bankCoverage();
            if (in_array($_GET['grade'] ?? '', GRADES, true)) {
                foreach ($cov as &$c) if ($c['grade'] === $_GET['grade']) $c['version'] = contentVersion($c['subject'], $c['grade']);
                unset($c);
            }
            respond(200, ['coverage' => $cov]);

        case $route === 'GET /stats':
            respond(200, publicStats());

        case $route === 'POST /leads':
            saveLead(body());
            respond(200, ['ok' => true]);

        // ---------- teachers ----------

        case $route === 'POST /teachers/register':
            teacherRegister(body());

        case $route === 'POST /teachers/login':
            teacherLogin(body());

        case $route === 'POST /teachers/logout':
            requireTeacher();
            preg_match('/([a-f0-9]{64})/i', header_('Authorization'), $mm);
            q('DELETE FROM teacher_tokens WHERE token_hash = ?', [tokenHash($mm[1])]);
            respond(200, ['ok' => true]);

        case $route === 'GET /teacher/classes':
            $t = requireTeacher();
            respond(200, ['teacher' => teacherPayload($t), 'classes' => teacherClasses($t)]);

        case $route === 'POST /teacher/classes':
            $t = requireTeacher();
            $d = body();
            if ((int)q('SELECT COUNT(*) FROM classes WHERE teacher_id = ?', [$t['id']])->fetchColumn() >= 20) respond(422, ['error' => 'You can have up to 20 classes']);
            q('INSERT INTO classes (teacher_id, name, grade, code) VALUES (?, ?, ?, ?)', [$t['id'], text($d, 'name', 40), oneOf($d, 'grade', GRADES), newClassCode()]);
            respond(200, ['classes' => teacherClasses($t)]);

        case $method === 'GET' && (bool)preg_match('#^/teacher/classes/(\d+)$#', $path, $mm):
            respond(200, classDetail(ownClass(requireTeacher(), (int)$mm[1])));

        case $method === 'POST' && (bool)preg_match('#^/teacher/classes/(\d+)/delete$#', $path, $mm):
            $t = requireTeacher();
            q('DELETE FROM classes WHERE id = ?', [ownClass($t, (int)$mm[1])['id']]);
            respond(200, ['classes' => teacherClasses($t)]);

        case $method === 'POST' && (bool)preg_match('#^/teacher/classes/(\d+)/remove$#', $path, $mm):
            $c = ownClass(requireTeacher(), (int)$mm[1]);
            q('DELETE FROM class_members WHERE class_id = ? AND player_id = ?', [$c['id'], intIn(body(), 'player_id', 1, PHP_INT_MAX)]);
            respond(200, classDetail($c));

        case $method === 'POST' && (bool)preg_match('#^/teacher/classes/(\d+)/assignments$#', $path, $mm):
            $c = ownClass(requireTeacher(), (int)$mm[1]);
            createAssignment($c, body());
            respond(200, classDetail($c));

        case $method === 'POST' && (bool)preg_match('#^/teacher/assignments/(\d+)/delete$#', $path, $mm):
            $t = requireTeacher();
            $a = q('SELECT a.id, a.class_id FROM assignments a JOIN classes c ON c.id = a.class_id AND c.teacher_id = ? WHERE a.id = ?', [$t['id'], (int)$mm[1]])->fetch() ?: respond(404, ['error' => 'Homework not found']);
            q('DELETE FROM assignments WHERE id = ?', [$a['id']]);
            respond(200, classDetail(ownClass($t, (int)$a['class_id'])));

        // ---------- PLE mock exams ----------

        case $route === 'GET /mocks':
            respond(200, mockHistory((int)requirePlayer()['id']));

        case $route === 'POST /mocks':
            respond(201, saveMock(requirePlayer(), body()));

        case $route === 'GET /teacher/questions':
            respond(200, teacherSuggestions(requireTeacher()));

        case $route === 'POST /teacher/questions':
            respond(201, teacherSuggest(requireTeacher(), body()));

        // ---------- classes, from the pupil's side ----------

        case $route === 'POST /classes/join':
            $p = requirePlayer();
            $joined = joinClass($p, text(body(), 'code', 12));
            respond(200, ['joined' => $joined, 'classes' => myClasses($p)]);

        case $route === 'GET /my/classes':
            respond(200, ['classes' => myClasses(requirePlayer())]);

        case $route === 'POST /classes/leave':
            $p = requirePlayer();
            q('DELETE FROM class_members WHERE class_id = ? AND player_id = ?', [intIn(body(), 'class_id', 1, PHP_INT_MAX), $p['id']]);
            respond(200, ['classes' => myClasses($p)]);

        // ---------- admin panel ----------

        case $route === 'POST /admin/login':
            adminLogin(body());

        case $route === 'GET /admin/overview':
            requireAdmin();
            respond(200, adminOverview());

        case $route === 'GET /admin/schools':
            requireAdmin();
            respond(200, ['schools' => adminSchools(in_array($_GET['status'] ?? '', ['pending', 'approved', 'hidden'], true) ? $_GET['status'] : 'pending')]);

        // {status?, name?, district?}: approve, hide or correct a school
        case $method === 'POST' && (bool)preg_match('#^/admin/schools/(\d+)$#', $path, $mm):
            requireAdmin();
            $d = body();
            if (isset($d['status'])) q('UPDATE schools SET status = ? WHERE id = ?', [oneOf($d, 'status', ['pending', 'approved', 'hidden']), (int)$mm[1]]);
            if (isset($d['name'])) q('UPDATE schools SET name = ?, district = ? WHERE id = ?', [text($d, 'name', 80), text($d, 'district', 40), (int)$mm[1]]);
            respond(200, ['ok' => true]);

        case $route === 'GET /admin/players':
            requireAdmin();
            respond(200, ['players' => adminPlayers(mb_substr(trim((string)($_GET['q'] ?? '')), 0, 40))]);

        // a child's name is public in leagues and feeds: admins can replace one that isn't suitable
        case $method === 'POST' && (bool)preg_match('#^/admin/players/(\d+)/rename$#', $path, $mm):
            requireAdmin();
            q('UPDATE players SET name = ? WHERE id = ? AND is_demo = 0', [text(body(), 'name', 30), (int)$mm[1]]);
            respond(200, ['ok' => true]);

        case $route === 'GET /admin/leads':
            requireAdmin();
            respond(200, ['leads' => q("SELECT id, kind, name, organisation, phone, email, message, status, created_at FROM leads ORDER BY status = 'new' DESC, id DESC LIMIT 200")->fetchAll()]);

        case $method === 'POST' && (bool)preg_match('#^/admin/leads/(\d+)$#', $path, $mm):
            requireAdmin();
            q('UPDATE leads SET status = ? WHERE id = ?', [oneOf(body(), 'status', ['new', 'contacted', 'closed']), (int)$mm[1]]);
            respond(200, ['ok' => true]);

        case $route === 'GET /admin/questions':
            requireAdmin();
            respond(200, adminQuestions($_GET));

        case $route === 'POST /admin/questions':
            respond(201, adminSaveQuestion(requireAdmin(), null, body()));

        case $route === 'POST /admin/questions/import':
            respond(200, adminImport(requireAdmin(), body()));

        case $method === 'POST' && (bool)preg_match('#^/admin/questions/(\d+)$#', $path, $mm):
            respond(200, adminSaveQuestion(requireAdmin(), (int)$mm[1], body()));

        case $route === 'GET /admin/facts':
            requireAdmin();
            respond(200, ['sets' => adminFactSets()]);

        case $method === 'GET' && (bool)preg_match('#^/admin/facts/(\d+)$#', $path, $mm):
            requireAdmin();
            $s = q('SELECT * FROM fact_sets WHERE id = ?', [(int)$mm[1]])->fetch() ?: respond(404, ['error' => 'Fact set not found']);
            respond(200, factSetOut($s));

        // {set…, status?}: create or update a whole set (rows included); or {status} alone
        case $route === 'POST /admin/facts':
        case $method === 'POST' && (bool)preg_match('#^/admin/facts/(\d+)$#', $path, $mm):
            $admin = requireAdmin();
            $d = body();
            $id = isset($mm[1]) ? (int)$mm[1] : null;
            $status = in_array($d['status'] ?? '', ['draft', 'approved', 'retired'], true) ? $d['status'] : 'draft';
            if ($id && count(array_diff(array_keys($d), ['status'])) === 0) {
                q('UPDATE fact_sets SET status = ? WHERE id = ?', [$status, $id]);
                respond(200, ['ok' => true]);
            }
            [$set, $problems] = cleanFactSet($d);
            if ($problems) respond(422, ['error' => $problems[0], 'problems' => $problems]);
            respond(200, ['id' => saveFactSet($id, $set, $status, 'admin:' . $admin['username'])]);

        // a JSON file of fact sets (like content/fact-sets-starter.json): each arrives as a draft
        case $route === 'POST /admin/facts/import':
            $admin = requireAdmin();
            $d = body();
            $sets = $d['sets'] ?? null;
            if (!is_array($sets) || count($sets) > 100) respond(422, ['error' => 'Send up to 100 fact sets']);
            $created = 0;
            $skipped = 0;
            $errors = [];
            foreach (array_values($sets) as $i => $raw) {
                [$set, $problems] = cleanFactSet(is_array($raw) ? $raw : []);
                $label = $set['name'] ?: 'set ' . ($i + 1);
                if ($problems) {
                    $errors[] = ['set' => $label, 'error' => implode('; ', array_slice($problems, 0, 3))];
                    continue;
                }
                if (q('SELECT 1 FROM fact_sets WHERE subject = ? AND name = ?', [$set['subject'], $set['name']])->fetchColumn()) {
                    $skipped++;
                    continue;
                }
                saveFactSet(null, $set, 'draft', 'import:' . mb_substr(preg_replace('/[^\w.\- ]/u', '', (string)($d['file'] ?? 'import')), 0, 40) . ' by ' . $admin['username']);
                $created++;
            }
            respond(200, ['created' => $created, 'skipped' => $skipped, 'errors' => $errors]);

        case $route === 'GET /admin/feed':
            requireAdmin();
            respond(200, ['events' => q('SELECT e.id, e.kind, e.detail, e.created_at, p.name, p.avatar, p.is_demo FROM events e JOIN players p ON p.id = e.player_id ORDER BY e.id DESC LIMIT 100')->fetchAll()]);

        case $method === 'POST' && (bool)preg_match('#^/admin/feed/(\d+)/delete$#', $path, $mm):
            requireAdmin();
            q('DELETE FROM events WHERE id = ?', [(int)$mm[1]]);
            respond(200, ['ok' => true]);

        // ---------- players ----------

        // {device_id, name, avatar, grade} → creates or updates the device's player and issues a fresh token
        case $route === 'POST /players':
            $d = body();
            $deviceId = text($d, 'device_id', 64);
            $name = text($d, 'name', 30);
            if (looksRude($name)) respond(422, ['error' => 'Please choose a different name']);
            $avatar = text($d, 'avatar', 16);
            $grade = oneOf($d, 'grade', GRADES);
            // a device already registered must send its own token: knowing a device id alone
            // is not enough to take over a child's player
            $existing = q('SELECT token_hash FROM players WHERE device_id = ?', [$deviceId])->fetch();
            if ($existing && $existing['token_hash'] && !hash_equals($existing['token_hash'], tokenHash(header_('X-Player-Token')))) {
                respond(409, ['error' => 'This device is already registered']);
            }
            $token = newToken();
            q(
                'INSERT INTO players (device_id, token_hash, name, avatar, grade) VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), name = VALUES(name), avatar = VALUES(avatar), grade = VALUES(grade)',
                [$deviceId, tokenHash($token), $name, $avatar, $grade],
            );
            $p = q('SELECT * FROM players WHERE device_id = ?', [$deviceId])->fetch();
            respond(200, ['id' => (int)$p['id'], 'token' => $token] + playerSummary($p));

        case $route === 'GET /players/me':
            respond(200, playerSummary(requirePlayer()));

        // a finished sprint: adds XP to the player's total and this week's league
        case $route === 'POST /sprints':
            $p = requirePlayer();
            $d = body();
            $total = intIn($d, 'total', 1, 50);
            $score = intIn($d, 'score', 0, $total * 25); // max per answer: 10 base + 10 speed + 5 streak
            $avgMs = intIn($d, 'avg_ms', 0, 600000);
            if ($score > 0 && $avgMs < 250) respond(422, ['error' => 'Answers were impossibly fast']);
            $played = strtotime((string)($d['played_at'] ?? ''));
            if ($played === false || $played > time() + 300) respond(422, ['error' => 'Invalid played_at']);
            $playedAt = date('Y-m-d H:i:s', $played);
            // the same sprint sent again after a dropped connection: accept it once
            if (q('SELECT 1 FROM sprints WHERE player_id = ? AND played_at = ?', [$p['id'], $playedAt])->fetchColumn()) {
                respond(200, playerSummary($p));
            }
            // a 10-question sprint takes well over 15 seconds, so two can't finish that close together
            // (checked by when they were played, so a phone can still upload a backlog played offline)
            $close = q('SELECT COUNT(*) FROM sprints WHERE player_id = ? AND ABS(TIMESTAMPDIFF(SECOND, played_at, ?)) < 15', [$p['id'], $playedAt])->fetchColumn();
            if ($close) respond(422, ['error' => 'Sprints finished too close together']);

            $s = [
                'subject' => oneOf($d, 'subject', SUBJECTS), 'grade' => oneOf($d, 'grade', GRADES), 'level' => oneOf($d, 'level', [...LEVELS, 'mixed']),
                'score' => $score, 'correct' => intIn($d, 'correct', 0, $total), 'total' => $total, 'best_streak' => intIn($d, 'best_streak', 0, $total),
            ];
            q(
                'INSERT INTO sprints (player_id, subject, grade, level, score, correct, total, avg_ms, best_streak, played_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$p['id'], $s['subject'], $s['grade'], $s['level'], $score, $s['correct'], $total, $avgMs, $s['best_streak'], $playedAt],
            );
            // only fresh sprints make the news; an old offline backlog stays quiet
            if ($played > time() - 3600) sprintEvent((int)$p['id'], $s);
            recordTopics((int)$p['id'], $s['subject'], $s['grade'], sprintTopics($d, $total));
            if (!empty($d['assignment_id'])) recordHomework($p, intIn($d, 'assignment_id', 1, PHP_INT_MAX), $s['correct'], $total, $score, $playedAt);
            q('UPDATE players SET xp_total = xp_total + ? WHERE id = ?', [$score, $p['id']]);
            // sprints played offline in an earlier week still count towards the total, not this week's league
            if (weekStart($played) === weekStart()) {
                ensureMembership($p);
                q('UPDATE league_members SET xp = xp + ? WHERE week_start = ? AND player_id = ?', [$score, weekStart(), $p['id']]);
            }
            respond(201, playerSummary(q('SELECT * FROM players WHERE id = ?', [$p['id']])->fetch()));

        case $route === 'GET /league':
            $p = requirePlayer();
            demoLife($p);
            $l = leagueStandings($p);
            // mark who is online right now
            $online = q('SELECT id FROM players WHERE id IN (' . implode(',', array_map(fn ($m) => (int)$m['id'], $l['members']) ?: [0]) . ') AND last_seen_at > ?', [date('Y-m-d H:i:s', time() - ONLINE_SECONDS)])->fetchAll(PDO::FETCH_COLUMN);
            foreach ($l['members'] as &$m) $m['online'] = in_array($m['id'], array_map('intval', $online), true);
            respond(200, $l);

        // ---------- social ----------

        // heartbeat while the app is open: {activity?: "maths:P5:hard", day_streak, badges}
        case $route === 'POST /presence':
            $p = requirePlayer();
            $d = body();
            $activity = isset($d['activity']) && preg_match('/^[a-z]+:[A-Z0-9]+:[a-z]+$/', (string)$d['activity']) ? (string)$d['activity'] : null;
            touchPresence($p, $activity, intIn($d, 'day_streak', 0, 100000), intIn($d, 'badges', 0, 255));
            demoLife($p);
            respond(200, presenceSummary($p));

        case $method === 'GET' && (bool)preg_match('#^/players/(\d+)/card$#', $path, $mm):
            requirePlayer();
            respond(200, playerCard((int)$mm[1]) ?? respond(404, ['error' => 'Player not found']));

        // the rival's ghost for a race: GET /race/12?subject=maths&grade=P5&level=hard
        case $method === 'GET' && (bool)preg_match('#^/race/(\d+)$#', $path, $mm):
            requirePlayer();
            $card = playerCard((int)$mm[1]) ?? respond(404, ['error' => 'Player not found']);
            $g = $_GET;
            respond(200, ['rival' => $card, 'stats' => raceStats((int)$mm[1], oneOf($g, 'subject', SUBJECTS), oneOf($g, 'grade', GRADES), oneOf($g, 'level', LEVELS))]);

        // ---------- friends ----------

        case $route === 'GET /friends':
            $p = requirePlayer();
            respond(200, ['code' => friendCode($p), 'friends' => friendsList($p)]);

        case $route === 'POST /friends':
            $p = requirePlayer();
            $added = addFriend($p, text(body(), 'code', 12));
            respond(200, ['added' => $added['name'], 'code' => friendCode($p), 'friends' => friendsList($p)]);

        case $route === 'POST /friends/remove':
            $p = requirePlayer();
            removeFriend($p, intIn(body(), 'friend_id', 1, PHP_INT_MAX));
            respond(200, ['code' => friendCode($p), 'friends' => friendsList($p)]);

        // ---------- schools ----------

        case $route === 'GET /schools':
            $p = requirePlayer();
            respond(200, ['schools' => searchSchools($p, mb_substr(trim((string)($_GET['q'] ?? '')), 0, 40))]);

        case $route === 'POST /schools':
            $p = requirePlayer();
            $d = body();
            $name = text($d, 'name', 80);
            $district = text($d, 'district', 40);
            if (mb_strlen($name) < 4) respond(422, ['error' => 'Write the full school name']);
            if (looksRude($name) || looksRude($district)) respond(422, ['error' => 'Please check the school name']);
            createSchool($p, $name, $district);
            respond(200, schoolBoard(q('SELECT * FROM players WHERE id = ?', [$p['id']])->fetch()));

        case $route === 'POST /schools/join':
            $p = requirePlayer();
            $id = intIn(body(), 'school_id', 1, PHP_INT_MAX);
            $ok = q("SELECT 1 FROM schools WHERE id = ? AND (status = 'approved' OR created_by = ?)", [$id, $p['id']])->fetchColumn();
            if (!$ok) respond(404, ['error' => 'School not found']);
            q('UPDATE players SET school_id = ? WHERE id = ?', [$id, $p['id']]);
            respond(200, schoolBoard(q('SELECT * FROM players WHERE id = ?', [$p['id']])->fetch()));

        case $route === 'POST /schools/leave':
            $p = requirePlayer();
            q('UPDATE players SET school_id = NULL WHERE id = ?', [$p['id']]);
            respond(200, schoolBoard(q('SELECT * FROM players WHERE id = ?', [$p['id']])->fetch()));

        case $route === 'GET /schools/board':
            respond(200, schoolBoard(requirePlayer()));

        // ---------- competitions: school contests (teachers) ----------

        case $route === 'GET /teacher/contests':
            respond(200, teacherContests(requireTeacher()));

        case $route === 'POST /teacher/contests':
            $t = requireTeacher();
            createContest($t, body());
            respond(201, teacherContests($t));

        case $method === 'GET' && (bool)preg_match('#^/teacher/contests/(\d+)$#', $path, $mm):
            respond(200, teacherContestDetail(requireTeacher(), (int)$mm[1]));

        case $method === 'POST' && (bool)preg_match('#^/teacher/contests/(\d+)/(accept|decline|cancel)$#', $path, $mm):
            $t = requireTeacher();
            $mm[2] === 'cancel' ? cancelContest($t, (int)$mm[1]) : answerContest($t, (int)$mm[1], $mm[2] === 'accept');
            respond(200, teacherContests($t));

        // ---------- class vs class inside a school (teachers) ----------

        case $route === 'GET /teacher/class-contests':
            $t = requireTeacher();
            $grade = in_array($_GET['grade'] ?? '', GRADES, true) ? $_GET['grade'] : null;
            respond(200, ['contests' => teacherClassContests($t), 'classes' => $grade && $t['school_id'] ? schoolClassesOfYear($t, $grade) : []]);

        case $route === 'POST /teacher/class-contests':
            $t = requireTeacher();
            createClassContest($t, body());
            respond(201, ['contests' => teacherClassContests($t)]);

        case $method === 'GET' && (bool)preg_match('#^/teacher/class-contests/(\d+)$#', $path, $mm):
            respond(200, teacherClassContestDetail(requireTeacher(), (int)$mm[1]));

        case $method === 'POST' && (bool)preg_match('#^/teacher/class-contests/(\d+)/cancel$#', $path, $mm):
            $t = requireTeacher();
            cancelClassContest($t, (int)$mm[1]);
            respond(200, ['contests' => teacherClassContests($t)]);

        case $route === 'GET /teacher/school':
            $t = requireTeacher();
            respond(200, ['school' => teacherSchoolRow($t), 'subjects' => array_combine(GRADES, array_map(fn ($g) => paperSubjects($g), GRADES))]);

        // the whole school, class by class (no pupil names)
        case $route === 'GET /teacher/school/overview':
            respond(200, schoolOverview(requireTeacher()));

        case $route === 'POST /teacher/school':
            respond(200, ['school' => setTeacherSchool(requireTeacher(), intIn(body(), 'school_id', 1, PHP_INT_MAX))]);

        case $route === 'POST /teacher/school/open':
            $t = requireTeacher();
            q('UPDATE schools SET open_to_challenges = ? WHERE id = ?', [empty(body()['open']) ? 0 : 1, requireTeacherSchool($t)]);
            respond(200, ['school' => teacherSchoolRow($t)]);

        case $route === 'GET /teacher/schools':
            requireTeacher();
            respond(200, ['schools' => teacherSearchSchools(trim((string)($_GET['q'] ?? '')))]);

        // ---------- competitions: the child's side ----------

        case $route === 'GET /compete':
            $p = requirePlayer();
            respond(200, ['contests' => playerContests($p), 'class_contests' => playerClassContests($p), 'duels' => myDuels($p), 'duel_subjects' => paperSubjects($p['grade'], DUEL_QUESTIONS)]);

        // what is waiting for this child (the dot on Home's Compete button)
        case $route === 'GET /compete/waiting':
            respond(200, competeWaiting(requirePlayer()));

        case $method === 'GET' && (bool)preg_match('#^/class-contests/(\d+)$#', $path, $mm):
            respond(200, playerClassContest(requirePlayer(), (int)$mm[1]));

        case $method === 'POST' && (bool)preg_match('#^/class-contests/(\d+)/(start|submit)$#', $path, $mm):
            $p = requirePlayer();
            respond(200, $mm[2] === 'start' ? startClassContest($p, (int)$mm[1]) : submitClassContest($p, (int)$mm[1], body()['picks'] ?? null));

        case $method === 'GET' && (bool)preg_match('#^/contests/(\d+)$#', $path, $mm):
            respond(200, playerContest(requirePlayer(), (int)$mm[1]));

        case $method === 'POST' && (bool)preg_match('#^/contests/(\d+)/(start|submit)$#', $path, $mm):
            $p = requirePlayer();
            $c = contestRow((int)$mm[1]);
            $side = contestSide($c, (int)$p['id']);
            if (!$side || $c['status'] !== 'accepted') respond(404, ['error' => 'Competition not found']);
            if ($mm[2] === 'start') {
                if (contestPhase($c) !== 'live') respond(422, ['error' => contestPhase($c) === 'upcoming' ? 'It has not started yet' : 'This competition has closed']);
                respond(200, startAttempt(paperRow((int)$c['paper_id']), $p, strtotime($c['ends_at']), $side));
            }
            respond(200, submitAttempt(paperRow((int)$c['paper_id']), $p, body()['picks'] ?? null));

        // the Weekly Challenge: this week's paper for my class, and last week's results
        case $route === 'GET /weekly':
            respond(200, weeklyChallenge(requirePlayer()));

        case $route === 'POST /weekly/start':
            respond(200, startWeekly(requirePlayer()));

        case $route === 'POST /weekly/submit':
            respond(200, submitWeekly(requirePlayer(), body()['picks'] ?? null));

        case $route === 'POST /duels':
            $d = body();
            respond(201, createDuel(requirePlayer(), intIn($d, 'friend_id', 1, PHP_INT_MAX), oneOf($d, 'subject', PAPER_SUBJECTS)));

        case $method === 'GET' && (bool)preg_match('#^/duels/(\d+)$#', $path, $mm):
            $p = requirePlayer();
            respond(200, duelOut(duelRow((int)$mm[1], $p), $p, true));

        case $method === 'POST' && (bool)preg_match('#^/duels/(\d+)/(start|submit|decline)$#', $path, $mm):
            $p = requirePlayer();
            if ($mm[2] === 'start') respond(200, startDuel($p, (int)$mm[1]));
            if ($mm[2] === 'submit') respond(200, submitDuel($p, (int)$mm[1], body()['picks'] ?? null));
            declineDuel($p, (int)$mm[1]);
            respond(200, ['duels' => myDuels($p)]);

        // ---------- weekly Boss Battle ----------

        case $route === 'GET /boss':
            respond(200, bossBoard(requirePlayer()));

        case $route === 'POST /boss':
            // at most 12 questions × 25 points of damage; played_at (optional) for results sent late
            $d = body();
            $played = isset($d['played_at']) ? strtotime((string)$d['played_at']) : time();
            if ($played === false || $played > time() + 300 || $played < time() - 30 * 86400) respond(422, ['error' => 'Invalid played_at']);
            respond(200, saveBoss(requirePlayer(), intIn($d, 'damage', 0, 300), $played));

        // a finished race: a win makes the news
        case $route === 'POST /races':
            $p = requirePlayer();
            $d = body();
            $rival = playerCard(intIn($d, 'rival_id', 1, PHP_INT_MAX)) ?? respond(404, ['error' => 'Player not found']);
            if (!empty($d['won'])) {
                $where = gradeName(oneOf($d, 'grade', GRADES)) . ' ' . SUBJECT_NAMES[oneOf($d, 'subject', SUBJECTS)];
                addEvent((int)$p['id'], 'race_win', "beat {$rival['name']} in a $where race");
            }
            respond(200, ['ok' => true]);

        // ---------- parents ----------

        case $route === 'POST /parents/register':
            $d = body();
            $phone = ugPhone((string)($d['phone'] ?? '')) ?? respond(422, ['error' => 'Enter a Ugandan phone number, like 0772 123456']);
            $pin = (string)($d['pin'] ?? '');
            if (!preg_match('/^\d{4}$/', $pin)) respond(422, ['error' => 'The PIN must be 4 digits']);
            $name = text($d, 'name', 80);
            if (q('SELECT 1 FROM parents WHERE phone = ?', [$phone])->fetchColumn()) respond(409, ['error' => 'This number already has an account. Sign in instead.']);
            q('INSERT INTO parents (phone, name, pin_hash) VALUES (?, ?, ?)', [$phone, $name, password_hash($pin, PASSWORD_DEFAULT)]);
            signInParent(q('SELECT * FROM parents WHERE phone = ?', [$phone])->fetch());

        case $route === 'POST /parents/login':
            $d = body();
            $phone = ugPhone((string)($d['phone'] ?? ''));
            $parent = $phone ? q('SELECT * FROM parents WHERE phone = ?', [$phone])->fetch() : null;
            if ($parent && $parent['locked_until'] && strtotime($parent['locked_until']) > time()) {
                respond(429, ['error' => 'Too many wrong PINs. Try again in 15 minutes.']);
            }
            if (!$parent || !password_verify((string)($d['pin'] ?? ''), (string)$parent['pin_hash'])) {
                if ($parent) {
                    // 5 wrong PINs in a row lock the account for 15 minutes
                    $fails = (int)$parent['failed_logins'] + 1;
                    $fails >= 5
                        ? q('UPDATE parents SET failed_logins = 0, locked_until = NOW() + INTERVAL 15 MINUTE WHERE id = ?', [$parent['id']])
                        : q('UPDATE parents SET failed_logins = ? WHERE id = ?', [$fails, $parent['id']]);
                }
                respond(401, ['error' => 'Wrong phone number or PIN']);
            }
            signInParent($parent);

        case $route === 'POST /parents/logout':
            requireParent();
            preg_match('/([a-f0-9]{64})/i', header_('Authorization'), $m);
            q('DELETE FROM parent_tokens WHERE token_hash = ?', [tokenHash($m[1])]);
            respond(200, ['ok' => true]);

        // the parent's dashboard: every linked child with progress
        case $route === 'GET /parents/me':
            $parent = requireParent();
            $children = q('SELECT * FROM players WHERE parent_id = ? ORDER BY name', [$parent['id']])->fetchAll();
            $out = [];
            foreach ($children as $c) {
                $subjects = q(
                    "SELECT subject, COUNT(*) AS sprints, SUM(correct) AS correct, SUM(total) AS answered
                     FROM sprints WHERE player_id = ? GROUP BY subject",
                    [$c['id']],
                )->fetchAll();
                $week = q(
                    "SELECT COUNT(*) AS sprints, COALESCE(SUM(correct), 0) AS correct, COALESCE(SUM(total), 0) AS answered
                     FROM sprints WHERE player_id = ? AND played_at >= ?",
                    [$c['id'], weekStart()],
                )->fetch();
                $recent = q('SELECT subject, grade, level, score, correct, total, played_at FROM sprints WHERE player_id = ? ORDER BY played_at DESC LIMIT 5', [$c['id']])->fetchAll();
                $rank = rankInWeek((int)$c['id'], weekStart());
                $out[] = [
                    'id' => (int)$c['id'],
                    'name' => $c['name'],
                    'avatar' => $c['avatar'],
                    'grade' => $c['grade'],
                    'xp_total' => (int)$c['xp_total'],
                    'tier_name' => TIERS[(int)$c['tier']],
                    'league_rank' => $rank['rank'] ?? null,
                    'league_size' => $rank['size'] ?? null,
                    'this_week' => array_map('intval', $week),
                    'subjects' => array_map(fn ($s) => ['subject' => $s['subject'], 'sprints' => (int)$s['sprints'], 'correct' => (int)$s['correct'], 'answered' => (int)$s['answered']], $subjects),
                    'recent' => $recent,
                    'topics' => weakAndStrong((int)$c['id']),
                    'mock_readiness' => mockHistory((int)$c['id'])['readiness'],
                ];
            }
            respond(200, ['parent' => parentPayload($parent), 'children' => $out]);

        // link the child playing on this device: needs the parent's sign-in AND the child's player token
        case $route === 'POST /parents/children':
            $parent = requireParent();
            $child = requirePlayer();
            if ($child['parent_id'] !== null && (int)$child['parent_id'] !== (int)$parent['id']) respond(409, ['error' => 'This child is already linked to another parent']);
            q('UPDATE players SET parent_id = ? WHERE id = ?', [$parent['id'], $child['id']]);
            respond(200, ['ok' => true]);

        case $route === 'POST /parents/children/unlink':
            $parent = requireParent();
            $id = intIn(body(), 'player_id', 1, PHP_INT_MAX);
            q('UPDATE players SET parent_id = NULL WHERE id = ? AND parent_id = ?', [$id, $parent['id']]);
            respond(200, ['ok' => true]);
    }
    respond(404, ['error' => 'Not found']);
} catch (PDOException $e) {
    error_log('[brainsprint] ' . $e->getMessage());
    respond(500, ['error' => 'Server error']);
}
