/**
 * Safety Router — Unit Tests
 *
 * Tests evaluateSafetyBoundary for accurate crisis keyword flagging,
 * case insensitivity, and safe boundary handling.
 */

import { describe, it, expect } from 'vitest';
import { evaluateSafetyBoundary } from '../utils/safetyRouter';

describe('evaluateSafetyBoundary', () => {
  // ---- Crisis keyword detection ----

  it('flags "suicide" as a crisis keyword', () => {
    expect(evaluateSafetyBoundary('I have been thinking about suicide')).toBe(true);
  });

  it('flags "self-harm" as a crisis keyword', () => {
    expect(evaluateSafetyBoundary('I have thoughts of self-harm')).toBe(true);
  });

  it('flags "self harm" without hyphen', () => {
    expect(evaluateSafetyBoundary('I have been doing self harm')).toBe(true);
  });

  it('flags "kill myself"', () => {
    expect(evaluateSafetyBoundary('I want to kill myself')).toBe(true);
  });

  it('flags "end my life"', () => {
    expect(evaluateSafetyBoundary('I want to end my life')).toBe(true);
  });

  it('flags "want to die"', () => {
    expect(evaluateSafetyBoundary('I want to die')).toBe(true);
  });

  it('flags "hopeless"', () => {
    expect(evaluateSafetyBoundary('Everything feels hopeless')).toBe(true);
  });

  it('flags "no reason to live"', () => {
    expect(evaluateSafetyBoundary('There is no reason to live anymore')).toBe(true);
  });

  it('flags "cannot go on"', () => {
    expect(evaluateSafetyBoundary('I cannot go on like this')).toBe(true);
  });

  it('flags "hurt myself"', () => {
    expect(evaluateSafetyBoundary('I might hurt myself')).toBe(true);
  });

  // ---- Case insensitivity ----

  it('flags "SEVERE CLINICAL DEPRESSION" (uppercase)', () => {
    expect(evaluateSafetyBoundary('I have SEVERE CLINICAL DEPRESSION')).toBe(true);
  });

  it('flags "SuIcIdE" (mixed case)', () => {
    expect(evaluateSafetyBoundary('SuIcIdE is on my mind')).toBe(true);
  });

  it('flags "Self-Harm" (capitalized)', () => {
    expect(evaluateSafetyBoundary('Self-Harm thoughts are common')).toBe(true);
  });

  // ---- Safe (non-crisis) inputs ----

  it('returns false for positive text', () => {
    expect(evaluateSafetyBoundary('I had a really good day today')).toBe(false);
  });

  it('returns false for neutral text', () => {
    expect(evaluateSafetyBoundary('I studied physics and went for a walk')).toBe(false);
  });

  it('returns false for text about exams', () => {
    expect(evaluateSafetyBoundary('My exam went well, I feel prepared')).toBe(false);
  });

  it('returns false for text with "help" in non-crisis context', () => {
    expect(evaluateSafetyBoundary('Can you help me with my homework?')).toBe(false);
  });

  // ---- Boundary handling ----

  it('returns false for empty string', () => {
    expect(evaluateSafetyBoundary('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(evaluateSafetyBoundary('   ')).toBe(false);
  });

  it('returns false for single space', () => {
    expect(evaluateSafetyBoundary(' ')).toBe(false);
  });

  it('handles null-like input gracefully', () => {
    // TypeScript should prevent this, but testing runtime safety
    expect(evaluateSafetyBoundary(null as unknown as string)).toBe(false);
    expect(evaluateSafetyBoundary(undefined as unknown as string)).toBe(false);
  });

  it('handles very long input without errors', () => {
    const longText = 'I feel good today. '.repeat(1000);
    expect(evaluateSafetyBoundary(longText)).toBe(false);
  });

  it('handles very long input with crisis keyword', () => {
    const longText = 'I feel good today. '.repeat(500) + 'suicide' + ' I feel okay. '.repeat(500);
    expect(evaluateSafetyBoundary(longText)).toBe(true);
  });

  // ---- Substring matching ----

  it('detects crisis keyword embedded in a sentence', () => {
    expect(evaluateSafetyBoundary('Yesterday I was feeling hopeless about everything')).toBe(true);
  });
});
