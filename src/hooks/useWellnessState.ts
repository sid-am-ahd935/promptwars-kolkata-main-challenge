/**
 * Central State Management Hook — useWellnessState
 *
 * Encapsulates all application state, derived analytics, and side effects.
 * Uses useCallback for all mutators and useMemo for derived data to
 * minimize unnecessary re-renders.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  MentalWellnessState,
  JournalEntry,
  ActiveFilters,
} from '../types/wellness';
import { evaluateSafetyBoundary } from '../utils/safetyRouter';
import { analyzeJournalEntry } from '../utils/analytics';
import { fetchMcpContext, updateEpisodicGraph } from '../utils/mcpSync';
import { generateDynamicStrategy } from '../utils/llmService';

/** Generates a unique ID using timestamp + random suffix. */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Initial application state. */
const INITIAL_STATE: MentalWellnessState = {
  entries: [],
  isCrisisState: false,
  activeFilters: {
    category: 'all',
    dateRange: 'all',
  },
  episodicGraph: {
    nodes: [],
    edges: [],
  },
  mcpContext: [],
};

/** Trigger frequency data point. */
export interface TriggerFrequency {
  trigger: string;
  count: number;
}

/** Trend data point for sentiment charting. */
export interface TrendPoint {
  timestamp: string;
  sentimentScore: number;
  label: string;
}

/** Return type of the useWellnessState hook. */
export interface WellnessStateActions {
  state: MentalWellnessState;
  addEntry: (text: string) => void;
  setFilters: (filters: Partial<ActiveFilters>) => void;
  resetCrisis: () => void;
  filteredEntries: JournalEntry[];
  trendData: TrendPoint[];
  triggerFrequencies: TriggerFrequency[];
}

/**
 * Custom hook managing the complete Mental Wellness Tracker state.
 *
 * @returns State object and memoized action handlers.
 */
export function useWellnessState(): WellnessStateActions {
  const [state, setState] = useState<MentalWellnessState>(INITIAL_STATE);

  // Fetch MCP context on mount
  useEffect(() => {
    let cancelled = false;
    fetchMcpContext().then((context) => {
      if (!cancelled) {
        setState((prev) => ({ ...prev, mcpContext: context }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Updates the dynamic coping strategy for a specific entry. */
  const updateEntryStrategy = useCallback((id: string, strategy: string): void => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.map((e) =>
        e.id === id ? { ...e, dynamicStrategy: strategy } : e
      ),
    }));
  }, []);

  /**
   * Adds a new journal entry through the full processing pipeline:
   * 1. Analyze text for sentiment, trigger, and category
   * 2. Check safety boundary for crisis keywords
   * 3. Update episodic graph with relational data
   * 4. Commit to state
   * 5. Trigger asynchronous dynamic strategy generation
   */
  const addEntry = useCallback((text: string): void => {
    const trimmedText = text.trim();
    if (trimmedText.length === 0) return;

    const analysis = analyzeJournalEntry(trimmedText);
    const isCrisis = evaluateSafetyBoundary(trimmedText);

    const entryId = generateId();
    const entry: JournalEntry = {
      id: entryId,
      timestamp: new Date().toISOString(),
      ...analysis,
    };

    setState((prev) => ({
      ...prev,
      entries: [entry, ...prev.entries],
      isCrisisState: isCrisis || prev.isCrisisState,
      episodicGraph: updateEpisodicGraph(prev.episodicGraph, entry),
    }));

    // Trigger LLM strategy fetch asynchronously
    generateDynamicStrategy(entry.trigger, entry.sentimentScore).then((strategy) => {
      updateEntryStrategy(entryId, strategy);
    });
  }, [updateEntryStrategy]);


  /** Updates active filters (partial merge). */
  const setFilters = useCallback((filters: Partial<ActiveFilters>): void => {
    setState((prev) => ({
      ...prev,
      activeFilters: { ...prev.activeFilters, ...filters },
    }));
  }, []);

  /** Resets the crisis state flag. */
  const resetCrisis = useCallback((): void => {
    setState((prev) => ({ ...prev, isCrisisState: false }));
  }, []);

  /** Entries filtered by active category and date range. */
  const filteredEntries = useMemo((): JournalEntry[] => {
    let result = state.entries;

    if (state.activeFilters.category !== 'all') {
      result = result.filter(
        (e) => e.suggestedCategory === state.activeFilters.category
      );
    }

    if (state.activeFilters.dateRange !== 'all') {
      const now = new Date();
      let cutoff: Date;

      switch (state.activeFilters.dateRange) {
        case 'today':
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }

      result = result.filter((e) => new Date(e.timestamp) >= cutoff);
    }

    return result;
  }, [state.entries, state.activeFilters]);

  /** Sentiment trend data sorted chronologically. */
  const trendData = useMemo((): TrendPoint[] => {
    return [...state.entries]
      .reverse()
      .map((entry) => ({
        timestamp: entry.timestamp,
        sentimentScore: entry.sentimentScore,
        label: new Date(entry.timestamp).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        }),
      }));
  }, [state.entries]);

  /** Most frequently identified triggers, sorted descending by count. */
  const triggerFrequencies = useMemo((): TriggerFrequency[] => {
    const counts = new Map<string, number>();

    for (const entry of state.entries) {
      counts.set(entry.trigger, (counts.get(entry.trigger) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count);
  }, [state.entries]);

  return {
    state,
    addEntry,
    setFilters,
    resetCrisis,
    filteredEntries,
    trendData,
    triggerFrequencies,
  };
}
