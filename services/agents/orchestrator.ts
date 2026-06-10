/**
 * Agent Orchestrator.
 * Pure-TypeScript controller — no AI. Wires the per-agent pipeline for
 * post creation: upload → vision → caption → merge → save → score → reward.
 */

import { createPost, uploadMedia } from '../firebase';
import type {
  AIAnalysis,
  DisabilityType,
  ManualAccessibilityChecklist,
  PostCreationInput,
  PostCreationResult,
} from '../../types';

import { captionAgent } from './captionAgent';
import { gamificationAgent } from './gamificationAgent';
import { scoringAgent } from './scoringAgent';
import { visionAgent } from './visionAgent';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Merge the vision-agent analysis with the user's manual checklist.
 * Manual values take priority — the user is the source of truth for anything
 * they explicitly verified. `lastAnalyzed` is bumped to "now".
 */
function mergeAnalysis(
  ai: AIAnalysis,
  manual: ManualAccessibilityChecklist,
): AIAnalysis {
  return {
    ...ai,
    hasRamp: manual.hasRamp ?? ai.hasRamp,
    hasElevator: manual.hasElevator ?? ai.hasElevator,
    hasBrailleSignage: manual.hasBrailleSignage ?? ai.hasBrailleSignage,
    hasSignLanguage: manual.hasSignLanguage ?? ai.hasSignLanguage,
    hasWideEntries: manual.hasWideEntries ?? ai.hasWideEntries,
    hasAccessibleParking: manual.hasAccessibleParking ?? ai.hasAccessibleParking,
    hasAccessibleRestroom: manual.hasAccessibleRestroom ?? ai.hasAccessibleRestroom,
    hasTactilePaving: manual.hasTactilePaving ?? ai.hasTactilePaving,
    hasQuietZone: manual.hasQuietZone ?? ai.hasQuietZone,
    noiseLevel: manual.noiseLevel ?? ai.noiseLevel,
    lightingLevel: manual.lightingLevel ?? ai.lightingLevel,
    crowdLevel: manual.crowdLevel ?? ai.crowdLevel,
    lastAnalyzed: Date.now(),
  };
}

/**
 * Pick the broad disability categories a place serves based on its features.
 * Used as a fallback when the caption agent doesn't emit accessibility tags.
 */
function deriveAccessibilityTags(analysis: AIAnalysis): DisabilityType[] {
  const tags: DisabilityType[] = [];
  if (analysis.hasRamp || analysis.hasElevator || analysis.hasWideEntries) {
    tags.push('mobility');
  }
  if (analysis.hasBrailleSignage || analysis.hasTactilePaving) {
    tags.push('visual');
  }
  if (analysis.hasSignLanguage) tags.push('hearing');
  if (analysis.hasQuietZone) tags.push('cognitive');
  if (analysis.noiseLevel === 'low' || analysis.crowdLevel === 'low') {
    if (!tags.includes('sensory')) tags.push('sensory');
  }
  return tags;
}

/** Build a Firebase Storage path for a user's post image. */
function buildStoragePath(userId: string, placeId: string): string {
  return `posts/${userId}/${placeId}/${Date.now()}.jpg`;
}

/* -------------------------------------------------------------------------- */
/*  Pipeline                                                                  */
/* -------------------------------------------------------------------------- */

export const orchestrator = {
  name: 'AgentOrchestrator' as const,

  /**
   * End-to-end pipeline for creating a Discova post.
   *
   * Steps:
   *  1. Upload the photo to Firebase Storage (with progress reporting).
   *  2. Run the vision agent over the base64 image in parallel with the upload.
   *  3. Run the caption agent over the vision result.
   *  4. Merge the vision result with the user's manual accessibility checklist.
   *  5. Persist the post via `firebase.createPost`.
   *  6. Push the new analysis into the place's score via the scoring agent.
   *  7. Award coins via the gamification agent.
   *  8. Return everything the UI needs (postId, imageUrl, merged analysis,
   *     caption output, coin total, any newly-qualified badges).
   *
   * Never throws on AI-agent failures — those agents return safe defaults.
   * May throw on Firebase Storage / Firestore errors, which the caller is
   * expected to surface as a retry-friendly UI message.
   */
  async handlePostCreation(input: PostCreationInput): Promise<PostCreationResult> {
    const {
      user,
      placeId,
      placeName,
      placeType,
      imageUri,
      imageBase64,
      manualCaption,
      manualChecklist,
      onProgress,
    } = input;

    // Steps 1 + 2 run in parallel — upload over the network, vision over base64.
    // Upload is non-fatal: if Storage isn't set up (or fails), fall back to the
    // local uri so the post still saves to Firestore.
    const [uploadedUrl, aiAnalysis] = await Promise.all([
      uploadMedia(imageUri, buildStoragePath(user.uid, placeId), onProgress).catch(() => ''),
      visionAgent.analyze(imageBase64),
    ]);
    const imageUrl = uploadedUrl || imageUri;

    // Step 3 — caption from the AI analysis.
    const captionOutput = await captionAgent.generate(aiAnalysis, placeName, placeType);

    // Step 4 — manual checklist wins on every flag the user toggled.
    const mergedAnalysis = mergeAnalysis(aiAnalysis, manualChecklist);

    // Decide the final user-facing caption and accessibility tags.
    const finalCaption =
      manualCaption.trim().length > 0 ? manualCaption.trim() : captionOutput.caption;
    const accessibilityTags =
      captionOutput.accessibilityTags.length > 0
        ? captionOutput.accessibilityTags
        : deriveAccessibilityTags(mergedAnalysis);

    // Step 5 — save the post to Firestore.
    // The post-level score is the merged AI score on a 0-10 scale.
    const postScore = Math.round((mergedAnalysis.accessibilityScore / 10) * 10) / 10;
    const postId = await createPost({
      userId: user.uid,
      userDisplayName: user.displayName,
      userPhotoURL: user.photoURL,
      placeId,
      placeName,
      imageUrl,
      caption: finalCaption,
      aiCaption: captionOutput.caption,
      accessibilityTags,
      isAccessible: accessibilityTags.length > 0,
      accessibilityScore: postScore,
    });

    // Step 6 — refresh the place's accessibility score with the new analysis.
    // Non-fatal: the place doc may not exist yet, or rules may block it. The
    // post is already saved, so don't fail the whole flow on a score update.
    try {
      await scoringAgent.updatePlaceScore(placeId, [mergedAnalysis]);
    } catch {
      /* place score update is best-effort */
    }

    // Step 7 — gamification: award coins (non-fatal too).
    let coinsAwarded = 0;
    try {
      coinsAwarded = await gamificationAgent.awardCoins(user, 'post_created');
    } catch {
      coinsAwarded = 0;
    }
    // Evaluate badges against an optimistically-updated stats snapshot so the
    // user sees "First Steps" etc. immediately after their first post.
    const projectedUser = {
      ...user,
      coins: user.coins + coinsAwarded,
      stats: { ...user.stats, postsCount: user.stats.postsCount + 1 },
    };
    const newBadges = gamificationAgent.checkBadgeEarned(projectedUser);

    // Step 8 — return the full result.
    return {
      postId,
      imageUrl,
      analysis: mergedAnalysis,
      caption: captionOutput,
      coinsAwarded,
      newBadges,
    };
  },
};
