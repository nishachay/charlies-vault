# { OUTTAKE }

Unreleased music vault with a 3D vinyl / turntable player. **97 verified, playable Charlie Puth unreleased & demo tracks** (recovered and machine-verified from the original 99-track Charlie's Vault), streamed live through YouTube's official IFrame API (no audio files hosted). Every video is machine-verified before it ships — dead or private links are never surfaced.

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

Derived from the original **Charlie's Vault** (99 unreleased Charlie Puth tracks): candidate links were recovered from it, machine-verified — **97 remain playable today** (1 now private). The prior multi-artist "grails" expansion shipped fabricated video links — those were removed in favor of only machine-verified, playable tracks.