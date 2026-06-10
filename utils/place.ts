/**
 * Small pure helpers for classifying places.
 */

/**
 * A "hidden gem" — highly rated but with relatively few reviews, so it's
 * underrated and usually less crowded. Needs enough reviews (≥25) to be
 * credible but few enough (<300) to be off the beaten path.
 */
export function isHiddenGem(rating: number, totalReviews: number): boolean {
  return rating >= 4.3 && totalReviews >= 25 && totalReviews < 300;
}
