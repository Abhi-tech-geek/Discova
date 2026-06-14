# DISCOVA 🧭♿

**AI-powered social accessibility & discovery app** — Instagram + Google Maps + accessibility, in one.

Most apps tell you *where* to go. Discova tells you whether you can actually **get in** — whether a place works for wheelchair users, seniors, parents with strollers, people with sensory needs… and everyone else.

> "Can I go there?" should be a question with a real answer.

---

## 📲 Download the app

**[⬇️ Download Discova for Android (.apk)](https://github.com/Abhi-tech-geek/Discova/releases/latest/download/discova.apk)**

[![Latest release](https://img.shields.io/github/v/release/Abhi-tech-geek/Discova?label=latest&color=2E6BFF)](https://github.com/Abhi-tech-geek/Discova/releases/latest)

This link always serves the **newest** build:
`https://github.com/Abhi-tech-geek/Discova/releases/latest/download/discova.apk`

1. Tap the download link above on your Android phone
2. Open the downloaded `discova.apk`
3. Allow *Install from unknown sources* if prompted

---

## ✨ What it does

| Feature | Description |
| --- | --- |
| 🤖 **AI accessibility scores** | Gemini reads a place's real photos + reviews and rates ramps, lifts, washrooms, parking — per-category (mobility / visual / hearing / cognitive / sensory) |
| 📍 **Real places near you** | Google Places (rating ≥ 3.9, real photos) ranked by quality, not just distance |
| 🗣️ **Ask Discova** | Natural-language AI chat — *"quiet wheelchair-friendly cafe near me"* → real, tappable picks |
| 📊 **Crowd / Quiet meter** | How busy & noisy a place typically is right now + **best time to visit** |
| 🛋️ **Universal Comfort Index** | Parking, walking, seating, calm — scored for *everyone*, not just PWD |
| 💎 **Hidden gems** | Highly-rated but under-visited places (usually less crowded) |
| ☔ **Weather-aware** | Rain or heat → indoor accessible suggestions (Open-Meteo, free) |
| ♿ **Community reviews** | 5-dimension accessibility ratings by real visitors; reviews feed the shared database |
| 🧭 **Visit nudge** | Visited a place and moved ~3 km away → gentle "rate its accessibility?" prompt |
| 🎮 **Gamification** | Coins (2× for PWD users), badges, daily challenges, leaderboard, rewards store |
| 🏠 **Two feeds** | **Discover** (AI/real places) + **Community** (real user posts) |

## 🛠️ Tech stack

- **App**: React Native 0.81 · Expo SDK 54 · TypeScript (strict) · expo-router · NativeWind (Tailwind) · Zustand · Reanimated
- **Backend**: Firebase v10 (Auth · Firestore · Storage)
- **AI**: Google **Gemini 2.5 Flash** (vision) · **Groq / Llama 3.3-70B** (text) — multi-agent architecture (vision, caption, scoring, recommendation, place-analysis, gamification, orchestrator)
- **Data**: Google Maps Platform (Places, Details, hours, reviews) · Open-Meteo (weather, no key)
- **Build**: EAS Build (cloud APK/AAB)

Runs entirely on free tiers.

## 🚀 Getting started

```bash
git clone https://github.com/Abhi-tech-geek/Discova.git
cd Discova
npm install --legacy-peer-deps
```

Create a `.env` in the project root (never committed):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...        # Google Cloud → Places + Maps SDK enabled
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=...
EXPO_PUBLIC_GROQ_API_KEY=...           # console.groq.com (free)
EXPO_PUBLIC_GEMINI_API_KEY=...         # aistudio.google.com (free)
```

Then:

```bash
npx expo start        # scan QR with Expo Go (Android/iOS)
```

In Firebase Console enable **Authentication → Email/Password + Anonymous**, and paste `firestore.rules` into Firestore → Rules.

APK build (cloud, no Android SDK needed): `eas build -p android --profile preview`

## 📁 Structure

```
app/          screens (expo-router) — tabs, auth, place/[id], review, ask, settings
components/   UI + design system (aurora theme, CrowdMeter, ComfortCard, …)
services/     firebase.ts · googleMaps.ts · weather.ts · agents/ (all AI calls)
stores/       Zustand (user, app, visits)
utils/        crowd · comfort · place · validation
docs/         in-depth docs (architecture, AI agents, data flow, tools, features)
```

Rule: screens never touch Firebase/AI directly — everything goes through `services/`.

## 📚 Docs

See [`docs/`](docs/) — features catalog, architecture, AI agents spec, data flow, stack rationale, build & deploy guide, Firestore rules.

## 🙏 Mission

Accessibility info shouldn't be guesswork. Every review and photo grows a **shared accessibility database** that helps the next visitor know before they go.

---

Built with ❤️ using React Native, Firebase, Gemini & Groq.
