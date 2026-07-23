# Contributing to Charlie's Vault

Thanks for your interest in contributing! This is a small fan project, but all thoughtful contributions are welcome.

---

## Ways to Contribute

- 🐛 **Bug reports** — Found a layout bug or broken playback? Open an issue.
- 💡 **Feature ideas** — Have a UI/UX suggestion? Open a discussion or issue.
- 🎵 **Missing tracks** — Know of an unreleased Charlie Puth track that should be included? Open an issue with the YouTube link.
- 🔐 **Security issues** — See [SECURITY.md](SECURITY.md) for responsible disclosure.

---

## Getting Started

```bash
git clone https://github.com/nishachay/charlies-vault.git
cd charlies-vault
node server.js
# Open http://localhost:8080
```

Node.js is required only for the local dev server. The app itself is a single `index.html`.

---

## Making a Pull Request

1. Fork the repository
2. Create a branch: `git checkout -b fix/your-fix-name`
3. Make your changes in `index.html` (the entire app lives here)
4. Test in both dark mode and light mode, on both desktop and mobile viewport
5. Open a PR with a clear description of what changed and why

---

## Code Style

- No build tools, no frameworks — keep it plain HTML/CSS/JS
- Inline styles go in the `<style>` block inside `index.html`
- JavaScript goes in the `<script>` block at the bottom of `index.html`
- Prefer CSS variables for colors — avoid hardcoding hex values

---

## Adding a Track

Song data is inlined directly in `index.html` as a `const SONGS = [...]` array. Each entry looks like:

```json
{
  "id": "youtube_video_id",
  "title": "Track Title",
  "artist": "Charlie Puth",
  "youtubeId": "youtube_video_id",
  "duration": 213,
  "letter": "T",
  "palette": {
    "from": "#E06C75",
    "to": "#A83B43",
    "text": "#fff"
  }
}
```

> Please only submit tracks that are publicly available on YouTube and are genuine Charlie Puth unreleased/demo recordings.

---

## Code of Conduct

Be respectful and constructive. This is a fan project — keep it fun and collaborative.
