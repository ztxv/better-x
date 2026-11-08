import type { ColorFeature } from '../features/types';
import { ColorField } from './ColorField';
import { Toggle } from './Toggle';

export { parseHex, toHex } from './ColorField';

/**
 * A feature with a color: the usual switch, and below it X's own accent colors, a color picker
 * and a hex box (`ColorField`). Live only while the switch is on.
 */
export function ColorRow({
  feature,
  enabled,
  value,
  onToggle,
  onValue,
}: {
  feature: ColorFeature;
  enabled: boolean;
  value: number;
  onToggle: (on: boolean) => void;
  onValue: (value: number) => void;
}) {
  return (
    <div className="color-row" data-on={enabled}>
      <Toggle
        label={feature.title}
        hint={feature.description}
        checked={enabled}
        onChange={onToggle}
      />
      <ColorField
        label={feature.title}
        value={value}
        defaultValue={feature.defaultValue}
        swatches
        disabled={!enabled}
        onValue={onValue}
      />
      {!enabled && <p className="slider-note">Turn on to adjust.</p>}
    </div>
  );
}
