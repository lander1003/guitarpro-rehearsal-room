# 零幺幺零线上排练房 / guitarpro-rehearsal-room

[![version](https://img.shields.io/badge/version-v1.0.1-1a73e8)](#)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-188038)](#)
[![runtime](https://img.shields.io/badge/runtime-Node.js%20%2B%20WebSocket-202124)](#)
[![score](https://img.shields.io/badge/score-Guitar%20Pro%20%2B%20alphaTab-202124)](#)

A LAN-based online rehearsal room for bands using Guitar Pro scores.

The host computer runs a local web server, uploads a Guitar Pro file, plays the score audio, and shows a QR code. Band members join from phones, tablets, or laptops on the same Wi-Fi network and follow the synchronized score, playback position, and cursor scrolling in real time.

中文说明请看 [README.zh-CN.md](README.zh-CN.md)。  
个人排练现场详细手册请看 [README.local.md](README.local.md)。

## Features

- Local rehearsal room server with LAN IP detection.
- QR code join flow for phones and tablets.
- Guitar Pro file rendering via alphaTab.
- Supports `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`, and `.gpif`.
- WebSocket room sync for members, selected song, playback state, and playback position.
- Host-side score playback with soundfont audio.
- Host-side mixer with per-track Solo, Mute, and volume control.
- Metronome toggle.
- Track selection, zoom control, progress seeking, and score-only fullscreen mode.
- Member nickname editing.
- Member-side auto-scroll following the current playback cursor.
- `gb18030` import encoding for better legacy Chinese Guitar Pro files.
- **Audio track (backing track) support**: GP files with embedded audio tracks play both MIDI (via SoundFont) and audio (via independent audio element) simultaneously.
- **Audio track in mixer**: Host mixer shows the backing track as a virtual channel with Solo/Mute/Volume.
- **Click-to-seek progress bar**: Displays both current position and total duration.

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + WebSocket
- Score engine: alphaTab
- QR code: qrcode
- Upload handling: multer
- Package management: npm workspaces

## Quick Start

Requirements:

- Node.js
- npm

Install dependencies and start both the server and web app:

```bash
npm install
npm run dev
```

Open the host page:

```text
http://localhost:3000/host
```

Useful local URLs:

- Host page: `http://localhost:3000/host`
- Member page: `http://localhost:3000/join`
- Room API: `http://localhost:3010/api/room`

If ports are already in use:

```bash
npm run stop
npm run dev
```

## How It Works

1. The host starts the app on a computer connected to the rehearsal room network.
2. The backend listens on `0.0.0.0` and detects the host computer's LAN IP.
3. The host page shows a QR code like `http://192.168.x.x:3000/join`.
4. Members scan the QR code from devices on the same network.
5. The host uploads a Guitar Pro score and controls playback.
6. Playback state and position are synchronized to all connected members over WebSocket.

## Project Structure

```text
guitarpro-rehearsal-room/
  server/        Local room service: API, QR code, WebSocket sync
  web/           Host and member web pages
  package.json   npm workspace scripts
  README.md
  README.zh-CN.md
  README.local.md
  .env.example
```

## Scripts

```bash
npm run dev      # Start server and web app
npm run stop     # Stop processes on ports 3000 and 3010
npm run check    # TypeScript check
npm run build    # Build the frontend
npm run start    # Start the backend entry
```

## Notes

- This is a LAN-first tool. It does not require a public server.
- Do not share `localhost` or `127.0.0.1` with members. Members must use the host computer's LAN URL.
- v1.0 is a source-run release. It does not ship `.exe`, `.app`, or `.dmg` packages yet.
- Some Guitar Pro files share MIDI channels between tracks. In those files, Solo/Mute/Volume may affect other tracks using the same shared channel.

## Changelog

### v1.0.1 (2026-06-06)

- **Audio track (backing track) support**: GP files with embedded audio tracks now play correctly. MIDI tracks are synthesized via SoundFont while the audio track plays simultaneously through an independent `HTMLAudioElement`, synced with the alphaTab player (play/pause/seek).
- **Audio track in mixer**: The host mixer now shows a virtual "音频轨" (Audio Track) entry with Solo/Mute/Volume control for GP files that contain a backing track.
- **Progress bar improvements**: Progress bar now displays both current position and total duration. Clicking on the progress bar seeks to any position.
- **Song switching fix**: When the host uploads a new song, the previous song's audio track is properly stopped and cleaned up — no more audio bleeding between songs.
- **Lifecycle refactor**: Backing track event handlers are registered once on the alphaTab API and read the current audio element from a React ref. This prevents stale handler accumulation when switching songs repeatedly.
- **Server-side `durationMs`**: Backend now preserves the `durationMs` field in playback state broadcasts, so member clients always see the total duration.
- **Score loading refactor**: Changed from `api.load()` to `ScoreLoader.loadScoreFromBytes()` + `api.renderScore()` for direct access to the score object during loading.
- **Config**: `playerMode` set to `EnabledSynthesizer` (2) to always use SoundFont synthesis for MIDI playback, even when a backing track is present.
- **Improved Chinese filename handling**: Server-side Content-Disposition headers now properly encode Chinese characters. Mojibake detection and repair for uploaded filenames.

### v1.0.0 (2025-11-xx)

- Initial release.

- Remember each member's preferred track.
- Persist uploaded files and restore rooms after restart.
- Improve playback cursor following and mobile reading ergonomics.
- Explore Electron packaging after the source-run version is stable.

## License

Personal rehearsal-room project, v1.0.1. A formal open-source license can be added in a later release.
