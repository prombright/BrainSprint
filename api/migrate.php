<?php
// Applies database changes in order, once each. Safe to run again: applied files are skipped.
//   C:\xampp\php\php.exe api\migrate.php
// On a fresh database it creates the base tables (schema.sql) first.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$config = require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';

$pdo = db();
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');

$has = fn (string $table) => (bool)$pdo->query("SHOW TABLES LIKE " . $pdo->quote($table))->fetchColumn();
$applied = $pdo->query('SELECT name FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);

// a database made before this runner existed: record what is clearly already there
if (!$applied && $has('players')) {
    $already = ['001_schema.sql'];
    if ($has('league_groups')) $already[] = '002_accounts_leagues.sql';
    if ($has('events')) $already[] = '003_social.sql';
    if ($has('boss_results')) $already[] = '004_friends_schools_boss.sql';
    if ($has('leads')) $already[] = '005_admin_leads.sql';
    foreach ($already as $name) $pdo->prepare('INSERT IGNORE INTO schema_migrations (name) VALUES (?)')->execute([$name]);
    $applied = $already;
    echo 'Existing database: marked ' . count($already) . " migrations as already applied\n";
}

/** Runs a .sql file statement by statement (skipping CREATE DATABASE / USE, the connection already has one). */
function runSql(PDO $pdo, string $file): void
{
    // drop comments, including ones after a column ("-- read-aloud text; …") that may contain semicolons
    $sql = preg_replace('/--\s.*$/m', '', file_get_contents($file));
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if (preg_match('/^(CREATE DATABASE|USE)\b/i', $statement)) continue;
        $pdo->exec($statement);
    }
}

$files = ['001_schema.sql' => __DIR__ . '/schema.sql'];
foreach (glob(__DIR__ . '/migrations/*.sql') as $f) $files[basename($f)] = $f;
ksort($files);

$ran = 0;
foreach ($files as $name => $file) {
    if (in_array($name, $applied, true)) continue;
    echo "Applying $name … ";
    runSql($pdo, $file);
    $pdo->prepare('INSERT INTO schema_migrations (name) VALUES (?)')->execute([$name]);
    echo "done\n";
    $ran++;
}
echo $ran ? "$ran migration(s) applied\n" : "Database is up to date\n";
