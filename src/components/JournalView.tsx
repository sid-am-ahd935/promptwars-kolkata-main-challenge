/**
 * JournalView — Journal Entry Input & Entry List
 *
 * Contains the open-ended text input area for daily reflections,
 * displays crisis card when triggered, and lists all journal entries
 * with sentiment badges and category tags.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { JournalEntry } from '../types/wellness';
import CrisisCard from './CrisisCard';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface JournalViewProps {
  entries: JournalEntry[];
  isCrisisState: boolean;
  onSubmitEntry: (text: string) => void;
  onResetCrisis: () => void;
}

/** Returns a sentiment badge class based on score range. */
function sentimentBadgeClass(score: number): string {
  if (score <= 4) return 'badge badge--danger';
  if (score <= 7) return 'badge badge--warning';
  return 'badge badge--success';
}

/** Returns a category tag class. */
function categoryClass(category: string): string {
  switch (category) {
    case 'Coping':
      return 'tag tag--coping';
    case 'Mindfulness':
      return 'tag tag--mindfulness';
    case 'Encouragement':
      return 'tag tag--encouragement';
    default:
      return 'tag';
  }
}

const JournalView: React.FC<JournalViewProps> = ({
  entries,
  isCrisisState,
  onSubmitEntry,
  onResetCrisis,
}) => {
  const [inputText, setInputText] = useState('');
  const [baseText, setBaseText] = useState('');

  const { isListening, transcript, startListening, stopListening, isSupported } = useSpeechToText();

  useEffect(() => {
    if (isListening && transcript) {
      const cleanBase = baseText.trim();
      setInputText(cleanBase ? `${cleanBase} ${transcript}` : transcript);
    }
  }, [transcript, isListening, baseText]);

  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      setBaseText(inputText);
      startListening();
    }
  }, [isListening, startListening, stopListening, inputText]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim().length === 0) return;
      if (isListening) {
        stopListening();
      }
      onSubmitEntry(inputText);
      setInputText('');
    },
    [inputText, onSubmitEntry, isListening, stopListening]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (inputText.trim().length > 0) {
          if (isListening) {
            stopListening();
          }
          onSubmitEntry(inputText);
          setInputText('');
        }
      }
    },
    [inputText, onSubmitEntry, isListening, stopListening]
  );

  return (
    <section className="journal-view" aria-label="Journal and companion view">
      {/* Crisis Card */}
      {isCrisisState && <CrisisCard onDismiss={onResetCrisis} />}

      {/* Journal Input */}
      <form
        className="journal-view__form"
        onSubmit={handleSubmit}
        aria-label="Journal entry form"
      >
        <label htmlFor="journal-input" className="journal-view__label">
          How are you feeling today?
        </label>
        <textarea
          id="journal-input"
          className="journal-view__textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your thoughts, reflections, or anything on your mind..."
          rows={5}
          aria-label="Journal entry input"
          aria-describedby="journal-hint"
        />
        <div className="journal-view__actions">
          <span id="journal-hint" className="journal-view__hint">
            Press Ctrl+Enter to submit quickly
          </span>
          <div className="journal-view__button-group">
            {isSupported && (
              <button
                type="button"
                className={`journal-view__mic-btn ${isListening ? 'journal-view__mic-btn--listening' : ''}`}
                onClick={handleMicToggle}
                aria-label={isListening ? 'Stop Voice Journal' : 'Use Voice Journal'}
                aria-pressed={isListening}
              >
                {isListening ? '🎙️ Listening...' : '🎙️ Voice Input'}
              </button>
            )}
            <button
              type="submit"
              className="journal-view__submit"
              disabled={inputText.trim().length === 0}
              aria-label="Submit journal entry"
            >
              <span aria-hidden="true">✨</span> Log Reflection
            </button>
          </div>
        </div>
      </form>

      {/* Entry List */}
      <div
        className="journal-view__entries"
        aria-live="polite"
        aria-label="Journal entries list"
      >
        <h3 className="journal-view__entries-title">
          Recent Reflections
          {entries.length > 0 && (
            <span className="journal-view__count">{entries.length}</span>
          )}
        </h3>

        {entries.length === 0 ? (
          <div className="journal-view__empty">
            <span className="journal-view__empty-icon" aria-hidden="true">📝</span>
            <p>Your journal is empty. Start by writing your first reflection above.</p>
          </div>
        ) : (
          <ul className="journal-view__list" aria-label="List of journal entries">
            {entries.map((entry) => {
              const isAnalyzing = entry.trigger === 'analyzing...';
              return (
                <li key={entry.id} className={`journal-view__entry ${isAnalyzing ? 'journal-view__entry--analyzing' : ''}`}>
                  <div className="journal-view__entry-header">
                    <time
                      className="journal-view__entry-time"
                      dateTime={entry.timestamp}
                    >
                      {new Date(entry.timestamp).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {!isAnalyzing && (
                      <div className="journal-view__entry-meta">
                        <span
                          className={sentimentBadgeClass(entry.sentimentScore)}
                          aria-label={`Sentiment score: ${entry.sentimentScore} out of 10`}
                        >
                          {entry.sentimentScore}/10
                        </span>
                        <span
                          className={categoryClass(entry.suggestedCategory)}
                          aria-label={`Category: ${entry.suggestedCategory}`}
                        >
                          {entry.suggestedCategory}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="journal-view__entry-text">{entry.text}</p>
                  {isAnalyzing ? (
                    <div className="journal-view__strategy-box" aria-live="polite">
                      <p className="journal-view__strategy-text journal-view__strategy-text--loading">
                        Analyzing reflection and identifying mental wellness triggers...
                      </p>
                    </div>
                  ) : (
                    <div className="journal-view__strategy-box">
                      <strong className="journal-view__strategy-title">
                        💡 Dynamic Strategy ({entry.suggestedCategory})
                      </strong>
                      {entry.dynamicStrategy ? (
                        <p className="journal-view__strategy-text" aria-live="polite">
                          {entry.dynamicStrategy}
                        </p>
                      ) : (
                        <p className="journal-view__strategy-text journal-view__strategy-text--loading" aria-live="polite">
                          Generating personalized strategy...
                        </p>
                      )}
                    </div>
                  )}
                  {!isAnalyzing && (
                    <div className="journal-view__entry-footer">
                      <span className="journal-view__trigger" aria-label={`Trigger: ${entry.trigger}`}>
                        <span aria-hidden="true">🔍</span> {entry.trigger}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default JournalView;
