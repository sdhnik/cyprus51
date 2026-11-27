# Cyprus 5+1 · Running passport

Six half marathons, one passport: Nicosia, Paphos, Limassol, Larnaka, Ayia Napa and one abroad.

- Site: https://sdhnik.github.io/cyprus51/
- Strava club: https://www.strava.com/clubs/cyprus51

## How it is built

- Static site on **GitHub Pages**, no build step: plain HTML, CSS and JavaScript modules.
- **Supabase** (EU, Frankfurt) for accounts, results and private photo storage. Schema: `supabase/schema.sql`.
- Fonts are self-hosted in `assets/fonts` (no Google Fonts).

## Editing the races

All race data lives in `data/races.json`, course files in `data/gpx/`.

1. Open `data/races.json` on GitHub and press the pencil icon.
2. Change what you need and press **Commit changes**.
3. GitHub checks the file. If something is wrong, the site is not updated and the **Actions** tab shows why.

Fields of a race:

| Field | Required | Example |
|---|---|---|
| `id` | yes, never change after the season starts | `larnaka-2027` |
| `city` | yes | `Larnaka` |
| `officialName` | yes | `Radisson Hotels Larnaka Marathon — Half Marathon` |
| `date` | yes: `YYYY-MM-DD`, or `YYYY-MM` while the date is not announced ("date TBC") | `2027-11` |
| `website` | yes, `https://…` | |
| `gpx` | yes, file in `data/gpx/` | `gpx/larnaka-2027.gpx` |
| `stamp` | yes, image name in `assets/stamps/` | `larnaka` |
| `startFinish`, `course` | optional, hidden when empty | `Finikoudes`, `Seafront` |

Distance, elevation, the map and the profile are calculated from the GPX.

## Automations

- **Publish site** (`.github/workflows/pages.yml`): on every push to `main`, checks `races.json` and publishes.
- **Keep Supabase awake** (`.github/workflows/keepalive.yml`): one tiny request a day. It also re-enables itself and the backup every day, so GitHub's "60 days without activity" rule does not switch them off.
- **Back up database** (`.github/workflows/backup.yml`): every Monday, an encrypted backup of the database (and the photo and GPX files, if the key is set). It needs repository secrets; see the top of the file.

## Emails

Sign-up, password and email-change emails are Supabase Auth templates (`supabase/emails/`).
Result emails come from the Edge Function `supabase/functions/notify/index.ts`, sent through the project Gmail:

- **Result verified** and **Result rejected**: the moment an admin reviews a result (database trigger).
- **Add your official result**: once, about a day after check-in, if the result is still missing (daily job at 09:07 UTC).

`email_log` records every email sent, so nobody gets the same email twice.
Secrets (Edge Functions → Secrets): `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_SECRET`.
The same `NOTIFY_SECRET` is stored in Vault as `notify_secret`, so the database can call the function.
To see the three emails with sample data, send `{"kind":"test"}` to the function with the header `x-notify-secret`.

## Backups

Each run of **Back up database** keeps one file for 90 days: Actions → Back up database → the run → Artifacts.
The file is encrypted with `BACKUP_PASSPHRASE`, so it can sit in this public repository safely.

Open it:

```sh
unzip cyprus51-backup-2027-01-25.zip        # GitHub wraps the artifact in a zip
gpg --decrypt cyprus51-backup-2027-01-25.tar.gz.gpg > backup.tar.gz   # asks for the passphrase
tar -xzf backup.tar.gz                       # backup/public.sql, backup/auth-and-files.sql, backup/storage/…
```

Restore into a new, empty Supabase project: run `backup/auth-and-files.sql` first (accounts and file
records), then `backup/public.sql`, with `psql` or the SQL editor; then upload `backup/storage/photos` and `backup/storage/gpx` to the
buckets of the same names. A full restore is rarely needed: to look up one result, open `public.sql` in a text editor.

## Keys

`js/config.js` holds the Supabase URL and the **publishable** key. Both are public by design.
Never commit the secret / service_role key.
