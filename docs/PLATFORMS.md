# PLATFORMS & SERVICES — kaun se accounts/consoles use kiye, kyun, kya kaam aate hain

`TOOLS.md` me **code libraries** (npm packages) the. Yeh doc us **external services / cloud platforms / accounts** ke baare me hai jo DISCOVA chalane ke liye banaye — jaise Google Cloud, Firebase, Expo, Groq, etc.

Har platform ke liye:
- **Kya hai**
- **Kyun use kiya** (is project me)
- **Kya kaam aata hai** (kaunse features)
- **Console / CLI + key kahan se**
- **Free tier**
- **Hamare identifiers** (project id, account — secret keys NAHI, woh `.env` me hain)

> ⚠️ **Secret keys kabhi doc/git me mat daalo.** Asli values sirf `.env` (local) aur `eas.json` (build) me hain. Yahan sirf naam/location bataya hai.

---

## 0. Bada picture — kaun kis kaam ke liye

```
                 ┌────────────────────────────────────────────┐
                 │                DISCOVA app                  │
                 └───┬───────┬───────────┬───────────┬─────────┘
                     │       │           │           │
        login/DB/file│  maps/places│  vision AI │  text AI
                     ▼       ▼           ▼           ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Firebase │ │  Google  │ │  Google  │ │   Groq   │
              │ (Auth/DB/│ │  Cloud   │ │AI Studio │ │  Cloud   │
              │ Storage) │ │ (Maps)   │ │ (Gemini) │ │ (Llama)  │
              └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┘
                   │            │            │
                   └─────── same Google account ───────┘

        Build/Deploy + dev:  Expo / EAS  (expo.dev)
        Runtime + tooling:   Node.js + npm,  Git (optional)
```

**Yaad rakhne layak**: Firebase, Google Cloud (Maps), aur Gemini (AI Studio) — teeno **ek hi Google account** pe hain. Firebase project andar-andar ek **Google Cloud project** hi hota hai (Firebase usi ke upar bana hai). Groq aur Expo alag accounts hain.

---

## 1. Expo / EAS — `expo.dev`

- **Kya hai**: React Native apps banane, run karne aur **build (APK/AAB)** karne ka platform. Expo SDK + Expo Go app + EAS cloud build.
- **Kyun use kiya**: Bina Android Studio/Xcode ke app develop + APK banane ke liye. Local machine pe Android SDK/Java nahi — isliye build **cloud (EAS)** pe.
- **Kya kaam aata hai**:
  - **Expo Go** — dev me phone pe instant test (QR scan).
  - **EAS Build** — code cloud pe bhejke installable **APK** banata.
  - **App signing keystore** — EAS cloud me auto-generate + store karta (app sign karne ke liye).
  - (Optional) **EAS Update** — JS-only changes OTA push (bina naya APK).
- **Console / CLI**:
  - Dashboard: `https://expo.dev/accounts/abhinavai9900/projects/Discova`
  - CLI: `npx expo ...` (dev), `eas ...` (build/deploy). Auth: `eas login` ya `EXPO_TOKEN`.
- **Free tier**: Expo Go free; EAS Build free plan me limited builds/month (queue ke saath).
- **Hamare identifiers**: account `abhinavai9900`, project `Discova` (id `5a0ec723-f112-4eb3-8054-cc77c418566a`), Android package `com.discova.app`. (`app.json` → `extra.eas.projectId`, `eas.json` → build profiles.)

---

## 2. Firebase — `console.firebase.google.com`

- **Kya hai**: Google ka **Backend-as-a-Service**. Auth + database + file storage, sab ek SDK me. Apna backend server likhne ki zaroorat nahi.
- **Kyun use kiya**: Solo/chhoti team — login, data save, photo upload sab ready-made chahiye tha.
- **Kya kaam aata hai (3 products)**:
  1. **Authentication** — user login. Hamne 2 method on kiye: **Email/Password** + **Anonymous** ("Continue as guest").
  2. **Cloud Firestore** (NoSQL DB) — users, posts, aur **places cache** (AI ne jo accessibility score nikala, woh `places/{id}` me — "shared accessibility database", taaki dubara AI na chale).
  3. **Storage** — user ki photos.
- **Console / SDK config**: Project Settings → "SDK config" se `EXPO_PUBLIC_FIREBASE_*` keys milti hain (`.env` me). Code me sirf `services/firebase.ts` use karta.
- **Free tier (Spark plan)**: Firestore ~50K reads / 20K writes per day, Storage 5 GiB, Auth 50K MAU. MVP ke liye kaafi.
- **Hamare identifiers**: project `discova-d62a3`, region `asia-south1` (India).
- **⚠️ Zaroori step**: Firebase Console → **Authentication → Sign-in method** me Email/Password + Anonymous **enable** karna, warna login fail. Storage use karne pe billing/Blaze upgrade maang sakta hai.

---

## 3. Google Cloud Platform (gcloud) — `console.cloud.google.com`

- **Kya hai**: Google ka cloud platform. Saari Google APIs (Maps, Places, etc.) yahin se enable + key banti hai, billing yahin manage hoti.
- **Kyun use kiya**: App ko **map + nearby real places + reviews** chahiye the — yeh Google Maps Platform se aate hain, jo GCP pe rehti hai.
- **Kya kaam aata hai (enabled APIs)**:
  - **Maps SDK for Android/iOS** — `react-native-maps` me actual map tiles.
  - **Places API** — around-me nearby places (cafe, mall, museum, park...).
  - **Place Details API** — ek place ka naam, photos, aur **real reviews**.
  - **Geocoding** — (location ke saath; reverse geocoding hum free `expo-location` se karte hain).
- **Console / key**: APIs & Services → Credentials se API key (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `.env` + `app.json` android/iOS config). Code: sirf `services/googleMaps.ts`.
- **Free tier**: Google Maps Platform har month **$200 free credit** — MVP ke liye bahut.
- **Firebase se rishta**: Firebase project `discova-d62a3` **andar-andar yahi GCP project** hai. Matlab Maps key aur Firebase ek hi Google account/project family me hain.
- **gcloud CLI**: zaroori nahi tha — sab console se kiya. (Advanced automation chahiye to `gcloud` CLI use hoti.)

---

## 4. Google AI Studio — `aistudio.google.com`

- **Kya hai**: Google ka **Gemini** models ka platform + free API key dene ki jagah.
- **Kyun use kiya**: Place ki **photo dekh ke** accessibility detect karni thi (ramp/stairs/wide doors) — iske liye multimodal (image samajhne waala) AI chahiye, jo free me Gemini deta hai.
- **Kya kaam aata hai**: **Gemini 2.5 Flash** (vision) — photo (base64) → accessibility features. (1.5 deprecated hua isliye 2.5.)
- **Console / key**: AI Studio → "Get API key" → `EXPO_PUBLIC_GEMINI_API_KEY` (`.env`). Code: `services/agents/visionAgent.ts`, `placeAnalysisAgent.ts` (SDK `@google/generative-ai`).
- **Free tier**: ~15 requests/min, ~1500/day. **On-demand** call (sirf jab ek place khulta) — isliye limit safe.
- **Note**: AI Studio key aur Maps key dono "AIza..."/"AQ..." dikh sakti hain par alag products ki alag keys hain — confuse mat karna.

---

## 5. Groq Cloud — `console.groq.com`

- **Kya hai**: Llama jaise open models ko **apne tez hardware (LPU)** pe host karta — 500+ tokens/sec, near real-time.
- **Kyun use kiya**: Captions + recommendations + reviews-se-hints jaise **text** tasks fast + free chahiye the.
- **Kya kaam aata hai**:
  - `llama-3.1-8b-instant` — caption generation (fast/sasta).
  - `llama-3.3-70b-versatile` — recommendations, reviews → per-category accessibility hints.
- **Console / key**: Groq console → API Keys → `EXPO_PUBLIC_GROQ_API_KEY` (`gsk_...`, `.env`). Code: `services/agents/captionAgent.ts`, `recommendationAgent.ts`, `placeAnalysisAgent.ts` (SDK `groq-sdk`).
- **Free tier**: free RPM/TPM limits — MVP ke caption/recommendation ke liye kaafi.

---

## 5b. Open-Meteo — `open-meteo.com`

- **Kya hai**: Free weather API — **koi API key nahi, koi signup nahi**.
- **Kyun use kiya**: Weather-aware suggestions — barish/garmi me "indoor accessible cafes nearby".
- **Kya kaam aata hai**: User ki location ka current temperature + precipitation + weather-code → app decide karta indoor suggest kare ya nahi.
- **Console / key**: **kuch nahi chahiye** — direct `fetch(...)`. Code: `services/weather.ts`.
- **Free tier**: non-commercial use free, generous limits.

---

## 6. Dev / runtime tooling (platform-level)

| Tool | Kya hai | Kyun |
| --- | --- | --- |
| **Node.js + npm** | JS runtime + package manager | `npm install`, scripts, sab JS tooling isi pe |
| **Git / GitHub** *(optional)* | Version control / code host | Code history + EAS git se project upload karta |
| **VS Code** *(optional)* | Code editor | Dev ke liye |
| **Windows + OneDrive** | Dev machine | ⚠️ OneDrive `node_modules` ko "online-only" bana deta → Metro errors. Fix: `node_modules` reinstall ya folder "Always keep on this device" |

---

## 7. Ek nazar me — kaun, kya, kahan se key

| Platform | Kaam | Key env var | Console | Free? |
| --- | --- | --- | --- | --- |
| **Expo / EAS** | Dev + APK build | `EXPO_TOKEN` (build) | expo.dev | ✅ (limited builds) |
| **Firebase** | Auth + DB + Storage | `EXPO_PUBLIC_FIREBASE_*` | console.firebase.google.com | ✅ Spark |
| **Google Cloud** | Maps + Places + reviews | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | console.cloud.google.com | ✅ $200/mo |
| **Google AI Studio** | Gemini vision AI | `EXPO_PUBLIC_GEMINI_API_KEY` | aistudio.google.com | ✅ |
| **Groq Cloud** | Llama text AI | `EXPO_PUBLIC_GROQ_API_KEY` | console.groq.com | ✅ |
| **Open-Meteo** | Weather (indoor suggestions) | — (no key needed) | open-meteo.com | ✅ |

---

## 8. Naya machine pe setup karna ho to (order)

1. **Node.js** install (npm aa jaata saath).
2. `npm install --legacy-peer-deps` (project deps).
3. **Accounts banao + keys lo**: Firebase project → SDK config; Google Cloud → Maps key (Places + Details + Maps SDK enable); AI Studio → Gemini key; Groq → key.
4. `.env` me saari `EXPO_PUBLIC_*` keys daalo (`README.md` me list).
5. Firebase Console → Auth me Email/Password + Anonymous enable.
6. Dev: `npx expo start`. APK: `eas login` → `eas build -p android --profile preview` (detail `BUILD_DEPLOY.md`).

> Sab free tier pe — chhote traffic ke liye poora project **₹0** me chalta hai (`STACK.md` ka cost table dekho).
