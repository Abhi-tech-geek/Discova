# Data Flow

User ne camera khola se le ke database update hone tak — **exactly kya-kya hota hai** step-by-step. Yeh full happy path hai post creation ka.

> Code reference: `app/(tabs)/camera.tsx` + `services/agents/orchestrator.ts`

---

## Step-by-step (16 steps)

### Step 1 — User camera tab kholta hai

User bottom nav mein **camera button** tap karta hai (woh raised blue circle).

- Screen: `app/(tabs)/camera.tsx`
- State: `step = 1`
- Subcomponent: `Step1Capture`

`useCameraPermissions()` hook check karta hai permission. Pehli baar hai toh `requestPermission()` auto-fire hoti hai.

---

### Step 2 — User photo capture karta hai

User capture button tap karta hai.

- `cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true })` chalti hai
- Result: `{ uri: 'file:///path/to/temp.jpg', width, height }`
- `setDraft({ imageUri: uri, ...defaults })` → step 2 pe move

> Alternatively user gallery se pick karta hai (`expo-image-picker`) — same result, just different source.

---

### Step 3 — User edit screen pe aata hai

- Screen: `Step2Edit`
- Photo preview top mein (`aspect-square`)
- Caption text input
- 4 accessibility toggles
- Hashtag suggestions
- Feed/Story selector
- Auto-detect location starts running in background

---

### Step 4 — Location auto-detect chalti hai

`useEffect` mount pe fire hota hai:

```typescript
const { status } = await Location.requestForegroundPermissionsAsync();
if (status === 'granted') {
  const loc = await Location.getCurrentPositionAsync({});
  const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
  setLocation({ name: top?.name ?? 'Current location', latitude, longitude });
}
```

Spinner UI mein dikhta hai jab tak resolve nahi hota. Permission deny ho gayi toh "Location unavailable" dikhta hai.

---

### Step 5 — User caption likhta hai aur toggles set karta hai

User free-form caption type karta hai. Manual checklist mein flags toggle karta hai (ramp / lift / wide entrance / accessible restroom — kya woh wahan dekha tha).

Yeh values local component state mein store ho rahi hain — abhi tak kuch persist nahi hua hai.

---

### Step 6 — User "Share post" tap karta hai

- Caption sanitize hoti hai via `utils/sanitize.ts` (`sanitizeInput(caption, 500)`)
- Manual checklist + share-to + location packaged ho jaate hain
- `setStep(3)` → AI processing screen show hoti hai

---

### Step 7 — Orchestrator pipeline shuru hoti hai (Step3Processing component)

`useEffect` mount pe fire:

```typescript
await orchestrator.handlePostCreation({
  user,
  placeId: `place_${lat.toFixed(4)}_${lng.toFixed(4)}`,
  placeName: location.name,
  placeType: 'general',
  imageUri,
  imageBase64,
  manualCaption,
  manualChecklist,
});
```

Status messages cycling start hote hain — "Analyzing your photo…" → "Detecting accessibility features…" → etc. — har 1.5s pe rotate.

---

### Step 8 — Image manipulator chalti hai

Orchestrator se pehle (actually Step 7 mein hi pehla operation):

```typescript
const manipulated = await ImageManipulator.manipulateAsync(
  imageUri,
  [{ resize: { width: 1024 } }],
  { compress: 0.8, format: SaveFormat.JPEG, base64: true }
);
```

Original phone photo 4-12 MB hoti hai. Resize karke 1024px width pe + JPEG 80% compress karne se size 100-500 KB rah jaati hai. Saath mein base64 string bhi mil jaati hai vision API ke liye.

---

### Step 9 — Parallel: Upload + Vision (Promise.all)

Orchestrator mein:

```typescript
const [imageUrl, aiAnalysis] = await Promise.all([
  uploadMedia(imageUri, `posts/${user.uid}/${placeId}/${ts}.jpg`, onProgress),
  visionAgent.analyze(imageBase64),
]);
```

- **Upload track**: `fetch(uri).blob()` → `uploadBytesResumable(ref, blob)` → progress callback fires → `getDownloadURL()`. Storage path: `posts/{uid}/{placeId}/{timestamp}.jpg`. Result: public download URL.
- **Vision track**: Gemini 2.5 Flash API call hota hai prompt + inline base64 image ke saath. Response text parse hoti hai, JSON.parse, fields coerce hote hain. Result: `AIAnalysis` object.

Dono parallel chalte hain kyunki dependency nahi ek doosre pe. Saving ~1-2 seconds.

---

### Step 10 — Caption agent chalti hai

```typescript
const captionOutput = await captionAgent.generate(aiAnalysis, placeName, placeType);
```

Groq Llama 8B-instant call hota hai system + user prompts ke saath. Response (~300 ms) — JSON parse, fence strip, filter against allow-lists. Result: `CaptionOutput`.

---

### Step 11 — Merge: AI + manual checklist

```typescript
const mergedAnalysis = mergeAnalysis(aiAnalysis, manualChecklist);
```

User ne manually jo flags toggle kiye unko AI ke flags ke upar overlay karte hain. `manualChecklist.hasRamp ?? aiAnalysis.hasRamp` pattern — user is source of truth jab user ne explicitly verify kiya ho.

---

### Step 12 — Decide final caption + accessibility tags

```typescript
const finalCaption = manualCaption.length > 0 ? manualCaption : captionOutput.caption;
const accessibilityTags = captionOutput.accessibilityTags.length > 0
  ? captionOutput.accessibilityTags
  : deriveAccessibilityTags(mergedAnalysis);
```

User ne caption likha hai toh wahi use karte hain. Empty hai toh AI ka caption use karte hain. Accessibility tags AI se aaye toh wahi, otherwise heuristic se derive — e.g. ramp + lift detected → `['mobility']` tag.

---

### Step 13 — Post Firestore mein save

```typescript
const postId = await createPost({
  userId: user.uid,
  userDisplayName: user.displayName,
  userPhotoURL: user.photoURL,
  placeId,
  placeName,
  imageUrl,           // step 9 ka download URL
  caption: finalCaption,
  aiCaption: captionOutput.caption,
  accessibilityTags,
  isAccessible: accessibilityTags.length > 0,
  accessibilityScore: mergedAnalysis.accessibilityScore / 10,
});
```

Firestore mein `posts/{auto-id}` ke under document create hota hai. `likes`, `commentsCount` 0 set hote hain, `createdAt: serverTimestamp()`.

`postId` return hota hai — yeh wahi id hai jo home feed mein dikhega.

---

### Step 14 — Place score update

```typescript
await scoringAgent.updatePlaceScore(placeId, [mergedAnalysis]);
```

Scoring agent recency weight calculate karta hai, weighted average lagata hai, `clamp100` karta hai har category pe — fresh `AccessibilityScores` block banta hai. Phir `firebase.updatePlaceScores(placeId, scores)` call hoti hai jo Firestore mein `places/{placeId}.accessibilityScores` field update karta hai + `updatedAt: serverTimestamp()` bhi.

> Note: full re-score ke liye ideally **saari analyses fetch karke pass karni chahiye** scoring agent ko. Yeh server-side cron job ka kaam hai. Post-creation hot path mein sirf naye analysis ke saath update karte hain — quick + cheap.

---

### Step 15 — Coins award + transaction log

```typescript
const coinsAwarded = await gamificationAgent.awardCoins(user, 'post_created');
```

Internally:

1. `calculateCoins(user, 'post_created')`:
   - base = 10
   - × 2 if `user.pwdMode`
   - × 1.5 if `user.streak >= 21`
   - `Math.floor()`
2. `firebase.addCoinsToUser(uid, amount, 'post_created')` — yeh atomically:
   - `users/{uid}.coins` mein `increment(amount)` lagata hai
   - `coinTransactions/{auto-id}` mein ek ledger row likhta hai (`userId`, `amount`, `action`, `createdAt`)

---

### Step 16 — Badge eligibility check + success state

```typescript
const projectedUser = {
  ...user,
  coins: user.coins + coinsAwarded,
  stats: { ...user.stats, postsCount: user.stats.postsCount + 1 },
};
const newBadges = gamificationAgent.checkBadgeEarned(projectedUser);
```

User ki stats optimistically bump karte hain (`postsCount + 1`) kyunki Firebase round-trip se pehle hi user ko "First Steps" badge dikhana hai jab pehla post share kare. Pure function — just checks predicates, doesn't persist.

Return value to UI:

```typescript
{
  postId,
  imageUrl,
  analysis: mergedAnalysis,
  caption: captionOutput,
  coinsAwarded,
  newBadges,
}
```

Camera screen ka `SuccessView` ye render karta hai — checkmark spring animation + "+N coins earned" + detected features chips (staggered animation) + new badge cards (agar koi qualify hua).

Zustand mein bhi `updateCoins(coinsAwarded)` fire hota hai — user ka balance turant update ho jaata hai sab screens pe (profile, header badges, etc.) bina Firebase re-fetch ke.

---

## Net result

Ek "Share" tap se yeh sab cheezein update hoti hain (1 user action → 7 distinct writes):

| Destination | What changed |
| --- | --- |
| Firebase Storage | New image file at `posts/{uid}/{placeId}/{ts}.jpg` |
| `posts/{id}` doc | New post created |
| `places/{placeId}.accessibilityScores` | Updated scores (all 6 categories) |
| `places/{placeId}.updatedAt` | Bumped to `serverTimestamp()` |
| `users/{uid}.coins` | Incremented by `coinsAwarded` |
| `coinTransactions/{id}` | New ledger row |
| Zustand `userStore.user.coins` | Mirror of coin balance for instant UI |

Saara flow typically **2-4 seconds** mein complete ho jaata hai depending on network. Most time vision API + upload mein jaata hai. Caption agent ~200-400 ms add karta hai. Baaki sab milliseconds.

---

## Failure modes — kya ho sakta hai galat

| Step | Failure | Behaviour |
| --- | --- | --- |
| 4 | Location permission denied | Continue — place_temp_{ts} placeId, "Location unavailable" UI |
| 8 | ImageManipulator throws | Outer try/catch catches; user-friendly error shown |
| 9 (upload) | Storage upload fails | Orchestrator throws; UI shows "Could not post right now" |
| 9 (vision) | Gemini API fails / timeout | Vision agent returns safe default — pipeline continues with empty analysis |
| 10 | Caption agent fails | Returns generic fallback caption — pipeline continues |
| 13 | createPost fails | Orchestrator throws; UI shows error + retry |
| 14 | updatePlaceScores fails | Throws — but post already saved. Edge case: orphaned post without score update |
| 15 | addCoinsToUser fails | Throws — post saved but no coins. Edge case: needs reconciliation cron job in production |

Production mein **Step 14 + 15 ko sequential se eventual-consistent banana chahiye** (queue + retry). Current MVP mein direct calls — acceptable for prototype.
