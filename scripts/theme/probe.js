/*
 * Better X theme probe. Paste the whole file into the DevTools console on a signed-in x.com tab
 * (Home timeline, scrolled a little; repeat on a post, a profile, Messages, a modal). It reads the
 * page and saves one JSON report to your Downloads folder (better-x-probe-….json; also copied to
 * the clipboard). It sends nothing anywhere and changes nothing except, for one moment, Better X's
 * own `data-bx-theme` attribute, which it puts back as it was.
 *
 * Send the file to whoever maintains src/themes/surfaces.ts. What it tells them:
 *   - mode: how X signals Lights out / Default right now;
 *   - stock: which elements carry each of X's stock dark colors, by class list, test id, inline
 *     style and shadow root, i.e. the real selectors to theme;
 *   - rnwRules: the rules in X's React Native Web stylesheet that set those colors (class names);
 *   - selectors: every selector in Better X's theme and how many elements it matches here;
 *   - missed: with a theme on, what still shows a stock color (the gaps).
 */
(() => {
  const CAP = 5000;
  const STOCK = {
    'rgb(0, 0, 0)': 'black',
    'rgb(5, 5, 5)': 'black-hc',
    'rgb(22, 24, 28)': 'raised-22',
    'rgb(32, 35, 39)': 'raised-32',
    'rgb(24, 24, 27)': 'raised-24',
    'rgb(20, 20, 20)': 'black-20',
    'rgb(23, 23, 23)': 'jetfuel-23',
    'rgb(38, 38, 38)': 'jetfuel-38',
    'rgb(47, 51, 54)': 'border',
    'rgb(62, 65, 68)': 'placeholder',
    'rgb(113, 118, 123)': 'muted',
    'rgb(231, 233, 234)': 'text',
    'rgba(0, 0, 0, 0.65)': 'backdrop',
    'rgb(29, 155, 240)': 'accent-blue',
    'rgb(255, 212, 0)': 'accent-yellow',
    'rgb(249, 24, 128)': 'accent-pink',
    'rgb(120, 86, 255)': 'accent-purple',
    'rgb(255, 122, 0)': 'accent-orange',
    'rgb(0, 186, 124)': 'accent-green',
  };
  const PROPS = [
    'backgroundColor',
    'borderTopColor',
    'borderBottomColor',
    'borderLeftColor',
    'borderRightColor',
    'color',
    'fill',
  ];
  const html = document.documentElement;

  /** Every element, including inside open shadow roots, with whether it is in one. */
  function* walk(root, shadow = false) {
    for (const el of root.querySelectorAll('*')) {
      yield [el, shadow];
      if (el.shadowRoot) yield* walk(el.shadowRoot, true);
    }
  }
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.checkVisibility?.() !== false;
  };

  function scan() {
    const groups = new Map();
    let seen = 0;
    for (const [el, shadow] of walk(document)) {
      if (seen >= CAP) break;
      if (!visible(el)) continue;
      seen++;
      const cs = getComputedStyle(el);
      const inline = el.getAttribute('style') ?? '';
      for (const prop of PROPS) {
        const value = cs[prop];
        if (!(value in STOCK)) continue;
        // Fill only paints SVG; every other element merely inherits the default black.
        if (prop === 'fill' && !(el instanceof SVGElement)) continue;
        // Borders only count where a border is drawn.
        if (prop.startsWith('border')) {
          const side = prop.replace('Color', 'Width');
          if (parseFloat(cs[side]) === 0) continue;
        }
        const key = `${prop}|${value}`;
        let group = groups.get(key);
        if (!group)
          groups.set(
            key,
            (group = {
              prop,
              value,
              name: STOCK[value],
              count: 0,
              classes: {},
              testids: {},
              inline: 0,
              shadow: 0,
              tags: {},
            }),
          );
        group.count++;
        const cls = [...el.classList].sort().join('.') || '(none)';
        group.classes[cls] = (group.classes[cls] ?? 0) + 1;
        const testid = el.closest('[data-testid]')?.getAttribute('data-testid');
        if (testid) group.testids[testid] = (group.testids[testid] ?? 0) + 1;
        group.tags[el.tagName.toLowerCase()] = (group.tags[el.tagName.toLowerCase()] ?? 0) + 1;
        if (inline.includes(value)) group.inline++;
        if (shadow) group.shadow++;
      }
    }
    const top = (counts, n = 5) =>
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
    return {
      scanned: seen,
      groups: [...groups.values()]
        .sort((a, b) => b.count - a.count)
        .map((g) => ({
          ...g,
          classes: top(g.classes),
          testids: top(g.testids),
          tags: top(g.tags, 3),
        })),
    };
  }

  /** Rules in X's atomic stylesheet that set a stock color: these are the class names to theme. */
  function rnwRules() {
    const sheet = document.getElementById('react-native-stylesheet')?.sheet;
    if (!sheet) return { found: false };
    const hits = [];
    for (const rule of sheet.cssRules) {
      const text = rule.cssText;
      for (const value of Object.keys(STOCK))
        if (text.includes(value)) hits.push(text.length > 160 ? text.slice(0, 160) + '…' : text);
    }
    return { found: true, total: sheet.cssRules.length, hits: hits.slice(0, 300) };
  }

  /** How many elements each of Better X's theme selectors matches on this page. */
  function selectors() {
    const sheet = document.getElementById('bx-theme')?.sheet;
    if (!sheet) return null;
    const out = {};
    for (const rule of sheet.cssRules) {
      if (!rule.selectorText) continue;
      for (const selector of rule.selectorText.split(/,(?![^(]*\))/)) {
        const bare = selector.trim().replace(/^html\[data-bx-theme\]\s*/, '') || 'html';
        try {
          out[bare] = document.querySelectorAll(bare.replace(/::placeholder$/, '')).length;
        } catch {
          out[bare] = 'invalid';
        }
      }
    }
    return out;
  }

  const before = html.getAttribute('data-bx-theme');
  const themeCss = document.getElementById('bx-theme')?.textContent ?? '';
  const report = {
    probe: 1,
    at: new Date().toISOString(),
    url: location.pathname,
    mode: {
      dataTheme: html.getAttribute('data-theme'),
      colorScheme: html.style.colorScheme || getComputedStyle(html).colorScheme,
      bodyInlineBg: document.body.style.backgroundColor,
      bodyClass: document.body.className,
      betterXTheme: before,
    },
    rnwRules: rnwRules(),
  };
  try {
    html.removeAttribute('data-bx-theme');
    report.stock = scan();
    if (themeCss) {
      html.setAttribute('data-bx-theme', before ?? 'probe');
      report.selectors = selectors();
      report.missed = scan();
    } else {
      report.missed = 'Choose a theme in Better X (Themes) and run the probe again to see gaps.';
    }
  } finally {
    if (before === null) html.removeAttribute('data-bx-theme');
    else html.setAttribute('data-bx-theme', before);
  }
  // The console shortens long lines when they are copied from it, so the report is saved as a file
  // (and copied to the clipboard); nothing long is printed.
  const json = JSON.stringify(report);
  const name = `better-x-probe-${report.mode.dataTheme ?? 'unknown'}-${location.pathname.replace(/\W+/g, '_')}.json`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  try {
    copy(json);
  } catch {
    /* Only the file, then. */
  }
  console.log(
    `Better X probe: saved ${name} to your Downloads folder (${json.length} characters, also on the clipboard). ` +
      `X mode: ${report.mode.dataTheme}; Better X theme: ${report.mode.betterXTheme ?? 'none'}` +
      (themeCss ? '' : ' (turn a theme on and run again to see what it misses)') +
      '.',
  );
})();
