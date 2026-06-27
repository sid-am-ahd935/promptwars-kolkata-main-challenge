/**
 * MCP Mock Service & Episodic Graph Memory
 *
 * Simulates a Model Context Protocol (MCP) service that fetches static
 * study_logs.json data and exposes it as environmental context.
 * Also manages the episodic relational graph:
 *   [Trigger] -> (creates) -> [Emotion] -> (affects) -> [SentimentScore]
 */

import type {
  StudyLog,
  EpisodicGraph,
  EpisodicNode,
  EpisodicEdge,
  JournalEntry,
} from '../types/wellness';

/**
 * Maps a sentiment score range to an emotion label.
 */
function scoreToEmotion(score: number): string {
  if (score <= 2) return 'Distress';
  if (score <= 4) return 'Anxiety';
  if (score <= 5) return 'Neutral';
  if (score <= 7) return 'Calm';
  if (score <= 9) return 'Joy';
  return 'Euphoria';
}

/**
 * Generates a deterministic node ID from type and label.
 */
function nodeId(type: EpisodicNode['type'], label: string): string {
  return `${type}:${label.toLowerCase()}`;
}

/**
 * Fetches the static study_logs.json file from the public directory.
 * This simulates an MCP service providing environmental context
 * (upcoming exams, deadlines) to the analytics engine.
 *
 * @returns A promise resolving to an array of StudyLog records.
 */
export async function fetchMcpContext(): Promise<StudyLog[]> {
  try {
    const response = await fetch('/study_logs.json');
    if (!response.ok) {
      console.warn(`MCP context fetch failed: ${response.status}`);
      return [];
    }
    const data: StudyLog[] = await response.json();
    return data;
  } catch (error) {
    console.warn('MCP context unavailable, using empty context:', error);
    return [];
  }
}

/**
 * Updates the episodic relational graph with data from a new journal entry.
 * This is a pure function — it returns a new graph without mutating the input.
 *
 * Graph structure per entry:
 *   [Trigger node] --(creates)--> [Emotion node] --(affects)--> [Score node]
 *
 * Nodes are deduplicated by their composite ID (type + label).
 *
 * @param graph - The current episodic graph state.
 * @param entry - The journal entry to incorporate.
 * @returns A new EpisodicGraph with the entry's nodes and edges added.
 */
export function updateEpisodicGraph(
  graph: EpisodicGraph,
  entry: JournalEntry
): EpisodicGraph {
  const emotion = scoreToEmotion(entry.sentimentScore);
  const scoreLabel = `Score: ${entry.sentimentScore}`;

  // Define the three nodes for this entry
  const triggerNode: EpisodicNode = {
    id: nodeId('Trigger', entry.trigger),
    type: 'Trigger',
    label: entry.trigger,
  };

  const emotionNode: EpisodicNode = {
    id: nodeId('Emotion', emotion),
    type: 'Emotion',
    label: emotion,
  };

  const scoreNode: EpisodicNode = {
    id: nodeId('Score', scoreLabel),
    type: 'Score',
    label: scoreLabel,
  };

  // Define the two edges for this entry
  const triggerToEmotion: EpisodicEdge = {
    from: triggerNode.id,
    to: emotionNode.id,
    relation: 'creates',
  };

  const emotionToScore: EpisodicEdge = {
    from: emotionNode.id,
    to: scoreNode.id,
    relation: 'affects',
  };

  // Deduplicate nodes by ID
  const existingNodeIds = new Set(graph.nodes.map((n) => n.id));
  const newNodes = [triggerNode, emotionNode, scoreNode].filter(
    (n) => !existingNodeIds.has(n.id)
  );

  // Deduplicate edges by composite key
  const existingEdgeKeys = new Set(
    graph.edges.map((e) => `${e.from}|${e.to}|${e.relation}`)
  );
  const newEdges = [triggerToEmotion, emotionToScore].filter(
    (e) => !existingEdgeKeys.has(`${e.from}|${e.to}|${e.relation}`)
  );

  return {
    nodes: [...graph.nodes, ...newNodes],
    edges: [...graph.edges, ...newEdges],
  };
}
