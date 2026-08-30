# AGENTS.md

`{ OUTTAKE }` — multi-artist "unreleased music vault" with a 3D vinyl/turntable player. ~128 tracks across 13 artists. Frontend is a single static file (`index.html`); the backend is a small DB-backed Node API that can run locally (SQLite) or on Vercel serverless (Postgres) with no framework.

## Run & verify

- Dev server: `node server.js` → http://localhost:8080. First boot auto-creates `data/vault.db` (SQLite, gitignored) and seeds it from `scripts/catalog.json`.
- Tests: `npm test` (`node --test "test/*.test.js"`). No lint/typecheck — verify frontend by manual browser testing (desktop + mobile, dark + light).
- Data scripts: `npm run db:export` (extract catalog from index.html → `scripts/catalog.json`), `npm run db:seed` (upsert catalog.json → DB), `node scripts/refresh_songs.js [--force]` (CLI video health check).
- `pg` is the only npm dependency (production Postgres). `node:sqlite` (built into Node ≥22.5) powers local dev/tests, so `npm install` is optional unless you deploy.

## Architecture

**Frontend** — everything in `index.html`: HTML + all CSS in one `<style>` block + all JS in `<script>` blocks. Never split out files. Runtime CDN deps: lucide icons (`unpkg.com`) and the YouTube IFrame API (`youtube.com/iframe_api`). No offline fallbacks for those.

**Backend** (Node, no framework):
- `src/schema.sql` + `src/db.js` — one portable schema; `DATABASE_URL` unset → SQLite (`node:sqlite`), set → Postgres (`pg`, `?` placeholders rewritten to `$n`). Timestamps are ISO TEXT written by the app (no dialect-specific defaults).
- `src/models.js` — repository functions (artists/songs/reports/refresh selection); never raw SQL outside it.
- `src/seeder.js` — idempotent `upsertCatalog`, auto-registers song-only collab artists, used by the seed CLI and server bootstrap.
- `api/handlers.js` — all endpoint logic, shared by local `server.js` and the Vercel functions (`api/*.js` are thin wrappers via `api/_lib.js` `wrap`).
- `lib/checkYouTube.js` — video probe: YouTube Data API v3 when `YOUTUBE_API_KEY` is set, otherwise the keyless `youtube.com/oembed` probe (200→active, 404→dead, 401→private, 403→dead-as-embed-disabled). Network failures degrade to `dead` (never throws).

**Endpoints** (`ctx` = `{ db, adminKey, apiKey }`; admin = `Authorization: Bearer $ADMIN_KEY`):
- Public: `GET /api/health`, `GET /api/artists`, `GET /api/songs` (`?artist=<slug>`, `?all=1` to include dead/private), `GET /api/songs/:id`, `POST /api/report` `{songId, reason?}`
- Admin: `POST /api/refresh` (`{force?, maxAgeMs?}` — probes stale videos), `POST /api/save` (`{artists?, songs?}` — catalog upsert)

## Data model gotchas

- `songs.status`: `active` | `dead` | `private`. `/api/songs` and the frontend only surface `active` by default. A song is auto-flagged `dead` after **3** listener reports (`REPORT_THRESHOLD` in `api/handlers.js`); the daily refresh resurrects it if the video plays again.
- Artist lookup is by `slug` (lowercased name, dashes). Song ids are stable strings (`kye01`, Charlie entries use the YouTube id).
- ~15 YouTube IDs are intentionally duplicated across two entries shared between *different* artists (e.g. "Alien" and "Starstruck" both use `8xX7mYjWJGE`). This dataset reuse is expected — do not dedupe, and never assume an ID maps to one artist. Many of these placeholder IDs are **dead links**; the refresh job marks them `dead`, which is correct behavior.
- Frontend fallback: `index.html` bundles a `SONGS`/`ARTISTS_DATA` copy and uses it when the API is unreachable (e.g. static deploy without a DB). Keep it in sync via `npm run db:export`.
- LocalStorage keys: `m2d_likes_v1` (likes) and `theme`.

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