/**
 * SentimentChart — SVG Trend Line Visualization
 *
 * Renders a pure SVG line/area chart of sentiment score trends over time.
 * Fully accessible with role="img" and descriptive aria-label.
 */

import React, { useMemo } from 'react';
import type { TrendPoint } from '../hooks/useWellnessState';

interface SentimentChartProps {
  data: TrendPoint[];
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 280;
const PADDING_X = 50;
const PADDING_Y = 30;
const PLOT_WIDTH = CHART_WIDTH - PADDING_X * 2;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_Y * 2;
const MIN_SCORE = 1;
const MAX_SCORE = 10;

const SentimentChart: React.FC<SentimentChartProps> = ({ data }) => {
  const points = useMemo(() => {
    if (data.length === 0) return [];

    return data.map((d, i) => {
      const x =
        data.length === 1
          ? PADDING_X + PLOT_WIDTH / 2
          : PADDING_X + (i / (data.length - 1)) * PLOT_WIDTH;
      const y =
        PADDING_Y +
        PLOT_HEIGHT -
        ((d.sentimentScore - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) *
          PLOT_HEIGHT;
      return { x, y, ...d };
    });
  }, [data]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const bottom = PADDING_Y + PLOT_HEIGHT;
    return `${linePath} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  }, [linePath, points]);

  /** Maps score to a color on a red-yellow-green gradient. */
  const scoreColor = (score: number): string => {
    const ratio = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
    if (ratio < 0.4) return 'var(--color-danger)';
    if (ratio < 0.7) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  if (data.length === 0) {
    return (
      <div className="sentiment-chart sentiment-chart--empty" aria-label="Sentiment trend chart - no data yet">
        <div className="sentiment-chart__placeholder">
          <span className="sentiment-chart__placeholder-icon" aria-hidden="true">📊</span>
          <p>Add journal entries to see your sentiment trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sentiment-chart">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`Sentiment trend chart showing ${data.length} data points with scores ranging from ${Math.min(...data.map((d) => d.sentimentScore))} to ${Math.max(...data.map((d) => d.sentimentScore))}`}
        className="sentiment-chart__svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
          const y =
            PADDING_Y +
            PLOT_HEIGHT -
            ((score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)) * PLOT_HEIGHT;
          return (
            <g key={`grid-${score}`}>
              <line
                x1={PADDING_X}
                y1={y}
                x2={PADDING_X + PLOT_WIDTH}
                y2={y}
                stroke="var(--color-grid)"
                strokeWidth="0.5"
                strokeDasharray={score === 5 ? '0' : '4 4'}
                opacity={score === 5 ? 0.5 : 0.2}
              />
              <text
                x={PADDING_X - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-text-muted)"
              >
                {score}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" />

        {/* Trend line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={`point-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill={scoreColor(p.sentimentScore)}
              stroke="var(--color-surface)"
              strokeWidth="2"
              className="sentiment-chart__point"
            />
            {/* Label (show for every other point or if few points) */}
            {(data.length <= 8 || i % 2 === 0) && (
              <text
                x={p.x}
                y={PADDING_Y + PLOT_HEIGHT + 18}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-muted)"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

export default SentimentChart;
