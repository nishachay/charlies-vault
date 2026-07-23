# Charlie's Vault 🎵

> A minimal listening archive of unreleased Charlie Puth tracks — demos, early concepts, and acoustic recordings not found on official albums.

Built with focus on minimal design and smooth playback.  
**Built by [Nishachay](https://github.com/nishachay)**

---

## Live Site

🔗 **[charlies-vault.vercel.app](https://charlies-vault.vercel.app)**

---

## Features

- 🎵 Stream tracks via the YouTube IFrame API — no audio files stored
- 🎚 Vinyl-deck player with real-time progress scrubbing
- 📱 Fully responsive — floating mini-player on mobile
- ❤️ Like/save tracks (persisted in `localStorage`)
- 🔍 Search, filter (All / Liked), and sort tracks
- 🌙 Dark mode by default with light mode toggle
- ⚡ Single-file deployment — no build step, no framework

---

## Stack

| Layer | Technology |
|-------|-----------|
| Structure | Plain HTML5 |
| Styling | Vanilla CSS (CSS variables, Grid, Flexbox) |
| Logic | Vanilla JavaScript (ES6+) |
| Playback | YouTube IFrame Player API |
| Hosting | Vercel (static) |
| Dev server | Node.js (local only) |

---

## Running Locally

```bash
git clone https://github.com/nishachay/charlies-vault.git
cd charlies-vault
node server.js
# Open http://localhost:8080
```

> **Node.js is only required for local development.** The deployed site is a single `index.html` file — no server required.

---

## Project Structure

```
charlies-vault/
├── index.html      # The entire application (inlined CSS + JS + song database)
├── server.js       # Local dev server (not deployed)
├── final_songs.js  # Song database source (reference — data is inlined in index.html)
├── songs.js        # Full track metadata database
└── LICENSE
```

---

## Legal & Copyright Notice

> **Important:** This project streams music via the YouTube IFrame API. All audio content is owned by Charlie Puth and/or the respective rights holders. This project does **not** host, store, download, or distribute any audio files. It is a fan-made listening interface that links to publicly available YouTube videos.
>
> If you are a rights holder and have concerns, please open an issue or contact the maintainer directly.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

---

## License

[MIT](LICENSE) © 2025 Nishachay

---

## Credits & Acknowledgements

- **Charlie Puth** — for the music that inspired this project
- **YouTube IFrame Player API** — for the playback engine
- **Google Fonts** — Space Grotesk, Outfit, JetBrains Mono
- **Vercel** — for free static hosting
- Built with the assistance of **Google Antigravity (AI coding assistant)**
