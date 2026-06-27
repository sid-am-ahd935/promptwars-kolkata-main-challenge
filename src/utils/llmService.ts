/**
 * LLM Service — Dynamic Coping Strategy Generator
 *
 * Utilizes the Google Gemini 1.5 Flash API to dynamically generate a specific,
 * non-medical, two-sentence actionable coping strategy for a user's trigger
 * and sentiment score.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Returns a static fallback coping strategy based on the sentiment score range.
 * Used if the Gemini API key is missing or the API call fails.
 */
export function getFallbackStrategy(trigger: string, sentimentScore: number): string {
  const normalizedTrigger = trigger === 'general' ? 'your current situation' : trigger;
  if (sentimentScore <= 4) {
    return `For ${normalizedTrigger}, take three slow, deep breaths, focus on what you can control right now, and step away for a short break.`;
  }
  if (sentimentScore <= 7) {
    return `Reflecting on ${normalizedTrigger} is a helpful practice. Consider writing down one small positive action you can take today.`;
  }
  return `Keep celebrating this positive momentum around ${normalizedTrigger}. Note what worked well so you can replicate it in the future.`;
}

/**
 * Dynamically generates a coping strategy using Gemini 1.5 Flash.
 * Returns a JSON schema-conforming response.
 *
 * @param trigger - The extracted trigger.
 * @param sentimentScore - The sentiment score (1-10).
 * @returns A promise resolving to a two-sentence coping strategy.
 */
export async function generateDynamicStrategy(
  trigger: string,
  sentimentScore: number
): Promise<string> {
  const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return getFallbackStrategy(trigger, sentimentScore);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
Act as a strict, empathetic mental wellness protocol engine.
Provide a specific, non-medical, two-sentence actionable coping strategy for a user experiencing a trigger of "${trigger}" with a sentiment score of ${sentimentScore}/10.
Output MUST be JSON matching this schema:
{
  "strategy": "string"
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed.strategy === 'string') {
      return parsed.strategy.trim();
    }
    throw new Error('Invalid JSON response schema');
  } catch (error) {
    console.warn('Gemini dynamic strategy failed, falling back to local strategy:', error);
    return getFallbackStrategy(trigger, sentimentScore);
  }
}
