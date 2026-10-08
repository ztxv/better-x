import { describe, expect, it } from 'vitest';
import {
  allCountries,
  countryByCode,
  flagOf,
  nameKey,
  placeKey,
  resolvePlace,
  resolveSelectable,
  searchPlaces,
} from './places';

describe('place names', () => {
  it('reads the country names X was recorded reporting', () => {
    for (const [raw, code] of [
      ['Germany', 'DE'],
      ['India', 'IN'],
      ['United States', 'US'],
      ['United Kingdom', 'GB'],
      ['Japan', 'JP'],
      ['Nigeria', 'NG'],
      ['Netherlands', 'NL'],
      ['Brazil', 'BR'],
      ['Norway', 'NO'],
    ] as const) {
      const place = resolvePlace(raw);
      expect(place?.kind, raw).toBe('country');
      expect(place?.code, raw).toBe(code);
    }
  });

  it('treats the usual spellings of a country as the same country', () => {
    const us = resolvePlace('United States');
    for (const alias of ['USA', 'United States of America', 'united states', ' US '])
      expect(resolvePlace(alias), alias).toEqual(us);
    expect(resolvePlace('Türkiye')?.code).toBe('TR');
    expect(resolvePlace('Turkey')?.code).toBe('TR');
    expect(resolvePlace('Czechia')?.code).toBe('CZ');
    expect(resolvePlace('Czech Republic')?.code).toBe('CZ');
    expect(resolvePlace('Russian Federation')?.code).toBe('RU');
    expect(resolvePlace('Hong Kong SAR China')?.name).toBe('Hong Kong');
    expect(resolvePlace('Côte d’Ivoire')?.code).toBe('CI');
    expect(resolvePlace('Bosnia & Herzegovina')?.code).toBe('BA');
  });

  it('keeps the two Congos apart', () => {
    expect(resolvePlace('Congo - Kinshasa')?.code).toBe('CD');
    expect(resolvePlace('Congo - Brazzaville')?.code).toBe('CG');
    expect(resolvePlace('Democratic Republic of the Congo')?.code).toBe('CD');
  });

  it('reads a region label as a region, not a country, and keeps unknown text as what X said', () => {
    expect(resolvePlace('South Asia')).toEqual({ kind: 'region', name: 'South Asia' });
    expect(resolvePlace('east asia & pacific')).toEqual({
      kind: 'region',
      name: 'East Asia & Pacific',
    });
    expect(resolvePlace('Bavaria')).toEqual({ kind: 'region', name: 'Bavaria' });
  });

  it('never guesses: nothing, blank text and non-strings give no place', () => {
    for (const raw of [undefined, null, '', '   ', 12, {}, 'x'.repeat(200)])
      expect(resolvePlace(raw)).toBeNull();
  });

  it('only lets a filter pick a real country or a known region label', () => {
    expect(resolveSelectable('germany')?.code).toBe('DE');
    expect(resolveSelectable('South Asia')?.kind).toBe('region');
    expect(resolveSelectable('Atlantis')).toBeNull();
    expect(resolveSelectable('Bavaria')).toBeNull();
    expect(resolveSelectable(7)).toBeNull();
  });

  it('gives one key per place whatever the spelling', () => {
    expect(placeKey(resolvePlace('USA')!)).toBe(placeKey(resolvePlace('United States')!));
    expect(placeKey(resolvePlace('South Asia')!)).not.toBe(placeKey(resolvePlace('India')!));
  });

  it('normalizes names for comparison', () => {
    expect(nameKey('  Côte d’Ivoire ')).toBe('cote d ivoire');
    expect(nameKey('East Asia & Pacific')).toBe('east asia and pacific');
    expect(nameKey('The Gambia')).toBe('gambia');
  });
});

describe('country list and flags', () => {
  it('lists each country once, sorted, with a name', () => {
    const list = allCountries();
    expect(list.length).toBeGreaterThan(240);
    expect(new Set(list.map((p) => p.code)).size).toBe(list.length);
    expect(new Set(list.map((p) => p.name)).size).toBe(list.length);
    const names = list.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    for (const place of list) expect(place.name, place.code).not.toBe(place.code);
  });

  it('draws a flag from the country code, and none for a region', () => {
    expect(flagOf(countryByCode('US')!)).toBe('🇺🇸');
    expect(flagOf(countryByCode('DE')!)).toBe('🇩🇪');
    expect(flagOf(resolvePlace('South Asia')!)).toBeNull();
    expect(countryByCode('zz')).toBeUndefined();
  });

  it('searches by name start, then by containing text, and by code', () => {
    const names = (q: string) => searchPlaces(q).map((p) => p.name);
    expect(names('germ')[0]).toBe('Germany');
    expect(names('stan')).toContain('Pakistan');
    expect(names('de')[0]).toBe('Germany'); // code match first
    expect(names('south asia')[0]).toBe('South Asia');
    expect(searchPlaces('')).toHaveLength(12);
    expect(searchPlaces('qqqq')).toEqual([]);
  });
});
