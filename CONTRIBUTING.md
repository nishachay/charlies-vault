# Contributing

Bugs, track suggestions, and UI fixes are welcome. Here's how.

---

## Ways to contribute

**Found a bug?** Open an issue. Include your device, browser, and what you expected vs. what actually happened.

**Know a missing track?** Open an issue with the YouTube link and track title. Only publicly available YouTube videos of genuine Charlie Puth unreleased or demo recordings, please.

**Security issue?** See [SECURITY.md](SECURITY.md).

---

## Setup

```bash
git clone https://github.com/nishachay/charlies-vault.git
cd charlies-vault
node server.local.js
# http://localhost:8080
```

---

## Submitting a PR

1. Fork the repo
2. Create a branch: `git checkout -b fix/your-fix-name`
3. Make changes in `index.html` (the whole app lives here)
4. Test on desktop and mobile, dark and light mode
5. Open a PR with a short description of what changed and why

---

## Code style

No build tools, no frameworks. Keep it plain HTML/CSS/JS. Use CSS variables for colors, don't hardcode hex values. Styles go in the `<style>` block. JS goes in the `<script>` block at the bottom of `index.html`.

---

## Adding a track

The song list is a `const SONGS = [...]` array inlined in `index.html`. Each entry looks like this:

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

---

Be respectful. This is a fan project.
