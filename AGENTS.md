# AGENTS.md

`{ OUTTAKE }` — "unreleased music vault" with a 3D vinyl/turntable player. Ships only **machine-verified, playable** tracks (288 tracks across 12 verified artists: 97 Charlie Puth outtakes recovered from the original 99-track Charlie's Vault, 50 The Weeknd vault tracks, and 141 tracks across 10 more artists curated from fan unreleased-playlists — every id oEmbed-verified; the curated rosters live in `scripts/build_catalog.js` + `scripts/vault_roster.json`). Frontend is a single static file (`index.html`); the backend is a small DB-backed Node API that can run locally (SQLite) or on Vercel serverless (Postgres) with no framework.

## Run & verify

- Dev server: `node server.js` → http://localhost:8080. First boot auto-creates `data/vault.db` (SQLite, gitignored) and seeds it from `scripts/catalog.json`.
- Tests: `npm test` (`node --test "test/*.test.js"`). No lint/typecheck — verify frontend by manual browser testing (desktop + mobile, dark + light).
- Data scripts (try to keep catalog.json/index.html/DB in sync, always **verify before shipping**):
  - Charlie legacy flow: `npm run db:verify` — probe every candidate in `scripts/charlie_legacy_tracks.json` (+ alternate versions) → `scripts/verified_legacy.json` (gitignored). This is the recovered Charlie's Vault source.
  - Weeknd flow: `node scripts/discover_weeknd.js` (keyless oEmbed truth-check, incl. the video's real title/author) → `scripts/weeknd_candidates.json` (gitignored), then the human-curated roster inside `build_catalog.js` is cross-checked against it.
  - Multi-artist flow (all non-Charlie artists except the original Weeknd block): `node scripts/harvest_playlists.js` — harvests `scripts/playlists.json` (fan-curated unreleased/leak playlists), dedupes the union of video ids, oEmbed-verifies each (real title/author + watch-page duration) → `scripts/harvested.json` (**committed** — it's the machine-verified evidence base `db:build` aborts on, and the apply pipeline needs it on a fresh CI checkout). The human-curated `scripts/vault_roster.json` is then cross-checked against it by `db:build` (every roster/version id must probe `active` or the build aborts).
  - Self-serve additions (single tracks, no full re-harvest): `npm run db:add -- "<youtube-url-or-id>" [--artist=Name]` (or `--file=tracks.json` with `[{url, artist?, title?}]`) — `scripts/add_tracks.js` verifies each via the same keyless oEmbed probe, appends to `vault_roster.json`, and registers the probe into `scripts/harvested.json` (so the build accepts it). It never ships anything unplayable. This is the engine the admin UI + apply Action reuse.
  - `npm run db:build` — rebuild curated `scripts/catalog.json` via `scripts/build_catalog.js` from the per-artist verified sources (active-only, alternate takes collapse into `versions`).
  - `npm run db:sync` — regenerate the bundled `SONGS`/`ARTISTS_DATA` fallback inside `index.html` to match `catalog.json`.
  - `npm run db:export` (extract catalog from index.html → `scripts/catalog.json`), `npm run db:seed` (upsert catalog.json → DB), `node scripts/refresh_songs.js [--force]` (CLI video health check).
- `pg` is the only npm dependency (production Postgres). `node:sqlite` (built into Node ≥22.5) powers local dev/tests, so `npm install` is optional unless you deploy.
- Artist art: `node scripts/fetch_artist_art.js "<name>" [size]` fetches official Apple Music art via the iTunes Search API (`avatarUrl`, mzstatic CDN). `scripts/charlie_legacy_tracks.json`/catalog artist entries carry `avatarUrl`; the frontend falls back to initials if a URL breaks (`av-avatar` + `mountAvatars`).
- Cover art: tracks never show scraped YouTube thumbnails. Every song renders an owned, deterministic "vault label" cover (`VAULT_PALETTES` + `coverHash`/`coverEl` in index.html); the spinning vinyl's center label is dyed with the playing track's palette (`applyVinyl`).

## Architecture

**Frontend** — everything in `index.html`: HTML + all CSS in one `<style>` block + all JS in `<script>` blocks. Never split out files. Runtime CDN deps: lucide icons (`unpkg.com`) and the YouTube IFrame API (`youtube.com/iframe_api`). No offline fallbacks for those.

**Backend** (Node, no framework):
- `src/schema.sql` + `src/db.js` — one portable schema; `DATABASE_URL` unset → SQLite (`node:sqlite`), set → Postgres (`pg`, `?` placeholders rewritten to `$n`). Timestamps are ISO TEXT written by the app (no dialect-specific defaults).
- `src/models.js` — repository functions (artists/songs/reports/refresh selection); never raw SQL outside it.
- `src/seeder.js` — idempotent `upsertCatalog`, auto-registers song-only collab artists, used by the seed CLI and server bootstrap.
- `api/handlers.js` — all endpoint logic, shared by local `server.js` and the Vercel functions (`api/*.js` are thin wrappers via `api/_lib.js` `wrap`).
- `lib/checkYouTube.js` — video probe: YouTube Data API v3 when `YOUTUBE_API_KEY` is set, otherwise the keyless `youtube.com/oembed` probe (200→active, 404→dead, 401→private, 403→dead-as-embed-disabled). Network failures degrade to `dead` (never throws).

**Endpoints** (`ctx` = `{ db, adminKey, apiKey }`; admin = `Authorization: Bearer $ADMIN_KEY`):
- Public: `GET /api/health`, `GET /api/artists`, `GET /api/songs` (`?artist=<slug>`, `?all=1` to include dead/private), `GET /api/songs/:id` (`?all=1` also returns dead versions), `POST /api/report` `{songId, reason?, versionId?}`
- Admin: `POST /api/refresh` (`{force?, maxAgeMs?}` — probes stale videos AND stale versions), `POST /api/save` (`{artists?, songs?}` — catalog upsert, incl. `songs[].versions`)
- Admin content pipeline (`admin.html`): `GET /api/admin/verify?url=…` (look up real title/author + playability, no mutation), `GET /api/admin/pending` (`?all=1` incl. applied), `POST /api/admin/queue` `{url, artist?, title?, note?}` (auto-verifies, stores in `pending_tracks` DB table), `POST /api/admin/clear` (mark current pending as applied after CI ships). All require `DATABASE_URL` (via `wrap()` 503 gate).

**Content-addition / apply pipeline** — the admin UI writes to the `pending_tracks` DB table (serverless can't touch the repo). `.github/workflows/apply_pending.yml` (`workflow_dispatch` / every 4h) fetches the queue via `node scripts/apply_pending.js --api` (needs `PROD_URL` + `ADMIN_KEY` secrets), runs `add_tracks.js` per track (verify → `vault_roster.json` + `harvested.json` probe), then `db:build` + `db:sync` + `npm test`, commits, and pushes → Vercel redeploys; it then POSTs `/api/admin/clear`. The same `add_tracks.js` engine is the `npm run db:add` CLI, so CLI, admin UI, and CI all share one verify-first path.

## Data model gotchas

- `songs.status`: `active` | `dead` | `private` — the **canonical copy's** verdict, never mutated by versions. `/api/songs` surfaces a song when its canonical copy OR any version is `active` (`EXISTS` subquery in `listSongs`); do not add status-mutation "recompute" logic — it loses the canonical verdict.
- Versions: derived id = `${songId}__v${n}` (`versionIdOf`), 1-based, seeded from `catalog.songs[].versions`; a version whose `youtubeId` equals the canonical id is skipped. Each version has its own `status`/`report_count`/`last_checked` and is probed on refresh.
- A canonical song (or version) is auto-flagged `dead` after **3** listener reports (`REPORT_THRESHOLD` in `api/handlers.js`); the daily refresh resurrects it if the video plays again. Reporting an already-dead version 404s (dead versions are hidden from `getSong`).
- Artist lookup is by `slug` (lowercased name, dashes). Song ids are stable strings; Charlie entries use the YouTube id.
- The curated `catalog.json` only ever contains **verified, playable** videos (see `npm run db:verify`/`db:build`). A YouTube id can legitimately appear in two song entries shared between different artists (e.g. a collab reused as a demo) — do not dedupe on id, and never assume an id maps to one artist.
- Frontend fallback: `index.html` bundles a `SONGS`/`ARTISTS_DATA` copy and uses it when the API is unreachable (e.g. static deploy without a DB). Keep it in sync via `npm run db:sync` (from catalog.json → index.html) or `npm run db:export` (index.html → catalog.json); tests assert the two stay deep-equal after a fresh sync.
- LocalStorage keys: `m2d_likes_v1` (likes), `theme`, `m2d_version_pref_v1` (per-song version choice).

## Deploy (Vercel)

- `vercel.json` pins Node 22 + CORS for `/api/*`. Set env vars: `DATABASE_URL` (required on Vercel — SQLite won't persist there), `ADMIN_KEY`, optional `YOUTUBE_API_KEY`. `.env.example` documents all of them.
- Scheduled freshness: `.github/workflows/refresh.yml` (daily cron) POSTs to `/api/refresh` using `PROD_URL` + `ADMIN_KEY` secrets. Unset secrets make the job no-op with a warning.
- CI: `.github/workflows/ci.yml` runs `npm test` on push/PR to `main` and `new-ui`.

## Conventions

- Plain HTML/CSS/JS; CSS variables for colors, no hardcoded hex; no frameworks.
- Commit messages use Conventional Commits with scope (`feat(ui):`, `fix:`, `build(backend):`, `docs:`).
- `new-ui` is the active dev branch (checked out); `main` and `Grails` are older.
- `README.md` documents the current OUTTAKE backend + deploy flow.
- Design skills for UI work live in gitignored `.agents/skills/` (pin: `skills-lock.json`); load through the skill tool.