<?php
// Settings. On a server, put real values in config.local.php (git-ignored; see
// config.local.example.php) or in BSK_* environment variables, never in this file.
$config = [
    'db_host' => '127.0.0.1',
    'db_name' => 'brainsprint',
    'db_user' => 'root',
    'db_pass' => '',
    // origins allowed to call the API from a browser (vite dev server, mobile app shells)
    'cors_origins' => [
        'http://localhost:5173',
        'capacitor://localhost',
        'https://localhost',
    ],
    'demo_life' => false, // local testing only: demo players act alive
];

if (is_file(__DIR__ . '/config.local.php')) {
    $config = array_merge($config, require __DIR__ . '/config.local.php');
}

foreach (['db_host', 'db_name', 'db_user', 'db_pass'] as $key) {
    $env = getenv('BSK_' . strtoupper($key));
    if ($env !== false) $config[$key] = $env;
}

return $config;
