/**
 * Safety Router — Crisis Keyword Detection
 *
 * Pure function that performs case-insensitive substring matching against
 * a curated list of crisis-indicative keywords. When triggered, the
 * application must immediately toggle isCrisisState to true and bypass
 * all generative text features.
 */

/** Curated crisis-indicative keyword phrases. */
const CRISIS_KEYWORDS: readonly string[] = [
  'self-harm',
  'self harm',
  'suicide',
  'kill myself',
  'end my life',
  'want to die',
  'severe clinical depression',
  'help me die',
  'no reason to live',
  'hopeless',
  "can't go on",
  'cannot go on',
  'hurt myself',
  'ending it all',
  'not worth living',
] as const;

/**
 * Evaluates whether the given text input contains crisis-indicative keywords.
 *
 * @param input - The raw journal entry text to evaluate.
 * @returns `true` if a crisis keyword is detected; `false` otherwise.
 *
 * @remarks
 * - Handles null, undefined, empty, and whitespace-only inputs gracefully.
 * - Case-insensitive matching via normalized lowercase comparison.
 * - Pure function with no side effects.
 */
export function evaluateSafetyBoundary(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const normalizedInput = input.toLowerCase().trim();

  if (normalizedInput.length === 0) {
    return false;
  }

  return CRISIS_KEYWORDS.some((keyword) => normalizedInput.includes(keyword));
}
