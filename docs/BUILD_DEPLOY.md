# BUILD & DEPLOY — APK kaise banta hai, aur change ke baad kya karna

Yeh doc 3 sawaalon ka jawaab deta hai:
1. APK kaise banta hai (EAS cloud build)?
2. Build me kitna time lagta hai?
3. **Agar kuch add/fix karein to dobara APK banana padega ya nahi?** ← sabse important

---

## A. APK kyun cloud me banta hai (local me nahi)

Local me APK banane ke liye **Android SDK + Java (JDK) + Android Studio** chahiye — is machine pe install nahi (ghante lagte setup me). Isliye **EAS Build** use karte hain: code Expo ke server pe jaata hai, wahan APK banta hai, ek download link milta hai. Local pe kuch install nahi karna.

### One-time setup (ho chuka hai)
- `eas-cli` global install.
- `app.json` me `android.package = "com.discova.app"` + `versionCode`.
- `eas.json` me build profiles + saari `EXPO_PUBLIC_*` keys (taaki cloud build me Firebase/Maps/AI chale).
- `eas init` → project link, `extra.eas.projectId` app.json me likh diya.
- Android **keystore** EAS ne cloud me auto-generate kiya (app signing ke liye — ise dubara generate mat karna, warna update install nahi hoga).

### Build profiles (`eas.json`)
| Profile | Output | Kab |
| --- | --- | --- |
| `development` | dev-client APK | native debugging |
| `preview` | **APK** (direct install) | **phone pe test** — yeh use karte hain |
| `production` | AAB (app bundle) | Play Store submit |

### Build command
```bash
eas build -p android --profile preview
```
(Hamare case me `EXPO_TOKEN` se non-interactive chala.)

---

## B. Time kitna lagta hai

| Step | Time |
| --- | --- |
| Keystore + upload + fingerprint | ~1 min |
| **Free tier queue** (server free hone ka wait) | 1–20 min (variable) |
| Actual gradle build | ~8–15 min |
| **Total** | **~10–30 min** |

Free plan pe queue ka time variable hai (busy ho to zyada). Build status live:
`https://expo.dev/accounts/abhinavai9900/projects/Discova/builds`

Build ho jaane par usi page pe **Download** + **QR code** — QR scan se phone me APK aata hai. Install ke time "unknown sources / install from this source" allow karna.

---

## C. Change ke baad dobara build? — ASLI JAWAAB

Yeh depend karta hai ki change **kis type** ka hai. Do tarah ke changes:

### 1. JS/TS-only change → **rebuild ki ZAROORAT NAHI (agar OTA setup ho)**
Inme se kuch bhi badlo to **native code nahi badalta**:
- UI / screens / components ka design
- Business logic, Zustand stores, hooks
- AI prompts, agents, services ka logic
- Text, colors (className), naye screens add karna (jaise Settings page)

**Iske 2 raaste:**

**(i) Dev me test** (sabse fast, daily kaam) — APK ki zaroorat hi nahi:
```bash
npx expo start
```
Phone pe Expo Go / dev-build me reload — change turant dikhta hai. **Daily development isi tarah karo, har baar APK mat banao.**

**(ii) Installed APK ko update karna (OTA / EAS Update)** — bina naya APK bheje:
> Abhi **`expo-updates` install nahi hai** (build log me warning aaya tha). Iske bina installed APK ko update karne ka **ek hi tareeka hai: naya APK banao**. Agar OTA chahiye to ek baar yeh setup karo:
```bash
npx expo install expo-updates
eas update:configure
# phir har JS change ke baad:
eas update --branch preview --message "kya badla"
```
Iske baad installed APK agli baar khulte hi naya JS download kar lega (~1 min, full rebuild nahi). **Native cheez badle to phir bhi rebuild.**

### 2. Native change → **rebuild ZAROORI (naya APK)**
Inme se kuch bhi karo to **naya APK** banana hi padega (OTA kaafi nahi):
- Nayi native library add karna (e.g. naya `expo-*` module, ya koi native package)
- `app.json` ka native config — permissions, app name, **icon**, splash, scheme
- Naye API key jo `eas.json`/native config me hain
- **Expo SDK upgrade** ya React Native version change
- `versionCode` / version bump for Play Store

**Rebuild se pehle** `app.json` me `android.versionCode` 1 badhao (1 → 2 → 3...), warna Play Store reject karega (phone pe direct install ke liye optional, par best practice).

---

## D. Decision table (yaad rakhne layak)

| Maine kya badla | Dev test | Installed app update | Naya APK? |
| --- | --- | --- | --- |
| Screen UI / text / color | `expo start` | OTA (`eas update`)* | Nahi* |
| Naya screen / logic / AI prompt | `expo start` | OTA (`eas update`)* | Nahi* |
| Bug fix (JS) | `expo start` | OTA (`eas update`)* | Nahi* |
| Nayi native library | rebuild | — | **Haan** |
| Permission / icon / app.json native | rebuild | — | **Haan** |
| SDK / React Native upgrade | rebuild | — | **Haan** |

\* sirf tab jab `expo-updates` setup ho. Abhi setup nahi → har change pe APK banana padega, ya `expo start` se test karo.

---

## E. Recommended workflow (DISCOVA ke liye)

1. **Roz ka kaam**: `npx expo start` + phone reload. APK bilkul mat banao.
2. **Kisi ko app share karni ho / offline test**: `eas build -p android --profile preview` → APK bhejo.
3. **Bar-bar updates push karne ho bina APK bheje**: ek baar `expo-updates` setup kar lo, phir `eas update`.
4. **Play Store pe daalna ho**: `production` profile → AAB → `eas submit -p android`.

---

## F. Common issues

| Problem | Fix |
| --- | --- |
| Build fail: keys missing | `eas.json` ke profile `env` me saari `EXPO_PUBLIC_*` honi chahiye |
| App khulte hi Firebase/login fail | Firebase Console → Auth me Email/Password + Anonymous enable karo |
| "Install blocked" phone pe | Settings → unknown sources / "is source se install" allow |
| Naya APK install nahi ho raha (purana hai) | same keystore + `versionCode` badha hua hona chahiye |
| OneDrive `node_modules` Metro error | `rm -rf node_modules && npm install`, ya folder "Always keep on this device" |
