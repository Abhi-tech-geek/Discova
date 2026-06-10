/**
 * Input sanitization helpers used before persisting user-supplied strings.
 */

/**
 * Strip HTML tags, trim whitespace, and clamp the result to `maxLength`.
 * Safe to call with non-string input — returns `""` for anything that's not a string.
 * @param text Raw user input (caption, bio, comment, etc.).
 * @param maxLength Maximum number of characters to keep.
 */
export function sanitizeInput(text: string, maxLength: number): string {
  if (typeof text !== 'string') return '';
  const stripped = text.replace(/<[^>]*>/g, '');
  const collapsed = stripped.replace(/\s+/g, ' ');
  const trimmed = collapsed.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
