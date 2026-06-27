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
  EpisodicGraph,
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

export interface UserProfile {
  id: string;
  username: string;
}

/** Return type of the useWellnessState hook. */
export interface WellnessStateActions {
  state: MentalWellnessState;
  activeUser: UserProfile | null;
  loginUser: (username: string) => Promise<void>;
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
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  // Initialize MCP context on mount
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

  // Initialize user profile session on boot
  useEffect(() => {
    const savedUser = localStorage.getItem('mindflow_active_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id && parsed.username) {
          setActiveUser(parsed);
          return;
        }
      } catch (e) {
        console.warn('Failed to parse saved user, clearing storage:', e);
        localStorage.removeItem('mindflow_active_user');
      }
    }

    // Default seed user
    const defaultUsername = 'default_user';
    fetch('/api/resolve-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: defaultUsername }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to resolve default user');
        return res.json();
      })
      .then((data) => {
        setActiveUser(data);
        localStorage.setItem('mindflow_active_user', JSON.stringify(data));
      })
      .catch((err) => {
        console.warn('Postgres profile seeding unavailable, running in local guest mode:', err);
        const offlineUser = { id: 'offline-uuid', username: defaultUsername };
        setActiveUser(offlineUser);
      });
  }, []);

  // Fetch reflections matching ONLY the active user profile context to prevent cross-pollution
  useEffect(() => {
    if (!activeUser) return;
    let cancelled = false;

    // Reset current list before loading next user
    setState((prev) => ({
      ...prev,
      entries: [],
      episodicGraph: { nodes: [], edges: [] },
    }));

    fetch(`/api/get-reflections?userId=${activeUser.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch user reflections');
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          let tempGraph: EpisodicGraph = { nodes: [], edges: [] };
          for (const entry of data) {
            tempGraph = updateEpisodicGraph(tempGraph, entry);
          }
          setState((prev) => ({
            ...prev,
            entries: data,
            episodicGraph: tempGraph,
          }));
        }
      })
      .catch((err) => {
        console.warn('Postgres connection unavailable, running client-side local memory:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activeUser]);

  /** Seeks or inserts profile context in Vercel Postgres database */
  const loginUser = useCallback(async (username: string): Promise<void> => {
    const cleanUsername = username.trim();
    if (!cleanUsername) return;

    try {
      const res = await fetch('/api/resolve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });
      if (!res.ok) throw new Error('API user resolution failed');
      const data = await res.json();
      setActiveUser(data);
      localStorage.setItem('mindflow_active_user', JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to resolve profile gate, running offline profile:', err);
      const offlineUser = { id: `offline-${Date.now()}`, username: cleanUsername };
      setActiveUser(offlineUser);
      localStorage.setItem('mindflow_active_user', JSON.stringify(offlineUser));
    }
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
   * 1. Check safety boundary synchronously first. If crisis, bypass all generative AI.
   * 2. Otherwise, add placeholder entry to show loading indicators.
   * 3. Trigger async Gemini analysis.
   * 4. Once analysis resolves, update the entry details and episodic graph.
   * 5. Save details to Vercel Postgres under active user profile context.
   * 6. Trigger async coping strategy generation using final metrics.
   */
  const addEntry = useCallback((text: string): void => {
    const trimmedText = text.trim();
    if (trimmedText.length === 0) return;

    const isCrisis = evaluateSafetyBoundary(trimmedText);
    const entryId = generateId();

    if (isCrisis) {
      // Synchronously bypass all generative elements
      const entry: JournalEntry = {
        id: entryId,
        timestamp: new Date().toISOString(),
        text: trimmedText,
        sentimentScore: 1,
        trigger: 'crisis',
        suggestedCategory: 'Coping',
        dynamicStrategy: 'Crisis hotline support is active. Please use the resources below.',
      };

      setState((prev) => ({
        ...prev,
        entries: [entry, ...prev.entries],
        isCrisisState: true,
        episodicGraph: updateEpisodicGraph(prev.episodicGraph, entry),
      }));

      // Async save crisis event to DB under user context
      fetch('/api/log-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmedText,
          sentimentScore: 1,
          trigger: 'crisis',
          suggestedCategory: 'Coping',
          userId: activeUser?.id,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Database insertion failed');
          return res.json();
        })
        .then((data) => {
          if (data && data.id) {
            setState((prev) => ({
              ...prev,
              entries: prev.entries.map((e) =>
                e.id === entryId ? { ...e, id: data.id, timestamp: data.timestamp } : e
              ),
            }));
          }
        })
        .catch((err) => {
          console.warn('Failed to persist crisis event:', err);
        });

      return;
    }

    // Render loading placeholders for the analytics metrics
    const placeholderEntry: JournalEntry = {
      id: entryId,
      timestamp: new Date().toISOString(),
      text: trimmedText,
      sentimentScore: 5,
      trigger: 'analyzing...',
      suggestedCategory: 'Mindfulness',
    };

    setState((prev) => ({
      ...prev,
      entries: [placeholderEntry, ...prev.entries],
    }));

    // Trigger async Gemini LLM analysis
    let finalAnalysis: any = null;
    analyzeJournalEntry(trimmedText)
      .then((analysis) => {
        finalAnalysis = analysis;
        setState((prev) => {
          const updatedEntries = prev.entries.map((e) =>
            e.id === entryId ? { ...e, ...analysis } : e
          );
          const resolvedEntry = updatedEntries.find((e) => e.id === entryId) || placeholderEntry;

          return {
            ...prev,
            entries: updatedEntries,
            episodicGraph: updateEpisodicGraph(prev.episodicGraph, resolvedEntry),
          };
        });

        // Trigger dynamic strategy after analytics resolve
        return generateDynamicStrategy(analysis.trigger, analysis.sentimentScore);
      })
      .then((strategy) => {
        if (strategy) {
          updateEntryStrategy(entryId, strategy);
        }

        // Save entry details to Vercel Postgres database under user context
        if (finalAnalysis) {
          return fetch('/api/log-reflection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: trimmedText,
              sentimentScore: finalAnalysis.sentimentScore,
              trigger: finalAnalysis.trigger,
              suggestedCategory: finalAnalysis.suggestedCategory,
              userId: activeUser?.id,
            }),
          });
        }
        throw new Error('Analysis missing');
      })
      .then((res) => {
        if (!res.ok) throw new Error('Database insertion failed');
        return res.json();
      })
      .then((data) => {
        if (data && data.id) {
          setState((prev) => ({
            ...prev,
            entries: prev.entries.map((e) =>
              e.id === entryId ? { ...e, id: data.id, timestamp: data.timestamp } : e
            ),
          }));
        }
      })
      .catch((error) => {
        console.warn('Async analysis, strategy, or database save failed:', error);
      });
  }, [updateEntryStrategy, activeUser]);


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
    activeUser,
    loginUser,
    addEntry,
    setFilters,
    resetCrisis,
    filteredEntries,
    trendData,
    triggerFrequencies,
  };
}
