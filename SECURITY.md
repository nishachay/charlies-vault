# Security Policy

## Supported Versions

This is a static, client-side web application with no backend (when deployed). The following version is actively maintained:

| Version | Supported |
|---------|-----------|
| Latest (`main` branch) | ✅ Yes |
| All older commits | ❌ No |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security issue, please report it responsibly by emailing the maintainer directly or using [GitHub's private vulnerability reporting](https://github.com/nishachay/charlies-vault/security/advisories/new).

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

## Security Architecture

This project is designed to have a minimal attack surface:

- **No server-side code on production** — deployed as a static file on Vercel
- **No user authentication** — no passwords or tokens stored
- **No database** — all data is inlined in `index.html`; user preferences use `localStorage` only
- **No external API keys** — YouTube IFrame API requires no credentials
- **No `eval()` or `innerHTML` with user input** — all user inputs (search) are handled as plain text comparisons; no DOM injection
- **No file uploads on production** — `server.js` upload endpoint only runs locally and is never deployed
- **`localStorage` only stores** liked track IDs and theme preference — no PII

---

## Known Limitations

- The `server.js` local development server uses `CORS: *` — this is intentional for local use only and is never deployed to production.
- The local `/api/save` endpoint writes to disk — this is a developer tool, not accessible on the deployed site.
