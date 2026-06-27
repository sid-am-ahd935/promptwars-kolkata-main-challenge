/**
 * SpeechToText Hook — Unit Tests
 *
 * Asserts hook initialization, exposure of control APIs, and support detection.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpeechToText } from '../hooks/useSpeechToText';

describe('useSpeechToText', () => {
  it('initializes with default isListening set to false', () => {
    const { result } = renderHook(() => useSpeechToText());
    expect(result.current.isListening).toBe(false);
  });

  it('initializes with an empty transcript string', () => {
    const { result } = renderHook(() => useSpeechToText());
    expect(result.current.transcript).toBe('');
  });

  it('exposes startListening and stopListening control interfaces', () => {
    const { result } = renderHook(() => useSpeechToText());
    expect(typeof result.current.startListening).toBe('function');
    expect(typeof result.current.stopListening).toBe('function');
  });

  it('detects SpeechRecognition availability safely in test environment', () => {
    const { result } = renderHook(() => useSpeechToText());
    // Since window.SpeechRecognition is missing in default jsdom test environments,
    // it should gracefully evaluate to false.
    expect(result.current.isSupported).toBe(false);
  });
});
