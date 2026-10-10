<?php
// LOCAL TESTING ONLY: fills this week's leagues with pretend players so the
// league screens have someone to race. Never run on the live server.
//   C:\xampp\php\php.exe api\dev\seed-demo.php          add 25 demo players per class
//   C:\xampp\php\php.exe api\dev\seed-demo.php --remove remove every demo player and demo school
//   C:\xampp\php\php.exe api\dev\seed-demo.php --extras only (re)add demo schools and boss scores
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$config = require __DIR__ . '/../config.php';
require __DIR__ . '/../lib.php';
require __DIR__ . '/../leagues.php';
require __DIR__ . '/../social.php';
require __DIR__ . '/../community.php';

/** Demo schools and Boss Battle scores for the demo players (clearly named "(demo)"). */
function seedExtras(): void
{
    $schools = [['Hillside Primary (demo)', 'Kampala'], ['Lakeview Primary (demo)', 'Wakiso'], ['Sunrise Junior (demo)', 'Mukono'],
        ['Riverside Primary (demo)', 'Jinja'], ['Green Valley School (demo)', 'Mbarara'], ['Starlight Primary (demo)', 'Gulu']];
    $ids = [];
    foreach ($schools as [$name, $district]) {
        q("INSERT IGNORE INTO schools (name, district, status) VALUES (?, ?, 'approved')", [$name, $district]);
        $ids[] = (int)q('SELECT id FROM schools WHERE name = ? AND district = ?', [$name, $district])->fetchColumn();
    }
    foreach (q('SELECT id, grade FROM players WHERE is_demo = 1')->fetchAll() as $p) {
        q('UPDATE players SET school_id = ? WHERE id = ?', [$ids[array_rand($ids)], $p['id']]);
        if (random_int(0, 99) < 40) {
            $dmg = random_int(40, 260);
            q('INSERT IGNORE INTO boss_results (week_start, player_id, grade, damage, defeated) VALUES (?, ?, ?, ?, ?)', [weekStart(), $p['id'], $p['grade'], $dmg, $dmg >= BOSS_HP ? 1 : 0]);
        }
    }
    echo "Demo schools and boss scores ready\n";
}

if (in_array('--extras', $argv, true)) {
    seedExtras();
    exit;
}

if (in_array('--remove', $argv, true)) {
    q("DELETE FROM schools WHERE name LIKE '%(demo)'");
    $n = q('DELETE FROM players WHERE is_demo = 1')->rowCount();
    q('UPDATE league_groups g SET size = (SELECT COUNT(*) FROM league_members m WHERE m.group_id = g.id)');
    q('DELETE FROM league_groups WHERE size = 0');
    echo "Removed $n demo players\n";
    exit;
}

$names = ['Amina', 'Okello', 'Nakato', 'Kato', 'Achieng', 'Mugisha', 'Apio', 'Wasswa', 'Nansubuga', 'Opio', 'Akello', 'Ssemakula', 'Namata',
    'Odongo', 'Kyomugisha', 'Tumusiime', 'Babirye', 'Kizza', 'Nabirye', 'Ochieng', 'Atim', 'Mukasa', 'Nalwoga', 'Byaruhanga', 'Auma', 'Lubega'];
$animals = ['🦁', '🐘', '🦒', '🐵', '🦓', '🐢', '🦜', '🐆', '🦛', '🐊'];

$made = 0;
foreach (GRADES as $grade) {
    for ($i = 0; $i < 25; $i++) {
        $device = 'demo-' . bin2hex(random_bytes(8));
        q(
            'INSERT INTO players (device_id, name, avatar, grade, is_demo) VALUES (?, ?, ?, ?, 1)',
            [$device, $names[array_rand($names)] . ' ' . chr(65 + random_int(0, 25)) . '.', $animals[array_rand($animals)], $grade],
        );
        $p = q('SELECT * FROM players WHERE device_id = ?', [$device])->fetch();
        ensureMembership($p);
        // a spread of scores, like a real class: a few keen players, many casual ones
        $xp = (int)round(random_int(0, 1000) ** 1.6 / 30);
        q('UPDATE players SET day_streak = ?, badges = ? WHERE id = ?', [random_int(0, 20), random_int(0, 7), $p['id']]);
        q('UPDATE league_members SET xp = ? WHERE week_start = ? AND player_id = ?', [$xp, weekStart(), $p['id']]);
        q('UPDATE players SET xp_total = ? WHERE id = ?', [$xp, $p['id']]);
        $made++;
    }
}
echo "Added $made demo players to this week's leagues\n";
seedExtras();
