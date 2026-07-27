# Charlie's Vault

A listening archive of 99 unreleased Charlie Puth tracks. Includes acoustic takes, early demos, and unreleased cuts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deploy: Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://charlies-vault.vercel.app)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&logoColor=black)](index.html)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](index.html)
[![Playback: YouTube API](https://img.shields.io/badge/Playback-YouTube%20API-FF0000?logo=youtube&logoColor=white)](https://developers.google.com/youtube/iframe_api_reference)

Live App: [charlies-vault.vercel.app](https://charlies-vault.vercel.app)

---

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="charlies-vault.png">
  <source media="(prefers-color-scheme: light)" srcset="charlies-vault-light.png">
  <img alt="Charlie's Vault App Preview" src="charlies-vault.png">
</picture>

---

## Features

- **99 Unreleased Tracks:** Streamed live via YouTube's official IFrame API. No audio files stored on any server.
- **Turntable UI:** Vinyl deck with tonearm motion and real-time scrubber.
- **Mobile Mini-Player:** Docked player drawer at the bottom of the viewport for smaller screens.
- **Favorites:** Like tracks and keep them saved in localStorage.
- **Search & Filters:** Fast track filtering, A-Z or duration sorting, and Liked-only view.
- **Dark & Light Mode:** Theme toggle persisted across sessions.
- **Zero Dependencies:** Single HTML file with vanilla CSS and JavaScript.

---

## Local Setup

Clone the repo and start the local development server:

```bash
git clone https://github.com/nishachay/charlies-vault.git
cd charlies-vault
node server.js
```

Open http://localhost:8080 in your browser.

Note: Node.js is only for local dev. The deployed app on Vercel is static index.html.

---

## Repository Files

```
charlies-vault/
├── index.html               # Entire app (HTML, CSS, JS, track list)
├── server.js                # Local dev server
├── charlies-vault.png       # Dark mode preview screenshot
├── charlies-vault-light.png # Light mode preview screenshot
├── LICENSE                  # MIT license
├── SECURITY.md              # Security policy & takedown contact
└── CONTRIBUTING.md          # Contribution guide
```

---

## Licensing & Rights

This repository has two clear legal boundaries:

- **Source Code (MIT License):** The HTML structure, CSS styling, and JavaScript logic are free to copy, modify, or fork.
- **Audio Content:** Belongs to Charlie Puth and respective rights holders. All playback streams through publicly accessible YouTube videos using the official YouTube IFrame API.

Rights holders can submit takedown inquiries via [GitHub Private Advisory](https://github.com/nishachay/charlies-vault/security/advisories/new) or by opening an issue. Takedowns get processed within 24 hours.

---

[CONTRIBUTING.md](CONTRIBUTING.md) | [SECURITY.md](SECURITY.md) | MIT (c) 2025 Nishachay
