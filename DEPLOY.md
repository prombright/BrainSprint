# Going live

How to put BrainSprint Kids on a real web address, so phones, tablets, laptops and the Android
app all work from anywhere. Written for ordinary shared hosting with **cPanel** (most Ugandan
and international hosts); a VPS works the same way.

## What you need

- A **domain**, e.g. `brainsprintkids.com` (or `.ug` / `.co.ug`).
- **Hosting** with PHP 8.2 or newer, MySQL or MariaDB, and free SSL (cPanel "AutoSSL" or Let's Encrypt).
  A terminal (cPanel → Terminal, or SSH) helps but isn't required.

On the server the site lives at the web root:

```
public_html/
  site.html        landing page (the front page)
  index.html       the game
  admin.html       admin panel
  BrainSprintKids.apk
  assets/ icons/ …
  api/             the PHP API (only index.php is reachable from the web)
```

## 1. Make the package (on this computer)

```
cd frontend
copy .env.live.example .env.live      # once; it already says VITE_API_URL=/api
npm run release
```

This makes `release/brainsprint-YYYY-MM-DD.zip` (the website and API) and `release/database.sql`.
Demo players, `seed-demo.php` and your local `config.local.php` are never included.

## 2. Database

In cPanel → **MySQL Databases**: create a database (e.g. `youraccount_brainsprint`) and a user with a
long random password, and give the user **All privileges** on the database.

Then either:
- **With a terminal** (after step 3): `php api/migrate.php`, or
- **Without one**: cPanel → phpMyAdmin → choose the new database → **Import** → `database.sql`.

## 3. Upload the files

cPanel → **File Manager** → `public_html` → **Upload** the zip → right-click → **Extract**.
Move the contents of the extracted `public_html` folder up into `public_html` itself, so
`public_html/site.html` and `public_html/api/index.php` exist. Delete the zip afterwards.

## 4. Settings

In `public_html/api/`, copy `config.local.example.php` to **`config.local.php`** and fill in the
database name, user and password from step 2, and your domain in `cors_origins`.
Keep `'demo_life' => false`.

Check: open `https://yourdomain/api/health` and you should see `{"ok":true}`.

## 5. Your admin account

- **With a terminal**: `php api/dev/create-admin.php yourname` (it asks for a password, 10+ characters).
- **Without one**: on this computer run
  `C:\xampp\php\php.exe api\dev\create-admin.php yourname --sql`,
  then paste the line it prints into phpMyAdmin → SQL on the live database.

Sign in at `https://yourdomain/admin.html`.

## 6. HTTPS

cPanel → **SSL/TLS Status** → run AutoSSL for the domain, then make sure `http://` redirects to
`https://` (cPanel → Domains → "Force HTTPS Redirect"). Phones install the web app and run the
service worker only over HTTPS.

## 7. The Android app

1. In `frontend/.env.android` set `VITE_API_URL=https://yourdomain/api`.
2. Rebuild: `npm run build:android`, then in `frontend/android`:
   `set JAVA_HOME=C:\Users\HP\.jdks\jdk-21.0.12.1+1` and `gradlew assembleDebug`.
3. Copy the new APK into `release/` or straight into `public_html/BrainSprintKids.apk`.

For the **Play Store** you'll need a signed release build and a Google Play developer account
(US$25 one-off). The signing key is permanent: whoever holds it controls app updates forever,
so it gets its own careful step later.

## Updating the live site later

1. `npm run release` again.
2. Upload and extract over the old files. **Keep `api/config.local.php`**: it isn't in the zip, so it won't be overwritten.
3. If the release added database changes: `php api/migrate.php` (safe to run every time), or import
   just the new files from `api/migrations/` in phpMyAdmin.

## Before you tell anyone the address

- [ ] `https://yourdomain/` shows the landing page, and **Play now** opens the game
- [ ] `https://yourdomain/api/health` → `{"ok":true}`
- [ ] `https://yourdomain/api/config.php` → **403 Forbidden** (settings are private)
- [ ] admin sign-in works; a wrong password is refused
- [ ] create a child on a phone, play a sprint, and see it in the admin overview
- [ ] the contact form sends, and the enquiry appears in the admin panel
- [ ] cPanel → **Backup**: turn on automatic database backups
