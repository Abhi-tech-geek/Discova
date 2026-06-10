# Discova

Ek **social accessibility travel app**, jahan log accessible places dhundh sakte hain, photos share kar sakte hain, aur AI automatically score nikalta hai ki yeh place wheelchair / visual / hearing impairment waale users ke liye kitna friendly hai.

Matlab, Instagram + Google Maps + Accessibility audit — sab ek hi app mein.

---

## Yeh app karta kya hai?

- **Photo upload** karo kisi public place ki (cafe, mall, monument, station — kuch bhi).
- **AI** photo dekh ke decide karta hai: ramp hai? lift hai? wide doors hain? stairs kitni hain?
- App us place ko **0-10 ka score** deta hai har category ke liye (mobility / visual / hearing / cognitive / sensory).
- Doosre users wahi place explore karte time **filter** kar sakte hain — "Sirf wheelchair-friendly dikhao".
- Aap jitne posts karoge utne **coins** milenge. Coins se partner rewards (CCD, Uber, Indigo, etc.) redeem kar sakte ho.

PWD (person with disability) users ko **2x coins** milte hain — yeh app ka inclusive incentive hai.

---

## Setup — start kese karein

### 1. Repo clone karo

```bash
git clone <repo-url>
cd Discova
```

### 2. Dependencies install karo

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` isliye chahiye kyunki React 19 + expo-router ka peer graph thoda strict hai.

### 3. `.env` file banao

`.env.example` ko copy karke `.env` bana lo, aur saari keys fill karo:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=...

EXPO_PUBLIC_GROQ_API_KEY=...
EXPO_PUBLIC_GEMINI_API_KEY=...
```

Keys kahan se milengi:

- **Firebase**: console.firebase.google.com → Project Settings → SDK config
- **Google Maps**: console.cloud.google.com → APIs & Services → Credentials
- **Groq** (free, fast LLM): console.groq.com
- **Gemini** (free, vision): aistudio.google.com

### 4. App run karo

```bash
npx expo start
```

- **Android**: phone pe Expo Go install karo, QR scan karo.
- **iOS**: Expo Go via App Store, ya simulator pe `i` press karo terminal mein.
- **Web** (debugging ke liye): `w` press karo.

---

## Tech stack — ek line summary

| Layer | Tech |
| --- | --- |
| Mobile framework | React Native 0.81 + Expo SDK 54 |
| React | 19.1.0 (exact pin — RN renderer se match) |
| Routing | expo-router 6 (file-based) |
| Styling | NativeWind v4 (Tailwind for RN) |
| State | Zustand v4 (no Context) |
| Animations | Reanimated v4 + worklets |
| Backend | Firebase v10 (Auth + Firestore + Storage) |
| Vision AI | Google Gemini 2.5 Flash (free) |
| Text AI | Groq (Llama 3.1 8B / 3.3 70B — free, super fast) |
| Maps | react-native-maps + Google Maps Web Services |
| Build/Deploy | EAS Build (cloud APK/AAB) |

Detail ke liye **`STACK.md`** (kyun chuna) aur **`TOOLS.md`** (har tool kya karta hai + kahan use hua) dekho.

---

## Folder structure (chhota tour)

```
app/                  Screens (expo-router file-based routing)
  _layout.tsx         Root layout — auth listener + visit tracker + Stack
  (tabs)/             home(index) / explore / camera / search / profile
  auth/               login (email + guest) + onboarding
  place/[id].tsx      Place detail (cache → Google + AI → cache)
  review/[placeId].tsx  Accessibility review form
  rewards/store.tsx   Rewards + Challenges + Leaderboard
  settings.tsx        Dark mode, edit profile, prefs, sign out

components/
  design/             Aurora atoms — Wordmark, ScorePill, FeatureChip,
                      GradientAvatar, MeshPhoto, NativeMap(.web), theme.ts
  HomePlaceCard · PlaceCard · CrowdMeter · BestTime · ComfortCard
  ReviewNudge · AccessibilityReport · StoryCircle · AccessibilityBadge
hooks/                useTheme · useProtectedRoute · useLiveLocation · useVisitTracker
services/
  firebase.ts         Saare Firestore / Auth / Storage calls (ek hi jagah)
  googleMaps.ts       Places / Details(+hours) / reviews / nearby / geocoding
  weather.ts          Open-Meteo (free, no key) — weather-aware suggestions
  agents/             AI agents — vision, caption, recommendation, scoring,
                      gamification, orchestrator, placeAnalysis
stores/               Zustand — userStore · appStore · visitStore
utils/                crowd · comfort · place · sanitize · validate
types/index.ts        Saare TypeScript interfaces ek jagah
docs/                 Yeh files
```

Rules ek baat clear hai: **screens / stores kabhi seedha Firebase ko nahi chhuti hain.** Sab kuch `services/firebase.ts` se hota hai. Saare AI calls `services/agents/` se hote hain. Yeh boundary tight rakhi gayi hai taaki test karna aur replace karna easy ho.

---

## Aage padho

- **FEATURES.md** — *(naya)* App me **abhi kya-kya hai** — screen-by-screen + smart features ka current catalog (file refs). Yeh sabse up-to-date hai.
- **TOOLS.md** — *(naya)* Har **code library/npm package**: kya hai, kyun, kya karta hai, **kahan use hua** (file refs)
- **PLATFORMS.md** — *(naya)* Har **external service/account** (Expo, Firebase, Google Cloud, AI Studio, Groq): kya hai, kyun use kiya, key kahan se
- **BUILD_DEPLOY.md** — *(naya)* APK kaise banta hai, time, aur **change ke baad dobara build karna hai ya nahi**
- **STACK.md** — Har technology kyu chuni gayi (alternatives + free tier)
- **ARCHITECTURE.md** — Multi-agent system ka overview + flow diagram
- **AI_AGENTS.md** — Har agent ka detailed spec
- **DATA_FLOW.md** — Photo se database tak ka pura journey
- **FIRESTORE_RULES.md** — Security rules template

> Note: ye docs originally SDK 56 / Gemini 1.5 ke time likhi gayi thi. Ab project **SDK 54 + Gemini 2.5 Flash** pe hai — sabse current facts ke liye **TOOLS.md** authoritative hai.
