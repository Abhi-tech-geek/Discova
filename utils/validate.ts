/**
 * Validation helpers for user uploads and AI responses.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png'] as const;
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;

/** Outcome of an image-upload validation. */
export interface ImageValidationResult {
  ok: boolean;
  error?: string;
  sizeBytes?: number;
  mimeType?: string;
}

/**
 * Validate a local image uri before it goes to Firebase Storage.
 * Checks: extension/mime is jpeg or png, total bytes under 10 MB.
 * Never throws — fetch/blob errors are reported as `{ ok: false, error }`.
 * @param uri Local file uri (e.g. from expo-image-picker).
 */
export async function validateImageUpload(uri: string): Promise<ImageValidationResult> {
  if (typeof uri !== 'string' || uri.length === 0) {
    return { ok: false, error: 'Image uri is missing.' };
  }

  const lower = uri.toLowerCase().split('?')[0] ?? '';
  const extension = lower.split('.').pop() ?? '';
  const extOk = (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(extension);

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeOk = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(blob.type);

    if (!extOk && !mimeOk) {
      return {
        ok: false,
        error: 'Image must be JPEG or PNG.',
        sizeBytes: blob.size,
        mimeType: blob.type,
      };
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: 'Image must be under 10 MB.',
        sizeBytes: blob.size,
        mimeType: blob.type,
      };
    }
    return { ok: true, sizeBytes: blob.size, mimeType: blob.type };
  } catch {
    return { ok: false, error: 'Could not read the image file.' };
  }
}

/**
 * Type-narrowing guard that confirms an unknown value is a non-null object
 * containing every required field. Used right after `JSON.parse` on an AI
 * agent response before reading fields.
 * @param data Parsed value to validate.
 * @param requiredFields List of property names that must exist on `data`.
 */
export function validateAIResponse<T extends object>(
  data: unknown,
  requiredFields: readonly (keyof T)[],
): data is T {
  if (data === null || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  for (const field of requiredFields) {
    const key = String(field);
    if (!(key in obj)) return false;
    if (obj[key] === undefined || obj[key] === null) return false;
  }
  return true;
}
