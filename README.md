# Charlie's Vault

A listening archive of unreleased Charlie Puth tracks. Demos, acoustic recordings, early versions, things that never made it to an album.

Built by [Nishachay](https://github.com/nishachay).

---

## Live

[charlies-vault.vercel.app](https://charlies-vault.vercel.app)

---

## What it does

Stream ~99 unreleased Charlie Puth tracks through a vinyl-deck player. No downloads, no stored audio files. Everything plays via YouTube's IFrame API.

On desktop you get the full turntable UI. On mobile, a floating mini-player sits at the bottom so you can browse the list while something's playing. You can like tracks, search, sort A-Z, and toggle dark/light mode. All preferences save to localStorage.

Single HTML file. No build step, no framework, no dependencies.

---

## Stack

Plain HTML, CSS, JavaScript. YouTube IFrame API for playback. Vercel for hosting. Node.js only for a local dev server (never deployed to production).

---

## Run it locally

```bash
git clone https://github.com/nishachay/charlies-vault.git
cd charlies-vault
node server.js
# http://localhost:8080
```

---

## Files

```
charlies-vault/
├── index.html      # The whole app — CSS, JS, and song list all inlined
├── server.js       # Local dev server. Not deployed.
├── final_songs.js  # Song metadata source (reference copy)
├── songs.js        # Full track database
├── LICENSE
├── SECURITY.md
└── CONTRIBUTING.md
```

---

## Licensing — please read this

Two different things are in this repo with 2 different legal statuses.

**The code is MIT licensed.** The HTML, CSS, and JavaScript are mine. You can copy it, fork it, build your own player with it, use it commercially. Just keep the copyright notice. That's the whole deal.

**The music belongs to Charlie Puth.** Every track you hear comes from a publicly available YouTube video, streamed through YouTube's official IFrame API. There are no audio files in this repo. No files on any server I control. If a video gets taken down on YouTube, it stops playing here automatically.

I don't own any of this music and I'm not claiming to. This is a fan-made listening interface, built for people who want to hear the demos.

If you're a rights holder with a concern, open an issue or use [GitHub's private advisory system](https://github.com/nishachay/charlies-vault/security/advisories/new). Takedown requests get actioned within 24 hours.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Security

See [SECURITY.md](SECURITY.md).

---

## Credits

- Charlie Puth, for the music that made this worth building
- YouTube IFrame Player API, for the official embedding API used for playback
- Google Fonts (Space Grotesk, Outfit, JetBrains Mono)
- Vercel, for free hosting
- Built with help from Google Antigravity

---

MIT © 2025 Nishachay — code only. Music rights belong to their respective owners.
