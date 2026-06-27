/**
 * Semantic NLP Pipeline & Episodic Graph Analytics Engine
 *
 * Upgrades the text-analysis pipeline to use semantic trigger embeddings
 * and guardrailed LLM sentiment extraction. Integrates a deterministic
 * circuit breaker for immediate crisis intervention.
 */

import type { JournalEntry } from '../types/wellness';
import { evaluateSafetyBoundary } from './safetyRouter';
import { GoogleGenerativeAI } from '@google/generative-ai';

/** Baseline semantic anchors for trigger categories. */
const BASELINE_TRIGGERS = [
  { id: 'exam', text: 'school college exam test study physics homework assignment deadlines grades exam pressure study stress mathematics academic' },
  { id: 'family', text: 'parents family home mother father mom dad sibling home pressure family conflict relationship parents expectations' },
  { id: 'sleep', text: 'sleep tired exhausted insomnia fatigue rest physical health rest quality layout physical sleep issues' },
  { id: 'social', text: 'friends lonely isolated alone peer peers social interaction social life bullying friend loneliness' },
  { id: 'general', text: 'general daily life routine normal standard casual everyday activities routine day-to-day' }
] as const;

/** In-memory cache for trigger baseline embeddings. */
let cachedBaselineEmbeddings: { id: string; values: number[] }[] | null = null;

/** Calculates dot product of two vectors. */
function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/** Calculates magnitude of a vector. */
function magnitude(a: number[]): number {
  return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
}

/** Calculates cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/** Gets embedding vector using text-embedding-004 model. */
async function getEmbedding(genAI: GoogleGenerativeAI, text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Deterministic local fallback analysis if the Gemini API key is missing or fails.
 */
export function localFallbackAnalysis(text: string): Omit<JournalEntry, 'id' | 'timestamp'> {
  const lowercase = text.toLowerCase().trim();
  let sentimentScore = 5;
  let trigger = 'general';

  if (
    lowercase.includes('exam') ||
    lowercase.includes('test') ||
    lowercase.includes('physics') ||
    lowercase.includes('math') ||
    lowercase.includes('study') ||
    lowercase.includes('homework') ||
    lowercase.includes('assignment') ||
    lowercase.includes('grade')
  ) {
    trigger = 'exam';
  } else if (
    lowercase.includes('parent') ||
    lowercase.includes('family') ||
    lowercase.includes('mom') ||
    lowercase.includes('dad') ||
    lowercase.includes('home') ||
    lowercase.includes('sibling')
  ) {
    trigger = 'family';
  } else if (
    lowercase.includes('sleep') ||
    lowercase.includes('tired') ||
    lowercase.includes('exhausted') ||
    lowercase.includes('insomnia')
  ) {
    trigger = 'sleep';
  } else if (
    lowercase.includes('friend') ||
    lowercase.includes('lonely') ||
    lowercase.includes('alone') ||
    lowercase.includes('social')
  ) {
    trigger = 'social';
  }

  const positives = ['happy', 'good', 'great', 'wonderful', 'excited', 'calm', 'relaxed', 'accomplished'];
  const negatives = ['sad', 'stressed', 'anxious', 'worried', 'angry', 'frustrated', 'depressed', 'overwhelmed'];

  let posCount = 0;
  let negCount = 0;
  for (const word of positives) {
    if (lowercase.includes(word)) posCount++;
  }
  for (const word of negatives) {
    if (lowercase.includes(word)) negCount++;
  }

  sentimentScore = sentimentScore + posCount * 2 - negCount * 2;
  const clampedScore = Math.max(1, Math.min(10, sentimentScore));

  const suggestedCategory =
    clampedScore <= 4 ? 'Coping' : clampedScore <= 7 ? 'Mindfulness' : 'Encouragement';

  return {
    text,
    sentimentScore: clampedScore,
    trigger,
    suggestedCategory,
  };
}

/**
 * Enterprise Semantic NLP Pipeline for Journal Reflection Analysis.
 *
 * @param text - The raw reflection text.
 * @returns A promise resolving to the parsed sentiment, trigger, and category.
 */
export async function analyzeJournalEntry(
  text: string
): Promise<Omit<JournalEntry, 'id' | 'timestamp'>> {
  // Tier 1: Deterministic Circuit Breaker (Safety)
  if (evaluateSafetyBoundary(text)) {
    return {
      text,
      sentimentScore: 1,
      trigger: 'Immediate Crisis Intervention',
      suggestedCategory: 'Coping',
    };
  }

  const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return localFallbackAnalysis(text);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Tier 2: Semantic Trigger Classification via Cosine Similarity
    if (!cachedBaselineEmbeddings) {
      cachedBaselineEmbeddings = await Promise.all(
        BASELINE_TRIGGERS.map(async (anchor) => {
          const values = await getEmbedding(genAI, anchor.text);
          return { id: anchor.id, values };
        })
      );
    }

    const inputEmbedding = await getEmbedding(genAI, text);

    let matchedTrigger = 'general';
    let highestSim = -1;

    for (const anchor of cachedBaselineEmbeddings) {
      const sim = cosineSimilarity(inputEmbedding, anchor.values);
      if (sim > highestSim) {
        highestSim = sim;
        matchedTrigger = anchor.id;
      }
    }

    // Tier 3: Guardrailed Sentiment Extraction
    const sentimentModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const sentimentPrompt = `
Analyze the user's reflection and extract a math sentiment score from 1 (deep distress) to 10 (high joy).
Reflection: "${text}"

Output MUST match this JSON schema:
{
  "sentimentScore": number
}
`;

    const result = await sentimentModel.generateContent(sentimentPrompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    const score =
      typeof data.sentimentScore === 'number'
        ? Math.max(1, Math.min(10, Math.round(data.sentimentScore)))
        : 5;

    const suggestedCategory =
      score <= 4 ? 'Coping' : score <= 7 ? 'Mindfulness' : 'Encouragement';

    return {
      text,
      sentimentScore: score,
      trigger: matchedTrigger,
      suggestedCategory,
    };
  } catch (error) {
    console.warn('Gemini Semantic NLP pipeline failed, falling back to local analysis:', error);
    return localFallbackAnalysis(text);
  }
}
