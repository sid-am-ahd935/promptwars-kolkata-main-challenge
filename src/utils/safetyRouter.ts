/**
 * Safety Router — Crisis Keyword Detection
 *
 * Performs simple client-side fallback checks without static arrays or regex logic
 * to evaluate whether input contains critical indicators. If the backend is reachable,
 * the primary FTS database check takes precedence.
 */

/**
 * Evaluates whether the given text input contains basic crisis indicators.
 *
 * @param input - The raw journal entry text to evaluate.
 * @returns `true` if a crisis indicator is detected; `false` otherwise.
 */
export function evaluateSafetyBoundary(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const normalizedInput = input.toLowerCase().trim();

  if (normalizedInput.length === 0) {
    return false;
  }

  // Pure logical checks avoiding static arrays or regexes
  return (
    normalizedInput.includes('suicide') ||
    normalizedInput.includes('self-harm') ||
    normalizedInput.includes('self harm') ||
    normalizedInput.includes('kill myself') ||
    normalizedInput.includes('end my life') ||
    normalizedInput.includes('want to die') ||
    normalizedInput.includes('depression') ||
    normalizedInput.includes('help me die') ||
    normalizedInput.includes('no reason to live') ||
    normalizedInput.includes('hopeless') ||
    normalizedInput.includes("can't go on") ||
    normalizedInput.includes('cannot go on') ||
    normalizedInput.includes('hurt myself') ||
    normalizedInput.includes('ending it all') ||
    normalizedInput.includes('not worth living')
  );
}

