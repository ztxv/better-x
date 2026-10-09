import { Database, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { clearStoredAccounts, storedAccountCount } from '../insights/accounts-store';
import type { LookupMode, Settings, SettingsPatch } from '../lib/settings';

const LOOKUPS: Array<{ value: LookupMode; label: string; hint: string }> = [
  {
    value: 'hover',
    label: 'When I point at it (recommended)',
    hint: 'A small globe appears beside the name; resting the pointer on it looks the account up.',
  },
  {
    value: 'manual',
    label: 'Only when I click',
    hint: 'Nothing is looked up until you click the globe beside a name.',
  },
  {
    value: 'visible',
    label: 'Automatically for posts on screen',
    hint: 'Looks up the accounts you are scrolling past, a few at a time, never ones off screen.',
  },
];

/**
 * The Account insights controls that are not on/off switches: when accounts are looked up, and
 * the local cache. The four badge switches above it are ordinary Customize features.
 */
export function InsightsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const refresh = useCallback(() => {
    void storedAccountCount()
      .then(setCount)
      .catch(() => setCount(null));
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <div className="smart-panel" data-panel="insights">
      <h3 id="lookup-title">Account lookups</h3>
      <div className="radio-list" role="radiogroup" aria-labelledby="lookup-title">
        {LOOKUPS.map((option) => (
          <label key={option.value} className="radio-option">
            <input
              type="radio"
              name="lookup-mode"
              checked={settings.insights.lookup === option.value}
              onChange={() => onChange({ insights: { lookup: option.value } })}
            />
            <span>
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="setting-hint">
        Lookups ask x.com, with your own signed-in session, the same “About this account” data X
        shows on a profile. Nothing goes anywhere else, and answers are kept on this device. Smart
        filtering looks up posts on screen whatever is chosen here.
      </p>
      <div className="smart-cache">
        <span>
          <Database size={14} aria-hidden="true" />{' '}
          <span aria-live="polite">
            {cleared
              ? 'Account cache cleared.'
              : count === null
                ? 'Account cache'
                : `${count} ${count === 1 ? 'account' : 'accounts'} cached`}
          </span>
        </span>
        <button
          type="button"
          className="link-button danger"
          disabled={count === 0}
          onClick={() => {
            void clearStoredAccounts().then(() => {
              setCleared(true);
              setCount(0);
            });
          }}
        >
          <Trash2 size={13} /> Clear account cache
        </button>
      </div>
    </div>
  );
}
