/**
 * AppShell — Root Layout with Tab Navigation
 *
 * Provides dual-tab navigation between Journal and Analytics views,
 * plus a toggle for the Context Graph panel. Uses semantic HTML5 structure.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useWellnessState } from '../hooks/useWellnessState';
import JournalView from './JournalView';
import AnalyticsDashboard from './AnalyticsDashboard';
import ContextGraph from './ContextGraph';

type TabId = 'journal' | 'analytics';

const AppShell: React.FC = () => {
  const {
    state,
    activeUser,
    loginUser,
    addEntry,
    setFilters,
    resetCrisis,
    filteredEntries,
    trendData,
    triggerFrequencies,
  } = useWellnessState();

  const [activeTab, setActiveTab] = useState<TabId>('journal');
  const [showContextGraph, setShowContextGraph] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  const toggleContextGraph = useCallback(() => {
    setShowContextGraph((prev) => !prev);
  }, []);

  const handleLoginSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = usernameInput.trim();
    if (trimmed) {
      loginUser(trimmed);
      setUsernameInput('');
    }
  }, [usernameInput, loginUser]);

  const averageSentiment = useMemo(() => {
    if (state.entries.length === 0) return 0;
    const sum = state.entries.reduce((acc, e) => acc + e.sentimentScore, 0);
    return sum / state.entries.length;
  }, [state.entries]);

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-shell__header">
        <div className="app-shell__brand">
          <span className="app-shell__logo" aria-hidden="true">🧠</span>
          <div>
            <h1 className="app-shell__title">MindFlow</h1>
            <p className="app-shell__subtitle">Mental Wellness Tracker</p>
          </div>
        </div>

        {/* Profile Switch Gate */}
        <div className="app-shell__user-gate">
          <span className="app-shell__user-active" aria-live="polite">
            👤 {activeUser?.username || 'Guest'}
          </span>
          <form className="app-shell__user-form" onSubmit={handleLoginSubmit}>
            <input
              type="text"
              placeholder="Switch account..."
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="app-shell__user-input"
              aria-label="Username for profile gate"
            />
            <button type="submit" className="app-shell__user-btn" aria-label="Switch User">
              Switch
            </button>
          </form>
        </div>

        <button
          className={`app-shell__context-toggle ${showContextGraph ? 'app-shell__context-toggle--active' : ''}`}
          onClick={toggleContextGraph}
          aria-label={showContextGraph ? 'Hide context graph' : 'Show context graph'}
          aria-expanded={showContextGraph}
          type="button"
        >
          <span aria-hidden="true">🌐</span>
          <span className="app-shell__context-toggle-text">
            {showContextGraph ? 'Hide' : 'Show'} Context Graph
          </span>
        </button>
      </header>

      {/* Navigation */}
      <nav className="app-shell__nav" aria-label="Main navigation">
        <button
          className={`app-shell__tab ${activeTab === 'journal' ? 'app-shell__tab--active' : ''}`}
          onClick={() => handleTabChange('journal')}
          aria-selected={activeTab === 'journal'}
          aria-controls="panel-journal"
          role="tab"
          id="tab-journal"
          type="button"
          aria-label="Journal and companion view"
        >
          <span aria-hidden="true">📝</span> Journal
        </button>
        <button
          className={`app-shell__tab ${activeTab === 'analytics' ? 'app-shell__tab--active' : ''}`}
          onClick={() => handleTabChange('analytics')}
          aria-selected={activeTab === 'analytics'}
          aria-controls="panel-analytics"
          role="tab"
          id="tab-analytics"
          type="button"
          aria-label="Analytics dashboard view"
        >
          <span aria-hidden="true">📊</span> Analytics
        </button>
      </nav>

      {/* Main Content */}
      <main className="app-shell__main">
        {/* Context Graph Panel */}
        {showContextGraph && (
          <aside className="app-shell__context-panel" aria-label="Context graph panel">
            <ContextGraph
              graph={state.episodicGraph}
              mcpContext={state.mcpContext}
            />
          </aside>
        )}

        {/* Tab Panels */}
        <div className="app-shell__content">
          {activeTab === 'journal' && (
            <div
              id="panel-journal"
              role="tabpanel"
              aria-labelledby="tab-journal"
              className="app-shell__panel"
            >
              <JournalView
                entries={filteredEntries}
                isCrisisState={state.isCrisisState}
                onSubmitEntry={addEntry}
                onResetCrisis={resetCrisis}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div
              id="panel-analytics"
              role="tabpanel"
              aria-labelledby="tab-analytics"
              className="app-shell__panel"
            >
              <AnalyticsDashboard
                trendData={trendData}
                triggerFrequencies={triggerFrequencies}
                activeFilters={state.activeFilters}
                onFilterChange={setFilters}
                totalEntries={state.entries.length}
                averageSentiment={averageSentiment}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-shell__footer">
        <p>
          MindFlow — Built with care for mental wellness.
          If you&apos;re in crisis, please reach out to a helpline immediately.
        </p>
      </footer>
    </div>
  );
};

export default AppShell;
