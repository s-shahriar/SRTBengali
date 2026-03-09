# SRT Bengali

Adds Bengali hints for uncommon English words inline in subtitle files (`.srt`, `.ass`, `.vtt`).

**Example:** `She was obstinate about leaving.` → `She was obstinate (একগুঁয়ে) about leaving.`

Powered by Gemini AI. Works on Android (APK) and in the browser.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Run in browser (instant, no build needed)

```bash
npx expo start --web
```

Open `http://localhost:8081` (or the port shown in terminal).

### 3. Test on phone with Expo Go

> ⚠️ Requires Expo SDK ≤ 52. This project uses SDK 55 — use EAS Build instead.

---

## Running the App

### Development

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run dev:android` | Run on connected Android device with hot reload |
| `npm run web` | Start web version |

### Building APK (Local)

| Command | Description |
|---------|-------------|
| `npm run build:android` | Build APK for **arm64 only** (faster build, smaller APK) |
| `npm run build:android:all` | Build APK for **all architectures** (universal) |
| `npm run build:android:x86` | Build APK for **x86_64 only** (emulator) |

### Building APK (Cloud)

| Command | Description |
|---------|-------------|
| `npm run build:android:cloud` | Build APK on EAS servers (no local resources needed) |

### Build Optimizations

The build is configured with the following optimizations in [eas.json](eas.json):
- **arm64-v8a only** (default profile) — smaller APK, faster build
- **Parallel Gradle execution** — uses multiple workers to speed up builds
- **Max 4 Gradle workers** — prevents system from hanging during builds

### Prerequisites — install once

```bash
npm install -g eas-cli
eas login          # create free account at expo.dev if needed
```

### Install on phone

1. Download the `.apk` to your phone
2. Settings → Apps → Special app access → **Install unknown apps** → allow your browser/file manager
3. Tap the `.apk` → Install

---

## Using the app

1. **API Key** — paste your Gemini API key and tap **Save**
   - Get a free key at [aistudio.google.com](https://aistudio.google.com) → Get API key
2. **Model** — Gemini 3 Flash Preview is the default (best quality)
3. **File** — tap to select your `.srt` / `.ass` / `.vtt` file
4. Tap **Add Bengali Translations**
5. Save the output file (named `original_translated.srt`)
6. Load it in X Player or any subtitle-compatible player

---

## EAS Build reference

| Command | What it does |
|---|---|
| `eas login` | Log in to your Expo account |
| `eas whoami` | Check logged-in account |
| `eas build:list` | See all past builds |
| `eas build:cancel` | Cancel a running build |

---

## Models

| Model | Notes |
|---|---|
| **Gemini 3 Flash Preview** | ✅ Best — balanced vocabulary, no common word noise |
| Gemini 2.5 Flash | Good fallback |
| Gemini 3.1 Flash Lite Preview | Very selective, fewer annotations |
| Gemini 3 Pro Preview | Highest quality, paid tier |
