# OUTTAKE — Founder Playbook & 100x-Dev Recommendations

**Context:** OUTTAKE is a machine-verified archive of unreleased music — currently 97
recovered Charlie Puth outtakes (Charlie's Vault), built to scale to many artists. This
doc is the founder-facing growth plan and the developer recommendations for running it
at 100x the current scale.

---

## 1. North star & honest positioning

OUTTAKE wins on **trust + access**:

- **Trust:** only machine-verified, currently-playable videos ever ship. No fabrications,
  no dead links, no scraped placeholder art. Every song survives an automated probe
  before it's visible and a daily freshness sweep after.
- **Access:** one fan could never pump 97 pump-up-leak-grade rarities into a clean,
  player-grade UI. That curation *is* the product.

Keep the promise literal: **each "grail" is verifiably playable right now.** The moment a
broken video ships, trust leaks.

Keep the honesty legal: call it an *archive/index*, link out to YouTube originals, never
host audio files, honor takedowns via a visible report + contact channel, and describe
everything as fan-curated discovery, not redistribution.

---

## 2. Multi-artist growth playbook

### 2.1 Which artists to add next
Pick artists whose fans are *starved* for vault content and whose unreleased material
publicly exists as live, re-uploadable YouTube videos:

1. Artists with a big, actively-taken-down leak economy: **The Weeknd**, **Juice WRLD**,
   **Post Malone**, **Travis Scott**, **Kanye**, **Billie Eilish**, **Justin Bieber**,
   **Ariana Grande** — the old OUTTAKE dataset already had 12 artists; rebuild those
   catalogs the *verified* way.
2. Prolific producers/vocalists who release "snippets/demos" on YouTube deliberately
   (e.g., many songwriters share rough demos).
3. Test each candidate by running discovery, then ship only if ≥ 3 verified playable
   videos exist, else wait.

### 2.2 The onboarding pipeline (already built)
For each new artist:

1. `node scripts/fetch_artist_art.js "<artist>" --save` → official artist identity photo
   to `assets/artists/<slug>.jpg` (verify it's actually that artist — the AM page can be wrong).
2. Harvest candidate ids: `node scripts/discover_youtube.js` (needs `YOUTUBE_API_KEY`)
   and/or a manual `*_legacy_tracks.json` for known vault uploads.
3. `npm run db:verify` → oEmbed ground truth (200=active, 404=dead, 401=private).
4. Add a `<slug>_verify.js`/builder mirroring `verify_legacy.js` → `build_charlie_catalog.js`,
   then run `npm run db:build` and `db:sync`.
5. `npm run db:seed`, then run `node scripts/refresh_songs.js` before any PR. **Nothing ships unverified.**

Generalize the pipeline trigger: make the builder artifacts generated from one
`ARTISTS` manifest so adding an artist is a config change, not a copy-paste of scripts.

### 2.3 Artist page depth
Beyond the track list, per artist: era filter chips (Voicenotes era, etc.), a "demo →
released" mapping section ("You know the chorus from *Attention* — here's the raw take"),
and count badges ("97 outtakes recovered"). Fans *live* for the mapping of leaked demos to
released songs.

---

## 3. Harvest & verify (the moat)

- **Deduping trap:** a YouTube id can legitimately appear on two songs (collab reused as a
  demo). Never dedupe on id alone; dedupe on (artist, title) and keep version linkage.
- **Verify policy:** a candidate only ships `active`. Refresh probes stale canonicals AND
  stale versions. Listeners can report broken links (3 reports → flagged dead; the daily
  sweep resurrects when the video plays again). This is already the production behavior —
  preserve it.
- **100x verification:** move the per-video probe onto a queue so a 5,000-video catalog
  refreshes in minutes, not hours. Currently `mapLimit 8`; raise it, add backoff on rate
  limits, and cache probe results in the DB (they already persist `last_checked`).
- **Keyless probe caveat:** the oEmbed probe can't distinguish "region blocked" from
  "removed by uploader". Document the failure modes per status and surface them on an
  admin page, not in the player.

---

## 4. Versions (v1/v2) — underrated growth mechanic

Alternate takes are *the* collectors' hook:

- Keep version metadata rich: label ("Acoustic", "Demo Take 7", "Original Mix"), notes,
  and the mapping to the released song.
- UX: a version chip on the playing track for instant switching, a persisted per-song
  preference (already `m2d_version_pref_v1`), and a count badge "1 preserved alternate".
- Surface "this song has 2 versions" as a discovery teaser with a completion mechanic
  ("you've heard 1 of 2").

---

## 5. Community & trust loops

- **Report flow matters more than likes:** make broken-link reports one tap and visible
  ("flagged — checking") so users feel the archive is alive.
- **Attribution:** every song links to its YouTube original and credits the uploader where
  known. Fans notice and reciprocate with links/leads.
- **Submission channel:** a lightweight "found a grail" form → drops into the harvest
  queue (admin review → verify → ship). Turn your most obsessive visitors into
  curators-of-record — this is the cheapest sourcing engine you have.

---

## 6. SEO / distribution (current weakness)

The single biggest gap: the site is a client-only `index.html` — crawlers see almost
nothing of the 97-track catalog.

- **SSG the catalog** (static, cacheable, cheap): generate one `/song/<slug>.html` per
  track at build time with the title/artist/duration embedded in the HTML (both for SEO and
  for link-share cards). Keep the player as the progressive enhancement.
- **Sitemap + per-artist landing pages** (`/artist/<slug>` with `<title>` + meta description
  "97 unreleased {Artist} outtakes — verified playable").
- **Link-share cards** (og:image = the deterministic cover art, which suddenly pays off:
  every share card is a designed record label).
- **Schema.org MusicRecording** microdata on song pages.
- Pitch the "Charlie's Vault, restored" story to music-leak communities/forums — the
  verification angle is genuinely media-worthy ("97 lost tracks, every one still plays").

---

## 7. Monetization (order of operations, honesty first)

1. **None until traffic proves interest** — build the audience on trust.
2. **Donations / "keep the archive alive"** (Ko-fi-style) — lowest friction, no paywall.
3. **Early membership** ($3/mo) for: newest recovered grails first, version completions,
  "recovered this week" digest. Never paywall already-public tracks — that's the trust line.
4. **Merch adjacent to vault drops** ("97 RECOVERED" tee on the catalog format) — the
  deterministic cover art doubles as merch-ready artwork.
5. **Artist/PR inbound** once the archive is big and clean — "verified unreleased
  catalogue" is something labels/mgmt may want to *reference* (link exchanges, not revenue
  sharing, to stay legally clean).
Avoid anything that looks like selling leaks. Revenue must never gate playability.

---

## 8. 100x-dev recommendations (engineering leverage)

- **One manifest to rule them:** drive artist onboarding from `ARTISTS`/`catalog.json`
  only; scripts read the manifest instead of encoding one artist's constants.
- **Static-first deploy:** output the catalog as static pages + a JSON payload (Vercel
  serves all non-API files already); DB-backed API stays the admin/refresh layer. This
  slashes cold-start latency and crawler blindness in one move.
- **Perf:** add `Cache-Control` for `/assets/*` (long max-age + hash names) and for
  `/api/songs` (short, stale-while-revalidate). The bundled SONGS fallback already makes
  the first paint DB-free.
- **Redis/Datastore, only when needed:** SQLite→Postgres already works via `DATABASE_URL`.
  Hold off until a second DB is actually worth it.
- **Testing:** the 40 tests are data-driven from `catalog.json` — extend the same pattern
  to version-report flows and the SSG renderer. Add a light contract test against the
  oEmbed probe's 200/404/401 mapping.
- **CI:** the daily `/api/refresh` cron is your uptime signal; add a synthetic check that
  surfaces "the archive claims 97 playable, probes found N" counts to the log.
- **Measure outcomes, not outputs:** log probe-hit rates (how many "grails" are still
  playable week over week) and report-to-resurrect cycles. That number is the moat health.
- **Docs-as-code:** keep AGENTS.md current (it already encodes the verify-first rule and
  the status model — the two things future-you will break).

---

## 9. Immediate next 30 days

1. Push the current backlog (everything in this commit series) to `new-ui` and cut a
   release note.
2. Run the 12-artist recovery the *verified* way (start with The Weeknd or Juice WRLD:
   discovery → verify → build). Ship 1–2 artists within the week.
3. Ship SSG song pages + sitemap (the SEO gap) as the next milestone after more artists.
4. Add the "found a grail" submission form + admin triage queue.
5. Swap-in the correct artist portrait (already staged: Confirmed Commons 2017) and ship
   the final cover-system look after a real browser pass.

Trust is the product. Every recommendation above either buys more trust, or makes the
pipeline that protects it 100x cheaper to run.