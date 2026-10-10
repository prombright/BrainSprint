<?php
// Creates an admin account, or sets a new password for an existing one.
//   php api/dev/create-admin.php <username>          writes it to the database
//   php api/dev/create-admin.php <username> --sql    only PRINTS the SQL, for hosting without a
//                                                    terminal: paste it into phpMyAdmin → SQL
// The password is typed in, or taken from BSK_ADMIN_PASSWORD.
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$username = $argv[1] ?? '';
$printSql = in_array('--sql', $argv, true);
if (!preg_match('/^[a-zA-Z0-9_.-]{3,40}$/', $username)) {
    fwrite(STDERR, "Usage: php api/dev/create-admin.php <username> [--sql]  (3–40 letters, numbers, . _ -)\n");
    exit(1);
}

$password = getenv('BSK_ADMIN_PASSWORD') ?: null;
if ($password === null) {
    echo 'Password (at least 10 characters): ';
    if (PHP_OS_FAMILY !== 'Windows') shell_exec('stty -echo');
    $password = trim((string)fgets(STDIN));
    if (PHP_OS_FAMILY !== 'Windows') shell_exec('stty echo');
    echo "\n";
}
if (strlen($password) < 10) {
    fwrite(STDERR, "The password must be at least 10 characters\n");
    exit(1);
}
$hash = password_hash($password, PASSWORD_DEFAULT);

if ($printSql) {
    // the username is limited to safe characters above, and a bcrypt hash has no quotes
    echo "INSERT INTO admins (username, password_hash) VALUES ('$username', '$hash')\n";
    echo "  ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), failed_logins = 0, locked_until = NULL;\n";
    exit;
}

$config = require __DIR__ . '/../config.php';
require __DIR__ . '/../lib.php';
q(
    'INSERT INTO admins (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), failed_logins = 0, locked_until = NULL',
    [$username, $hash],
);
echo "Admin \"$username\" is ready\n";
