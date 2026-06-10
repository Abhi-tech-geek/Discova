# AI Agents

Discova mein **5 agents** hain + 1 orchestrator. Yahan har ek ka full spec hai.

> Quick recap: ek "agent" matlab ek module jiska scope chhota hai aur jo ek specific kaam karta hai. AI ho ya math — koi farak nahi padta. Important yeh hai ki **boundary clear ho**.

---

## 1. VisionAgent

| Field | Value |
| --- | --- |
| **Naam** | `AccessibilityVisionAgent` |
| **File** | `services/agents/visionAgent.ts` |
| **Model** | Google Gemini 2.5 Flash (`gemini-2.5-flash`) — 1.5 deprecated ho gaya tha |
| **Type** | AI |
| **Input** | `base64Image: string` (raw base64 of one photo) |
| **Output** | `AIAnalysis` object — sab booleans + 3 scores + features + summary |
| **Purpose** | Photo dekh ke accessibility features detect karna (ramp, lift, stairs, wide doors, etc.) |
| **Kisko report karta hai** | Orchestrator (kabhi seedha screen ko nahi) |
| **Data kahan jaata hai** | Wapas orchestrator ko. Orchestrator usko CaptionAgent ko pass karta hai aur ScoringAgent + Firestore ko bhi |

**Kaam karne ka tareeka**:

1. Image se data URL prefix strip karo (`data:image/jpeg;base64,...`)
2. Gemini ko prompt + image bhejo
3. Response text ko fence-strip karo (Gemini kabhi-kabhi ```json``` wrap karta hai)
4. JSON.parse — fail ho gaya toh safe default return
5. Har field ko coerce karo (`toBool`, `toNumber(min, max)`, etc.) — LLM kuch bhi shape bheje toh bhi strict TypeScript shape mein convert ho jaye

**Safe default**: sab booleans false, scores 0, summary "Analysis unavailable.", confidence 0. **Kabhi throw nahi karta.**

---

## 2. CaptionAgent

| Field | Value |
| --- | --- |
| **Naam** | `CaptionGeneratorAgent` |
| **File** | `services/agents/captionAgent.ts` |
| **Model** | Groq Llama 3.1 8B Instant (`llama-3.1-8b-instant`) |
| **Type** | AI |
| **Input** | `analysis: AIAnalysis`, `placeName: string`, `placeType: string` |
| **Output** | `CaptionOutput` — `{ caption, vibeTags, hashtags, emojis, accessibilityTags }` |
| **Purpose** | Vision output + place info se ek punchy social-media caption banana |
| **Kisko report karta hai** | Orchestrator |
| **Data kahan jaata hai** | Post document mein save hota hai (`aiCaption` field). User chahe to manual caption se override kare. |

**Kyun Groq?** Llama 8B-instant 500+ tokens/sec deta hai. Caption generation bohot fast hota hai — user ko 1-2 second mein response mil jaata hai.

**Output hardening**:
- Caption 80 chars se zyada ho gaya toh truncate
- Vibe tags ko fixed 12-entry allow-list ke against filter karte hain (`chill / cozy / lively / ...`)
- Accessibility tags `DisabilityType` union ke against filter
- Hashtags ko normalize — `#` prepend, whitespace remove, max 5
- LLM kuch bhi return kare, output strict TypeScript shape mein hi nikalta hai

**Safe default**: generic caption like "{placeName} — worth the stop ✨" + 5 generic hashtags + emoji set.

---

## 3. RecommendationAgent

| Field | Value |
| --- | --- |
| **Naam** | `RecommendationAgent` |
| **File** | `services/agents/recommendationAgent.ts` |
| **Model** | Groq Llama 3.3 70B Versatile (`llama-3.3-70b-versatile`) |
| **Type** | AI |
| **Input** | `disabilityType: DisabilityType`, `places: Place[]` |
| **Output** | `RecommendationOutput` — top 3 recommendations with **Hinglish reasons** |
| **Purpose** | User ke disability profile ke hisaab se best 3 places pick karna |
| **Kisko report karta hai** | Screen seedha (not orchestrator) — Explore tab ke "Recommended for you" section ke liye |
| **Data kahan jaata hai** | UI mein dikhaata hai. Persist nahi karta. |

**Kyun 70B model?** Recommendation mein nuance chahiye — small model context lose karta hai jab 10-20 places ki accessibility scores ek saath compare karne ho. 70B better reasoning.

**Hinglish reason example**: "Yahan ramp hai aur wide entrance bhi hai, perfect hai aapke liye."

**Safety**: LLM kabhi-kabhi non-existent place IDs invent karta hai. Output build karte time hum **input set ke against placeId verify** karte hain. Jo place input mein nahi, woh recommendation drop ho jaati hai.

**Safe default**: Agar AI fail ho gaya, deterministic score-sorted top 3 places return karte hain — har ek ka reason "Achha accessibility score hai yahan."

---

## 4. ScoringAgent

| Field | Value |
| --- | --- |
| **Naam** | `AccessibilityScoringAgent` |
| **File** | `services/agents/scoringAgent.ts` |
| **Model** | **Koi nahi — pure TypeScript math** |
| **Type** | Pure functions, no AI |
| **Input** | `placeId: string`, `analyses: AIAnalysis[]` (saari vision outputs ek place ke liye) |
| **Output** | Updated `AccessibilityScores` (overall, mobility, visual, hearing, cognitive, sensory) |
| **Purpose** | Multiple vision analyses ko weighted average karke ek place ka final score nikalna |
| **Kisko report karta hai** | Orchestrator |
| **Data kahan jaata hai** | Firestore `places/{placeId}.accessibilityScores` field update hota hai |

**Algorithm**:

1. **Recency weight** — last 7 days ke analyses ko weight 1.0, older ko 0.5. Reason: places change karte rehte hain (new ramp install, accessible parking add, etc.)
2. **Per-category extraction**:
   - `overall` = weighted avg of `analysis.accessibilityScore`
   - `mobility` = weighted avg of `analysis.wheelchairScore`
   - `visual` = weighted avg of `analysis.visualScore`
   - `hearing`, `cognitive`, `sensory` = heuristic functions (presence of sign language / quiet zone / etc.)
3. Clamp har score ko `[0, 100]` mein

**Kyun no AI?** Math reliable hai, fast hai, deterministic hai. LLM ko scoring karna detha toh kabhi 6 deta kabhi 8 deta — chaos.

---

## 5. GamificationAgent

| Field | Value |
| --- | --- |
| **Naam** | `GamificationAgent` |
| **File** | `services/agents/gamificationAgent.ts` |
| **Model** | **Koi nahi — pure TypeScript rules** |
| **Type** | Rule-based, no AI |
| **Input** | `user: User`, `action: CoinTransactionAction` |
| **Output** | Coins awarded (number), and (separately) list of newly-earned badges |
| **Purpose** | Coins calculate + award karna; badge eligibility check karna |
| **Kisko report karta hai** | Orchestrator |
| **Data kahan jaata hai** | `users/{uid}.coins` increment hota hai, `coinTransactions/{id}` mein ledger row likha jaata hai |

**Coin formula**:

```
final_coins = base_coins[action] × pwd_multiplier × streak_multiplier
            = base × (pwdMode ? 2 : 1) × (streak >= 21 ? 1.5 : 1)
            then Math.floor()
```

**Base table** (`COINS_TABLE` in code):
- `post_created`: 10 coins
- `review_created`: 20 coins
- `place_added`: 50 coins
- `badge_earned`: 100 coins
- `daily_bonus`: 5 coins
- `level_up`: 25 coins
- `reward_redeemed`: 0 (yeh outflow hai, alag handle hota hai)
- `adjustment`: 0 (manual admin adjustments)

**Badge catalog** mein 8 badges hain (first_post, helpful_voice, explorer_10, trailblazer_50, pioneer_5, streak_21, streak_100, inclusive_ally). `checkBadgeEarned(user)` pure function hai — sirf eligible badges return karta hai, persist khud nahi karta. Caller (orchestrator / profile screen) decide karta hai kab award karna hai.

---

## Orchestrator

| Field | Value |
| --- | --- |
| **Naam** | `AgentOrchestrator` |
| **File** | `services/agents/orchestrator.ts` |
| **Model** | **Koi nahi — pure TypeScript controller** |
| **Type** | Coordinator |
| **Input** | `PostCreationInput` — user + place + image + manual checklist + caption |
| **Output** | `PostCreationResult` — postId + imageUrl + analysis + caption + coins + new badges |
| **Purpose** | Saare agents ko sahi order mein call karna, parallel jahan possible ho, results merge karna |
| **Kisko report karta hai** | Screen (camera screen ka step 3) |
| **Data kahan jaata hai** | Saara persistence orchestrator se hi trigger hota hai — Storage, Firestore posts, places, coinTransactions sab. |

Pure 8-step pipeline — detail `DATA_FLOW.md` mein hai.

---

## Boundary recap

| Layer | Kisko call kar sakta hai |
| --- | --- |
| Screens | `services/agents/orchestrator` + `services/firebase` (read-only operations like fetchHomeFeed) + stores |
| Stores | Stores apne mein contained — koi Firebase nahi call karte directly. Mutations screen se trigger hote hain |
| Orchestrator | Saare 5 agents + `services/firebase` |
| Each agent | External API (Gemini / Groq) + nothing else; firebase.updatePlaceScores ka ek call sirf scoring agent karta hai, addCoinsToUser ka call sirf gamification agent karta hai |
| Firebase service | Firebase SDK only |

Yeh boundary tight hone se ek faayda yeh hai — kal koi naya agent add karna ho toh sirf ek file likhni hai aur orchestrator mein register karna hai. Saare screens untouched.
