/*
 * Better X demo page. Everything that decides what a setting does comes from the extension's own
 * code in engine/better-x-engine.js (FEATURES, featureRegistry, QUICK_SETUPS, presetPatch,
 * THEMES, deriveTokens, contrastWarnings, themeVars, extractPost). This file only draws the panel
 * replica and moves the engine's output into the simulated timeline, the way
 * src/features/host.ts and src/themes/host.ts do on x.com.
 */
(function () {
  'use strict';

  var E = window.BetterXEngine;
  var registry = E.featureRegistry;
  var FEATURES = E.FEATURES;
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var SAVE_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.02 12 5.48 3.13a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74L7.98 12"/><path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74Z"/></svg>';

  // Features whose work is runtime behavior on live x.com (account lookups, photo dragging, the
  // tab icon) rather than CSS. The demo lists them, switched off, instead of pretending.
  var hasCss = function (def) { return def.kind !== 'toggle' || !!(def.css && def.css.trim()); };
  var SHIMMED = { 'appearance.twitterTitle': true, 'feed.hideForYou': true };
  var offSite = function (def) {
    return !SHIMMED[def.id] && (!hasCss(def) || def.id === 'posts.dragPhotos');
  };

  $('fact-count').textContent = FEATURES.length;
  $('fact-themes').textContent = E.THEMES.length;
  $('fsearch').placeholder = 'Search ' + FEATURES.length + ' settings';

  /* ================================================================ state */
  var state = { features: {}, values: {}, theme: null, custom: null };
  var frame = $('page');
  var mockWin = null;

  function featureCss() {
    // The same composition as src/features/host.ts renderStyle().
    var on = registry.enabled(state.features);
    var values = registry.values(state.values);
    return FEATURES.filter(function (def) { return on[def.id] && !offSite(def); })
      .map(function (def) {
        var css = def.kind !== 'toggle' ? def.css(values[def.id]) : def.css;
        return css ? '/* ' + def.id + ' */\n' + css : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  function themeSeed() {
    if (state.theme === 'custom') return state.custom;
    var def = E.THEMES.find(function (t) { return t.id === state.theme; });
    return def ? def.seed : null;
  }

  function styleIn(doc, id, css) {
    var el = doc.getElementById(id);
    if (!css) { if (el) el.remove(); return; }
    if (!el) { el = doc.createElement('style'); el.id = id; doc.head.appendChild(el); }
    el.textContent = css;
  }

  function applyToPage() {
    if (!mockWin) return;
    var doc = mockWin.document;
    var root = doc.documentElement;
    styleIn(doc, 'bx-features', featureCss());
    var on = registry.enabled(state.features);
    // Shim: on x.com, Hide For You's activate() marks <html> and switches to Following.
    if (on['feed.hideForYou']) {
      if (!root.hasAttribute('data-bx-hide-for-you')) mockWin.bxMock.selectTab('following');
      root.setAttribute('data-bx-hide-for-you', '');
    } else {
      if (root.hasAttribute('data-bx-hide-for-you')) mockWin.bxMock.selectTab('foryou');
      root.removeAttribute('data-bx-hide-for-you');
    }
    // Shim: on x.com, the Twitter title feature rewrites <title>.
    var title = on['appearance.twitterTitle'] ? 'Home / Twitter' : 'Home / X';
    mockWin.bxMock.setTitle(title);
    $('btab-title').textContent = title;
    // Theme: the engine's real tokens and custom properties.
    var seed = themeSeed();
    styleIn(doc, 'bx-theme', seed ? E.themeVars(E.deriveTokens(seed)) : '');
    if (seed) root.setAttribute('data-bx-theme', state.theme);
    else root.removeAttribute('data-bx-theme');
    mockWin.bxMock.refresh();
  }

  /* ================================================================ timeline bridge */
  var library = [];
  window.bxDemo = {
    ready: function (win) { mockWin = win; applyToPage(); library.forEach(function (d) { win.bxMock.setSaved(d.tweetId, true); }); },
    saved: function (draft) {
      library = library.filter(function (d) { return d.tweetId !== draft.tweetId; });
      library.unshift(draft);
      renderLibrary();
    },
    removed: function (id) {
      library = library.filter(function (d) { return d.tweetId !== id; });
      renderLibrary();
    },
  };
  // The frame may have loaded before this script ran.
  try {
    if (frame.contentWindow && frame.contentWindow.bxMock) window.bxDemo.ready(frame.contentWindow);
  } catch (e) { /* not ready yet */ }
  frame.addEventListener('load', function () {
    if (!mockWin && frame.contentWindow.bxMock) window.bxDemo.ready(frame.contentWindow);
  });

  /* ================================================================ panel tabs */
  var tabs = ['customize', 'themes', 'library'];
  function selectPanelTab(name, focus) {
    tabs.forEach(function (t) {
      var on = t === name;
      var tab = $('ptab-' + t);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $('pview-' + t).hidden = !on;
      if (on && focus) tab.focus();
    });
  }
  tabs.forEach(function (t, i) {
    var tab = $('ptab-' + t);
    tab.addEventListener('click', function () { selectPanelTab(t); });
    tab.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectPanelTab(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  /* ================================================================ customize */
  var rows = {};
  var activeCat = 'all';
  var cats = ['all'].concat(Object.keys(E.CATEGORY_TITLES));
  $('cats').innerHTML = cats.map(function (c) {
    return '<button type="button" class="cat" data-cat="' + c + '" aria-pressed="' + (c === 'all') + '">' + (c === 'all' ? 'All' : esc(E.CATEGORY_SHORT[c])) + '</button>';
  }).join('');
  $('cats').addEventListener('click', function (e) {
    var b = e.target.closest('.cat');
    if (!b) return;
    activeCat = b.dataset.cat;
    document.querySelectorAll('.cat').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    filterRows();
  });

  (function buildList() {
    var html = '';
    Object.keys(E.CATEGORY_TITLES).forEach(function (cat) {
      var defs = FEATURES.filter(function (d) { return d.category === cat; });
      html += '<div class="fgroup" data-cat="' + cat + '"><h4>' + esc(E.CATEGORY_TITLES[cat]) + '</h4>';
      defs.forEach(function (def) {
        var id = 'f-' + def.id.replace('.', '-');
        var off = offSite(def);
        html += '<div class="frow' + (def.requires ? ' child' : '') + (off ? ' off-site' : '') + '" data-id="' + def.id + '">' +
          '<label class="ft" for="' + id + '">' + esc(def.title) + '</label>' +
          '<span class="switch"><input type="checkbox" role="switch" id="' + id + '"' + (off ? ' disabled aria-describedby="' + id + '-d"' : ' aria-describedby="' + id + '-d"') + '><span></span></span>' +
          '<span class="fd" id="' + id + '-d">' + esc(def.description) + (off ? ' Not simulated in this demo.' : '') + '</span>';
        if (def.kind === 'slider') {
          html += '<span class="val" hidden><input type="range" min="' + def.min + '" max="' + def.max + '" step="' + def.step + '" value="' + def.defaultValue + '" aria-label="' + esc(def.title) + '"><output>' + def.defaultValue + def.unit + '</output></span>';
        } else if (def.kind === 'color') {
          html += '<span class="val" hidden><input type="color" value="#' + def.defaultValue.toString(16).padStart(6, '0') + '" aria-label="' + esc(def.title) + '"><output>#' + def.defaultValue.toString(16).padStart(6, '0') + '</output></span>';
        }
        html += '</div>';
      });
      html += '</div>';
    });
    html += '<p class="empty" id="f-empty" hidden>No settings match.</p>';
    $('flist').innerHTML = html;
    document.querySelectorAll('.frow').forEach(function (row) {
      var def = registry.get(row.dataset.id);
      rows[def.id] = { row: row, def: def, input: row.querySelector('input[role="switch"]'), val: row.querySelector('.val') };
    });
  })();

  function filterRows() {
    var q = $('fsearch').value.trim().toLowerCase();
    var shown = 0;
    document.querySelectorAll('.fgroup').forEach(function (g) {
      var any = false;
      g.querySelectorAll('.frow').forEach(function (row) {
        var def = rows[row.dataset.id].def;
        var hay = (def.title + ' ' + def.description + ' ' + (def.keywords || []).join(' ')).toLowerCase();
        var ok = (activeCat === 'all' || def.category === activeCat) && (!q || hay.indexOf(q) !== -1);
        row.hidden = !ok;
        if (ok) { any = true; shown++; }
      });
      g.hidden = !any;
    });
    $('f-empty').hidden = shown > 0;
  }
  $('fsearch').addEventListener('input', filterRows);

  function syncRows() {
    var on = registry.enabled(state.features);
    var values = registry.values(state.values);
    var count = 0;
    FEATURES.forEach(function (def) {
      var r = rows[def.id];
      var parentOff = def.requires && !on[def.requires];
      r.input.checked = on[def.id] && !offSite(def);
      r.input.disabled = offSite(def) || !!parentOff;
      if (on[def.id]) count++;
      if (r.val) {
        r.val.hidden = !on[def.id];
        var input = r.val.querySelector('input');
        var out = r.val.querySelector('output');
        if (def.kind === 'slider') { input.value = values[def.id]; out.textContent = values[def.id] + def.unit; }
        else { var hex = '#' + values[def.id].toString(16).padStart(6, '0'); input.value = hex; out.textContent = hex; }
      }
    });
    $('on-count').textContent = count + ' of ' + FEATURES.length + ' on';
    E.QUICK_SETUPS.forEach(function (p) {
      var btn = document.querySelector('.setup[data-id="' + p.id + '"]');
      var want = new Set(p.features);
      var same = FEATURES.every(function (def) { return !!on[def.id] === want.has(def.id); });
      btn.setAttribute('aria-pressed', String(same));
    });
  }

  function update() { syncRows(); applyToPage(); }

  $('flist').addEventListener('change', function (e) {
    var row = e.target.closest('.frow');
    if (!row) return;
    var def = rows[row.dataset.id].def;
    if (e.target.getAttribute('role') === 'switch') {
      if (e.target.checked) state.features[def.id] = true;
      else delete state.features[def.id];
    }
    hideUndo();
    update();
  });
  $('flist').addEventListener('input', function (e) {
    var row = e.target.closest('.frow');
    if (!row || !rows[row.dataset.id].val || !rows[row.dataset.id].val.contains(e.target)) return;
    var def = rows[row.dataset.id].def;
    state.values[def.id] = def.kind === 'color' ? parseInt(e.target.value.slice(1), 16) : Number(e.target.value);
    update();
  });

  /* Quick setups: the extension's presets, applied with its presetPatch(). */
  var before = null;
  $('setups').innerHTML = E.QUICK_SETUPS.map(function (p) {
    return '<button type="button" class="setup" data-id="' + p.id + '" aria-pressed="false"><b>' + esc(p.title) + '</b><span>' + p.features.length + ' switches</span></button>';
  }).join('');
  E.QUICK_SETUPS.forEach(function (p) {
    document.querySelector('.setup[data-id="' + p.id + '"]').title = p.description;
  });
  function applyPatch(patch) {
    Object.keys(patch.features).forEach(function (id) {
      if (patch.features[id] === null) delete state.features[id];
      else state.features[id] = patch.features[id];
    });
    Object.keys(patch.values).forEach(function (id) {
      if (patch.values[id] === null) delete state.values[id];
      else state.values[id] = patch.values[id];
    });
  }
  $('setups').addEventListener('click', function (e) {
    var b = e.target.closest('.setup');
    if (!b) return;
    var preset = E.QUICK_SETUPS.find(function (p) { return p.id === b.dataset.id; });
    before = { features: Object.assign({}, state.features), values: Object.assign({}, state.values) };
    applyPatch(E.presetPatch(preset, registry));
    $('undo-text').textContent = preset.title + ' applied: ' + preset.description;
    $('undo-bar').hidden = false;
    update();
  });
  function hideUndo() { $('undo-bar').hidden = true; before = null; }
  $('undo').addEventListener('click', function () {
    if (!before) return;
    state.features = before.features;
    state.values = before.values;
    hideUndo();
    update();
  });
  $('all-off').addEventListener('click', function () {
    before = { features: Object.assign({}, state.features), values: Object.assign({}, state.values) };
    state.features = {};
    state.values = {};
    $('undo-text').textContent = 'Every customization is off.';
    $('undo-bar').hidden = false;
    update();
  });

  /* ================================================================ themes tab */
  function themeCards() {
    var list = [{ id: null, title: 'Lights out', description: 'X’s own black', seed: { bg: '#000000', text: '#e7e9ea', accent: '#1d9bf0' } }]
      .concat(E.THEMES)
      .concat(state.custom ? [{ id: 'custom', title: 'Custom', description: 'From the theme lab', seed: state.custom }] : []);
    $('tgrid').innerHTML = list.map(function (t) {
      var tk = E.deriveTokens(t.seed);
      return '<button type="button" role="radio" class="tcard" data-theme="' + (t.id || '') + '" aria-checked="' + (state.theme === t.id) + '" tabindex="' + (state.theme === t.id ? 0 : -1) + '">' +
        '<span class="tsw" aria-hidden="true"><i style="background:' + tk.bg + '"></i><i style="background:' + tk.raised + '"></i><i style="background:' + tk.text + '"></i><i style="background:' + tk.accent + '"></i></span>' +
        '<b>' + esc(t.title) + '</b><span>' + esc(t.description) + '</span></button>';
    }).join('');
  }
  function setTheme(id) {
    state.theme = id;
    themeCards();
    applyToPage();
  }
  $('tgrid').addEventListener('click', function (e) {
    var c = e.target.closest('.tcard');
    if (!c) return;
    setTheme(c.dataset.theme || null);
    var now = document.querySelector('.tcard[aria-checked="true"]');
    if (now) now.focus();
  });
  $('tgrid').addEventListener('keydown', function (e) {
    var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!keys[e.key]) return;
    e.preventDefault();
    var cards = Array.prototype.slice.call(document.querySelectorAll('.tcard'));
    var i = cards.indexOf(document.activeElement);
    var next = cards[(i + keys[e.key] + cards.length) % cards.length];
    setTheme(next.dataset.theme || null);
    document.querySelector('.tcard[data-theme="' + next.dataset.theme + '"]').focus();
  });
  themeCards();

  /* ================================================================ library */
  function renderLibrary() {
    var q = $('lsearch').value.trim().toLowerCase();
    var items = library.filter(function (d) {
      return !q || (d.text + ' ' + d.authorDisplayName + ' ' + d.authorHandle).toLowerCase().indexOf(q) !== -1;
    });
    var badge = $('lib-count');
    badge.textContent = library.length;
    badge.classList.toggle('has', library.length > 0);
    if (!library.length) {
      $('lib').innerHTML = '<li class="lib-empty">' + SAVE_SVG + '<b>Nothing saved yet</b>Click the layers icon under any post in the timeline.</li>';
      return;
    }
    if (!items.length) { $('lib').innerHTML = '<li class="lib-empty"><b>No bookmarks match</b>Try another word.</li>'; return; }
    $('lib').innerHTML = items.map(function (d) {
      var date = d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
      return '<li class="bm"><div class="bm-head"><b>' + esc(d.authorDisplayName || d.authorHandle) + '</b><span>@' + esc(d.authorHandle) + '</span><time datetime="' + esc(d.createdAt || '') + '">' + date + '</time></div>' +
        '<p>' + esc(d.text) + '</p><div class="bm-foot"><code title="Post id read by the extractor">' + esc(d.tweetId) + '</code><button type="button" data-remove="' + esc(d.tweetId) + '">Remove bookmark</button></div></li>';
    }).join('');
  }
  $('lsearch').addEventListener('input', renderLibrary);
  $('lib').addEventListener('click', function (e) {
    var b = e.target.closest('[data-remove]');
    if (!b) return;
    var id = b.getAttribute('data-remove');
    library = library.filter(function (d) { return d.tweetId !== id; });
    if (mockWin) mockWin.bxMock.setSaved(id, false);
    renderLibrary();
  });
  renderLibrary();
  syncRows();

  /* ================================================================ theme lab */
  var labSeed = Object.assign({}, E.THEMES[0].seed);
  var labPreset = E.THEMES[0].id;
  var KEYS = ['bg', 'text', 'accent'];
  var HEX = /^#[0-9a-f]{6}$/i;
  $('lab-presets').innerHTML = E.THEMES.map(function (t) {
    return '<button type="button" class="chip" data-id="' + t.id + '" aria-pressed="' + (t.id === labPreset) + '"><i style="background:' + t.seed.bg + ';border-color:' + t.seed.accent + '"></i>' + esc(t.title) + '</button>';
  }).join('');
  $('lab-presets').addEventListener('click', function (e) {
    var b = e.target.closest('.chip');
    if (!b) return;
    var t = E.THEMES.find(function (x) { return x.id === b.dataset.id; });
    labSeed = Object.assign({}, t.seed);
    labPreset = t.id;
    renderLab(true);
  });
  KEYS.forEach(function (k) {
    $('c-' + k).addEventListener('input', function (e) { setLab(k, e.target.value); $('t-' + k).value = e.target.value; });
    $('t-' + k).addEventListener('input', function (e) {
      var v = e.target.value.trim();
      if (v[0] !== '#') v = '#' + v;
      var ok = HEX.test(v);
      e.target.setAttribute('aria-invalid', String(!ok));
      if (ok) { $('c-' + k).value = v.toLowerCase(); setLab(k, v.toLowerCase()); }
    });
  });
  function setLab(k, v) {
    labSeed[k] = v;
    // A new background or text color re-derives the in-between surfaces instead of keeping the
    // preset's, the way "Start from" works in the extension's editor.
    if (k !== 'accent') ['raised', 'hover', 'border', 'muted'].forEach(function (x) { delete labSeed[x]; });
    labPreset = null;
    renderLab(false);
  }
  var WARN_TEXT = {
    text: 'Text on the background is {r}:1. The editor asks for 4.5:1.',
    accent: 'The accent on the background is {r}:1. The editor asks for 3:1.',
    border: 'Borders are {r}:1 against the background, so dividers may vanish.',
    label: 'White button labels on the accent are {r}:1, under 2.2:1.',
  };
  var TOKEN_NAMES = [['bg', 'Background'], ['raised', 'Raised'], ['hover', 'Hover'], ['border', 'Border'], ['text', 'Text'], ['muted', 'Secondary text'], ['accent', 'Accent'], ['accentText', 'Links'], ['ring', 'Focus ring'], ['mention', 'Mentions'], ['badge', 'Unread badge'], ['accentHover', 'Accent hover']];
  function renderLab(syncInputs) {
    var tk = E.deriveTokens(labSeed);
    if (syncInputs) KEYS.forEach(function (k) { $('c-' + k).value = tk[k]; $('t-' + k).value = tk[k]; $('t-' + k).setAttribute('aria-invalid', 'false'); });
    document.querySelectorAll('#lab-presets .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.id === labPreset)); });
    var pv = $('lab-preview').style;
    pv.setProperty('--lp-bg', tk.bg);
    pv.setProperty('--lp-text', tk.text);
    pv.setProperty('--lp-muted', tk.muted);
    pv.setProperty('--lp-border', tk.border);
    pv.setProperty('--lp-accent', tk.accent);
    pv.setProperty('--lp-mention', tk.mention);
    pv.setProperty('--lp-badge', tk.badge);
    pv.setProperty('--lp-badge-text', tk.badgeText);
    $('lab-tokens').innerHTML = TOKEN_NAMES.map(function (n) {
      return '<li><i style="background:' + tk[n[0]] + '"></i><span><b>' + n[1] + '</b><code>' + tk[n[0]] + '</code></span></li>';
    }).join('');
    var warnings = E.contrastWarnings(labSeed);
    $('lab-warn').innerHTML = warnings.length
      ? warnings.map(function (w) { return '<li>' + WARN_TEXT[w.pair].replace('{r}', w.ratio.toFixed(2)) + '</li>'; }).join('')
      : '<li class="ok">No warnings. Secondary text and links meet 4.5:1 on this background.</li>';
  }
  renderLab(true);
  $('lab-apply').addEventListener('click', function () {
    state.custom = Object.assign({}, labSeed);
    var t = labPreset && E.THEMES.find(function (x) { return x.id === labPreset; });
    if (t && !state.custom.raised) state.custom = Object.assign({}, t.seed);
    setTheme(labPreset || 'custom');
    selectPanelTab('themes');
    $('demo').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });

  /* ================================================================ hero stack */
  var title = function (id) { var d = registry.get(id); return d ? d.title : id; };
  var STACK = [
    { name: 'Priya Raman', text: 'Shipped dark mode for our docs today…', hue: 265, tag: 'Post', keep: true, save: true },
    { name: 'Nimbus Notes', text: 'Your notes, finally in one place.', hue: 200, tag: 'Ad', feature: 'cleanup.hideAds' },
    { name: 'Who to follow', text: 'River Chen, Noor Haddad and 3 more', hue: 150, tag: 'Suggested', feature: 'feed.hideSuggestedModules' },
    { name: 'Mika Sato', text: 'Reminder that you are allowed to close the app.', hue: 330, tag: 'Post', keep: true },
    { name: 'Get verified', text: 'Subscribe to unlock new features.', hue: 45, tag: 'Prompt', feature: 'feed.hideInlinePrompts' },
    { name: 'Grok', text: 'Ask about this post', hue: 0, tag: 'Grok', feature: 'cleanup.hideGrok' },
  ];
  var clean = E.QUICK_SETUPS.find(function (p) { return p.id === 'clean'; });
  var rowsEl = $('stack-rows');
  rowsEl.innerHTML = STACK.map(function (r) {
    return '<li class="srow' + (r.keep ? '' : ' clutter') + '"><span class="sav" style="--h:' + r.hue + '"></span><div><b>' + esc(r.name) + '</b><span>' + esc(r.text) + '</span></div>' +
      (r.keep ? '<span class="save">' + SAVE_SVG + '</span>' : '<span class="tag">' + r.tag + '</span>') + '</li>';
  }).join('');
  var srows = rowsEl.querySelectorAll('.srow');
  var label = $('stack-label');
  var count = $('stack-count');
  var steps = STACK.map(function (r, i) { return r.feature ? i : -1; }).filter(function (i) { return i >= 0; });

  function finalState() {
    srows.forEach(function (el, i) {
      if (!STACK[i].keep) el.classList.add('gone');
      if (STACK[i].save) el.classList.add('saved');
    });
    $('stack-mode').textContent = 'With Clean on';
    count.textContent = clean.features.length + ' switches';
    label.innerHTML = '<b>Clean</b> hides ads, suggestions, prompts and Grok, and the layers icon saves a post to your library.';
  }

  if (reduceMotion) {
    finalState();
  } else {
    var t = 0;
    var timer = null;
    var visible = true;
    var tick = function () {
      if (!visible) return;
      var n = t % (steps.length + 3);
      if (n === 0) {
        srows.forEach(function (el) { el.classList.remove('gone', 'going', 'saved'); });
        $('stack-mode').textContent = 'Your timeline';
        count.textContent = '';
        label.textContent = 'The Clean quick setup, applied one switch at a time.';
      } else if (n <= steps.length) {
        var i = steps[n - 1];
        var tag = srows[i].querySelector('.tag');
        srows[i].classList.add('going');
        tag.textContent = title(STACK[i].feature);
        $('stack-mode').textContent = 'Applying Clean';
        count.textContent = n + ' of ' + steps.length;
        label.innerHTML = '<b>' + esc(title(STACK[i].feature)) + '</b> is on.';
        setTimeout(function () { srows[i].classList.add('gone'); }, 650);
      } else if (n === steps.length + 1) {
        srows[0].classList.add('saved');
        $('stack-mode').textContent = 'With Clean on';
        count.textContent = clean.features.length + ' switches';
        label.innerHTML = 'One click on the layers icon <b>saves the post</b> to your library.';
      }
      t++;
    };
    var start = function () { if (!timer) { tick(); timer = setInterval(tick, 1700); } };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }).observe($('stack'));
    } else start();
  }
})();
