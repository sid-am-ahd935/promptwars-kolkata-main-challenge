/**
 * Mental Wellness Tracker — Domain Type Definitions
 *
 * Strict TypeScript interfaces for journal entries,
 * episodic graph memory, MCP context, and application state.
 */

/** A single journal reflection entry with deterministic sentiment analysis. */
export interface JournalEntry {
  id: string;
  timestamp: string;
  text: string;
  /** Sentiment score on a scale of 1 (most negative) to 10 (most positive). */
  sentimentScore: number;
  /** The primary trigger keyword extracted from the journal text. */
  trigger: string;
  /** Category derived from the sentiment score range. */
  suggestedCategory: 'Mindfulness' | 'Coping' | 'Encouragement';
}

/** A node in the episodic relational graph. */
export interface EpisodicNode {
  id: string;
  type: 'Trigger' | 'Emotion' | 'Score';
  label: string;
}

/** A directed edge in the episodic relational graph. */
export interface EpisodicEdge {
  from: string;
  to: string;
  relation: 'creates' | 'affects';
}

/** Relational map: [Trigger] -> (creates) -> [Emotion] -> (affects) -> [Score]. */
export interface EpisodicGraph {
  nodes: EpisodicNode[];
  edges: EpisodicEdge[];
}

/** A single record from the MCP mock study_logs.json file. */
export interface StudyLog {
  subject: string;
  date: string;
  type: string;
}

/** Active filter state for the analytics dashboard. */
export interface ActiveFilters {
  category: string;
  dateRange: string;
}

/** Root application state for the Mental Wellness Tracker. */
export interface MentalWellnessState {
  entries: JournalEntry[];
  isCrisisState: boolean;
  activeFilters: ActiveFilters;
  episodicGraph: EpisodicGraph;
  mcpContext: StudyLog[];
}
