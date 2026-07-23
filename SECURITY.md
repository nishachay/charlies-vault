# Security Policy

## Supported Versions

This is a static, client-side web application with no backend when deployed. The following version is actively maintained:

| Version | Supported |
|---------|-----------|
| Latest (`main` branch) | ✅ Yes |
| All older commits | ❌ No |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue, please report it responsibly by using [GitHub's private vulnerability reporting](https://github.com/nishachay/charlies-vault/security/advisories/new).

### What to include in your report

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact or attack scenario
- Any suggested fixes (optional but appreciated)

### What to expect

- **Acknowledgement** within 48 hours
- **Status update** within 7 days
- **Fix or mitigation** shipped as soon as possible

All reporters who responsibly disclose valid vulnerabilities will be credited in the release notes (unless they prefer anonymity).

---

## Content / DMCA / Takedown Requests

This project streams music by embedding YouTube videos via the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference). **No audio files are hosted or stored in this repository or on any server this project controls.**

If you are a music rights holder (Charlie Puth, management, label, or authorized representative) and have concerns about a specific track appearing in this project's song list:

1. Open a [GitHub Issue](https://github.com/nishachay/charlies-vault/issues) with the track title and your contact information, **or**
2. Use [GitHub's private advisory system](https://github.com/nishachay/charlies-vault/security/advisories/new) for a private channel

All takedown requests from verified rights holders will be actioned **within 24 hours**. This is a non-commercial fan project with no monetization whatsoever.

---

## Security Architecture

This project is designed to have a minimal attack surface:

| Area | Status |
|------|--------|
| Server-side code on production | ✅ None — deployed as a static file on Vercel |
| User authentication | ✅ None — no passwords or tokens anywhere |
| Database | ✅ None — all data is inlined in `index.html` |
| External API keys | ✅ None — YouTube IFrame API requires no credentials |
| `eval()` or `innerHTML` with user input | ✅ None — search uses plain `.filter()` string matching |
| File uploads on production | ✅ None — upload endpoint only exists in local `server.js` |
| Data collected from users | ✅ None — `localStorage` only stores liked track IDs and theme preference (no PII) |
| Content Security Policy | ✅ Set via meta tag — restricts unauthorized script/resource loading |

---

## Known Intentional Limitations

- `server.js` uses `CORS: *` — this is intentional for local development only and is **never deployed**
- The local `/api/save` endpoint writes to disk — this is a developer tool that is **never deployed** to production
- `unsafe-inline` is required in the CSP because all CSS and JS is inlined in a single HTML file
