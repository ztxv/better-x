import { Feather, Sparkles, Target } from 'lucide-react';
import type { ComponentType } from 'react';
import { PRESETS, type Preset } from '../features/presets';

const ICONS: Record<Preset['id'], ComponentType<{ size?: number }>> = {
  clean: Sparkles,
  minimal: Feather,
  focus: Target,
};

/** Three one-click setups. Applying one replaces the customization switches; Undo puts them back. */
export function Presets({
  active,
  onApply,
}: {
  active: Preset['id'] | null;
  onApply: (preset: Preset) => void;
}) {
  return (
    <section className="presets" aria-labelledby="presets-title">
      <h2 id="presets-title">Quick setups</h2>
      <div className="preset-grid">
        {PRESETS.map((preset) => {
          const Icon = ICONS[preset.id];
          return (
            <button
              key={preset.id}
              type="button"
              className="preset"
              aria-pressed={active === preset.id}
              onClick={() => onApply(preset)}
            >
              <span className="preset-head">
                <Icon size={14} />
                <strong>{preset.title}</strong>
              </span>
              <small>{preset.description}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
