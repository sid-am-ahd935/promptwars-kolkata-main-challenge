/**
 * ContextGraph — Episodic Graph Visualization & MCP Context Display
 *
 * Toggleable panel showing:
 * 1. MCP context (study logs table from mock service)
 * 2. Episodic graph (SVG node-link diagram)
 */

import React, { useMemo } from 'react';
import type { EpisodicGraph, StudyLog } from '../types/wellness';

interface ContextGraphProps {
  graph: EpisodicGraph;
  mcpContext: StudyLog[];
}

const GRAPH_WIDTH = 600;
const GRAPH_HEIGHT = 400;

/** Assigns positions to nodes in a layered layout by type. */
function layoutNodes(
  graph: EpisodicGraph
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  const triggers = graph.nodes.filter((n) => n.type === 'Trigger');
  const emotions = graph.nodes.filter((n) => n.type === 'Emotion');
  const scores = graph.nodes.filter((n) => n.type === 'Score');

  const layers = [
    { nodes: triggers, x: GRAPH_WIDTH * 0.15 },
    { nodes: emotions, x: GRAPH_WIDTH * 0.5 },
    { nodes: scores, x: GRAPH_WIDTH * 0.85 },
  ];

  for (const layer of layers) {
    const count = layer.nodes.length;
    layer.nodes.forEach((node, i) => {
      const y =
        count === 1
          ? GRAPH_HEIGHT / 2
          : 60 + (i / (count - 1)) * (GRAPH_HEIGHT - 120);
      positions.set(node.id, { x: layer.x, y });
    });
  }

  return positions;
}

/** Returns a color based on node type. */
function nodeColor(type: string): string {
  switch (type) {
    case 'Trigger':
      return 'var(--color-trigger)';
    case 'Emotion':
      return 'var(--color-emotion)';
    case 'Score':
      return 'var(--color-score)';
    default:
      return 'var(--color-text-muted)';
  }
}

const ContextGraph: React.FC<ContextGraphProps> = ({ graph, mcpContext }) => {
  const positions = useMemo(() => layoutNodes(graph), [graph]);

  return (
    <section className="context-graph" aria-label="Context graph and environmental data">
      {/* MCP Context Table */}
      <div className="context-graph__mcp">
        <h3 className="context-graph__section-title">
          <span aria-hidden="true">🔗</span> MCP Environmental Context
        </h3>
        <p className="context-graph__description">
          Upcoming academic events injected from the mock MCP service.
        </p>
        {mcpContext.length > 0 ? (
          <div className="context-graph__table-wrap">
            <table className="context-graph__table" aria-label="Upcoming study events">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                </tr>
              </thead>
              <tbody>
                {mcpContext.map((log, i) => (
                  <tr key={`${log.subject}-${i}`}>
                    <td>{log.subject}</td>
                    <td>
                      {new Date(log.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <span className="context-graph__badge">{log.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="context-graph__empty">No environmental context available.</p>
        )}
      </div>

      {/* Episodic Graph Visualization */}
      <div className="context-graph__episodic">
        <h3 className="context-graph__section-title">
          <span aria-hidden="true">🧠</span> Episodic Memory Graph
        </h3>
        <p className="context-graph__description">
          Relational map: Trigger → creates → Emotion → affects → Score
        </p>

        {graph.nodes.length > 0 ? (
          <svg
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            role="img"
            aria-label={`Episodic memory graph with ${graph.nodes.length} nodes and ${graph.edges.length} connections`}
            className="context-graph__svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill="var(--color-text-muted)"
                  opacity="0.6"
                />
              </marker>
            </defs>

            {/* Layer labels */}
            <text x={GRAPH_WIDTH * 0.15} y="30" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)" fontWeight="600">
              Triggers
            </text>
            <text x={GRAPH_WIDTH * 0.5} y="30" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)" fontWeight="600">
              Emotions
            </text>
            <text x={GRAPH_WIDTH * 0.85} y="30" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)" fontWeight="600">
              Scores
            </text>

            {/* Edges */}
            {graph.edges.map((edge, i) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;

              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2 - 10;

              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={from.x + 30}
                    y1={from.y}
                    x2={to.x - 30}
                    y2={to.y}
                    stroke="var(--color-text-muted)"
                    strokeWidth="1.5"
                    opacity="0.4"
                    markerEnd="url(#arrowhead)"
                  />
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fontSize="9"
                    fill="var(--color-text-muted)"
                    opacity="0.7"
                    fontStyle="italic"
                  >
                    {edge.relation}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {graph.nodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;

              return (
                <g key={node.id} className="context-graph__node">
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="24"
                    fill={nodeColor(node.type)}
                    opacity="0.15"
                    stroke={nodeColor(node.type)}
                    strokeWidth="2"
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="6"
                    fill={nodeColor(node.type)}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 36}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--color-text-secondary)"
                    fontWeight="500"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="context-graph__empty-graph">
            <span aria-hidden="true">🌐</span>
            <p>Graph will populate as you add journal entries.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ContextGraph;
