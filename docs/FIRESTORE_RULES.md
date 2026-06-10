# Firestore Security Rules

Firebase ka security model **default deny** hai. Matlab jab tak aap explicitly allow nahi karte, koi bhi read / write block ho jaata hai. Yeh template Discova ke saare collections ke liye sahi rules deta hai.

> Copy karke `Firebase Console → Firestore → Rules` mein paste karo. Phir **Publish** karo.

---

## Rules ka mental model

Har request mein Firebase ko 3 cheezein pata hoti hain:

- **`request.auth`** — kisne request ki hai (null agar signed out)
- **`request.resource.data`** — naya data jo likhna chahta hai
- **`resource.data`** — current data jo Firestore mein hai (update / delete ke liye)

Hum in 3 cheezo ko use karke decide karte hain `allow read | write | create | update | delete: if <condition>;`

---

## Helper functions (top of file)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---- HELPERS ----

    /// Kya user signed in hai?
    function isSignedIn() {
      return request.auth != null;
    }

    /// Yeh document khud user ka hai? (uid match karta hai)
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    /// Document ka userId field current user se match karta hai?
    function isAuthor() {
      return isSignedIn() && request.auth.uid == resource.data.userId;
    }

    /// Naye document ka userId field current user pe set hai?
    function isCreatingOwn() {
      return isSignedIn() && request.auth.uid == request.resource.data.userId;
    }

    /// Updated payload mein sirf yeh fields hi change hue hain (rest unchanged)?
    function onlyChanged(allowedFields) {
      return request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(allowedFields);
    }
```

---

## `users/{uid}` — User profiles

| Operation | Kaun kar sakta hai |
| --- | --- |
| read | Koi bhi signed-in user (profile public hai) |
| create | Sirf wahi user jiska uid match karta hai (signup ke time) |
| update | Sirf khud profile owner |
| delete | Koi nahi (admin SDK se hi delete) |

```javascript
    match /users/{uid} {
      // Public profile read for signed-in users
      allow read: if isSignedIn();

      // Self-create at signup
      allow create: if isOwner(uid)
                    && request.resource.data.uid == uid;

      // Self-update — coins / stats client se manipulate nahi hone chahiye
      // Woh fields sirf coinTransactions + Cloud Functions se update hote hain.
      allow update: if isOwner(uid)
                    && onlyChanged([
                         'displayName', 'photoURL', 'bio', 'location',
                         'disabilityType', 'pwdMode', 'preferences',
                         'lastActiveDate'
                       ]);

      // No client-side delete
      allow delete: if false;
    }
```

> **Important**: `coins`, `level`, `stats`, `badges` jaisi fields ko client se update karne ki ijazat nahi. Woh sirf server-side (Cloud Functions / Admin SDK) se ya `coinTransactions` write ke side-effect se update honge.

---

## `posts/{postId}` — User posts

| Operation | Kaun |
| --- | --- |
| read | Koi bhi signed-in user |
| create | Signed-in user, agar post ka `userId` apna hai |
| update | Sirf post author (caption / tags edit), aur `likes` counter ko subcollection write se increment karna |
| delete | Sirf post author |

```javascript
    match /posts/{postId} {
      allow read: if isSignedIn();

      allow create: if isCreatingOwn()
                    && request.resource.data.keys().hasAll([
                         'userId', 'placeId', 'imageUrl', 'caption',
                         'createdAt', 'accessibilityScore'
                       ]);

      // Author edit: caption / aiCaption / accessibilityTags
      // OR: koi bhi user likes counter increment / decrement kar sake (toggleLike)
      allow update: if (isAuthor()
                        && onlyChanged(['caption', 'aiCaption', 'accessibilityTags']))
                    || (isSignedIn()
                        && onlyChanged(['likes', 'commentsCount']));

      allow delete: if isAuthor();

      // Per-user like subdoc: posts/{postId}/likes/{userId}
      match /likes/{userId} {
        allow read: if isSignedIn();
        // Sirf khud apna like add / remove kar sakte ho
        allow create, delete: if isOwner(userId);
        allow update: if false;
      }
    }
```

---

## `places/{placeId}` — Place catalog

| Operation | Kaun |
| --- | --- |
| read | Koi bhi (public catalog) |
| create | Signed-in user (any user place add kar sakta hai) |
| update | Signed-in user, scores update karne ke liye |
| delete | Koi nahi |

```javascript
    match /places/{placeId} {
      allow read: if true;  // public

      allow create: if isSignedIn()
                    && request.resource.data.keys().hasAll([
                         'name', 'address', 'city', 'location', 'category'
                       ]);

      // Sirf scores aur updatedAt change ho sakti hain client se
      allow update: if isSignedIn()
                    && onlyChanged([
                         'accessibilityScores', 'aiAnalysis',
                         'rating', 'totalReviews', 'updatedAt'
                       ]);

      allow delete: if false;
    }
```

---

## `stories/{storyId}` — 24h stories

| Operation | Kaun |
| --- | --- |
| read | Koi bhi signed-in user |
| create | Story owner |
| update | Koi nahi (stories immutable) |
| delete | Story owner |

```javascript
    match /stories/{storyId} {
      allow read: if isSignedIn();

      allow create: if isCreatingOwn()
                    && request.resource.data.keys().hasAll([
                         'userId', 'placeId', 'mediaUrl', 'expiresAt'
                       ]);

      allow update: if false;
      allow delete: if isAuthor();
    }
```

> Stories automatic expire nahi hoti Firestore mein — `expiresAt > now` filter client query mein lagta hai. Cleanup ke liye **scheduled Cloud Function** weekly chalao jo expired stories delete kare.

---

## `reviews/{reviewId}` — Place reviews

| Operation | Kaun |
| --- | --- |
| read | Koi bhi signed-in user |
| create | Signed-in user with own userId |
| update | Sirf author (text / rating edit), ya helpfulCount increment |
| delete | Sirf author |

```javascript
    match /reviews/{reviewId} {
      allow read: if isSignedIn();

      allow create: if isCreatingOwn()
                    && request.resource.data.rating >= 1
                    && request.resource.data.rating <= 5;

      allow update: if (isAuthor()
                        && onlyChanged(['text', 'rating', 'accessibilityRatings', 'photos']))
                    || (isSignedIn()
                        && onlyChanged(['helpfulCount']));

      allow delete: if isAuthor();
    }
```

---

## `coinTransactions/{id}` — Ledger

Yeh ek **append-only ledger** hai. Client likh sakta hai apne lie, but kabhi update / delete nahi kar sakta. Yahi reason hai ki users.coins ko `coinTransactions` write ke saath atomic transaction mein update karte hain server-side calls mein.

```javascript
    match /coinTransactions/{id} {
      // User apne hi transactions dekh sakta hai
      allow read: if isSignedIn()
                  && request.auth.uid == resource.data.userId;

      // Append-only: sirf create allowed
      allow create: if isCreatingOwn();
      allow update, delete: if false;
    }
```

> Production hardening: client ko `coinTransactions` likhne hi nahi dena chahiye. Sab kuch Cloud Function trigger ke through karwana chahiye taaki client `amount` field manipulate na kare. MVP ke liye yeh rules theek hain.

---

## `redemptions/{id}` — Reward redemption records

```javascript
    match /redemptions/{id} {
      allow read: if isSignedIn()
                  && request.auth.uid == resource.data.userId;

      allow create: if isCreatingOwn()
                    && request.resource.data.keys().hasAll([
                         'userId', 'rewardId', 'cost', 'createdAt'
                       ]);

      allow update, delete: if false;
    }
```

---

## `rewards/{rewardId}` — Catalog

Read-only catalog. Sirf admin SDK / Cloud Functions se hi write hota hai.

```javascript
    match /rewards/{rewardId} {
      allow read: if isSignedIn();
      allow write: if false;  // admin SDK only
    }
```

---

## Final close braces

```javascript
  }
}
```

---

## Complete file (copy-paste ready)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function isAuthor() {
      return isSignedIn() && request.auth.uid == resource.data.userId;
    }
    function isCreatingOwn() {
      return isSignedIn() && request.auth.uid == request.resource.data.userId;
    }
    function onlyChanged(allowedFields) {
      return request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(allowedFields);
    }

    match /users/{uid} {
      allow read: if isSignedIn();
      allow create: if isOwner(uid) && request.resource.data.uid == uid;
      allow update: if isOwner(uid)
                    && onlyChanged([
                         'displayName', 'photoURL', 'bio', 'location',
                         'disabilityType', 'pwdMode', 'preferences',
                         'lastActiveDate'
                       ]);
      allow delete: if false;
    }

    match /posts/{postId} {
      allow read: if isSignedIn();
      allow create: if isCreatingOwn()
                    && request.resource.data.keys().hasAll([
                         'userId', 'placeId', 'imageUrl', 'caption',
                         'createdAt', 'accessibilityScore'
                       ]);
      allow update: if (isAuthor()
                        && onlyChanged(['caption', 'aiCaption', 'accessibilityTags']))
                    || (isSignedIn()
                        && onlyChanged(['likes', 'commentsCount']));
      allow delete: if isAuthor();

      match /likes/{userId} {
        allow read: if isSignedIn();
        allow create, delete: if isOwner(userId);
        allow update: if false;
      }
    }

    match /places/{placeId} {
      allow read: if true;
      allow create: if isSignedIn()
                    && request.resource.data.keys().hasAll([
                         'name', 'address', 'city', 'location', 'category'
                       ]);
      allow update: if isSignedIn()
                    && onlyChanged([
                         'accessibilityScores', 'aiAnalysis',
                         'rating', 'totalReviews', 'updatedAt'
                       ]);
      allow delete: if false;
    }

    match /stories/{storyId} {
      allow read: if isSignedIn();
      allow create: if isCreatingOwn()
                    && request.resource.data.keys().hasAll([
                         'userId', 'placeId', 'mediaUrl', 'expiresAt'
                       ]);
      allow update: if false;
      allow delete: if isAuthor();
    }

    match /reviews/{reviewId} {
      allow read: if isSignedIn();
      allow create: if isCreatingOwn()
                    && request.resource.data.rating >= 1
                    && request.resource.data.rating <= 5;
      allow update: if (isAuthor()
                        && onlyChanged(['text', 'rating', 'accessibilityRatings', 'photos']))
                    || (isSignedIn()
                        && onlyChanged(['helpfulCount']));
      allow delete: if isAuthor();
    }

    match /coinTransactions/{id} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isCreatingOwn();
      allow update, delete: if false;
    }

    match /redemptions/{id} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isCreatingOwn()
                    && request.resource.data.keys().hasAll([
                         'userId', 'rewardId', 'cost', 'createdAt'
                       ]);
      allow update, delete: if false;
    }

    match /rewards/{rewardId} {
      allow read: if isSignedIn();
      allow write: if false;
    }

    // Default deny — agar koi rule match nahi kiya, request reject hoti hai
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Storage rules (bonus)

Firebase Storage ke liye bhi rules chahiye. Console → Storage → Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Posts: posts/{uid}/{placeId}/{timestamp}.jpg
    match /posts/{uid}/{allPaths=**} {
      allow read: if request.auth != null;
      // Sirf khud ke folder mein upload kar sakte ho, 10 MB tak
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Avatars: avatars/{uid}_{timestamp}.jpg
    match /avatars/{file} {
      allow read: if true;  // public profile photos
      allow write: if request.auth != null
                   && file.matches(request.auth.uid + '_.*')
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Stories: stories/{uid}/{storyId}/{file}
    match /stories/{uid}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 20 * 1024 * 1024;
    }

    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Testing rules

Firebase Console mein **Rules Playground** hai (Firestore → Rules → Playground tab). Wahan simulated request bhej ke check kar sakte ho ki rule allow / deny kya kar raha hai.

Production deploy karne se pehle yeh scenarios test karo:

1. Signed-out user koi post create karne ki koshish kare → deny
2. User A, user B ke post update karne ki koshish kare → deny
3. User apne hi user document mein `coins` field update karne ki koshish kare → deny (`onlyChanged` check)
4. Signed-in user kisi bhi post pe like add kare → allow
5. User dusre ke `coinTransactions` read kare → deny

In test pass ho gaye, toh rules production-ready hain.
