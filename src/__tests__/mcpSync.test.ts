/**
 * MCP Sync & Episodic Graph — Unit Tests
 *
 * Tests updateEpisodicGraph for correct node/edge creation,
 * deduplication, and structural integrity.
 */

import { describe, it, expect } from 'vitest';
import { updateEpisodicGraph } from '../utils/mcpSync';
import type { EpisodicGraph, JournalEntry } from '../types/wellness';

/** Creates a test journal entry with specified overrides. */
function createTestEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'test-1',
    timestamp: new Date().toISOString(),
    text: 'Test journal entry',
    sentimentScore: 5,
    trigger: 'exam',
    suggestedCategory: 'Mindfulness',
    ...overrides,
  };
}

/** Creates an empty episodic graph. */
function createEmptyGraph(): EpisodicGraph {
  return { nodes: [], edges: [] };
}

describe('updateEpisodicGraph', () => {
  // ---- Node creation ----

  it('adds three nodes for a new entry (Trigger, Emotion, Score)', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry();
    const result = updateEpisodicGraph(graph, entry);
    expect(result.nodes).toHaveLength(3);
  });

  it('creates a Trigger node with the entry trigger label', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ trigger: 'exam' });
    const result = updateEpisodicGraph(graph, entry);
    const triggerNode = result.nodes.find((n) => n.type === 'Trigger');
    expect(triggerNode).toBeDefined();
    expect(triggerNode!.label).toBe('exam');
  });

  it('creates an Emotion node derived from sentiment score', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 5 });
    const result = updateEpisodicGraph(graph, entry);
    const emotionNode = result.nodes.find((n) => n.type === 'Emotion');
    expect(emotionNode).toBeDefined();
    expect(emotionNode!.label).toBe('Neutral');
  });

  it('creates a Score node with the numeric score label', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 7 });
    const result = updateEpisodicGraph(graph, entry);
    const scoreNode = result.nodes.find((n) => n.type === 'Score');
    expect(scoreNode).toBeDefined();
    expect(scoreNode!.label).toBe('Score: 7');
  });

  // ---- Edge creation ----

  it('adds two edges per entry', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry();
    const result = updateEpisodicGraph(graph, entry);
    expect(result.edges).toHaveLength(2);
  });

  it('creates a "creates" edge from Trigger to Emotion', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry();
    const result = updateEpisodicGraph(graph, entry);
    const createsEdge = result.edges.find((e) => e.relation === 'creates');
    expect(createsEdge).toBeDefined();
    expect(createsEdge!.from).toContain('Trigger');
    expect(createsEdge!.to).toContain('Emotion');
  });

  it('creates an "affects" edge from Emotion to Score', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry();
    const result = updateEpisodicGraph(graph, entry);
    const affectsEdge = result.edges.find((e) => e.relation === 'affects');
    expect(affectsEdge).toBeDefined();
    expect(affectsEdge!.from).toContain('Emotion');
    expect(affectsEdge!.to).toContain('Score');
  });

  // ---- Deduplication ----

  it('deduplicates nodes with the same trigger', () => {
    let graph = createEmptyGraph();
    const entry1 = createTestEntry({ id: 'e1', trigger: 'exam', sentimentScore: 5 });
    const entry2 = createTestEntry({ id: 'e2', trigger: 'exam', sentimentScore: 5 });

    graph = updateEpisodicGraph(graph, entry1);
    graph = updateEpisodicGraph(graph, entry2);

    const triggerNodes = graph.nodes.filter((n) => n.type === 'Trigger' && n.label === 'exam');
    expect(triggerNodes).toHaveLength(1);
  });

  it('does not duplicate emotion nodes with same label', () => {
    let graph = createEmptyGraph();
    // Both score 5 → same "Neutral" emotion
    const entry1 = createTestEntry({ id: 'e1', trigger: 'exam', sentimentScore: 5 });
    const entry2 = createTestEntry({ id: 'e2', trigger: 'family', sentimentScore: 5 });

    graph = updateEpisodicGraph(graph, entry1);
    graph = updateEpisodicGraph(graph, entry2);

    const neutralNodes = graph.nodes.filter((n) => n.type === 'Emotion' && n.label === 'Neutral');
    expect(neutralNodes).toHaveLength(1);
  });

  it('adds new nodes for different triggers', () => {
    let graph = createEmptyGraph();
    const entry1 = createTestEntry({ id: 'e1', trigger: 'exam', sentimentScore: 3 });
    const entry2 = createTestEntry({ id: 'e2', trigger: 'family', sentimentScore: 8 });

    graph = updateEpisodicGraph(graph, entry1);
    graph = updateEpisodicGraph(graph, entry2);

    const triggerNodes = graph.nodes.filter((n) => n.type === 'Trigger');
    expect(triggerNodes).toHaveLength(2);
  });

  // ---- Edge deduplication ----

  it('does not duplicate edges for identical relationships', () => {
    let graph = createEmptyGraph();
    const entry1 = createTestEntry({ id: 'e1', trigger: 'exam', sentimentScore: 5 });
    const entry2 = createTestEntry({ id: 'e2', trigger: 'exam', sentimentScore: 5 });

    graph = updateEpisodicGraph(graph, entry1);
    graph = updateEpisodicGraph(graph, entry2);

    // Same trigger + same sentiment → same edges
    expect(graph.edges).toHaveLength(2);
  });

  // ---- Immutability ----

  it('does not mutate the original graph', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry();
    const result = updateEpisodicGraph(graph, entry);

    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  // ---- Emotion mapping coverage ----

  it('maps score 1 to Distress emotion', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 1 });
    const result = updateEpisodicGraph(graph, entry);
    const emotion = result.nodes.find((n) => n.type === 'Emotion');
    expect(emotion!.label).toBe('Distress');
  });

  it('maps score 4 to Anxiety emotion', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 4 });
    const result = updateEpisodicGraph(graph, entry);
    const emotion = result.nodes.find((n) => n.type === 'Emotion');
    expect(emotion!.label).toBe('Anxiety');
  });

  it('maps score 7 to Calm emotion', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 7 });
    const result = updateEpisodicGraph(graph, entry);
    const emotion = result.nodes.find((n) => n.type === 'Emotion');
    expect(emotion!.label).toBe('Calm');
  });

  it('maps score 9 to Joy emotion', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 9 });
    const result = updateEpisodicGraph(graph, entry);
    const emotion = result.nodes.find((n) => n.type === 'Emotion');
    expect(emotion!.label).toBe('Joy');
  });

  it('maps score 10 to Euphoria emotion', () => {
    const graph = createEmptyGraph();
    const entry = createTestEntry({ sentimentScore: 10 });
    const result = updateEpisodicGraph(graph, entry);
    const emotion = result.nodes.find((n) => n.type === 'Emotion');
    expect(emotion!.label).toBe('Euphoria');
  });
});
