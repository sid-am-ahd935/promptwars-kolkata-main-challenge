/**
 * Deterministic Sentiment & Trigger Parser — Unit Tests
 *
 * Tests analyzeJournalEntry for correct sentiment scaling, trigger
 * extraction, and category assignment. Updated to handle async pipeline.
 */

import { describe, it, expect } from 'vitest';
import { analyzeJournalEntry } from '../utils/analytics';

describe('analyzeJournalEntry', () => {
  // ---- Sentiment scoring ----

  it('assigns high sentiment score for positive text', async () => {
    const result = await analyzeJournalEntry('I feel happy and wonderful today, everything is great!');
    expect(result.sentimentScore).toBeGreaterThanOrEqual(7);
    expect(result.sentimentScore).toBeLessThanOrEqual(10);
  });

  it('assigns low sentiment score for negative text', async () => {
    const result = await analyzeJournalEntry('I am stressed, anxious, and overwhelmed by everything');
    expect(result.sentimentScore).toBeGreaterThanOrEqual(1);
    expect(result.sentimentScore).toBeLessThanOrEqual(4);
  });

  it('assigns neutral sentiment score for neutral text', async () => {
    const result = await analyzeJournalEntry('Today I went to the park and sat on a bench');
    expect(result.sentimentScore).toBeGreaterThanOrEqual(4);
    expect(result.sentimentScore).toBeLessThanOrEqual(7);
  });

  it('clamps sentiment score to minimum of 1', async () => {
    const result = await analyzeJournalEntry(
      'terrible awful miserable depressed overwhelmed panic struggling pain fear sad crying upset angry frustrated'
    );
    expect(result.sentimentScore).toBeGreaterThanOrEqual(1);
  });

  it('clamps sentiment score to maximum of 10', async () => {
    const result = await analyzeJournalEntry(
      'wonderful amazing great happy joyful excited proud confident grateful optimistic motivated accomplished peaceful'
    );
    expect(result.sentimentScore).toBeLessThanOrEqual(10);
  });

  it('returns integer sentiment score', async () => {
    const result = await analyzeJournalEntry('I feel okay about things');
    expect(Number.isInteger(result.sentimentScore)).toBe(true);
  });

  // ---- Trigger extraction ----

  it('extracts "exam" trigger for exam-related words', async () => {
    const result = await analyzeJournalEntry('My physics exam went badly today');
    expect(result.trigger).toBe('exam');
  });

  it('extracts "exam" trigger for "test"', async () => {
    const result = await analyzeJournalEntry('I have a test tomorrow and I am not ready');
    expect(result.trigger).toBe('exam');
  });

  it('extracts "exam" trigger for "study" and "homework"', async () => {
    const result1 = await analyzeJournalEntry('I need to study more');
    expect(result1.trigger).toBe('exam');

    const result2 = await analyzeJournalEntry('Homework is piling up');
    expect(result2.trigger).toBe('exam');
  });

  it('extracts "family" trigger for family-related words', async () => {
    const result = await analyzeJournalEntry('My parents are putting a lot of pressure on me');
    expect(result.trigger).toBe('family');
  });

  it('extracts "sleep" trigger for sleep-related words', async () => {
    const result = await analyzeJournalEntry('I am so tired and exhausted from insomnia');
    expect(result.trigger).toBe('sleep');
  });

  it('extracts "social" trigger for social-related words', async () => {
    const result = await analyzeJournalEntry('I feel lonely and isolated from my friends');
    expect(result.trigger).toBe('social');
  });

  it('returns "general" when no trigger keyword matches', async () => {
    const result = await analyzeJournalEntry('The weather was nice today');
    expect(result.trigger).toBe('general');
  });

  // ---- Category mapping ----

  it('maps low sentiment (1-4) to Coping category', async () => {
    const result = await analyzeJournalEntry('I am extremely sad depressed and miserable');
    expect(result.suggestedCategory).toBe('Coping');
  });

  it('maps medium sentiment (5-7) to Mindfulness category', async () => {
    const result = await analyzeJournalEntry('Today was an ordinary and quiet day');
    expect(result.suggestedCategory).toBe('Mindfulness');
  });

  it('maps high sentiment (8-10) to Encouragement category', async () => {
    const result = await analyzeJournalEntry('I feel amazing wonderful and excited about life!');
    expect(result.suggestedCategory).toBe('Encouragement');
  });

  // ---- Type safety & structure ----

  it('returns object with all required fields', async () => {
    const result = await analyzeJournalEntry('Just a normal day');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('sentimentScore');
    expect(result).toHaveProperty('trigger');
    expect(result).toHaveProperty('suggestedCategory');
  });

  it('preserves original text in output', async () => {
    const input = 'Today I went for a long walk by the river';
    const result = await analyzeJournalEntry(input);
    expect(result.text).toBe(input);
  });

  it('does not include id or timestamp in output', async () => {
    const result = await analyzeJournalEntry('Some text here');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('timestamp');
  });

  it('category is one of the three valid values', async () => {
    const validCategories = ['Coping', 'Mindfulness', 'Encouragement'];
    const inputs = [
      'terrible day',
      'okay day',
      'amazing day',
      'just a day',
    ];
    for (const input of inputs) {
      const result = await analyzeJournalEntry(input);
      expect(validCategories).toContain(result.suggestedCategory);
    }
  });

  it('handles empty-ish text without throwing', async () => {
    await expect(analyzeJournalEntry('')).resolves.not.toThrow();
    await expect(analyzeJournalEntry('   ')).resolves.not.toThrow();
    await expect(analyzeJournalEntry('a')).resolves.not.toThrow();
  });

  it('handles text with special characters', async () => {
    await expect(
      analyzeJournalEntry('I feel great! @#$%^&*() 123 :)')
    ).resolves.not.toThrow();
    const result = await analyzeJournalEntry('I feel great! @#$%^&*()');
    expect(result.sentimentScore).toBeGreaterThanOrEqual(1);
    expect(result.sentimentScore).toBeLessThanOrEqual(10);
  });
});
