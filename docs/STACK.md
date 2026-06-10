# Stack

Har technology kyu chuni gayi, alternatives kya the, kyun reject hue, aur free tier mein kitna kaam chal jaata hai — sab yahan.

---

## React Native 0.81 + Expo SDK 54

**Kya hai**: Cross-platform mobile framework. Ek codebase, Android + iOS dono pe chalti hai.

> **Update**: pehle SDK 56 plan tha, par **Expo Go (store waala) abhi SDK 54 pe hai** — 56 ke saath *"Incompatible SDK version"* aata tha. Isliye **56 → 54 downgrade** kiya. Saath me `react` ko **exactly 19.1.0** pin karna pada (RN 0.81 ke renderer se match), warna *"Incompatible React versions"* crash.

**Kyun chuna**:
- Hire karna easy hai (JS / TS developers har jagah hain)
- Expo SDK out-of-the-box camera, location, image-picker, secure-store deta hai — har feature ke liye native code likhna nahi padta
- OTA (over-the-air) updates EAS Update se aasaan (setup detail `BUILD_DEPLOY.md`)
- Hot reload + Reanimated ka combination dev experience tez deta hai

**Alternatives**:
- **Flutter** — Dart sikhna padta. Native performance better, but team productivity slower in our case. Hire pool chhota.
- **Native (Swift + Kotlin)** — Best performance, lekin 2 codebases = 2x cost.

**Free tier**: Expo Go free. EAS Build mein 30 builds/month free. Production builds ke liye paid plan chahiye eventually.

---

## expo-router (v6)

**Kya hai**: File-based routing — `app/` folder ki structure hi routes ban jaati hai.

**Kyun chuna**:
- Next.js jaisa familiar mental model
- Nested layouts (root, tabs, etc.) ka clean syntax
- Type-safe routes with `useLocalSearchParams`

**Alternative**: Raw React Navigation. More flexibility but more boilerplate — Stack.Navigator + Tab.Navigator manually wire karne padte.

**Free**: Open source, sab kuch free.

---

## NativeWind v4

**Kya hai**: Tailwind CSS, but for React Native. `className="bg-primary p-4"` syntax.

**Kyun chuna**:
- Web Tailwind se familiarity — same utilities
- Dark mode handling built-in (`dark:bg-surface-dark`)
- Compile-time, koi runtime overhead nahi (v4 mein)

**Alternative**: StyleSheet.create + custom theme objects. Verbose. Hard to scan at a glance. NativeWind classes are scannable like CSS.

**Free**: Open source.

> Note: rules mein hai ki `StyleSheet.create` use mat karo, sirf `className` use karo. Iska reason hi yeh hai — ek hi styling system rakhna codebase mein.

---

## Zustand v4

**Kya hai**: Tiny state management library. Like Redux but without boilerplate.

**Kyun chuna**:
- Hooks-first API (`useUserStore`)
- Selectors built-in — sirf wo data subscribe karta hai component jo zaroori hai (re-renders kam)
- 1.2 KB minified — bohot light
- No provider wrapping needed

**Alternatives**:
- **Redux Toolkit** — battle-tested but verbose. 4-5 files for one slice.
- **React Context** — re-renders pure tree ko trigger karta hai. Performance issue at scale.
- **Recoil** — Facebook ne abandon kar diya effectively.

**Free**: Open source.

> Rules mein: **Context use mat karo, Zustand only**. Iska reason performance + consistency.

---

## react-native-reanimated v4 (+ react-native-worklets)

**Kya hai**: Animations on the UI thread, not the JS thread. Smooth 60fps even when JS is busy.

**Kyun chuna**:
- `useSharedValue` + `useAnimatedStyle` declarative pattern
- Layout animations (`entering`, `exiting`) one-liners
- Layout transitions, gestures, repeats — sab cover

**v4 note**: v4 me worklets ka engine alag package me nikal gaya, isliye **`react-native-worklets`** bhi install hai (v3 me yeh built-in tha).

**Alternative**: React Native ka built-in `Animated` API. Runs on JS thread → jitter when JS busy.

**Free**: Open source.

> Rules mein: Reanimated (v3+) only, RN ka legacy Animated kabhi mat use karo.

---

## Firebase v10 (Auth + Firestore + Storage)

**Kya hai**: Google ka BaaS (Backend as a Service). Auth, NoSQL DB, file storage — sab ek SDK mein.

**Kyun chuna**:
- Solo dev / small team ke liye backend setup nahi karna
- Real-time listeners built-in (`onSnapshot`)
- Indian region (asia-south1) available
- Security rules client-side se hi enforce ho jaate hain — backend server nahi chahiye

**Alternatives**:
- **Supabase** — Postgres-based, open source. Better for relational data. Lekin storage + realtime + auth ka same level of polish nahi abhi.
- **Custom Node.js + Postgres** — full control, but you write everything (auth, file upload signed URLs, etc.)
- **AWS Amplify** — powerful but learning curve high

**Free tier (Spark plan)**:
- **Firestore**: 50K reads / 20K writes / 20K deletes per day, 1 GiB storage
- **Storage**: 5 GiB stored, 1 GiB/day downloads, 20K uploads/day
- **Auth**: 50K MAU
- Pretty generous for an MVP.

**Paid (Blaze plan)** start: pay-as-you-go, but free tier hi included rehta hai.

---

## Google Gemini 2.5 Flash (vision)

**Kya hai**: Google ka multimodal LLM. Image + text input le sakta hai.

> **Update**: pehle `gemini-1.5-flash` use hota tha, par woh **deprecated** ho gaya (API models list me nahi aata). Ab **`gemini-2.5-flash`** use karte hain (`services/agents/visionAgent.ts`).

**Kyun chuna**:
- **Free tier hai** — ~15 RPM, ~1500 RPD (requests per day)
- Vision quality solid hai for accessibility detection (ramps, stairs detect karta hai accurately)
- JSON mode supported
- **On-demand**: AI sirf tab chalta hai jab koi ek place khulta hai (saare nearby places pe ek saath nahi) — isliye rate limit safe rehta hai

**Alternatives**:
- **OpenAI GPT-4o vision** — better quality lekin paid only. Cost prohibitive for MVP.
- **Claude vision** — similar quality. Paid.
- **Open source (LLaVA, Llama 3.2 Vision)** — self-host karna padega. Infra cost zyada.

**Free tier limits** (per minute / per day):
- 15 requests/minute
- 1,500 requests/day
- 1M tokens/minute

For an MVP with 100s of posts/day → bilkul kaafi hai.

---

## Groq (text generation)

**Kya hai**: Inference platform jo Llama, Mixtral, etc. host karta hai apne custom hardware (LPU) pe. **Stupidly fast** — 500+ tokens/sec.

**Kyun chuna**:
- Free tier exists
- Llama 3.1 8B Instant — caption generation ke liye perfect
- Llama 3.3 70B Versatile — recommendation jaise tasks ke liye
- Latency 200-400 ms — almost real-time

**Alternatives**:
- **OpenAI** — paid only.
- **Anthropic Claude API** — paid only (free tier sirf web/app pe).
- **Together AI** — similar to Groq, free tier hai but rate limits chhote.
- **Self-hosted Llama** — infra cost + GPU rental + ops overhead.

**Free tier**:
- Llama 3.1 8B Instant: 30 RPM, 6K TPM, 14.4K req/day
- Llama 3.3 70B Versatile: 30 RPM, 6K TPM, 1K req/day

Caption + recommendation flows ke liye more than enough.

---

## react-native-maps + Google Maps

**Kya hai**: RN component jo native MapView wrap karta hai. `PROVIDER_GOOGLE` set karne pe Google Maps tiles use hote hain.

**Kyun chuna**:
- Markers, polylines, regions — all standard map features
- Native performance (proper map gestures)
- Google Maps tiles familiar to Indian users

**Alternatives**:
- **Mapbox** — beautiful customization, but free tier limited (50K loads/month).
- **Apple Maps** (iOS only) — single platform.

**Free tier**: Google Maps SDK for Android/iOS — **$200 free credit per month** on Google Cloud. For maps rendering + place autocomplete, that covers a lot.

---

## expo-camera, expo-location, expo-image-picker, expo-image-manipulator, expo-secure-store, expo-linear-gradient

Yeh sab Expo modules hain. Free, well-maintained, version-locked to your Expo SDK.

- **expo-camera** — CameraView component for capture
- **expo-location** — GPS + reverse geocoding
- **expo-image-picker** — gallery picker
- **expo-image-manipulator** — resize / compress / base64 conversion before sending to vision API
- **expo-secure-store** — encrypted key-value storage (we persist the theme here)
- **expo-linear-gradient** — gradient backgrounds (used in login, profile, rewards)

Sab free, sab Expo SDK 54 compatible. (Har module ka exact role + file `TOOLS.md` me.)

---

## @react-native-async-storage/async-storage

**Kya hai**: Persistent key-value storage. SQLite-backed on native.

**Kyun chuna**: Recent searches save karne ke liye. SecureStore overkill hai non-sensitive data ke liye. AsyncStorage simple + fast.

**Free**: Open source.

---

## TypeScript (strict)

**Kya hai**: JavaScript + types.

**Kyun chuna**:
- Refactoring confidence — type errors compile-time pe hi pakad lete
- IDE autocomplete + go-to-def
- AI agents ka JSON output coerce karne ke liye type guards

**Rule**: `any` type ban hai. Strict mode on. `noUnusedLocals`, `noImplicitAny`, etc. sab on hain `tsconfig.json` mein.

**Free**: Open source.

---

## Total monthly cost (free tier mein)

| Service | Cost |
| --- | --- |
| Firebase Spark (Auth + Firestore + Storage) | ₹0 |
| Gemini API (1500 req/day free) | ₹0 |
| Groq API (free tier) | ₹0 |
| Google Maps ($200 free credit) | ₹0 |
| Expo Go | ₹0 |
| EAS Build (30/month) | ₹0 |
| **Total** | **₹0** |

Yes, theoretically pura MVP **₹0 mein chal sakta hai** jab tak ki traffic chhota hai. Production scale pe Firebase + Maps charges bhar honge.
