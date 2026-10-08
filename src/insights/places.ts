/*
 * The alias spellings below (the names X and other sources use for the same country) were
 * gathered from X-Posed's `COUNTRY_ALIASES`, MIT, Alexander Hagenah. See
 * THIRD_PARTY_NOTICES.md.
 */

/**
 * Places an account can be "based in". X reports either a country ("Germany") or, for some
 * accounts, a wider region label ("South Asia"). A region is never expanded into the countries
 * inside it, and a country is never mapped to a region: each is matched only as itself.
 */
export type PlaceKind = 'country' | 'region';

export interface Place {
  kind: PlaceKind;
  /** The name Better X shows ("United States", "South Asia"). */
  name: string;
  /** ISO 3166-1 alpha-2 code, for countries only. */
  code?: string;
}

const ISO_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(
    ' ',
  );

/** Short, plain names where the browser's own name for the region is long or odd. */
const DISPLAY_OVERRIDES: Record<string, string> = {
  HK: 'Hong Kong',
  MO: 'Macao',
  MM: 'Myanmar',
  PS: 'Palestine',
  CD: 'Congo (Kinshasa)',
  CG: 'Congo (Brazzaville)',
  UM: 'US Outlying Islands',
  VI: 'US Virgin Islands',
};

/** Other spellings of a country that X, its data or its users use. */
const ALIASES: Record<string, string> = {
  'cabo verde': 'CV',
  'cape verde': 'CV',
  'u.s. virgin islands': 'VI',
  'united states virgin islands': 'VI',
  swaziland: 'SZ',
  'republic of the congo': 'CG',
  'congo brazzaville': 'CG',
  congo: 'CG',
  'dr congo': 'CD',
  drc: 'CD',
  'democratic republic of the congo': 'CD',
  'congo kinshasa': 'CD',
  'republic of korea': 'KR',
  'south korea': 'KR',
  korea: 'KR',
  "democratic people's republic of korea": 'KP',
  'north korea': 'KP',
  'republic of moldova': 'MD',
  'holy see': 'VA',
  'vatican city': 'VA',
  'brunei darussalam': 'BN',
  'federated states of micronesia': 'FM',
  'micronesia federated states of': 'FM',
  'united republic of tanzania': 'TZ',
  'state of palestine': 'PS',
  'palestinian territories': 'PS',
  'united states of america': 'US',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  'svalbard and jan mayen islands': 'SJ',
  'saint martin french part': 'MF',
  'sint maarten dutch part': 'SX',
  'wallis and futuna islands': 'WF',
  naoero: 'NR',
  'bolivia plurinational state of': 'BO',
  'iran islamic republic of': 'IR',
  'netherlands kingdom of the': 'NL',
  'venezuela bolivarian republic of': 'VE',
  'falkland islands malvinas': 'FK',
  'china hong kong special administrative region': 'HK',
  'china macao special administrative region': 'MO',
  'united kingdom of great britain and northern ireland': 'GB',
  uk: 'GB',
  britain: 'GB',
  'great britain': 'GB',
  'bonaire sint eustatius and saba': 'BQ',
  bosnia: 'BA',
  burma: 'MM',
  "cote d'ivoire": 'CI',
  'ivory coast': 'CI',
  'czech republic': 'CZ',
  'east timor': 'TL',
  'lao people s democratic republic': 'LA',
  macau: 'MO',
  macedonia: 'MK',
  russia: 'RU',
  'russian federation': 'RU',
  'syrian arab republic': 'SY',
  turkey: 'TR',
  turkiye: 'TR',
  uae: 'AE',
  'viet nam': 'VN',
  reunion: 'RE',
  holland: 'NL',
};

/**
 * Region labels X is known to use in place of a country. Matching is by the exact label only:
 * "Europe" does not stand for the countries of Europe. The list is what X-Posed offers for the
 * same purpose (see the note at the top); only "South Asia" appears in recorded X responses we
 * could inspect, so a label X uses that is not here is still shown and matched, as itself.
 */
export const REGION_LABELS: readonly string[] = [
  'Africa',
  'Asia',
  'Australasia',
  'Caribbean',
  'Central Asia',
  'East Asia',
  'East Asia & Pacific',
  'Europe',
  'North Africa',
  'North America',
  'Oceania',
  'South America',
  'South Asia',
  'Southeast Asia',
  'West Asia',
];

/** Lowercase, accents and punctuation removed, "&" read as "and": the key names are compared by. */
export function nameKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

interface Tables {
  countries: Place[];
  byKey: Map<string, Place>;
  byCode: Map<string, Place>;
  regions: Map<string, Place>;
}

let cached: Tables | undefined;

function tables(): Tables {
  if (cached) return cached;
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const countries: Place[] = [];
  const byKey = new Map<string, Place>();
  const byCode = new Map<string, Place>();
  for (const code of ISO_CODES) {
    const raw = DISPLAY_OVERRIDES[code] ?? names.of(code);
    if (!raw || raw === code) continue;
    const place: Place = { kind: 'country', code, name: raw.replace(/ & /g, ' and ') };
    countries.push(place);
    byCode.set(code, place);
    byKey.set(nameKey(raw), place);
    byKey.set(nameKey(place.name), place);
    // The browser's own name too, when a shorter one is shown ("Hong Kong SAR China").
    const browserName = names.of(code);
    if (browserName) byKey.set(nameKey(browserName), place);
  }
  for (const [alias, code] of Object.entries(ALIASES)) {
    const place = byCode.get(code);
    if (place) byKey.set(nameKey(alias), place);
  }
  countries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const regions = new Map<string, Place>();
  for (const label of REGION_LABELS) regions.set(nameKey(label), { kind: 'region', name: label });
  cached = { countries, byKey, byCode, regions };
  return cached;
}

/** Every country a person can pick, sorted by name. */
export function allCountries(): readonly Place[] {
  return tables().countries;
}

/** The country with this ISO code, if it is one. */
export function countryByCode(code: string): Place | undefined {
  return tables().byCode.get(code.toUpperCase());
}

/**
 * Reads the place name X reports. A known country (under any of its usual spellings) becomes that
 * country; a known region label becomes that region; any other non-empty text is kept as a region
 * named exactly what X said. Nothing is guessed from the text: "Bavaria" stays "Bavaria".
 */
export function resolvePlace(raw: unknown): Place | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 80) return null;
  const key = nameKey(text);
  if (!key) return null;
  const t = tables();
  return t.byKey.get(key) ?? t.regions.get(key) ?? { kind: 'region', name: text };
}

/**
 * Reads a name a person chose in the filter list (or a backup file): only countries and the
 * region labels Better X offers are accepted, so a typo can never become a silent no-op entry.
 */
export function resolveSelectable(raw: unknown): Place | null {
  if (typeof raw !== 'string') return null;
  const key = nameKey(raw);
  if (!key || raw.length > 80) return null;
  const t = tables();
  return t.byKey.get(key) ?? t.regions.get(key) ?? null;
}

/** Two places are the same when they are the same country, or the same region label. */
export function placeKey(place: Place): string {
  return place.code ? `cc:${place.code}` : `rg:${nameKey(place.name)}`;
}

const REGIONAL_INDICATOR_A = 0x1f1e6;

/** The flag glyph for a country (two regional-indicator letters), or null for a region. */
export function flagOf(place: Place): string | null {
  if (!place.code || !/^[A-Z]{2}$/.test(place.code)) return null;
  return String.fromCodePoint(
    ...[...place.code].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65),
  );
}

/** Countries and regions matching a search, best first: names starting with the text, then containing it. */
export function searchPlaces(query: string, limit = 12): Place[] {
  const key = nameKey(query);
  const t = tables();
  const all = [...t.countries, ...t.regions.values()];
  if (!key) return all.slice(0, limit);
  const exact: Place[] = [];
  const starts: Place[] = [];
  const contains: Place[] = [];
  for (const place of all) {
    const name = nameKey(place.name);
    const code = place.code?.toLowerCase();
    if (code === key) exact.push(place);
    else if (name.startsWith(key)) starts.push(place);
    else if (name.includes(key)) contains.push(place);
  }
  return [...exact, ...starts, ...contains].slice(0, limit);
}
