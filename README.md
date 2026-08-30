# { OUTTAKE }

Multi-artist unreleased music vault with a 3D vinyl / turntable player. ~128 unreleased & demo tracks across 13 artists, streamed live through YouTube's official IFrame API (no audio files hosted).

**Stack:** single-file static frontend (`index.html`, vanilla HTML/CSS/JS) + a tiny DB-backed Node API. Runs anywhere you can run Node — locally on SQLite, in production on Vercel serverless + Postgres (Neon / Supabase).

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

## The database

One portable schema (`src/schema.sql`) for both backends:

- **Local dev / tests** — SQLite via `node:sqlite`, zero config.
- **Production** — Postgres: set `DATABASE_URL` (Neon / Supabase, both have free tiers) and the same code runs; `?` placeholders are rewritten to Postgres `$n` automatically.

Tables: `artists` (slug, name, avatar…), `songs` (title, youtube_id, mirror_id, duration, era, category, **status**, report_count, last_checked), `song_reports`.

`songs.status` is `active` | `dead` | `private`. `/api/songs` and the player surface `active` tracks only.

## API

Public:

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | service status, db backend, counts |
| `GET /api/artists` | all artists with song counts |
| `GET /api/songs` | active songs (`?artist=<slug>` filters, `?all=1` includes dead/private) |
| `GET /api/songs/:id` | single song |
| `POST /api/report` | `{ songId, reason? }` — listeners flag broken links |

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

1. Edit `scripts/catalog.json` (or edit `SONGS`/`ARTISTS_DATA` in `index.html` and run `npm run db:export`), then
2. `npm run db:seed` — idempotent upsert, artists auto-created from song credits if missing.

## Deploy (Vercel)

Static `index.html` + serverless API under `/api/*`. Set these project env vars (see `.env.example`):

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | **Required** — Postgres connection string (SQLite won't persist on Vercel) |
| `ADMIN_KEY` | Required for `/api/refresh` & `/api/save` |
| `YOUTUBE_API_KEY` | Optional; enables authoritative YouTube API checks |

## License

Source code: MIT. All audio streams from publicly available YouTube videos and belongs to the respective rights holders.

---

Derived from the original **Charlie's Vault** (99 unreleased Charlie Puth tracks).