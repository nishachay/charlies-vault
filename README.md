# Charlie's Vault 🎵

A private listening archive of **99 unreleased Charlie Puth tracks** — demos, early versions, covers, and songs that never made it out.

## What's in here

| File | Purpose |
|------|---------|
| `vault.html` | The main site — vinyl player + track list |
| `final_songs.js` | The 99 kept songs (data) |
| `index.html` | Curation dashboard (used to review all tracks) |
| `songs.js` | Full database of all 199 tracks with curation flags |
| `server.js` | Local Node.js dev server |

## Running locally

```bash
node server.js
# open http://localhost:8080
```

## Stack

Plain HTML, CSS, JavaScript. No frameworks. YouTube iframe API for playback.
