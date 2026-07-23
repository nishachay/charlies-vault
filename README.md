# Charlie's Vault 🎵

> A minimal listening archive of unreleased Charlie Puth tracks — demos, early concepts, and acoustic recordings not found on official albums.

Built with focus on minimal design and smooth playback.  
**Built by [Nishachay](https://github.com/nishachay)**

---

## Live Site

🔗 **[charlies-vault.vercel.app](https://charlies-vault.vercel.app)**

---

## Features

- 🎵 Stream tracks via the YouTube IFrame API — no audio files stored or hosted
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
├── index.html      # The entire application (inlined CSS + JS + song list)
├── server.js       # Local dev server only — not deployed to production
├── final_songs.js  # Song metadata source file (reference copy)
├── songs.js        # Full track metadata database
├── LICENSE         # MIT License (applies to code only — see Legal section)
├── SECURITY.md     # Security policy and responsible disclosure
└── CONTRIBUTING.md # Contribution guidelines
```

---

## ⚖️ Legal & Licensing — Please Read

This project has **two separate things** with different legal status. It is important to understand both.

### 1. The Code — MIT Licensed

The source code of this project (the HTML structure, CSS styling, JavaScript player logic, and UI) is written by Nishachay and released under the **MIT License**.

This means you are free to:
- Copy, use, and modify the code for your own projects
- Build your own music archive or player using this as a base
- Use it commercially (with attribution)

The MIT License **only covers the code**. It does not apply to any music or media content.

### 2. The Music — NOT Owned by This Project

All audio content streamed through this player belongs entirely to **Charlie Puth** and/or the respective rights holders.

**This project:**
- Does ❌ NOT own, host, store, download, or distribute any audio files
- Does ❌ NOT claim any rights over any music
- Does ✅ stream audio by embedding publicly available YouTube videos via the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), which is YouTube's officially provided and permitted embedding method

The song list in this project contains YouTube video IDs that point to videos publicly available on YouTube. We do not control the availability of these videos. If a video is taken down on YouTube, it stops playing here automatically.

### Rights Holder Contact

If you are Charlie Puth, his management, or a rights holder and have any concerns about this project, please:

- Open a [GitHub Issue](https://github.com/nishachay/charlies-vault/issues) and it will be addressed promptly
- Or use [GitHub's private contact](https://github.com/nishachay/charlies-vault/security/advisories/new)

This is a non-commercial fan project. Any takedown requests will be respected immediately.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

See [SECURITY.md](SECURITY.md) for responsible disclosure.

---

## License

[MIT](LICENSE) © 2025 Nishachay  
*(Code only — music rights belong to respective owners. See Legal section above.)*

---

## Credits & Acknowledgements

- **Charlie Puth** — for the music that inspired this project
- **YouTube IFrame Player API** — for providing the official embedding API used for playback
- **Google Fonts** — Space Grotesk, Outfit, JetBrains Mono
- **Vercel** — for free static hosting
- Built with the assistance of **Google Antigravity (AI coding assistant)**
