# TOOLS — har tool, kyun, kya karta hai, kahan use hua

Yeh DISCOVA ka **complete toolbox** hai. Har library / service ke liye 4 cheezein:

1. **Kya hai** — ek line me.
2. **Kyun chuna** — is project me iski zaroorat kyun padi.
3. **Kya karta hai** — kaam kya karta hai actually.
4. **Kahan use hua** — kis file me, kis feature me (taaki code me dhoond sako).

Versions wahi hain jo `package.json` me locked hain (June 2026).

> Golden rule (CLAUDE.md se): **screens/stores kabhi seedha Firebase ya AI ko nahi chhoote.** Saare Firebase calls `services/firebase.ts` se, saare AI calls `services/agents/` se. Isiliye neeche har service ka "kahan use hua" ek hi jagah point karta hai — boundary tight hai.

---

## 1. Core framework

### Expo SDK 54 (`expo ~54.0.0`)
- **Kya hai**: React Native ke upar ek toolkit + managed workflow. Camera, location, secure-store jaise native modules ready-made deta hai.
- **Kyun chuna**: Akele/chhoti team ke liye native Android/iOS code likhe bina poori app ban jaati hai. Expo Go app me turant test, aur EAS se APK build.
- **Kyun 54 (56 nahi)**: SDK 56 ke saath **Expo Go incompatible** tha (store waala Expo Go abhi 54 pe hai). Isliye 56 → **54 downgrade** kiya taaki phone pe Expo Go me chal sake.
- **Kya karta hai**: Native modules ka bridge, config (`app.json`) ko native project me convert, dev server.
- **Kahan**: poori app. Config `app.json`, entry `package.json` → `"main": "expo-router/entry"`.

### React Native 0.81.5 (`react-native`)
- **Kya hai**: JS/TS me likho, real native UI (Android `View`, iOS `UIView`) banta hai — browser webview nahi.
- **Kyun chuna**: Ek codebase → Android + iOS dono. JS/TS developers easily milte hain.
- **Kya karta hai**: `View`, `Text`, `Pressable`, `FlatList`, `ScrollView`, `Switch`, `TextInput`, `Modal` — yeh sab native components JS se render karta hai.
- **Kahan**: har screen aur component.

### React 19.1.0 (`react`, `react-dom`)
- **Kya hai**: UI library — components, hooks, state.
- **Kyun **exactly** 19.1.0** (caret `^` nahi): React Native 0.81 ka renderer **exactly** React 19.1.0 se match karta hai. 19.2.x daalne pe *"Incompatible React versions"* crash aata tha. Isliye `react` aur `react-dom` dono **pinned** hain (no `^`).
- **Kya karta hai**: `useState`, `useEffect`, `useCallback`, `useMemo` — saari hooks.
- **Kahan**: har component.

---

## 2. Routing

### expo-router 6 (`expo-router ~6.0.24`)
- **Kya hai**: **File-based routing** — `app/` folder ka structure hi URLs/routes ban jaate hain (Next.js jaisa).
- **Kyun chuna**: Manual `Stack.Navigator` wiring se bachne ke liye. Folder banao = route ban gaya. Nested layouts clean.
- **Kya karta hai**:
  - `app/_layout.tsx` = root layout (Stack).
  - `app/(tabs)/_layout.tsx` = bottom tab navigator. `(tabs)` brackets matlab "group, URL me mat dikhao".
  - `app/place/[id].tsx` = dynamic route, `useLocalSearchParams()` se `id` milta hai.
  - Navigation: `useRouter().push('/settings')`, `router.replace('/auth/login')`, `router.back()`.
- **Kahan**: `app/` ke andar har file. Navigation calls har screen me.

### @react-navigation/* (`native`, `bottom-tabs`, `stack`)
- **Kya hai**: expo-router andar-andar React Navigation par bana hai. Yeh uska base engine hai.
- **Kyun chuna**: expo-router ki peer dependency — directly hum kam chhoote hain, par install zaroori hai.
- **Kahan**: indirectly expo-router ke through.

---

## 3. Styling

### NativeWind v4 (`nativewind ^4.2.4`) + Tailwind CSS 3 (`tailwindcss ^3.4.19`)
- **Kya hai**: Tailwind CSS, lekin React Native ke liye. `className="bg-primary p-4 dark:bg-surface-dark"`.
- **Kyun chuna**: Web Tailwind se familiar utilities; dark mode built-in (`dark:` variant); compile-time (runtime overhead nahi).
- **Kya karta hai**: className strings ko native styles me convert. Theme tokens (aurora colors, `primary`, `surface-light/dark`) `tailwind.config.js` me define.
- **Kahan**: **har** UI file. Config `tailwind.config.js`, CSS entry `global.css`, Metro wiring `metro.config.js` me `withNativeWind(...)`.
- **Rule**: `StyleSheet.create` **ban** hai — sirf `className`. Ek hi styling system rakhne ke liye. Dark mode ke liye **har** className me `dark:` variant.

---

## 4. State management

### Zustand v4 (`zustand ^4.5.7`)
- **Kya hai**: Tiny global state library (~1 KB). Redux ki tarah, par bina boilerplate.
- **Kyun chuna**: Hooks-first, selectors built-in (sirf zaroori data subscribe → kam re-renders), no provider wrapping.
- **Kya karta hai**: 3 stores —
  - `stores/userStore.ts` — logged-in user, `setUser`, `signOut`, `togglePWDMode`.
  - `stores/visitStore.ts` — visit tracking + review nudge (persisted).
  - `stores/appStore.ts` — app-level UI state.
- **Kahan**: `useUserStore((s) => s.user)` jaise selectors har screen me.
- **Rule**: **React Context ban hai, Zustand only** — Context poora tree re-render karta hai, Zustand selector sirf zaroori component.

---

## 5. Animations & gestures

### react-native-reanimated v4 (`~4.1.1`) + react-native-worklets (`^0.5.1`)
- **Kya hai**: Animations **UI thread** pe chalti hain (JS thread pe nahi) → JS busy ho tab bhi smooth 60fps.
- **Kyun chuna**: Story rail, gradient transitions, smooth screen animations.
- **Kya karta hai**: `useSharedValue`, `useAnimatedStyle`, `entering/exiting` layout animations. v4 ko alag **worklets** package chahiye (isliye `react-native-worklets` install hai).
- **Kahan**: animated components; Babel plugin `babel.config.js` me reanimated/worklets plugin.
- **Rule**: RN ka legacy `Animated` mat use karo, sirf Reanimated.

### react-native-gesture-handler (`~2.28.0`)
- **Kya hai**: Native-level touch/gesture handling (swipe, pan, long-press).
- **Kyun chuna**: expo-router + Reanimated dono ispe depend karte; smooth gestures.
- **Kahan**: navigation transitions, swipeable UI.

### react-native-screens (`~4.16.0`) + react-native-safe-area-context (`~5.6.0`)
- **screens**: har screen ko native screen container banata (memory + performance). expo-router internally use karta.
- **safe-area-context**: notch/status-bar/home-indicator se UI bachata. `<SafeAreaView edges={['top']}>` har screen ke top pe (e.g. `app/settings.tsx`).

---

## 6. Backend — Firebase v10 (`firebase ^10.14.1`)

Ek hi SDK me Auth + Database + Storage. **Saare calls sirf `services/firebase.ts` me.**

### Firebase Auth
- **Kya karta hai**: User login/signup.
  - `signInAnonymouslyUser()` — "Continue as guest" (bina email).
  - `emailLoginOrSignUp(email, password)` — email/password se login ya naya account (`{ user, isNew }`).
  - `signOutUser()`, `getCurrentUser()`, `onAuthChange()` (auth state listener).
- **Khaas baat**: React Native me persistence ke liye `initializeAuth` + `getReactNativePersistence(AsyncStorage)` use kiya — taaki app band karke kholo to logged-in raho.
- **Kahan**: `app/auth/login.tsx`, `app/_layout.tsx` (listener), `app/settings.tsx` (sign out).
- **Zaroori**: Firebase Console → Authentication → Sign-in method me **Email/Password + Anonymous** enable hona chahiye.

### Firestore (NoSQL DB)
- **Kya karta hai**: Users, posts, places store. Read-through cache pattern.
  - `createUserProfile`, `getUserProfile`, `updateUserProfile`.
  - `fetchHomeFeed` — home feed posts.
  - `cachePlace(place)` — AI ne jis place ko score kiya, use `places/{id}` me save (merge). Agli baar koi wahi place khole → Firestore se turant (dubara AI nahi). **Yahi "shared accessibility database" hai.**
- **Kahan**: `services/firebase.ts`; consume `app/(tabs)/index.tsx`, `app/place/[id].tsx`, `app/(tabs)/profile.tsx`.

### Firebase Storage
- **Kya karta hai**: User ki photos upload → download URL.
- **Khaas**: upload **non-fatal** hai — fail ho to local `imageUri` fallback (orchestrator me `.catch(() => '')`), post phir bhi banta hai.
- **Kahan**: `services/firebase.ts`, `services/agents/orchestrator.ts`.

**Free tier (Spark)**: Firestore 50K reads / 20K writes per day, Storage 5 GiB, Auth 50K MAU. MVP ke liye kaafi.

---

## 7. AI — Vision + Text

### Google Gemini 2.5 Flash (`@google/generative-ai ^0.15.0`)
- **Kya hai**: Google ka multimodal LLM — **image + text** dono samajhta hai.
- **Kyun chuna**: Free tier; vision quality accha (ramp/stairs/door detect); JSON output.
- **Kyun 2.5 (1.5 nahi)**: `gemini-1.5-flash` **deprecated** ho gaya (models list me nahi aata). Isliye `gemini-2.5-flash` use karte hain.
- **Kya karta hai**: Place ki photo (base64) bhejke accessibility features extract karta hai (ramp hai? wide door? steps?).
- **Kahan**: `services/agents/visionAgent.ts` (`MODEL_NAME = 'gemini-2.5-flash'`), `services/agents/placeAnalysisAgent.ts`.
- **Free tier**: ~15 req/min, ~1500 req/day. On-demand call hota hai (sirf jab koi place khulta hai), isliye limit safe.

### Groq (`groq-sdk ^0.5.0`)
- **Kya hai**: Llama models ko apne custom hardware (LPU) pe host karta — **bahut tez** (500+ tokens/sec).
- **Kyun chuna**: Free tier; near real-time text (~200-400 ms).
- **Kya karta hai**:
  - `llama-3.1-8b-instant` — caption generation (fast/sasta).
  - `llama-3.3-70b-versatile` — recommendations, review se accessibility hints.
- **Kahan**: `services/agents/captionAgent.ts`, `recommendationAgent.ts`, `placeAnalysisAgent.ts` (reviews → per-category hints).

> **Sab AI calls `try/catch` me** hain + safe fallback (rule). AI fail ho to app crash nahi, "Not assessed" / default dikhata hai. AI ka output **English** me (Hinglish nahi) — yeh user ne explicitly maanga tha.

---

## 8. Maps & Location

### react-native-maps (`1.20.1`) + Google Maps
- **Kya hai**: Native MapView wrapper. `PROVIDER_GOOGLE` se Google tiles.
- **Kyun chuna**: Markers, regions, native gestures; Indian users ko Google Maps familiar.
- **Khaas (web fix)**: react-native-maps web pe crash karta hai, isliye **platform split**:
  - `components/design/NativeMap.tsx` — native (Android/iOS).
  - `components/design/NativeMap.web.tsx` — web fallback. Metro automatically `.web.tsx` web ke liye picks karta.
- **Kahan**: `app/(tabs)/explore.tsx`.

### Google Maps Web Services (REST, key se) — `services/googleMaps.ts`
- **Kya karta hai** (sirf is file se):
  - `getNearbyAttractions(center, radius)` — curated types (`tourist_attraction`, `restaurant`, `cafe`, `park`, `museum`, ...) ke around-me places. **Generic search hata diya** kyunki usse societies/random jagah aa rahi thi. `EXCLUDED_TYPES` filter + distance sort + cap 40.
  - `getPlaceDetails(id)` — naam, photos, aur **real reviews** (`GoogleReview[]`).
  - `nearbyToPlace(...)` — Google response ko app ke `Place` type me convert.
- **Free tier**: Google Cloud **$200/month free credit** — MVP ke liye bahut.

### expo-location (`~19.0.8`)
- **Kya karta hai**: User ki GPS location + **reverse geocoding** (lat/lng → "Sector 99A, Gurugram"). Key-free (`reverseGeocodeAsync`).
- **Kahan**: `hooks/useLiveLocation.ts` → `{ location, city, area, label, status }`. Header me `label` dikhta hai, explore screen isi center se nearby laata hai.

---

## 9. Media & visuals

| Tool | Version | Kya karta hai | Kahan |
| --- | --- | --- | --- |
| **expo-camera** | ~17.0.10 | Photo capture (`CameraView`) | `app/(tabs)/camera.tsx` |
| **expo-image-picker** | ~17.0.11 | Gallery se existing photo | `app/(tabs)/camera.tsx` |
| **expo-image-manipulator** | ~14.0.8 | Vision API bhejne se pehle photo resize/compress → **base64** | `services/agents/placeAnalysisAgent.ts` |
| **expo-linear-gradient** | ~15.0.8 | Aurora gradient backgrounds/buttons | login, profile, rewards, camera, MeshPhoto |
| **@expo/vector-icons** | ^15.0.2 | Icon set (Ionicons, MaterialCommunityIcons) | har screen |

---

## 10. Local storage

### @react-native-async-storage/async-storage (`^2.2.0`)
- **Kya karta hai**: Simple persistent key-value (SQLite-backed). Recent searches + Firebase Auth persistence.
- **Kahan**: `services/firebase.ts` (auth persistence), search screen.

### expo-secure-store (`~15.0.8`)
- **Kya karta hai**: **Encrypted** key-value (Keychain/Keystore). Sensitive/preference data.
- **Kahan**: `hooks/useTheme.ts` — dark/light theme `discova.theme` key me persist.
- **Async-storage vs secure-store**: non-sensitive (searches) → AsyncStorage; small/sensitive (theme/token-ish) → SecureStore.

---

## 11. Language, build & dev tooling

### TypeScript strict (`typescript ~5.9.2`)
- **Kya karta hai**: JS + types. Compile-time errors, autocomplete, AI ke JSON output ko type guards se coerce.
- **Rule**: `any` **ban**, strict mode on (`tsconfig.json`). Har function pe JSDoc.
- **Check command**: `npx tsc --noEmit`.

### Metro (`metro.config.js`)
- **Kya hai**: React Native ka bundler (Webpack jaisa).
- **Khaas config (Firebase fix)**: Firebase v10 default me apna **browser** build deta tha → *"Component auth has not been registered"*. Fix: `unstable_enablePackageExports = true` + `unstable_conditionNames = ['react-native','require','default']` (browser condition hata di) + `sourceExts` me `'cjs'`.
- **Note**: Yeh project OneDrive me hai; OneDrive `node_modules` ko "online-only" bana deta hai (reparse points), Metro unko skip karta → *"module could not be found"*. Fix: `node_modules` delete + `npm install`, ya OneDrive me folder "Always keep on this device".

### Babel (`babel-preset-expo ~54.0.10`, `babel.config.js`)
- **Kya karta hai**: Modern JS/TS + JSX ko transpile; NativeWind + Reanimated/worklets plugins yahan wire hote hain.

### EAS + eas-cli (cloud build) → poora detail `BUILD_DEPLOY.md` me
- **Kya hai**: Expo ka cloud build service. APK/AAB cloud me banata (local Android SDK/Java nahi chahiye).
- **Kahan**: `eas.json` (build profiles), `app.json` → `extra.eas.projectId`.

---

## 12. Quick command cheatsheet

```bash
# Dev server (Expo Go / dev)
npx expo start              # phir 'a' android, 'w' web, 'r' reload
npx expo start --clear      # cache clear karke

# Type check
npx tsc --noEmit

# Bundle test (Metro chalu hona chahiye)
curl "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false"

# Clean reinstall (OneDrive/Metro dikkat pe)
rm -rf node_modules && npm install --legacy-peer-deps

# APK banane ke liye (detail BUILD_DEPLOY.md)
eas build -p android --profile preview
```

---

## 13. Total cost (free tier me) = ₹0

| Service | Free tier | Cost |
| --- | --- | --- |
| Expo Go + EAS Build | 30 builds/month | ₹0 |
| Firebase Spark | 50K reads, 20K writes/day | ₹0 |
| Gemini 2.5 Flash | ~1500 req/day | ₹0 |
| Groq | free tier RPM/TPM | ₹0 |
| Google Maps | $200 credit/month | ₹0 |

MVP traffic chhota hai jab tak — **pura ₹0** me chalta hai. Scale pe Firebase + Maps charge honge.
