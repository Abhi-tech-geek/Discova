# FEATURES — DISCOVA me abhi kya-kya hai

Ye app ka **current feature catalog** hai (screen-by-screen + cross-cutting), file references ke saath. Sabse up-to-date picture yahi doc deta hai.

> Data sources: **Google Places** (real places/photos/reviews/hours), **Firebase** (auth + Firestore + Storage), **Gemini 2.5** (vision), **Groq/Llama** (text), **Open-Meteo** (free weather). Saare external calls `services/` me.

---

## 🔐 Auth — `app/auth/`
- **Login** (`login.tsx`) — Email/Password (naya email → auto sign-up), ya **"Continue as guest"** (anonymous). Aurora hero + value-props + show/hide password.
- **Onboarding** (`onboarding.tsx`) — 3 slides + "PWD ho?" question → disability type → profile Firestore me save. PWD = 2× coins.
- Persistence: `initializeAuth` + AsyncStorage (app band karke bhi logged-in).
- Route guard: `hooks/useProtectedRoute.ts`.

## 🏠 Home — `app/(tabs)/index.tsx`
Real **discovery feed** (fake gradients nahi):
- **"Accessible places near you"** — real Google places, **real photos**, rating ≥3.9
- **Need-chips**: Top picks · 💎 Hidden gems · 🏠 Indoor · Calm · Family · Cafés · Parks · Food → har chip Google ki suitable categories laata
- **🌦️ Weather banner** — barish/garmi me "indoor accessible spots" suggest (tap → Indoor chip)
- **🎯 Daily challenge** card — "1 jagah rate karo → coins"
- **Stories rail** + full-screen story viewer
- **Crowd/quiet meter** har card pe · **💎 Hidden gem** badge
- PWD on → info banner · Pull-to-refresh
- New **logo** (`components/design/Wordmark.tsx` — aurora locator mark)

## 🗺️ Explore — `app/(tabs)/explore.tsx`
- Live location → **real Google places** (rating ≥3.9 + photos, quality-ranked)
- **Map view** (markers, color by access score) + **list view** toggle
- Category chips + accessibility filter chips (Wheelchair/Visual/Hearing/Senior)
- Marker tap → bottom sheet (View details / Get route)
- "Societies" chip alag (explicit), warna residential filter out

## 🔍 Search — `app/(tabs)/search.tsx`
- **Real Google Places autocomplete** (poore India) — debounced, location-biased
- Tap result → place detail (Google + AI access)
- People tab (seed) · Recent searches (AsyncStorage)

## 📍 Place detail — `app/place/[id].tsx`
Cache-first (Firestore) → Google + AI → cache (shared accessibility DB):
- Photo gallery (real Google photos) + **⏰ Open now / Closes 10 PM** (real hours)
- **♿ Accessibility report** (AI: ramp/lift/toilet/parking + per-category scores) + verdict
- **📊 Crowd/Quiet meter** (busy/quiet + noise, AI-photo signal jab ho)
- **⏱️ Best time to visit** (din bhar busyness bar-chart, quietest window)
- **🛋️ Comfort Index** (/100 + parking/walking/seating/calm bars)
- **💎 Hidden gem** badge (agar applicable)
- Tabs: **Posts** · **Reviews** (Google + community) · **AI Summary**
- **"Rate accessibility"** → review form · Get route · Add experience

## ♿ Accessibility review form — `app/review/[placeId].tsx`
- Overall ⭐ + 5 dimensions (Mobility/Visual/Hearing/Cognitive/Sensory) 0-5, skippable
- Optional note → Firestore (`createReview`) + coins (PWD 2×)
- Place detail Reviews tab me turant dikhta (focus refresh)

## 🧭 Visit → review nudge — `hooks/useVisitTracker.ts` + `components/ReviewNudge.tsx`
- Foreground location watch — kisi venue ke ~200m andar = "visit" yaad
- 3km door jaane par bottom banner: "Rate [place]?" → review form
- Persisted (`stores/visitStore.ts`) — app reopen pe bhi

## 📸 Camera / post — `app/(tabs)/camera.tsx`
- Capture/gallery → 3-step post flow → Firestore + Storage
- AI: vision (Gemini) → caption (Groq) → score → coins/badges (`orchestrator`)

## 👤 Profile — `app/(tabs)/profile.tsx`
- GradientAvatar, impact/coins cards, stats, photo grid, **gear → Settings**

## ⚙️ Settings — `app/settings.tsx`
- Dark mode toggle · edit name/bio · notifications · PWD mode · account · sign out

## 🎁 Rewards — `app/rewards/store.tsx`
- Coins se partner rewards · Challenges + Leaderboard (seed)

---

## 🧩 Cross-cutting "smart" features (utils + components)

| Feature | Logic | UI | Note |
| --- | --- | --- | --- |
| **Crowd/Quiet meter** | `utils/crowd.ts` (`estimateCrowd`) | `components/CrowdMeter.tsx` | time+category+popularity, AI-photo signal jab ho |
| **Best time to visit** | `utils/crowd.ts` (`dayBusyness`) | `components/BestTime.tsx` | quietest 2h window |
| **Comfort Index** | `utils/comfort.ts` | `components/ComfortCard.tsx` | parking/walking/seating/calm — sabke liye |
| **Hidden gems** | `utils/place.ts` (`isHiddenGem`) | badge + home chip | high rating + few reviews |
| **Weather-aware** | `services/weather.ts` (Open-Meteo) | home banner | rain/heat → indoor |
| **Open now / hours** | `services/googleMaps.ts` (`getPlaceDetails`) | place badge | real Google hours |
| **Dark mode** | `hooks/useTheme.ts` + `surfaces()` | har screen | NativeWind class strategy |

> Honest note: Google officially **live crowd ("popular times") nahi deta** — crowd/best-time ek **smart estimate** hai (analyzed places pe AI-photo se zyada accurate).

---

## 🚧 Abhi seed / pending (real nahi)
- Stories (seed) · Leaderboard/Challenges (seed) · People search (seed)
- Comments · Follow · Real OTA updates (expo-updates)
- Background geofence (app-band visit tracking) · Push notifications
- Launcher icon (phone wala) abhi purana

Aage ka roadmap discussion ke liye team/chat dekho.
