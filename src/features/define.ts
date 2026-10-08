import type { FeatureCategory, SliderFeature, ToggleFeature } from './types';

interface SliderRange {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
}

/**
 * Builders for the features of one category, so a catalog file lists only what is particular to
 * each feature. Every feature defined here starts switched off: customization is opt-in.
 */
export function definitions(category: FeatureCategory) {
  return {
    toggle(
      name: string,
      title: string,
      description: string,
      css: string,
      keywords: readonly string[] = [],
    ): ToggleFeature {
      return {
        id: `${category}.${name}`,
        category,
        title,
        description,
        keywords,
        kind: 'toggle',
        defaultEnabled: false,
        css,
      };
    },
    slider(
      name: string,
      title: string,
      description: string,
      range: SliderRange,
      css: (value: number) => string,
      keywords: readonly string[] = [],
    ): SliderFeature {
      return {
        id: `${category}.${name}`,
        category,
        title,
        description,
        keywords,
        kind: 'slider',
        defaultEnabled: false,
        ...range,
        css,
      };
    },
  };
}
