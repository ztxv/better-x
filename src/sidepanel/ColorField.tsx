import { Check, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** The accent colors X offers in its own display settings. */
export const X_COLORS: ReadonlyArray<{ label: string; value: number }> = [
  { label: 'Blue', value: 0x1d9bf0 },
  { label: 'Yellow', value: 0xffd400 },
  { label: 'Pink', value: 0xf91880 },
  { label: 'Purple', value: 0x7856ff },
  { label: 'Orange', value: 0xff7a00 },
  { label: 'Green', value: 0x00ba7c },
];
/** How often a color-picker drag is written to storage. */
const WRITE_EVERY_MS = 80;

export const toHex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;

/** `#1d9bf0`, `1d9bf0`, `#fa0` and `fa0` are all fine; anything else is not a color. */
export function parseHex(text: string): number | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!match) return null;
  const digits = match[1]!;
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits;
  return parseInt(full, 16);
}

/**
 * One color: optionally X's own accent colors as swatches, a native color picker (a drag is
 * written at most every 80 ms, and once at the end), a hex box (typing waits for a complete code,
 * so a half-typed one is never stored) and, with a `defaultValue`, a reset. Labels are built from
 * `label`, so every control is named for screen readers.
 */
export function ColorField({
  label,
  value,
  defaultValue,
  swatches = false,
  disabled = false,
  onValue,
}: {
  label: string;
  value: number;
  defaultValue?: number;
  swatches?: boolean;
  disabled?: boolean;
  onValue: (value: number) => void;
}) {
  const [text, setText] = useState(toHex(value));
  const [typing, setTyping] = useState(false);
  const lastWrite = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<number | null>(null);

  // Follow the stored color unless the person is in the middle of typing a code.
  useEffect(() => {
    if (!typing) setText(toHex(value));
  }, [value, typing]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function flush() {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    lastWrite.current = Date.now();
    onValue(next);
  }
  function drag(next: number) {
    pending.current = next;
    const wait = lastWrite.current + WRITE_EVERY_MS - Date.now();
    if (wait <= 0) flush();
    else {
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, wait);
    }
  }
  const parsed = parseHex(text);
  const invalid = typing && text.trim() !== '' && parsed === null;

  return (
    <div className="color-control" aria-disabled={disabled}>
      {swatches && (
        <div className="color-swatches" role="radiogroup" aria-label={`${label} presets`}>
          {X_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={value === color.value}
              aria-label={color.label}
              title={color.label}
              disabled={disabled}
              className={`swatch ${value === color.value ? 'active' : ''}`}
              style={{ '--swatch': toHex(color.value) } as React.CSSProperties}
              onClick={() => {
                setTyping(false);
                onValue(color.value);
              }}
            >
              {value === color.value && <Check size={14} strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
      <div className="color-custom">
        <input
          type="color"
          className="color-picker"
          aria-label={`${label} picker`}
          value={toHex(value)}
          disabled={disabled}
          onChange={(event) => {
            setTyping(false);
            drag(parseHex(event.target.value) ?? value);
          }}
          onPointerUp={flush}
          onBlur={flush}
        />
        <input
          type="text"
          className="color-hex"
          aria-label={`${label} hex code`}
          aria-invalid={invalid}
          spellCheck={false}
          maxLength={7}
          placeholder="#1d9bf0"
          value={text}
          disabled={disabled}
          onFocus={() => setTyping(true)}
          onChange={(event) => {
            setText(event.target.value);
            const next = parseHex(event.target.value);
            if (next !== null) onValue(next);
          }}
          onBlur={() => setTyping(false)}
        />
        {defaultValue !== undefined && (
          <button
            type="button"
            className="icon-button slider-reset"
            aria-label={`Reset ${label} to ${toHex(defaultValue)}`}
            title="Reset color"
            disabled={disabled || value === defaultValue}
            onClick={() => {
              setTyping(false);
              onValue(defaultValue);
            }}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
