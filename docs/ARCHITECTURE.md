# Architecture

Discova ek **multi-agent system** hai. Matlab — ek hi AI nahi karta sab kaam. Alag-alag specialized agents alag-alag kaam karte hain, aur ek **orchestrator** unko coordinate karta hai.

Kyun? Kyunki ek model sab nahi kar sakta. Vision (photo dekhna) ke liye Gemini best hai. Text generation (caption) ke liye Groq fastest hai. Scoring ka kaam math hai — AI ki zaroorat nahi. Gamification rules-based hai — fixed logic.

Toh humne kaam baant diye.

---

## 5 Agents ka overview

| Agent | Type | Model | Kaam |
| --- | --- | --- | --- |
| **VisionAgent** | AI | Gemini 2.5 Flash | Photo dekh ke ramp / lift / stairs / etc. detect karta hai |
| **CaptionAgent** | AI | Groq Llama 3.1 8B | Photo info + vision output se Instagram-style caption banata hai |
| **RecommendationAgent** | AI | Groq Llama 3.3 70B | User ke disability ke hisaab se top 3 places recommend karta hai (reasons English me) |
| **PlaceAnalysisAgent** | AI | Gemini 2.5 + Groq | Place ki photos (vision) + Google reviews (text) blend karke per-category accessibility score |
| **ScoringAgent** | Pure math | Koi nahi | Multiple analyses ko weighted average karke place ka final score nikalta hai |
| **GamificationAgent** | Rules | Koi nahi | Coins calculate karta hai, badges check karta hai, multipliers apply karta hai |

Plus ek **Orchestrator** jo coordinator hai — koi AI use nahi karta, bas in 5 agents ko sahi order mein call karta hai.

---

## Orchestrator kya hai?

Sochiye ek **manager** ki tarah jiska kaam hai sirf coordinate karna. Khud kuch nahi karta. Bas sahi agent ko sahi time pe call karta hai aur output collect karta hai.

Code mein `services/agents/orchestrator.ts` mein rehta hai. Iska main function hai `handlePostCreation(input)` — yahi ek call karte hi pura pipeline chal jata hai:

1. Photo upload
2. Vision agent ko bhejo
3. Caption agent ko bhejo
4. Manual checklist merge karo
5. Post save karo Firebase mein
6. Score update karo
7. Coins do user ko
8. Result return karo

---

## Data flow diagram (ASCII)

```
                    ┌─────────────────────────┐
                    │   User taps Share       │
                    │   (camera screen)       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     ORCHESTRATOR        │
                    │  (no AI, just routes)   │
                    └────────────┬────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │ (parallel)         │                    │
            ▼                    ▼                    │
    ┌───────────────┐   ┌────────────────┐            │
    │  uploadMedia  │   │  VisionAgent   │            │
    │  → Storage    │   │  → Gemini      │            │
    └───────┬───────┘   └────────┬───────┘            │
            │                    │                    │
            └─────┬──────────────┘                    │
                  │ (both done)                       │
                  ▼                                   │
         ┌──────────────────┐                         │
         │  CaptionAgent    │                         │
         │  → Groq          │                         │
         └────────┬─────────┘                         │
                  │                                   │
                  ▼                                   │
         ┌──────────────────┐                         │
         │  Merge AI + user │                         │
         │  manual flags    │                         │
         └────────┬─────────┘                         │
                  │                                   │
                  ▼                                   │
         ┌──────────────────┐                         │
         │  createPost      │                         │
         │  → Firestore     │                         │
         └────────┬─────────┘                         │
                  │                                   │
                  ▼                                   │
         ┌──────────────────┐                         │
         │ ScoringAgent     │                         │
         │ (math only)      │                         │
         │ → updatePlace    │                         │
         └────────┬─────────┘                         │
                  │                                   │
                  ▼                                   │
         ┌──────────────────┐                         │
         │ GamificationAgent│                         │
         │ (rules only)     │                         │
         │ → addCoins       │                         │
         │ → checkBadges    │                         │
         └────────┬─────────┘                         │
                  │                                   │
                  ▼                                   │
         ┌──────────────────┐                         │
         │  PostCreation-   │ ◄───────────────────────┘
         │  Result          │
         └──────────────────┘
                  │
                  ▼
            UI shows
       success + coins + badges
```

---

## Layer separation — kaun kisko call kar sakta hai

```
┌─────────────────────────────────────────────┐
│   Screens (app/)                            │
│   - app/(tabs)/index.tsx                    │
│   - app/place/[id].tsx                      │
│   - etc.                                    │
└────────────┬────────────────────────────────┘
             │
             │ allowed: stores + components + hooks + orchestrator
             ▼
┌─────────────────────────────────────────────┐
│   Stores (stores/)                          │
│   - userStore                               │
│   - appStore                                │
│   - visitStore                              │
└────────────┬────────────────────────────────┘
             │
             │ allowed: services/firebase only
             ▼
┌─────────────────────────────────────────────┐
│   Services + Agents (services/)             │
│   - firebase.ts (all Firestore/Auth/Storage)│
│   - agents/orchestrator.ts                  │
│   - agents/visionAgent, captionAgent, etc.  │
└────────────┬────────────────────────────────┘
             │
             ▼
        External APIs:
        Firebase / Gemini / Groq / Google Maps
```

**Rule of thumb**: ek screen kabhi seedha `firebase` SDK ko import nahi karega. Hamesha `services/firebase.ts` ka helper use karega. Same way, koi screen seedha Gemini ko nahi call karega — bas orchestrator ya agent ko call karega.

Yeh boundary tight rakhne ka faayda: kal Firebase ki jagah Supabase use karna ho, ya Gemini ki jagah OpenAI use karna ho, toh bas ek file change karni padegi. Screens untouched.

---

## Error handling philosophy

AI agents **kabhi throw nahi karte**. Har agent apne aap mein try/catch karke ek safe default return karta hai. Reason — AI APIs unreliable hote hain (network, rate limit, JSON parse fail). Agar har failure user ko dikhane lage toh app unusable ho jayegi.

Toh:
- VisionAgent fail ho gaya → `safeDefault()` AIAnalysis return karta hai (sab false, 0 score)
- CaptionAgent fail ho gaya → generic fallback caption ("worth the stop ✨")
- RecommendationAgent fail ho gaya → deterministic score-sorted list

Sirf **Firebase calls** (storage / firestore) throw karte hain — kyunki yeh recoverable hote hain (retry button dikha do).

---

## Future agents (abhi nahi banaye)

Yeh ideas hain jo future mein add ho sakte hain:

- **ModerationAgent** — gaali / spam check captions ko publish karne se pehle
- **TranslationAgent** — captions ko regional languages mein convert
- **SafetyAgent** — gender-based safety analysis ka score
- **TourAgent** — multi-place itinerary planning

Pipeline mein add karne ka pattern same rahega: agent ko `services/agents/` mein add karo, orchestrator mein call karo.
