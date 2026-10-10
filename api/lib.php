<?php
// Shared helpers for the BrainSprint Kids API.
declare(strict_types=1);

date_default_timezone_set('Africa/Kampala'); // leagues run Monday to Sunday, Kampala time

const GRADES = ['TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
const SUBJECTS = ['maths', 'english', 'science', 'sst'];
const LEVELS = ['simple', 'medium', 'hard', 'pro'];

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = $GLOBALS['config'];
    $pdo = new PDO(
        "mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4",
        $c['db_user'],
        $c['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC],
    );
    $pdo->exec("SET time_zone = '+03:00'");
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function body(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($data)) respond(400, ['error' => 'Send a JSON body']);
    return $data;
}

function oneOf(array $data, string $key, array $allowed): string
{
    $v = (string)($data[$key] ?? '');
    if (!in_array($v, $allowed, true)) respond(422, ['error' => "Invalid $key"]);
    return $v;
}

function intIn(array $data, string $key, int $min, int $max): int
{
    $v = filter_var($data[$key] ?? null, FILTER_VALIDATE_INT);
    if ($v === false || $v < $min || $v > $max) respond(422, ['error' => "Invalid $key"]);
    return $v;
}

function text(array $data, string $key, int $maxChars, bool $required = true): string
{
    $v = trim((string)($data[$key] ?? ''));
    if (($required && $v === '') || mb_strlen($v) > $maxChars) respond(422, ['error' => "Invalid $key"]);
    return $v;
}

// ---------- tokens ----------

function newToken(): string
{
    return bin2hex(random_bytes(32));
}

function tokenHash(string $token): string
{
    return hash('sha256', $token);
}

function header_(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    // some Apache setups only pass Authorization through the rewrite rule in .htaccess
    return trim((string)($_SERVER[$key] ?? $_SERVER['REDIRECT_' . $key] ?? ''));
}

/** The player this device owns, proven by X-Player-Id + X-Player-Token. */
function requirePlayer(): array
{
    $id = (int)header_('X-Player-Id');
    $token = header_('X-Player-Token');
    if (!$id || $token === '') respond(401, ['error' => 'Player sign-in needed']);
    $p = q('SELECT * FROM players WHERE id = ?', [$id])->fetch();
    if (!$p || !$p['token_hash'] || !hash_equals($p['token_hash'], tokenHash($token))) respond(401, ['error' => 'Player sign-in needed']);
    return $p;
}

/** The signed-in parent, from "Authorization: Bearer <token>". */
function requireParent(): array
{
    $auth = header_('Authorization');
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $auth, $m)) respond(401, ['error' => 'Please sign in']);
    $hash = tokenHash($m[1]);
    $p = q('SELECT p.* FROM parent_tokens t JOIN parents p ON p.id = t.parent_id WHERE t.token_hash = ?', [$hash])->fetch();
    if (!$p) respond(401, ['error' => 'Please sign in']);
    q('UPDATE parent_tokens SET last_used_at = NOW() WHERE token_hash = ?', [$hash]);
    return $p;
}

/** Uganda numbers: 0772123456 / +256772123456 / 256772123456 → 256772123456 */
function ugPhone(string $raw): ?string
{
    $d = preg_replace('/\D/', '', $raw);
    if (strlen($d) === 10 && $d[0] === '0') $d = '256' . substr($d, 1);
    if (strlen($d) === 9 && $d[0] === '7') $d = '256' . $d;
    return preg_match('/^2567\d{8}$/', $d) ? $d : null;
}

// ---------- weeks ----------

function weekStart(?int $ts = null): string
{
    $ts ??= time();
    return date('Y-m-d', strtotime('monday this week', $ts));
}

function weekEndsAt(): string
{
    return date('c', strtotime(weekStart() . ' +7 days'));
}
