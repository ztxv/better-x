import { Home, Sparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import { FEATURES, featureRegistry } from '../features';
import { CATEGORY_TITLES, type FeatureCategory } from '../features/types';
import type { Settings, SettingsPatch } from '../lib/settings';
import { Toggle } from './Toggle';

const CATEGORY_ICONS: Record<FeatureCategory, ComponentType<{ size?: number }>> = {
  cleanup: Sparkles,
  feed: Home,
};

/**
 * The first, minimal Customize view: each customization feature as a toggle, grouped by
 * category. Toggles take effect on every open X tab as soon as they change.
 */
export function Customize({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
}) {
  const enabled = featureRegistry.enabled(settings.features);
  const categories = (Object.keys(CATEGORY_TITLES) as FeatureCategory[]).filter((category) =>
    FEATURES.some((feature) => feature.category === category),
  );
  return (
    <main className="customize" id="customize-panel" aria-labelledby="customize-tab">
      <p className="customize-intro">
        Changes you make here apply to X right away. Open X tabs update without reloading, and
        turning a switch off restores what it hid.
      </p>
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category];
        return (
          <section className="customize-group" key={category} aria-labelledby={`group-${category}`}>
            <h2 id={`group-${category}`}>
              <Icon size={14} />
              {CATEGORY_TITLES[category]}
            </h2>
            <div className="customize-card">
              {FEATURES.filter((feature) => feature.category === category).map((feature) => (
                <Toggle
                  key={feature.id}
                  label={feature.title}
                  hint={feature.description}
                  checked={enabled[feature.id]!}
                  onChange={(value) => onChange({ features: { [feature.id]: value } })}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
