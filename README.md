# { OUTTAKE }

Unreleased music vault with a 3D vinyl / turntable player. **288 verified, playable unreleased & demo tracks across 12 artists** (97 Charlie Puth recovered from the original 99-track Charlie's Vault, 50 The Weeknd vault tracks, and 141 more across Kanye, Travis Scott, Drake, Justin Bieber, Post Malone, XXXTentacion, Lil Uzi Vert, Ariana Grande, Juice WRLD, Billie Eilish). Streamed live through YouTube's official IFrame API (no audio files hosted). Every video is machine-verified before it ships — dead or private links are never surfaced. Loves are stored in the browser (`localStorage`).

## Architecture: static-first

This site is built the way a YouTube-iframe listening site should be: **the catalog is static data; a server is optional.**

- **Plays from a bundled static catalog.** `index.html` embeds the full `SONGS`/`ARTISTS_DATA` arrays (regenerated from `scripts/catalog.json` via `npm run db:sync`). Opening the file on any static host immediately shows all 288 tracks and plays them through the official YouTube IFrame API — **no backend required**.
- **Live API is an optional enhancement.** If `/api/*` is reachable, the frontend enriches from it; if it isn't (unconfigured, down, or a pure static deploy), the page still boots and plays instantly from its bundle. The player never blocks on the network.
- **Reports degrade gracefully.** The "report broken link" button posts to `/api/report` when the API is up; otherwise the report is queued in `localStorage` so it's never lost.

## Run the optional backend

```bash
node server.js
# → http://localhost:8080  (frontend + the /api/* write/enrichment API)
```

First boot creates `data/vault.db` (SQLite) and seeds it from `scripts/catalog.json`. No `npm install` needed for local dev — SQLite uses Node's built-in `node:sqlite` (Node ≥ 22.5).

```bash
npm install   # optional — only for the Postgres backend path (installs `pg`)
npm test      # node:test suite — models, API, video probe
```

> Deploying as a **pure static site** (no Node)? Just drop `index.html` on any static host. The site is fully functional; only the live-enrichment and report-sync features go dormant.

## Local setup

```bash
node server.js
# → http://localhost:8080
```

First boot creates `data/vault.db` (SQLite) and seeds it from `scripts/catalog.json`. No `npm install` needed for local dev — SQLite uses Node's built-in `node:sqlite` (Node ≥ 22.5).

```bash
npm install   # only needed to deploy (installs `pg` for Postgres)
npm test      # node:test suite — models, API, video probe
```

## The database (optional, backend only)

The catalog itself is static and needs no database. If you run the optional backend, it uses one portable schema (`src/schema.sql`) for either backend:

- **Local dev / tests** — SQLite via `node:sqlite`, zero config.
- **Production** — Postgres: set `DATABASE_URL` (Neon / Supabase, both have free tiers) and the same code runs; `?` placeholders are rewritten to Postgres `$n` automatically.

Tables:
- `artists` — slug, name, avatar… (any artist — the whole catalog is multi-artist by design; every song points at one `artist_id`).
- `songs` — title, youtube_id (best/default source), mirror_id, duration, era, category, **status**, report_count, last_checked.
- `song_versions` — alternate takes of a song (e.g. studio vs **Acoustic** cut of *I Don't Wanna Hurt You Baby*). Each has its own youtube_id, label, status and report_count. A song is surfaced while its canonical copy **or** any version plays; picking a version is remembered per listener (`m2d_version_pref_v1`).
- `song_reports` — listener-flagged broken links (optionally scoped to one `version_id`).

`songs.status` is `active` | `dead` | `private`. `/api/songs` and the player surface `active` tracks (plus songs whose versions are still playable).

## API

Public:

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | service status, db backend, counts |
| `GET /api/artists` | all artists with song counts |
| `GET /api/songs` | active songs (`?artist=<slug>` filters, `?all=1` includes dead/private) |
| `GET /api/songs/:id` | single song (`?all=1` also returns dead versions for admins) |
| `POST /api/report` | `{ songId, reason?, versionId? }` — listeners flag broken links (optionally a specific version) |

Admin (`Authorization: Bearer $ADMIN_KEY`):

| Endpoint | Description |
| --- | --- |
| `POST /api/refresh` | probe stale videos, update status (`{ force?, maxAgeMs? }`) |
| `POST /api/save` | upsert catalog `{ artists?, songs? }` (curation) |

A song auto-flags `dead` after **3** reports; the daily refresh resurrects it if the video plays again.

## Keeping data fresh

- `POST /api/refresh` checks videos with the **YouTube Data API v3** when `YOUTUBE_API_KEY` is set, otherwise the **keyless** `youtube.com/oembed` probe. Either way failures degrade safely — never crash the cycle.
- `.github/workflows/refresh.yml` runs it daily (cron) via GitHub Actions using `PROD_URL` + `ADMIN_KEY` secrets.
- CLI one-shot: `node scripts/refresh_songs.js [--force]`

## Extending the catalog

**New artists and tracks always verify first — this is what keeps the vault honest.**

The Charlie Puth side is rebuilt from a recovered legacy source: `scripts/charlie_legacy_tracks.json` (the 98 candidates from the original Charlie's Vault, hand-curated titles). Other artists follow the same pattern — drop candidate links (ids + titles) into a source file, verify, build:

1. **Add candidates.** Edit `scripts/charlie_legacy_tracks.json` (or add a new source file for other artists) with `{ id, title, youtubeId?, versions? }`.
2. `npm run db:verify` — probes every candidate + version via `youtube.com/oembed`; only live links survive. Writes `scripts/verified_legacy.json` (gitignored).
3. `npm run db:build` — rebuilds `catalog.json` from the verified probe: playable candidates only (dead/private automatically dropped), old rows keep their real probed durations, alternate takes collapse into `versions`.
4. `npm run db:sync` — regenerates the bundled `SONGS`/`ARTISTS_DATA` fallback inside `index.html` to match.
 5. `npm run db:seed` — idempotent upsert into the DB; artists are auto-created from song credits.

### Adding one track fast (the easiest path)

`npm run db:add -- "<youtube-url-or-id>" [--artist="Artist Name"]` verifies a single link via the same keyless oEmbed truth-check (real title/author + playable), appends it to the roster, and records the probe so builds accept it. Nothing unplayable ever ships. Batch too:

```bash
# tracks.json → [{ "url": "...", "artist": "Travis Scott", "title"? }]
npm run db:add -- --file=tracks.json
npm run db:build && npm run db:sync && npm run db:seed && npm test
```

### Self-serve admin (no code, no commands)

Open **`/admin.html`** on a configured backend (password = your `ADMIN_KEY`). Paste a YouTube link → it verifies and shows the real title/author + playability → pick/type an artist → **Queue**. Queued tracks are stored in the `pending_tracks` DB table, and the **apply workflow** (`.github/workflows/apply_pending.yml`, manual or every 4h) fetches the queue, runs the same `add_tracks.js` engine, rebuilds + re-syncs, commits, and pushes → Vercel redeploys. Uses `PROD_URL` + `ADMIN_KEY` action secrets.


## Deploy (Vercel)

The frontend is **static** — the simplest correct deploy is to serve `index.html` as a static site, which works with no env vars and no build (songs play from the bundled catalog).

To also enable the live-enrichment + report-sync API, deploy the `/api/*` functions and set:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | **Required to run `/api/*`** — Postgres connection string (SQLite won't persist on Vercel). Without it the API returns a clean **503** ("database not configured") but the **static frontend still works**. Also enables the admin content pipeline (`/admin.html`, pending queue). |
| `ADMIN_KEY` | Required for `/api/refresh`, `/api/save`, and the admin `/api/admin/*` endpoints |
| `YOUTUBE_API_KEY` | Optional; enables authoritative YouTube API checks |

## License

Source code: MIT. All audio streams from publicly available YouTube videos and belongs to the respective rights holders.

---

Derived from the original **Charlie's Vault** (99 unreleased Charlie Puth tracks): candidate links were recovered from it, machine-verified — **97 remain playable today** (1 now private). The prior multi-artist "grails" expansion shipped fabricated video links — those were removed in favor of only machine-verified, playable tracks, verified keyless via YouTube's oEmbed truth-check (real title/author) before anything ships.