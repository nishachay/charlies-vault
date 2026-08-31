# Security policy

## What's supported

The `main` branch. Older commits aren't actively maintained.

---

## Reporting a vulnerability

Don't open a public issue for security bugs. Use [GitHub's private vulnerability reporting](https://github.com/nishachay/charlies-vault/security/advisories/new) instead.

In your report, include what you found, how to reproduce it, and what you think the impact is. A suggested fix is optional but always welcome.

You'll get a response within 48 hours and a status update within a week. If you want credit in the release notes, say so. If you'd rather stay anonymous, that's fine.

---

## DMCA and takedown requests

This project streams music by embedding YouTube videos through the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference). No audio files are hosted or stored anywhere this project controls.

If you're a rights holder (Charlie Puth, his management, his label, or anyone authorized to act on his behalf) and want a track removed:

1. Open a [GitHub issue](https://github.com/nishachay/charlies-vault/issues) with the track name, or
2. Use the [private advisory channel](https://github.com/nishachay/charlies-vault/security/advisories/new) if you'd prefer a private conversation

This is a non-commercial fan project. No ads, no monetization, nothing. Takedown requests get actioned within 24 hours.

---

## Security architecture

This is a static site. No backend in production. The attack surface is small by design.

| Area | Status |
|------|--------|
| Server-side code in production | None. Vercel serves a single HTML file. |
| User authentication | None. No passwords, no accounts. |
| Database | None. All data lives in `index.html`. |
| External API keys | None. YouTube IFrame API needs no credentials. |
| `eval()` or `innerHTML` with user input | None. Search runs as a plain `.filter()` string match. |
| File uploads in production | None. The upload endpoint only exists in `dev.js`, which never deploys. |
| User data collected | None. `localStorage` stores liked track IDs and theme preference. That's it. |
| Content Security Policy | Set via meta tag. Restricts what external resources can load. |

---

## Known intentional limits

`dev.js` uses `CORS: *`. Intentional for local development. Never sees production.

The local `/api/save` endpoint writes to disk. Developer tool only, never deployed.

The CSP requires `unsafe-inline` because all CSS and JS is inlined in a single HTML file. No external scripts load except YouTube's API.
