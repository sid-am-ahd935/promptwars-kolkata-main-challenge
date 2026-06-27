/**
 * CrisisCard — Emergency Helpline Display
 *
 * Rendered when isCrisisState is true. Displays a prominent, accessible
 * warning card with real-world student emergency helpline numbers.
 */

import React from 'react';

interface CrisisCardProps {
  onDismiss: () => void;
}

interface Helpline {
  name: string;
  number: string;
  description: string;
}

const HELPLINES: readonly Helpline[] = [
  {
    name: 'NIMHANS',
    number: '080-46110007',
    description: 'National Institute of Mental Health and Neuro Sciences',
  },
  {
    name: 'Vandrevala Foundation',
    number: '1860-2662-345',
    description: '24/7 Mental Health Support Helpline',
  },
  {
    name: 'iCall',
    number: '9152987821',
    description: 'Psychosocial Helpline by TISS',
  },
  {
    name: 'AASRA',
    number: '9820466726',
    description: '24/7 Crisis Intervention Centre',
  },
] as const;

const CrisisCard: React.FC<CrisisCardProps> = ({ onDismiss }) => {
  return (
    <div
      className="crisis-card"
      role="alert"
      aria-live="assertive"
      aria-label="Crisis support information"
    >
      <div className="crisis-card__header">
        <span className="crisis-card__icon" aria-hidden="true">
          ⚠️
        </span>
        <h2 className="crisis-card__title">You Are Not Alone</h2>
      </div>

      <p className="crisis-card__message">
        We noticed some words in your entry that suggest you may be going through
        a difficult time. Please reach out to one of these helplines — trained
        professionals are available to support you.
      </p>

      <ul className="crisis-card__helplines" aria-label="Emergency helpline numbers">
        {HELPLINES.map((helpline) => (
          <li key={helpline.name} className="crisis-card__helpline">
            <div className="crisis-card__helpline-info">
              <strong className="crisis-card__helpline-name">
                {helpline.name}
              </strong>
              <span className="crisis-card__helpline-desc">
                {helpline.description}
              </span>
            </div>
            <a
              href={`tel:${helpline.number.replace(/[^0-9+]/g, '')}`}
              className="crisis-card__helpline-number"
              aria-label={`Call ${helpline.name} at ${helpline.number}`}
            >
              📞 {helpline.number}
            </a>
          </li>
        ))}
      </ul>

      <button
        className="crisis-card__dismiss"
        onClick={onDismiss}
        aria-label="Acknowledge crisis support information"
        type="button"
      >
        I understand, continue journaling
      </button>
    </div>
  );
};

export default CrisisCard;
