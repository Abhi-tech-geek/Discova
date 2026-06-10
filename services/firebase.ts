/**
 * Firebase service layer.
 * All Firestore / Auth / Storage access for Discova lives here.
 * Screens and stores must not touch the Firebase SDK directly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Persistence,
  type User as FirebaseUser,
  type Unsubscribe,
} from 'firebase/auth';

/**
 * Firebase 10 exports `getReactNativePersistence` at runtime but omits it from
 * the published `.d.ts`. Pull it via require with an explicit type assertion.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';

import type {
  CoinTransactionAction,
  Place,
  Post,
  Review,
  ReviewFilter,
  Reward,
  Story,
  User,
} from '../types';

/* -------------------------------------------------------------------------- */
/*  Initialization                                                            */
/* -------------------------------------------------------------------------- */

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Initialize Firebase Auth with React-Native-aware persistence.
 * `initializeAuth` throws if called twice (e.g. after Fast Refresh), so we
 * fall back to `getAuth` on the second pass.
 */
function createAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth: Auth = createAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Coerce a Firestore-stored timestamp field into epoch milliseconds.
 * Accepts Timestamp, number, or missing values.
 */
function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return 0;
}

/**
 * Parse a Firestore user document snapshot into the typed `User` domain object.
 * Returns `null` if the snapshot is missing.
 */
function parseUser(snap: DocumentSnapshot<DocumentData>): User | null {
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    photoURL: data.photoURL ?? null,
    bio: data.bio ?? '',
    dob: data.dob ?? '',
    location: data.location ?? '',
    disabilityType: data.disabilityType ?? 'none',
    pwdMode: Boolean(data.pwdMode),
    coins: data.coins ?? 0,
    level: data.level ?? 1,
    badges: Array.isArray(data.badges) ? data.badges : [],
    followers: data.followers ?? 0,
    following: data.following ?? 0,
    joinedAt: toMillis(data.joinedAt),
    streak: data.streak ?? 0,
    lastActiveDate: toMillis(data.lastActiveDate),
    stats: data.stats ?? {
      postsCount: 0,
      reviewsCount: 0,
      placesAdded: 0,
      storiesCount: 0,
    },
    preferences: data.preferences ?? {
      pwdMode: false,
      notifications: true,
      preferredCategories: [],
      preferredRadiusKm: 5,
    },
  };
}

/**
 * Parse a Firestore post document snapshot into a typed `Post`.
 * `likedByMe` is always returned `false` here; the caller should hydrate it
 * from the per-user likes subcollection if needed.
 */
function parsePost(snap: QueryDocumentSnapshot<DocumentData>): Post {
  const data = snap.data();
  return {
    id: snap.id,
    userId: data.userId ?? '',
    userDisplayName: data.userDisplayName ?? '',
    userPhotoURL: data.userPhotoURL ?? null,
    placeId: data.placeId ?? '',
    placeName: data.placeName ?? '',
    imageUrl: data.imageUrl ?? '',
    caption: data.caption ?? '',
    aiCaption: data.aiCaption ?? '',
    accessibilityTags: Array.isArray(data.accessibilityTags) ? data.accessibilityTags : [],
    isAccessible: Boolean(data.isAccessible),
    accessibilityScore: typeof data.accessibilityScore === 'number' ? data.accessibilityScore : 0,
    likes: data.likes ?? 0,
    commentsCount: data.commentsCount ?? 0,
    likedByMe: false,
    createdAt: toMillis(data.createdAt),
  };
}

/** Parse a Firestore place snapshot into the typed `Place` domain object. */
function parsePlace(snap: DocumentSnapshot<DocumentData>): Place | null {
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    googlePlaceId: data.googlePlaceId ?? '',
    name: data.name ?? '',
    address: data.address ?? '',
    city: data.city ?? '',
    location: data.location ?? { latitude: 0, longitude: 0 },
    category: data.category ?? '',
    photos: Array.isArray(data.photos) ? data.photos : [],
    rating: data.rating ?? 0,
    totalReviews: data.totalReviews ?? 0,
    accessibilityScores: data.accessibilityScores ?? {
      overall: 0,
      mobility: 0,
      visual: 0,
      hearing: 0,
      cognitive: 0,
      sensory: 0,
    },
    aiAnalysis: data.aiAnalysis ?? null,
    phoneNumber: data.phoneNumber ?? null,
    website: data.website ?? null,
    hours: data.hours ?? null,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

/** Parse a Firestore story snapshot into a typed `Story`. */
function parseStory(snap: QueryDocumentSnapshot<DocumentData>): Story {
  const data = snap.data();
  return {
    id: snap.id,
    userId: data.userId ?? '',
    userDisplayName: data.userDisplayName ?? '',
    userPhotoURL: data.userPhotoURL ?? null,
    placeId: data.placeId ?? '',
    placeName: data.placeName ?? '',
    city: data.city ?? '',
    mediaUrl: data.mediaUrl ?? '',
    mediaType: data.mediaType ?? 'image',
    caption: data.caption ?? '',
    createdAt: toMillis(data.createdAt),
    expiresAt: toMillis(data.expiresAt),
  };
}

/** Parse a Firestore review snapshot into a typed `Review`. */
function parseReview(snap: QueryDocumentSnapshot<DocumentData>): Review {
  const data = snap.data();
  return {
    id: snap.id,
    userId: data.userId ?? '',
    userDisplayName: data.userDisplayName ?? '',
    placeId: data.placeId ?? '',
    rating: data.rating ?? 0,
    text: data.text ?? '',
    accessibilityRatings: data.accessibilityRatings ?? {
      mobility: 0,
      visual: 0,
      hearing: 0,
      cognitive: 0,
      sensory: 0,
    },
    photos: Array.isArray(data.photos) ? data.photos : [],
    helpfulCount: data.helpfulCount ?? 0,
    createdAt: toMillis(data.createdAt),
  };
}

/** Parse a Firestore reward snapshot into a typed `Reward`. */
function parseReward(snap: QueryDocumentSnapshot<DocumentData>): Reward {
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name ?? '',
    description: data.description ?? '',
    cost: data.cost ?? 0,
    icon: data.icon ?? '',
    partner: data.partner ?? '',
    category: data.category ?? '',
    city: data.city ?? '',
    available: Boolean(data.available),
    expiresAt: data.expiresAt ? toMillis(data.expiresAt) : null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

/** One page of the home feed plus a cursor for the next page. */
export interface HomeFeedPage {
  posts: Post[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}

/** Result of toggling a like on a post. */
export interface ToggleLikeResult {
  liked: boolean;
  likes: number;
}

/* -------------------------------------------------------------------------- */
/*  AUTH                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Subscribe to auth state changes.
 * @param callback Invoked with the current Firebase user (or `null` when signed out).
 * @returns Unsubscribe function to detach the listener.
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

/**
 * Exchange a Google OAuth ID token (obtained via `expo-auth-session`) for a
 * Firebase session and sign the user in.
 * @param idToken Google-issued ID token from the OAuth flow.
 * @returns The signed-in Firebase user.
 */
export async function signInWithGoogle(idToken: string): Promise<FirebaseUser> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}

/**
 * Sign in anonymously — gives a real Firebase uid without an OAuth flow.
 * Used as the default "guest" sign-in so Firestore reads/writes work on-device.
 * @returns The signed-in (anonymous) Firebase user.
 */
export async function signInAnonymouslyUser(): Promise<FirebaseUser> {
  const result = await signInAnonymously(auth);
  return result.user;
}

/** Result of the email auth helper. */
export interface EmailAuthResult {
  user: FirebaseUser;
  /** True if a brand-new account was created (→ send to onboarding). */
  isNew: boolean;
}

/**
 * Email + password auth for testing — logs in if the account exists, otherwise
 * creates it. No OAuth client IDs needed. Requires Email/Password enabled in
 * Firebase Console → Authentication → Sign-in method.
 */
export async function emailLoginOrSignUp(
  email: string,
  password: string,
): Promise<EmailAuthResult> {
  const trimmed = email.trim().toLowerCase();
  try {
    const result = await signInWithEmailAndPassword(auth, trimmed, password);
    return { user: result.user, isNew: false };
  } catch (err) {
    const code = (err as { code?: string }).code ?? '';
    // Account doesn't exist yet → create it.
    if (
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-login-credentials'
    ) {
      const created = await createUserWithEmailAndPassword(auth, trimmed, password);
      return { user: created.user, isNew: true };
    }
    throw err;
  }
}

/** Sign the current user out and clear the cached Firebase session. */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/** Return the currently signed-in Firebase user, or `null`. */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

/* -------------------------------------------------------------------------- */
/*  USERS                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create the Firestore profile document for a freshly signed-up user.
 * Use this immediately after `signInWithGoogle` if `getUserProfile` returns null.
 */
export async function createUserProfile(
  uid: string,
  data: Omit<User, 'uid' | 'joinedAt'>,
): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    joinedAt: serverTimestamp(),
  });
}

/** Fetch a user profile by uid. Returns `null` if the document does not exist. */
export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return parseUser(snap);
}

/** Patch a subset of fields on a user profile. Uses merge so it also works
 *  when the document doesn't exist yet (guests / first-time writes). */
export async function updateUserProfile(
  uid: string,
  data: Partial<Omit<User, 'uid' | 'joinedAt'>>,
): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

/**
 * Atomically add (or subtract, if `amount` is negative) coins to a user's balance
 * and append a ledger entry to `coinTransactions`.
 */
export async function addCoinsToUser(
  uid: string,
  amount: number,
  action: CoinTransactionAction = 'adjustment',
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { coins: increment(amount) });
  await logCoinTransaction(uid, amount, action);
}

/* -------------------------------------------------------------------------- */
/*  POSTS                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a new post.
 * Caller supplies all content fields; system fields (id, likes, commentsCount,
 * likedByMe, createdAt) are populated server-side.
 * @returns The new post's id.
 */
export async function createPost(
  postData: Omit<Post, 'id' | 'likes' | 'commentsCount' | 'likedByMe' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'posts'), {
    ...postData,
    likes: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Fetch one page of the global home feed, sorted by newest first.
 * @param lastDoc Cursor returned by the previous page. Omit for the first page.
 * @param pageSize Number of posts to fetch (defaults to 20).
 */
export async function fetchHomeFeed(
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = 20,
): Promise<HomeFeedPage> {
  const baseQuery = lastDoc
    ? query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        fsLimit(pageSize),
      )
    : query(collection(db, 'posts'), orderBy('createdAt', 'desc'), fsLimit(pageSize));

  const snap = await getDocs(baseQuery);
  const posts = snap.docs.map(parsePost);
  const nextCursor = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { posts, lastDoc: nextCursor };
}

/** Fetch every post associated with a place, newest first. */
export async function fetchPlacePosts(placeId: string): Promise<Post[]> {
  const q = query(
    collection(db, 'posts'),
    where('placeId', '==', placeId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(parsePost);
}

/** Fetch every post by a user, newest first. */
export async function fetchUserPosts(userId: string): Promise<Post[]> {
  const q = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(parsePost);
}

/**
 * Toggle a like on a post for the given user.
 * Atomically updates the per-user `likes` subdoc and the post's `likes` counter.
 * @returns The new liked state and updated like count.
 */
export async function toggleLike(postId: string, userId: string): Promise<ToggleLikeResult> {
  return runTransaction(db, async (tx) => {
    const postRef = doc(db, 'posts', postId);
    const likeRef = doc(db, 'posts', postId, 'likes', userId);
    const [postSnap, likeSnap] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
    if (!postSnap.exists()) throw new Error(`Post ${postId} not found`);

    const currentLikes: number = postSnap.data().likes ?? 0;
    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(postRef, { likes: increment(-1) });
      return { liked: false, likes: Math.max(0, currentLikes - 1) };
    }
    tx.set(likeRef, { createdAt: serverTimestamp() });
    tx.update(postRef, { likes: increment(1) });
    return { liked: true, likes: currentLikes + 1 };
  });
}

/* -------------------------------------------------------------------------- */
/*  PLACES                                                                    */
/* -------------------------------------------------------------------------- */

/** Fetch a single place by its Firestore id. */
export async function fetchPlaceDetails(placeId: string): Promise<Place | null> {
  const snap = await getDoc(doc(db, 'places', placeId));
  return parsePlace(snap);
}

/** Fetch every indexed place in a city, sorted by overall accessibility score. */
export async function fetchNearbyPlaces(city: string): Promise<Place[]> {
  const q = query(
    collection(db, 'places'),
    where('city', '==', city),
    orderBy('accessibilityScores.overall', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parsePlace(d))
    .filter((p): p is Place => p !== null);
}

/** Replace the accessibility-scores block on a place and bump `updatedAt`. */
export async function updatePlaceScores(
  placeId: string,
  scores: Place['accessibilityScores'],
): Promise<void> {
  await updateDoc(doc(db, 'places', placeId), {
    accessibilityScores: scores,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Create a new place document.
 * @returns The new place's id.
 */
export async function addNewPlace(
  placeData: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'places'), {
    ...placeData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Upsert a place into the cache (keyed by its id, e.g. Google place id) with
 * its AI accessibility scores. Lets the next visitor — and every other user —
 * load the result instantly instead of re-running AI. This is what grows the
 * shared, community-powered accessibility database.
 * Best-effort: never throws.
 */
export async function cachePlace(place: Place): Promise<void> {
  try {
    const { id, ...rest } = place;
    await setDoc(
      doc(db, 'places', id),
      { ...rest, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch {
    /* cache write is best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/*  STORIES                                                                   */
/* -------------------------------------------------------------------------- */

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Create a new story. `expiresAt` is set to `now + 24h` automatically.
 * @returns The new story's id.
 */
export async function createStory(
  storyData: Omit<Story, 'id' | 'createdAt' | 'expiresAt'>,
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collection(db, 'stories'), {
    ...storyData,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + STORY_TTL_MS),
  });
  return ref.id;
}

/** Fetch all non-expired stories in a city, newest first. */
export async function fetchCityStories(city: string): Promise<Story[]> {
  const q = query(
    collection(db, 'stories'),
    where('city', '==', city),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(parseStory);
}

/** Fetch all non-expired stories tied to a place, newest first. */
export async function fetchPlaceStories(placeId: string): Promise<Story[]> {
  const q = query(
    collection(db, 'stories'),
    where('placeId', '==', placeId),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(parseStory);
}

/* -------------------------------------------------------------------------- */
/*  REVIEWS                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Create a new review.
 * @returns The new review's id.
 */
export async function createReview(
  reviewData: Omit<Review, 'id' | 'createdAt' | 'helpfulCount'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'reviews'), {
    ...reviewData,
    helpfulCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Fetch reviews for a place. Filtering by disability type / min rating happens
 * client-side after the base placeId query (Firestore composite-index cost).
 */
export async function fetchPlaceReviews(
  placeId: string,
  filter: ReviewFilter = {},
): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('placeId', '==', placeId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  let reviews = snap.docs.map(parseReview);

  if (filter.minRating !== undefined) {
    const min = filter.minRating;
    reviews = reviews.filter((r) => r.rating >= min);
  }
  if (filter.withPhotosOnly) {
    reviews = reviews.filter((r) => r.photos.length > 0);
  }
  if (filter.disabilityType && filter.disabilityType !== 'none') {
    const key = filter.disabilityType;
    reviews = reviews.filter((r) => r.accessibilityRatings[key] > 0);
  }
  return reviews;
}

/* -------------------------------------------------------------------------- */
/*  STORAGE                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Upload a local file (image/video) to Firebase Storage with progress reporting.
 * Converts the `file://` uri to a Blob first, then uses a resumable upload task.
 * @param uri Local file uri (e.g. from expo-image-picker).
 * @param path Destination path inside the storage bucket.
 * @param onProgress Optional callback receiving 0-100 percentage updates.
 * @returns The public download URL of the uploaded object.
 */
export async function uploadMedia(
  uri: string,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ref = storageRef(storage, path);
  const task = uploadBytesResumable(ref, blob);

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

/* -------------------------------------------------------------------------- */
/*  COINS / REWARDS                                                           */
/* -------------------------------------------------------------------------- */

/** Append a row to the `coinTransactions` ledger for a user. */
export async function logCoinTransaction(
  userId: string,
  amount: number,
  action: CoinTransactionAction,
): Promise<void> {
  await addDoc(collection(db, 'coinTransactions'), {
    userId,
    amount,
    action,
    createdAt: serverTimestamp(),
  });
}

/** Fetch all currently-available rewards in a city. */
export async function fetchRewards(city: string): Promise<Reward[]> {
  const q = query(
    collection(db, 'rewards'),
    where('city', '==', city),
    where('available', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(parseReward);
}

/**
 * Atomically deduct coins from a user's balance and record the redemption.
 * Throws if the user has insufficient coins or does not exist.
 */
export async function redeemReward(
  userId: string,
  rewardId: string,
  coinsRequired: number,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error(`User ${userId} not found`);

    const currentCoins: number = userSnap.data().coins ?? 0;
    if (currentCoins < coinsRequired) {
      throw new Error(`Insufficient coins: have ${currentCoins}, need ${coinsRequired}`);
    }

    tx.update(userRef, { coins: increment(-coinsRequired) });

    const redemptionRef = doc(collection(db, 'redemptions'));
    tx.set(redemptionRef, {
      userId,
      rewardId,
      cost: coinsRequired,
      createdAt: serverTimestamp(),
    });

    const txnRef = doc(collection(db, 'coinTransactions'));
    tx.set(txnRef, {
      userId,
      amount: -coinsRequired,
      action: 'reward_redeemed' satisfies CoinTransactionAction,
      createdAt: serverTimestamp(),
    });
  });
}
