import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SliderFeature } from '../features/types';
import { Toggle } from './Toggle';

/** How often a drag is written to storage, so X follows the thumb without a write per pixel. */
const WRITE_EVERY_MS = 80;

/**
 * A feature with a number: the usual switch, and below it a slider that is live only while the
 * switch is on. The slider is a native range input, so arrow keys, Home/End and Page Up/Down
 * work, and a screen reader hears its value with the unit. While it is dragged the number shown
 * is the thumb's; storage is written at most every 80 ms and once more when the drag ends, and
 * every open X tab restyles as each write lands.
 */
export function SliderRow({
  feature,
  enabled,
  value,
  onToggle,
  onValue,
}: {
  feature: SliderFeature;
  enabled: boolean;
  value: number;
  onToggle: (on: boolean) => void;
  onValue: (value: number) => void;
}) {
  const { min, max, step, defaultValue, unit } = feature;
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const pending = useRef<number | null>(null);
  const lastWrite = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The stored number has caught up with the drag; show it again.
  useEffect(() => {
    if (draft === value) setDraft(null);
  }, [value, draft]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function flush() {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    lastWrite.current = Date.now();
    onValue(next);
  }
  function move(next: number) {
    setDraft(next);
    pending.current = next;
    const wait = lastWrite.current + WRITE_EVERY_MS - Date.now();
    if (wait <= 0) flush();
    else {
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, wait);
    }
  }
  function reset() {
    clearTimeout(timer.current);
    pending.current = null;
    setDraft(null);
    onValue(defaultValue);
  }

  const fill = ((shown - min) / (max - min)) * 100;
  return (
    <div className="slider-row" data-on={enabled}>
      <Toggle
        label={feature.title}
        hint={feature.description}
        checked={enabled}
        onChange={onToggle}
      />
      <div className="slider-control" aria-disabled={!enabled}>
        <input
          type="range"
          className="slider"
          min={min}
          max={max}
          step={step}
          value={shown}
          disabled={!enabled}
          aria-label={`${feature.title} value`}
          aria-valuetext={`${shown} ${unit}`}
          style={{ '--fill': `${fill}%` } as React.CSSProperties}
          onChange={(event) => move(Number(event.target.value))}
          onPointerUp={flush}
          onKeyUp={flush}
          onBlur={flush}
        />
        <output className="slider-value" aria-hidden="true">
          {shown}
          <span>{unit}</span>
        </output>
        <button
          type="button"
          className="icon-button slider-reset"
          aria-label={`Reset ${feature.title} to ${defaultValue} ${unit}`}
          title={`Reset to ${defaultValue} ${unit}`}
          disabled={!enabled || shown === defaultValue}
          onClick={reset}
        >
          <RotateCcw size={13} />
        </button>
      </div>
      {!enabled && <p className="slider-note">Turn on to adjust.</p>}
    </div>
  );
}
