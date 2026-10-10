<?php
// Copy to config.local.php on the server and fill in. Never commit the real file.
return [
    'db_host' => 'localhost',
    'db_name' => 'youraccount_brainsprint',
    'db_user' => 'youraccount_bsk',
    'db_pass' => 'a-long-random-password',
    // the website's own address must be listed so browsers may call the API
    'cors_origins' => [
        'https://brainsprintkids.com',
        'https://www.brainsprintkids.com',
        'capacitor://localhost', // the Android/iOS app
        'https://localhost',     // the Android app (Capacitor's https scheme)
    ],
    'demo_life' => false,
];
