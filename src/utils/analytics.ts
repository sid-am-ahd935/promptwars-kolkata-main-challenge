/**
 * Deterministic Sentiment & Trigger Parser
 *
 * Rule-based keyword mapping algorithm for sentiment scoring (1-10),
 * trigger extraction, and category assignment. No external LLM API calls —
 * all processing is local and deterministic.
 */

import type { JournalEntry } from '../types/wellness';

/** Trigger keyword categories mapped to their representative trigger label. */
const TRIGGER_MAP: ReadonlyMap<string, string> = new Map([
  ['exam', 'exam'],
  ['exams', 'exam'],
  ['test', 'exam'],
  ['tests', 'exam'],
  ['study', 'exam'],
  ['studying', 'exam'],
  ['physics', 'exam'],
  ['math', 'exam'],
  ['maths', 'exam'],
  ['mathematics', 'exam'],
  ['homework', 'exam'],
  ['assignment', 'exam'],
  ['grade', 'exam'],
  ['grades', 'exam'],
  ['parents', 'family'],
  ['parent', 'family'],
  ['family', 'family'],
  ['home', 'family'],
  ['mother', 'family'],
  ['father', 'family'],
  ['mom', 'family'],
  ['dad', 'family'],
  ['sibling', 'family'],
  ['sleep', 'sleep'],
  ['tired', 'sleep'],
  ['exhausted', 'sleep'],
  ['insomnia', 'sleep'],
  ['fatigue', 'sleep'],
  ['rest', 'sleep'],
  ['nap', 'sleep'],
  ['friends', 'social'],
  ['friend', 'social'],
  ['lonely', 'social'],
  ['isolated', 'social'],
  ['alone', 'social'],
  ['social', 'social'],
  ['peer', 'social'],
  ['peers', 'social'],
  ['bullying', 'social'],
  ['work', 'work'],
  ['job', 'work'],
  ['boss', 'work'],
  ['office', 'work'],
  ['deadline', 'work'],
  ['exercise', 'health'],
  ['gym', 'health'],
  ['diet', 'health'],
  ['weight', 'health'],
  ['illness', 'health'],
  ['sick', 'health'],
]);

/** Positive sentiment keywords with their respective score weights. */
const POSITIVE_KEYWORDS: ReadonlyMap<string, number> = new Map([
  ['happy', 3],
  ['happiness', 3],
  ['good', 2],
  ['great', 3],
  ['wonderful', 4],
  ['amazing', 4],
  ['relaxed', 3],
  ['calm', 2],
  ['peaceful', 3],
  ['excited', 3],
  ['proud', 3],
  ['confident', 3],
  ['grateful', 3],
  ['thankful', 2],
  ['joy', 3],
  ['joyful', 3],
  ['love', 2],
  ['hopeful', 2],
  ['optimistic', 3],
  ['motivated', 3],
  ['energetic', 2],
  ['content', 2],
  ['satisfied', 2],
  ['accomplished', 3],
  ['better', 1],
  ['well', 1],
  ['fine', 1],
  ['okay', 1],
]);

/** Negative sentiment keywords with their respective score weights. */
const NEGATIVE_KEYWORDS: ReadonlyMap<string, number> = new Map([
  ['sad', 3],
  ['sadness', 3],
  ['stressed', 3],
  ['stress', 3],
  ['anxious', 3],
  ['anxiety', 3],
  ['worried', 2],
  ['worry', 2],
  ['angry', 3],
  ['anger', 3],
  ['frustrated', 3],
  ['frustration', 3],
  ['scared', 3],
  ['fear', 3],
  ['overwhelmed', 4],
  ['depressed', 4],
  ['terrible', 4],
  ['awful', 4],
  ['miserable', 4],
  ['upset', 2],
  ['nervous', 2],
  ['lonely', 3],
  ['crying', 3],
  ['hurt', 2],
  ['pain', 2],
  ['failed', 3],
  ['failure', 3],
  ['bad', 2],
  ['worse', 2],
  ['worst', 3],
  ['struggling', 3],
  ['panic', 4],
  ['dread', 3],
]);

/** Baseline neutral sentiment score. */
const BASELINE_SCORE = 5.5;

/** Minimum allowed sentiment score. */
const MIN_SCORE = 1;

/** Maximum allowed sentiment score. */
const MAX_SCORE = 10;

/**
 * Extracts words from text, stripping punctuation and converting to lowercase.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Determines the sentiment category based on the score range.
 *
 * - 1-4: Coping
 * - 5-7: Mindfulness
 * - 8-10: Encouragement
 */
function mapCategory(
  score: number
): 'Coping' | 'Mindfulness' | 'Encouragement' {
  if (score <= 4) return 'Coping';
  if (score <= 7) return 'Mindfulness';
  return 'Encouragement';
}

/**
 * Clamps a number between min and max bounds.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Analyzes a journal entry text to extract sentiment score, trigger, and category.
 *
 * @param text - The raw journal entry text.
 * @returns An object containing the analyzed text, sentimentScore, trigger, and suggestedCategory.
 *
 * @remarks
 * Uses a deterministic, local keyword-matching algorithm:
 * 1. Tokenizes the input text
 * 2. Sums positive and negative keyword weights
 * 3. Normalizes around a baseline of 5.5, clamped to [1, 10]
 * 4. Extracts the first matched trigger keyword
 * 5. Maps category from the final score
 */
export function analyzeJournalEntry(
  text: string
): Omit<JournalEntry, 'id' | 'timestamp'> {
  const tokens = tokenize(text);

  // Calculate sentiment from weighted keyword matches
  let sentimentDelta = 0;

  for (const token of tokens) {
    const positiveWeight = POSITIVE_KEYWORDS.get(token);
    if (positiveWeight !== undefined) {
      sentimentDelta += positiveWeight;
    }

    const negativeWeight = NEGATIVE_KEYWORDS.get(token);
    if (negativeWeight !== undefined) {
      sentimentDelta -= negativeWeight;
    }
  }

  // Normalize: apply delta to baseline, then clamp to valid range
  const rawScore = BASELINE_SCORE + sentimentDelta * 0.5;
  const sentimentScore = clamp(Math.round(rawScore), MIN_SCORE, MAX_SCORE);

  // Extract trigger: first token that matches a known trigger keyword
  let trigger = 'general';
  for (const token of tokens) {
    const matchedTrigger = TRIGGER_MAP.get(token);
    if (matchedTrigger !== undefined) {
      trigger = matchedTrigger;
      break;
    }
  }

  const suggestedCategory = mapCategory(sentimentScore);

  return {
    text,
    sentimentScore,
    trigger,
    suggestedCategory,
  };
}
