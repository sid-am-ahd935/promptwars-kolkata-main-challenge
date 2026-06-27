/**
 * AnalyticsDashboard — Sentiment Trends & Trigger Frequency
 *
 * Displays sentiment score trends via SVG chart and lists the most
 * frequently identified triggers with visual bar representations.
 * Includes filter controls for category and date range.
 */

import React, { useCallback } from 'react';
import type { ActiveFilters } from '../types/wellness';
import type { TrendPoint, TriggerFrequency } from '../hooks/useWellnessState';
import SentimentChart from './SentimentChart';

interface AnalyticsDashboardProps {
  trendData: TrendPoint[];
  triggerFrequencies: TriggerFrequency[];
  activeFilters: ActiveFilters;
  onFilterChange: (filters: Partial<ActiveFilters>) => void;
  totalEntries: number;
  averageSentiment: number;
}

const CATEGORIES = ['all', 'Coping', 'Mindfulness', 'Encouragement'] as const;
const DATE_RANGES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  trendData,
  triggerFrequencies,
  activeFilters,
  onFilterChange,
  totalEntries,
  averageSentiment,
}) => {
  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ category: e.target.value });
    },
    [onFilterChange]
  );

  const handleDateRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ dateRange: e.target.value });
    },
    [onFilterChange]
  );

  const maxTriggerCount = triggerFrequencies.length > 0
    ? Math.max(...triggerFrequencies.map((t) => t.count))
    : 1;

  return (
    <section className="analytics-dashboard" aria-label="Analytics dashboard">
      {/* Summary Cards */}
      <div className="analytics-dashboard__summary">
        <div className="analytics-dashboard__stat-card">
          <span className="analytics-dashboard__stat-icon" aria-hidden="true">📊</span>
          <div className="analytics-dashboard__stat-content">
            <span className="analytics-dashboard__stat-value">{totalEntries}</span>
            <span className="analytics-dashboard__stat-label">Total Entries</span>
          </div>
        </div>
        <div className="analytics-dashboard__stat-card">
          <span className="analytics-dashboard__stat-icon" aria-hidden="true">💫</span>
          <div className="analytics-dashboard__stat-content">
            <span className="analytics-dashboard__stat-value">
              {averageSentiment > 0 ? averageSentiment.toFixed(1) : '—'}
            </span>
            <span className="analytics-dashboard__stat-label">Avg. Sentiment</span>
          </div>
        </div>
        <div className="analytics-dashboard__stat-card">
          <span className="analytics-dashboard__stat-icon" aria-hidden="true">🎯</span>
          <div className="analytics-dashboard__stat-content">
            <span className="analytics-dashboard__stat-value">
              {triggerFrequencies.length > 0 ? triggerFrequencies[0].trigger : '—'}
            </span>
            <span className="analytics-dashboard__stat-label">Top Trigger</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-dashboard__filters" aria-label="Dashboard filters">
        <div className="analytics-dashboard__filter">
          <label htmlFor="filter-category" className="analytics-dashboard__filter-label">
            Category
          </label>
          <select
            id="filter-category"
            className="analytics-dashboard__select"
            value={activeFilters.category}
            onChange={handleCategoryChange}
            aria-label="Filter by category"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
        <div className="analytics-dashboard__filter">
          <label htmlFor="filter-daterange" className="analytics-dashboard__filter-label">
            Time Range
          </label>
          <select
            id="filter-daterange"
            className="analytics-dashboard__select"
            value={activeFilters.dateRange}
            onChange={handleDateRangeChange}
            aria-label="Filter by date range"
          >
            {DATE_RANGES.map((dr) => (
              <option key={dr.value} value={dr.value}>
                {dr.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sentiment Trend Chart */}
      <div className="analytics-dashboard__chart-section">
        <h3 className="analytics-dashboard__section-title">Sentiment Trends</h3>
        <SentimentChart data={trendData} />
      </div>

      {/* Trigger Frequency */}
      <div className="analytics-dashboard__triggers-section">
        <h3 className="analytics-dashboard__section-title">Trigger Frequency</h3>
        {triggerFrequencies.length === 0 ? (
          <div className="analytics-dashboard__empty">
            <span aria-hidden="true">🔍</span>
            <p>No triggers identified yet. Add journal entries to see patterns.</p>
          </div>
        ) : (
          <ul className="analytics-dashboard__trigger-list" aria-label="Trigger frequency list">
            {triggerFrequencies.map((tf) => (
              <li key={tf.trigger} className="analytics-dashboard__trigger-item">
                <div className="analytics-dashboard__trigger-info">
                  <span className="analytics-dashboard__trigger-name">{tf.trigger}</span>
                  <span className="analytics-dashboard__trigger-count">{tf.count}</span>
                </div>
                <div className="analytics-dashboard__trigger-bar-track">
                  <div
                    className="analytics-dashboard__trigger-bar"
                    style={{ width: `${(tf.count / maxTriggerCount) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={tf.count}
                    aria-valuemin={0}
                    aria-valuemax={maxTriggerCount}
                    aria-label={`${tf.trigger}: ${tf.count} occurrences`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default AnalyticsDashboard;
