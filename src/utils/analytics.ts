/**
 * Generative Analytics Engine via Gemini
 *
 * Upgrades the analytics system to perform sentiment analysis and trigger
 * extraction entirely via the Google Gemini LLM when an API key is available.
 * Gracefully falls back to local rules if the API call fails or the key is absent.
 */

import type { JournalEntry } from '../types/wellness';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Deterministic local fallback analysis if the Gemini API key is missing or fails.
 */
export function localFallbackAnalysis(text: string): Omit<JournalEntry, 'id' | 'timestamp'> {
  const lowercase = text.toLowerCase().trim();
  let sentimentScore = 5;
  let trigger = 'general';

  // Fallback trigger mapping
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

  // Fallback sentiment keywords
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
 * Analyzes a journal entry using Google Gemini 1.5 Flash.
 *
 * @param text - The raw journal entry text.
 * @returns A promise resolving to the sentiment analysis details.
 */
export async function analyzeJournalEntry(
  text: string
): Promise<Omit<JournalEntry, 'id' | 'timestamp'>> {
  const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return localFallbackAnalysis(text);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2, // Low temperature for high consistency and classification reliability
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
Act as a strict, expert mental wellness analytics engine.
Analyze the user's journal reflection and determine:
1. sentimentScore: A mathematical score from 1 to 10 (1 being severe distress/sadness, 10 being highly positive/joyful).
2. trigger: The primary human-readable trigger of their state (e.g., "exam", "family", "sleep", "social", "work", "health", or "general" if not clear).
3. suggestedCategory: A string based on the sentiment score:
   - Scores 1-4 assign "Coping"
   - Scores 5-7 assign "Mindfulness"
   - Scores 8-10 assign "Encouragement"

User Reflection: "${text}"

Output MUST match this exact JSON schema:
{
  "sentimentScore": number,
  "trigger": "string",
  "suggestedCategory": "Coping" | "Mindfulness" | "Encouragement"
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    const score =
      typeof data.sentimentScore === 'number'
        ? Math.max(1, Math.min(10, Math.round(data.sentimentScore)))
        : 5;

    const trigger = typeof data.trigger === 'string' ? data.trigger.trim().toLowerCase() : 'general';

    let category: 'Coping' | 'Mindfulness' | 'Encouragement' = 'Mindfulness';
    if (
      data.suggestedCategory === 'Coping' ||
      data.suggestedCategory === 'Mindfulness' ||
      data.suggestedCategory === 'Encouragement'
    ) {
      category = data.suggestedCategory;
    } else {
      category = score <= 4 ? 'Coping' : score <= 7 ? 'Mindfulness' : 'Encouragement';
    }

    return {
      text,
      sentimentScore: score,
      trigger,
      suggestedCategory: category,
    };
  } catch (error) {
    console.warn('Gemini analytics engine failed, falling back to local analysis:', error);
    return localFallbackAnalysis(text);
  }
}
