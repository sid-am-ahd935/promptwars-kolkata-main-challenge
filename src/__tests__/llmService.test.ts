/**
 * LLM Service — Unit Tests
 *
 * Asserts fallback behaviors, strategy mapping, and graceful error handling.
 */

import { describe, it, expect } from 'vitest';
import { generateDynamicStrategy, getFallbackStrategy } from '../utils/llmService';

describe('llmService', () => {
  // ---- Fallback Strategy Builder ----

  it('generates coping fallback strategy when score <= 4', () => {
    const strategy = getFallbackStrategy('exam', 3);
    expect(strategy).toContain('For exam');
    expect(strategy).toContain('take three slow, deep breaths');
  });

  it('generates mindfulness fallback strategy when score 5-7', () => {
    const strategy = getFallbackStrategy('family', 6);
    expect(strategy).toContain('Reflecting on family is a helpful practice');
  });

  it('generates encouragement fallback strategy when score 8-10', () => {
    const strategy = getFallbackStrategy('social', 9);
    expect(strategy).toContain('positive momentum around social');
  });

  it('handles general trigger cleanly in fallbacks', () => {
    const strategy = getFallbackStrategy('general', 2);
    expect(strategy).toContain('your current situation');
  });

  // ---- API Boundary & Fallbacks ----

  it('gracefully falls back to local strategies when API key is missing', async () => {
    // In test environment, VITE_GEMINI_API_KEY is not set, so it triggers fallback
    const strategy = await generateDynamicStrategy('exam', 3);
    expect(strategy).toBe(getFallbackStrategy('exam', 3));
  });
});
