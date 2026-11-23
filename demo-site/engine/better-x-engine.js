/*
 * Better X demo engine. GENERATED FILE: do not edit by hand.
 * Built from scripts/demo/engine.ts (the extension's own src/ modules) by
 * scripts/demo/build-engine.mjs. Re-run `npm run demo:engine` after changing src/.
 * Better X is MIT licensed; see LICENSE and THIRD_PARTY_NOTICES.md in the repository.
 */
"use strict";
var BetterXEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // scripts/demo/engine.ts
  var engine_exports = {};
  __export(engine_exports, {
    CATEGORY_HINTS: () => CATEGORY_HINTS,
    CATEGORY_SHORT: () => CATEGORY_SHORT,
    CATEGORY_TITLES: () => CATEGORY_TITLES,
    FEATURES: () => FEATURES,
    LIGHTS_OUT_SEED: () => LIGHTS_OUT_SEED,
    PRODUCT_NAME: () => PRODUCT_NAME,
    QUICK_SETUPS: () => PRESETS2,
    THEMES: () => PRESETS,
    contrastWarnings: () => contrastWarnings,
    deriveTokens: () => deriveTokens,
    extractPost: () => extractPost,
    featureRegistry: () => featureRegistry,
    presetPatch: () => presetPatch,
    themeVars: () => themeVars
  });

  // src/features/css.ts
  function hide(...selectors) {
    return `${selectors.flat().join(",\n")} {
  display: none !important;
}`;
  }
  function rule(selectors, declarations) {
    return `${[selectors].flat().join(",\n")} {
  ${declarations}
}`;
  }
  var within = (scope, selectors) => [selectors].flat().map((selector) => `${scope} ${selector}`);
  var onRoute = (...routes) => routes.length === 1 ? `html[data-bx-route="${routes[0]}"]` : `html:is(${routes.map((route) => `[data-bx-route="${route}"]`).join(", ")})`;
  var PRIMARY_NAV = ':is(header[role="banner"] nav, #layers nav)';
  var MENU = '[role="menu"]';
  var MORE = '[aria-labelledby="modal-header"]';
  var links = (match, rootAttributes = "") => [
    `html${rootAttributes} ${PRIMARY_NAV} a${match}`,
    `html${rootAttributes} ${MENU} a${match}`,
    `html[data-bx-layout="narrow"]${rootAttributes} [role="dialog"] a${match}`,
    `html${rootAttributes} ${MORE} a${match}`
  ];
  var navLinks = (match) => [`${PRIMARY_NAV} a${match}`];
  var PRIMARY_COLUMN = '[data-testid="primaryColumn"]';
  var SIDEBAR = '[data-testid="sidebarColumn"]';
  var SIDEBAR_SECTIONS = `${SIDEBAR} > div > div > div > div > div`;
  var CELL = '[data-testid="cellInnerDiv"]';
  var POST = '[data-testid="tweet"]';
  var cellWhere = (condition, scope = "") => `${scope ? `${scope} ` : ""}${CELL}${condition} > div`;

  // src/features/define.ts
  function definitions(category) {
    return {
      toggle(name, title, description, css, keywords = []) {
        return {
          id: `${category}.${name}`,
          category,
          title,
          description,
          keywords,
          kind: "toggle",
          defaultEnabled: false,
          css
        };
      },
      color(name, title, description, defaultValue, css, keywords = []) {
        return {
          id: `${category}.${name}`,
          category,
          title,
          description,
          keywords,
          kind: "color",
          defaultEnabled: false,
          defaultValue,
          css
        };
      },
      slider(name, title, description, range, css, keywords = []) {
        return {
          id: `${category}.${name}`,
          category,
          title,
          description,
          keywords,
          kind: "slider",
          defaultEnabled: false,
          ...range,
          css
        };
      }
    };
  }

  // src/features/appearance.ts
  var { toggle, slider } = definitions("appearance");
  var NAV = 'header[role="banner"] nav';
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var APPEARANCE_FEATURES = [
    slider(
      "timelineWidth",
      "Timeline width",
      "How wide the timeline can grow on Home, lists and communities. X’s own width is 600.",
      { min: 500, max: 1e3, step: 10, defaultValue: 700, unit: "px" },
      (width) => rule(
        [
          `${onRoute("home", "list", "community")} ${PRIMARY_COLUMN}`,
          `${onRoute("home", "list", "community")} ${PRIMARY_COLUMN} > div:first-child > div:last-child`
        ],
        `max-width: ${width}px;`
      ),
      ["width", "wide", "narrow", "column"]
    ),
    slider(
      "sidebarWidth",
      "Sidebar width",
      "How wide the sidebar is. X’s own width is 350.",
      { min: 250, max: 450, step: 10, defaultValue: 350, unit: "px" },
      (width) => rule(
        [SIDEBAR, `${SIDEBAR} > div > div`, `${SIDEBAR_SECTIONS} > div:first-child`],
        `width: ${width}px !important;`
      ),
      ["width", "column"]
    ),
    slider(
      "navSpacing",
      "Menu spacing",
      "How much room each item in the side menu gets.",
      { min: 0, max: 12, step: 1, defaultValue: 6, unit: "px" },
      (padding) => [
        rule(
          [`${NAV} > a`, `${NAV} > div[data-testid="AppTabBar_More_Menu"]`],
          "padding-top: 0 !important;\n  padding-bottom: 0 !important;"
        ),
        rule(
          [`${NAV} > a > div`, `${NAV} > div[data-testid="AppTabBar_More_Menu"] > div`],
          `padding-top: ${padding}px !important;
  padding-bottom: ${padding}px !important;`
        )
      ].join("\n"),
      ["density", "compact", "padding"]
    ),
    slider(
      "navTextSize",
      "Menu text size",
      "The size of the labels in the side menu, in regular weight. X’s own size is 20.",
      { min: 12, max: 20, step: 1, defaultValue: 15, unit: "px" },
      (size) => rule(
        [`${NAV} div[dir]:not([aria-live]) span`, `${NAV} span[style] > span`],
        `font-size: ${size}px !important;
  font-weight: normal !important;`
      ),
      ["font", "labels"]
    ),
    slider(
      "postTextSize",
      "Post text size",
      "The size of the text in posts. X’s own size is 15.",
      { min: 13, max: 22, step: 1, defaultValue: 16, unit: "px" },
      (size) => rule(
        ['div[data-testid="tweetText"]', 'div[data-testid="tweetText"] span'],
        `font-size: ${size}px !important;
  line-height: 1.35 !important;`
      ),
      ["font", "type", "reading"]
    ),
    slider(
      "avatarShape",
      "Profile picture shape",
      "Square off profile pictures everywhere on X. Raise the number to round the corners again; 50 is a circle.",
      { min: 0, max: 50, step: 5, defaultValue: 0, unit: "%" },
      (radius) => {
        const AVATAR = ':is([data-testid^="UserAvatar-Container"], [data-testid="Tweet-User-Avatar"])';
        return rule(
          [AVATAR, `${AVATAR} *`],
          `border-radius: ${radius}% !important;
  clip-path: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;`
        );
      },
      ["avatar", "pfp", "square", "circle", "round", "profile photo"]
    ),
    toggle(
      "systemFont",
      "Use the system font",
      "Show X in your computer’s own font instead of X’s Chirp.",
      rule(["body", "body *"], `font-family: ${FONT} !important;`),
      ["chirp", "typeface"]
    ),
    toggle(
      "lighterMenuText",
      "Lighter menu text",
      "Show the items in X’s popup menus in regular weight instead of bold.",
      rule(
        [
          '[data-testid="Dropdown"] [role="menuitem"] [dir]',
          '[data-testid="sheetDialog"] [role="menuitem"] [dir]'
        ],
        "font-weight: normal;"
      ),
      ["bold", "weight"]
    )
  ];

  // src/runtime/observe.ts
  function observe(scope, target, options, callback) {
    const observer = new MutationObserver((records, self) => {
      if (scope.alive()) callback(records, self);
    });
    observer.observe(target, options);
    scope.add(() => observer.disconnect());
    return observer;
  }

  // src/features/branding.ts
  var BIRD_PATH = "M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.850 2.313 3.198 4.352 3.234-1.595 1.250-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.510 2.093 7.140 2.093 8.570 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.910-.658 1.700-1.477 2.323-2.410z";
  var BIRD_BLUE = "#1d9bf0";
  function birdIcon(pip = false) {
    const dot = pip ? '<circle cx="20" cy="4" r="4" fill="#f91880"/>' : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${BIRD_BLUE}" d="${BIRD_PATH}"/>${dot}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  var ICON_LINKS = 'link[rel~="icon"]';
  var isPip = (href) => /pip/i.test(href);
  var twitterBird = {
    id: "appearance.twitterBird",
    category: "appearance",
    title: "Twitter bird icon",
    description: "Show the classic blue Twitter bird as the tab icon instead of the X logo.",
    keywords: ["favicon", "logo", "twitter", "bird", "tab icon", "branding"],
    kind: "toggle",
    defaultEnabled: false,
    activate({ scope }) {
      const head = document.head;
      const originals = /* @__PURE__ */ new Map();
      const apply = () => {
        for (const link of head.querySelectorAll(ICON_LINKS)) {
          const href = link.getAttribute("href") ?? "";
          if (href.startsWith("data:image/svg+xml")) continue;
          originals.set(link, href);
          link.setAttribute("href", birdIcon(isPip(href)));
        }
      };
      apply();
      observe(
        scope,
        head,
        { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] },
        apply
      );
      scope.add(() => {
        for (const [link, href] of originals) if (link.isConnected) link.setAttribute("href", href);
      });
    }
  };
  function twitterTitle(title) {
    if (title === "X") return "Twitter";
    return title.replace(/ on X: /, " on Twitter: ").replace(/ \/ X$/, " / Twitter");
  }
  var twitterName = {
    id: "appearance.twitterTitle",
    category: "appearance",
    title: "Say Twitter in the tab title",
    description: "Name the site Twitter in the browser tab, as in “Home / Twitter”.",
    keywords: ["title", "tab", "twitter", "name", "branding"],
    kind: "toggle",
    defaultEnabled: false,
    activate({ scope }) {
      let original = document.title;
      const apply = () => {
        const title = document.title;
        const renamed = twitterTitle(title);
        if (renamed === title) {
          if (twitterTitle(original) !== title) original = title;
          return;
        }
        original = title;
        document.title = renamed;
      };
      apply();
      observe(scope, document.head, { childList: true, subtree: true, characterData: true }, apply);
      scope.add(() => {
        if (document.title === twitterTitle(original)) document.title = original;
      });
    }
  };
  var BRANDING_FEATURES = [twitterBird, twitterName];

  // src/features/cleanup.ts
  var { toggle: toggle2 } = definitions("cleanup");
  var IMAGINE = ':is([href^="/i/imagine"], [href^="https://grok.com/imagine"], [href^="/i/grok-redirect"])';
  var PREMIUM_LINK = '[href^="/i/premium_sign_up"]';
  var FOCUSED_POST = `${POST}[tabindex="-1"]`;
  var PROFILE = onRoute("profile");
  var CLEANUP_FEATURES = [
    toggle2(
      "hideGrokImageEdit",
      "Hide Grok image editing",
      "Remove the “Edit image” entry points Grok adds to photos and menus.",
      hide(
        `${POST} div[aria-labelledby] a${IMAGINE}`,
        `${POST} [data-testid="tweetText"] a${IMAGINE}`,
        `[role="menuitem"]${IMAGINE}`,
        `[aria-modal="true"] > div > div:first-of-type a${IMAGINE}`
      ),
      ["imagine", "ai", "edit image"]
    ),
    toggle2(
      "hideGrokPosts",
      "Hide posts sharing Grok chats",
      "Remove posts that link to a shared Grok conversation.",
      hide(cellWhere(`:has(${POST} a[href^="/i/grok/share/"])`)),
      ["ai", "conversation"]
    ),
    toggle2(
      "hidePremiumUpsells",
      "Hide Premium upsells",
      "Remove the Premium prompts X shows in menus, settings, your profile, the composer and your own posts.",
      hide(
        links('[href="/i/account_analytics"]'),
        '[role="menu"] a' + PREMIUM_LINK,
        'html[data-bx-layout="narrow"] [role="dialog"] a' + PREMIUM_LINK,
        '[role="menuitem"][data-testid="highlightUpsell"]',
        '[role="menuitem"][data-testid="editWithPremium"]',
        `${onRoute("settings")} a${PREMIUM_LINK}`,
        `${PROFILE} ${PRIMARY_COLUMN} a${PREMIUM_LINK}`,
        `${PROFILE} [data-testid="analytics-preview"]`,
        `${onRoute("communities")} ${PRIMARY_COLUMN} a:is([href^="/i/premium"], [href^="/i/verified"])`,
        '[data-testid="verified_profile_upsell"]',
        '[data-testid="profileAnalyticsUpsell"]',
        '[data-testid="verified_profile_visitor_upsell"]',
        `[aria-live="polite"][role="status"]:has(a${PREMIUM_LINK})`,
        ...[
          'a[href^="/i/premium"]',
          'div > a[href^="/i/premium"]',
          'div > div > a[href^="/i/premium"]'
        ].map((link) => `${PROFILE} ${PRIMARY_COLUMN} nav + div:has(> ${link})`)
      ),
      ["subscribe", "blue", "analytics", "upgrade"]
    ),
    toggle2(
      "hideSubscriptions",
      "Hide creator subscriptions",
      "Remove Subscribe buttons, subscriber badges, subscription counts and the Subscriptions tabs.",
      hide(
        // The purple Subscribe button on a profile, matched by its border colour as Control Panel does.
        `${PROFILE} [role="button"][style*="border-color: rgb(201, 54, 204)"]`,
        `${PROFILE} a[href$="/creator-subscriptions/subscriptions"]`,
        `${PROFILE} ${PRIMARY_COLUMN} nav div:has(> a[href$="/superfollows"])`,
        `${PROFILE} ${PRIMARY_COLUMN} nav div:has(> a[href$="/subscriptions"])`,
        `${FOCUSED_POST} [data-testid$="-subscribe"]`,
        '[data-testid="Dropdown"] > [data-testid="subscribe"]',
        '[data-testid="sheetDialog"] > [data-testid="subscribe"]',
        `${POST} [data-testid="icon-subscriber"]`
      ),
      ["superfollow", "creator", "paid"]
    ),
    toggle2(
      "hideVerifiedFollowersTab",
      "Hide the Verified Followers tab",
      "Remove the Verified Followers tab from follower lists. Opening its address directly still works.",
      hide(`${PROFILE} ${PRIMARY_COLUMN} nav div:has(> a[href$="/verified_followers"])`),
      ["premium", "blue", "followers"]
    )
  ];

  // src/features/drag-photos.ts
  var VIEWER = '[aria-modal="true"]';
  var NEXT = ':is([data-testid="Carousel-NavRight"], [aria-label="Next slide"])';
  var PREV = ':is([data-testid="Carousel-NavLeft"], [aria-label="Previous slide"])';
  var SLIDE = 'img, [data-testid="swipe-to-dismiss"], li[role="listitem"]';
  var NOT_DRAGGABLE = 'button, [role="button"], a[href], video, [data-testid="videoPlayer"], [data-testid="videoComponent"], input, textarea, [contenteditable="true"], [role="slider"], article';
  var DRAGGING_ATTR = "data-bx-photo-dragging";
  var START_PX = 8;
  var commitDistance = (viewerWidth) => Math.max(48, Math.min(96, viewerWidth * 0.06));
  var EDGE_RESISTANCE = 0.2;
  var SETTLE_MS = 220;
  function startPhotoDrag(scope, doc = document) {
    const root = doc.documentElement;
    const view = doc.defaultView ?? window;
    let gesture = null;
    let swallowClick = false;
    const reducedMotion = () => typeof view.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const arrow = (viewer, direction) => viewer.querySelector(direction === "next" ? NEXT : PREV);
    function end(commit) {
      const current = gesture;
      if (!current) return;
      gesture = null;
      if (!current.dragging) return;
      root.removeAttribute(DRAGGING_ATTR);
      const { mover, viewer, dx } = current;
      try {
        mover.releasePointerCapture(current.pointerId);
      } catch {
      }
      const from = mover.style.translate;
      mover.style.translate = current.translate;
      const target = arrow(viewer, dx < 0 ? "next" : "prev");
      const go = commit && Math.abs(dx) >= commitDistance(viewer.clientWidth) && target;
      if (!reducedMotion() && typeof mover.animate === "function" && mover.isConnected)
        mover.animate([{ translate: from }, { translate: current.translate || "0px 0px" }], {
          duration: SETTLE_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
        });
      if (go) target.click();
    }
    scope.add(() => end(false));
    scope.listen(
      doc,
      "pointerdown",
      (event) => {
        const e = event;
        end(false);
        if (e.button !== 0 || !e.isPrimary || e.pointerType === "touch") return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const target = e.target instanceof Element ? e.target : null;
        const viewer = target?.closest(VIEWER);
        if (!target || !viewer) return;
        if (!target.closest(SLIDE) || target.closest(NOT_DRAGGABLE)) return;
        if (!arrow(viewer, "next") && !arrow(viewer, "prev")) return;
        const mover = target.closest('ul[role="list"]') ?? target.closest('[data-testid="swipe-to-dismiss"]') ?? target.closest("img");
        if (!mover || !viewer.contains(mover)) return;
        gesture = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          viewer,
          mover,
          translate: mover.style.translate,
          dragging: false,
          dx: 0
        };
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "pointermove",
      (event) => {
        const e = event;
        if (!gesture || e.pointerId !== gesture.pointerId) return;
        if (e.buttons === 0 || !gesture.mover.isConnected) return end(false);
        const dx = e.clientX - gesture.startX;
        const dy = e.clientY - gesture.startY;
        if (!gesture.dragging) {
          if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
          if (Math.abs(dy) >= Math.abs(dx)) {
            gesture = null;
            return;
          }
          gesture.dragging = true;
          root.setAttribute(DRAGGING_ATTR, "");
          view.getSelection?.()?.removeAllRanges();
          try {
            gesture.mover.setPointerCapture(e.pointerId);
          } catch {
          }
        }
        e.preventDefault();
        gesture.dx = dx;
        const open = arrow(gesture.viewer, dx < 0 ? "next" : "prev");
        const offset = Math.round(open ? dx : dx * EDGE_RESISTANCE);
        gesture.mover.style.translate = `${offset}px 0px`;
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "pointerup",
      (event) => {
        const e = event;
        if (!gesture || e.pointerId !== gesture.pointerId) return;
        const dragged = gesture.dragging;
        end(true);
        if (dragged) {
          swallowClick = true;
          scope.setTimeout(() => swallowClick = false, 80);
        }
      },
      { capture: true }
    );
    const cancel = (event) => {
      if (gesture && event.pointerId === gesture.pointerId) end(false);
    };
    scope.listen(doc, "pointercancel", cancel, { capture: true });
    scope.listen(doc, "lostpointercapture", cancel, { capture: true });
    scope.listen(view, "blur", () => end(false));
    scope.listen(
      doc,
      "keydown",
      (event) => {
        if (event.key === "Escape") end(false);
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "click",
      (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "dragstart",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const viewer = target?.closest(VIEWER);
        if (!target || !viewer || !target.closest(SLIDE) || target.closest(NOT_DRAGGABLE)) return;
        if (arrow(viewer, "next") || arrow(viewer, "prev")) event.preventDefault();
      },
      { capture: true }
    );
  }
  var POST_MEDIA = '[data-testid="tweetPhoto"], [data-testid="videoComponent"]';
  var TIMELINE_NOT_DRAGGABLE = 'button, [role="button"], video, [data-testid="videoPlayer"], input, textarea, [contenteditable="true"], [role="slider"]';
  var INLINE_NEXT = `${NEXT}, [aria-label="Next"]`;
  var INLINE_PREV = `${PREV}, [aria-label="Previous"]`;
  function findCarousel(media, post) {
    const view = media.ownerDocument.defaultView ?? window;
    for (let el2 = media.parentElement; el2 && el2 !== post; el2 = el2.parentElement) {
      if (el2.scrollWidth <= el2.clientWidth + 1) continue;
      const overflow = view.getComputedStyle(el2).overflowX;
      if (overflow === "visible" || overflow === "clip") continue;
      if (el2.querySelectorAll(POST_MEDIA).length >= 2) return el2;
    }
    return null;
  }
  function snapPoints(carousel) {
    const view = carousel.ownerDocument.defaultView ?? window;
    const box = carousel.getBoundingClientRect();
    const max = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const pad = parseFloat(view.getComputedStyle(carousel).scrollPaddingLeft) || 0;
    const aligned = [...carousel.querySelectorAll("*")].map((el2) => [el2, (view.getComputedStyle(el2).scrollSnapAlign || "").split(" ").pop()]).filter(([, align]) => align && align !== "none");
    const items = aligned.length ? aligned : [...carousel.querySelectorAll(POST_MEDIA)].map((el2) => [el2, "start"]);
    const points = items.map(([el2, align]) => {
      const rect = el2.getBoundingClientRect();
      const left = rect.left - box.left + carousel.scrollLeft;
      const x = align === "center" ? left + rect.width / 2 - carousel.clientWidth / 2 : align === "end" ? left + rect.width - carousel.clientWidth : left - pad;
      return Math.min(max, Math.max(0, Math.round(x)));
    });
    return [.../* @__PURE__ */ new Set([0, max, ...points])].sort((a2, b) => a2 - b);
  }
  function restingPoint(points, start, now, commit) {
    if (!commit || points.length === 0) return start;
    const nearest = points.reduce((best, p) => Math.abs(p - now) < Math.abs(best - now) ? p : best);
    if (now > start && nearest <= start + 1) return points.find((p) => p > start + 1) ?? nearest;
    if (now < start && nearest >= start - 1)
      return [...points].reverse().find((p) => p < start - 1) ?? nearest;
    return nearest;
  }
  function startTimelinePhotoDrag(scope, doc = document) {
    const root = doc.documentElement;
    const view = doc.defaultView ?? window;
    let gesture = null;
    let swallowClick = false;
    const reducedMotion = () => typeof view.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inlineArrow = (post, direction) => post.querySelector(direction === "next" ? INLINE_NEXT : INLINE_PREV);
    function pressable(target) {
      if (!target || target.closest(VIEWER)) return null;
      const media = target.closest(POST_MEDIA);
      const post = media?.closest("article");
      if (!media || !post) return null;
      const blocked = target.closest(TIMELINE_NOT_DRAGGABLE);
      if (blocked && !blocked.contains(media)) return null;
      const carousel = findCarousel(media, post);
      if (!carousel && !inlineArrow(post, "next") && !inlineArrow(post, "prev")) return null;
      return { media, post, carousel };
    }
    function end(commit) {
      const current = gesture;
      if (!current) return;
      gesture = null;
      if (!current.dragging) return;
      root.removeAttribute(DRAGGING_ATTR);
      const { carousel, mover, dx } = current;
      try {
        (carousel ?? mover).releasePointerCapture(current.pointerId);
      } catch {
      }
      if (carousel) {
        const go2 = commit && Math.abs(dx) >= commitDistance(carousel.clientWidth);
        const target = restingPoint(
          snapPoints(carousel),
          current.startScroll,
          carousel.scrollLeft,
          go2
        );
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          carousel.style.scrollSnapType = current.snap;
          carousel.style.scrollBehavior = current.behavior;
        };
        if (Math.abs(carousel.scrollLeft - target) < 1) return settle();
        carousel.addEventListener("scrollend", settle, { once: true });
        scope.setTimeout(settle, 900);
        carousel.scrollTo({ left: target, behavior: reducedMotion() ? "auto" : "smooth" });
        return;
      }
      const from = mover.style.translate;
      mover.style.translate = current.translate;
      const button = inlineArrow(current.post, dx < 0 ? "next" : "prev");
      const go = commit && Math.abs(dx) >= commitDistance(mover.clientWidth || 600) && button;
      if (!reducedMotion() && typeof mover.animate === "function" && mover.isConnected)
        mover.animate([{ translate: from }, { translate: current.translate || "0px 0px" }], {
          duration: SETTLE_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
        });
      if (go) button.click();
    }
    scope.add(() => end(false));
    scope.listen(
      doc,
      "pointerdown",
      (event) => {
        const e = event;
        end(false);
        if (e.button !== 0 || !e.isPrimary || e.pointerType === "touch") return;
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const found = pressable(e.target instanceof Element ? e.target : null);
        if (!found) return;
        const { media, post, carousel } = found;
        const mover = media.closest('ul[role="list"]') ?? media.closest("li") ?? media;
        gesture = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          post,
          carousel,
          mover,
          translate: mover.style.translate,
          startScroll: carousel?.scrollLeft ?? 0,
          snap: carousel?.style.scrollSnapType ?? "",
          behavior: carousel?.style.scrollBehavior ?? "",
          dragging: false,
          dx: 0
        };
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "pointermove",
      (event) => {
        const e = event;
        const current = gesture;
        if (!current || e.pointerId !== current.pointerId) return;
        const holder = current.carousel ?? current.mover;
        if (e.buttons === 0 || !holder.isConnected) return end(false);
        const dx = e.clientX - current.startX;
        const dy = e.clientY - current.startY;
        if (!current.dragging) {
          if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
          if (Math.abs(dy) >= Math.abs(dx)) {
            gesture = null;
            return;
          }
          current.dragging = true;
          root.setAttribute(DRAGGING_ATTR, "");
          view.getSelection?.()?.removeAllRanges();
          if (current.carousel) {
            current.carousel.style.scrollSnapType = "none";
            current.carousel.style.scrollBehavior = "auto";
          }
          try {
            holder.setPointerCapture(e.pointerId);
          } catch {
          }
        }
        e.preventDefault();
        current.dx = dx;
        if (current.carousel) {
          current.carousel.scrollLeft = current.startScroll - dx;
          return;
        }
        const open = inlineArrow(current.post, dx < 0 ? "next" : "prev");
        current.mover.style.translate = `${Math.round(open ? dx : dx * EDGE_RESISTANCE)}px 0px`;
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "pointerup",
      (event) => {
        const e = event;
        if (!gesture || e.pointerId !== gesture.pointerId) return;
        const dragged = gesture.dragging;
        end(true);
        if (dragged) {
          swallowClick = true;
          scope.setTimeout(() => swallowClick = false, 80);
        }
      },
      { capture: true }
    );
    const cancel = (event) => {
      if (gesture && event.pointerId === gesture.pointerId) end(false);
    };
    scope.listen(doc, "pointercancel", cancel, { capture: true });
    scope.listen(doc, "lostpointercapture", cancel, { capture: true });
    scope.listen(view, "blur", () => end(false));
    scope.listen(
      doc,
      "keydown",
      (event) => {
        if (event.key === "Escape") end(false);
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "click",
      (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true }
    );
    scope.listen(
      doc,
      "dragstart",
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const inner = target.matches(POST_MEDIA) ? null : target.querySelector(POST_MEDIA);
        if (gesture || pressable(target) || inner && pressable(inner)) event.preventDefault();
      },
      { capture: true }
    );
  }
  var dragPhotos = {
    id: "posts.dragPhotos",
    category: "posts",
    title: "Drag to navigate photos",
    description: "In the expanded photo viewer, drag a photo left or right to move between a post’s photos.",
    keywords: ["swipe", "carousel", "gallery", "image", "lightbox", "slide", "mouse"],
    kind: "toggle",
    defaultEnabled: false,
    css: `
html[${DRAGGING_ATTR}],
html[${DRAGGING_ATTR}] * {
  cursor: grabbing !important;
  user-select: none !important;
}`,
    activate({ scope }) {
      startPhotoDrag(scope);
    }
  };
  var dragTimelinePhotos = {
    id: "posts.dragTimelinePhotos",
    category: "posts",
    title: "Also drag photos in the timeline",
    description: "Drag a post’s photos left or right where they are in your timeline, without opening the photo viewer.",
    keywords: ["swipe", "carousel", "gallery", "image", "inline", "feed", "mouse"],
    kind: "toggle",
    defaultEnabled: false,
    requires: "posts.dragPhotos",
    activate({ scope }) {
      startTimelinePhotoDrag(scope);
    }
  };

  // src/features/feed.ts
  var { toggle: toggle3 } = definitions("feed");
  var HOME = onRoute("home");
  var PINNED_ICON = "M13 21l-1 2-1-2v-5H4.5v-2.287l";
  var COMMUNITY_ICON = "M7.471 21H.472l.029-1.027c.184";
  var LIKE_NOTIFICATION_ICON = "M20.884 13.19c-1.351 2.48-4.00";
  var REPOST_NOTIFICATION_ICON = "M4.75 3.79l4.603 4.3-1.706 1.8";
  var sharedPost = (route) => cellWhere(
    `:has(${POST} [data-testid="socialContext"]):not(:has(path[d^="${PINNED_ICON}"], path[d^="${COMMUNITY_ICON}"]))`,
    route
  );
  var FEED_FEATURES = [
    toggle3(
      "hideNewPostsPill",
      "Hide “Show new posts”",
      "Remove the floating pill that announces new posts on Home.",
      hide(
        `${HOME} ${PRIMARY_COLUMN} > div > div:first-child > div[style^="transform"]`,
        `${HOME} [data-testid="TopNavBar"] ~ div[style^="transform"]:last-child`
      ),
      ["see new posts", "refresh"]
    ),
    toggle3(
      "hidePostBox",
      "Hide the Home composer",
      "Remove the “What is happening?” box at the top of Home. The Post button still opens the composer.",
      // Found by the editor's class, which almost nothing else on the page has; a `data-testid`
      // test would make Chrome re-test the composer's ancestors for every post that is added.
      hide(`${HOME} ${PRIMARY_COLUMN} > div > div:has(.DraftEditor-root)`),
      ["compose", "tweet box", "write"]
    ),
    toggle3(
      "hideManageTimelines",
      "Hide “Manage timelines”",
      "Remove the plus button beside the Home tabs.",
      hide(
        `${HOME} ${PRIMARY_COLUMN} div:has(> nav) + div:has(path[d="M11 11V4h2v7h7v2h-7v7h-2v-7H4v-2h7z"])`
      ),
      ["pinned timelines", "tabs"]
    ),
    toggle3(
      "hideInlinePrompts",
      "Hide timeline prompts",
      "Remove the “Subscribe”, “Verify” and other prompts X inserts between posts.",
      hide(cellWhere(':has([data-testid="inlinePrompt"])')),
      ["upsell", "promotion"]
    ),
    toggle3(
      "hideSuggestedModules",
      "Hide “Who to follow” in the timeline",
      "Remove suggested-account modules from Home: their heading, the accounts and “Show more”.",
      hide(
        cellWhere(
          `:not(:has(${POST})):is(:has(h2[role="heading"]), :has([data-testid="UserCell"]), :has(a[href*="/i/connect_people"]))`,
          HOME
        )
      ),
      ["recommended accounts", "suggested accounts", "people"]
    ),
    toggle3(
      "hideProfileSuggestions",
      "Hide suggestions on profiles",
      "Remove “You might like” and similar suggestions that appear on a profile page.",
      hide(`${onRoute("profile")} ${PRIMARY_COLUMN} aside[role="complementary"]`),
      ["recommended", "who to follow"]
    ),
    toggle3(
      "hideExploreContents",
      "Empty the Explore page",
      "Remove the trending, news and recommendation tabs from Explore, leaving search.",
      hide(
        `${onRoute("explore")} ${PRIMARY_COLUMN} > div > div:first-of-type nav`,
        `${onRoute("explore")} ${PRIMARY_COLUMN} section > h1 + div[aria-label] > div`,
        `${onRoute("explore")} [data-testid="TopNavBar"] > div > div:nth-of-type(2)`
      ),
      ["trending", "for you", "news"]
    ),
    toggle3(
      "hideReposts",
      "Hide reposts on Home",
      "Remove reposts from the Home timeline. Also hides the other “because someone liked or followed” posts, which X labels the same way.",
      hide(sharedPost(HOME)),
      ["retweets", "shared"]
    ),
    toggle3(
      "hideProfileReposts",
      "Hide reposts on profiles",
      "Remove reposts from other people’s profiles. Pinned posts stay.",
      hide(sharedPost(onRoute("profile"))),
      ["retweets"]
    ),
    toggle3(
      "hideNotificationLikes",
      "Hide “liked your post” notifications",
      "Remove like notifications from your Notifications page.",
      hide(
        cellWhere(
          `:has([data-testid="notification"] svg path[d^="${LIKE_NOTIFICATION_ICON}"])`,
          onRoute("notifications")
        )
      ),
      ["likes"]
    ),
    toggle3(
      "hideNotificationReposts",
      "Hide “reposted your post” notifications",
      "Remove repost notifications from your Notifications page.",
      hide(
        cellWhere(
          `:has([data-testid="notification"] svg path[d^="${REPOST_NOTIFICATION_ICON}"])`,
          onRoute("notifications")
        )
      ),
      ["retweets"]
    )
  ];

  // src/content/popover.ts
  function anchorVisible(anchor) {
    if (!anchor.isConnected) return false;
    const rect = anchor.getBoundingClientRect();
    return rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight;
  }
  function xTheme() {
    const [r = 255, g = 255, b = 255, alpha = 1] = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
    return alpha > 0 && 0.299 * r + 0.587 * g + 0.114 * b < 128 ? "dark" : "light";
  }
  function el(tag, className = "", text = "", attributes = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  // src/insights/places.ts
  var ISO_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW".split(
    " "
  );
  var DISPLAY_OVERRIDES = {
    HK: "Hong Kong",
    MO: "Macao",
    MM: "Myanmar",
    PS: "Palestine",
    CD: "Congo (Kinshasa)",
    CG: "Congo (Brazzaville)",
    UM: "US Outlying Islands",
    VI: "US Virgin Islands"
  };
  var ALIASES = {
    "cabo verde": "CV",
    "cape verde": "CV",
    "u.s. virgin islands": "VI",
    "united states virgin islands": "VI",
    swaziland: "SZ",
    "republic of the congo": "CG",
    "congo brazzaville": "CG",
    congo: "CG",
    "dr congo": "CD",
    drc: "CD",
    "democratic republic of the congo": "CD",
    "congo kinshasa": "CD",
    "republic of korea": "KR",
    "south korea": "KR",
    korea: "KR",
    "democratic people's republic of korea": "KP",
    "north korea": "KP",
    "republic of moldova": "MD",
    "holy see": "VA",
    "vatican city": "VA",
    "brunei darussalam": "BN",
    "federated states of micronesia": "FM",
    "micronesia federated states of": "FM",
    "united republic of tanzania": "TZ",
    "state of palestine": "PS",
    "palestinian territories": "PS",
    "united states of america": "US",
    "united states": "US",
    usa: "US",
    us: "US",
    "svalbard and jan mayen islands": "SJ",
    "saint martin french part": "MF",
    "sint maarten dutch part": "SX",
    "wallis and futuna islands": "WF",
    naoero: "NR",
    "bolivia plurinational state of": "BO",
    "iran islamic republic of": "IR",
    "netherlands kingdom of the": "NL",
    "venezuela bolivarian republic of": "VE",
    "falkland islands malvinas": "FK",
    "china hong kong special administrative region": "HK",
    "china macao special administrative region": "MO",
    "united kingdom of great britain and northern ireland": "GB",
    uk: "GB",
    britain: "GB",
    "great britain": "GB",
    "bonaire sint eustatius and saba": "BQ",
    bosnia: "BA",
    burma: "MM",
    "cote d'ivoire": "CI",
    "ivory coast": "CI",
    "czech republic": "CZ",
    "east timor": "TL",
    "lao people s democratic republic": "LA",
    macau: "MO",
    macedonia: "MK",
    russia: "RU",
    "russian federation": "RU",
    "syrian arab republic": "SY",
    turkey: "TR",
    turkiye: "TR",
    uae: "AE",
    "viet nam": "VN",
    reunion: "RE",
    holland: "NL"
  };
  var REGION_LABELS = [
    "Africa",
    "Asia",
    "Australasia",
    "Caribbean",
    "Central Asia",
    "East Asia",
    "East Asia & Pacific",
    "Europe",
    "North Africa",
    "North America",
    "Oceania",
    "South America",
    "South Asia",
    "Southeast Asia",
    "West Asia"
  ];
  function nameKey(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "");
  }
  var cached;
  function tables() {
    if (cached) return cached;
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const countries = [];
    const byKey = /* @__PURE__ */ new Map();
    const byCode = /* @__PURE__ */ new Map();
    for (const code of ISO_CODES) {
      const raw = DISPLAY_OVERRIDES[code] ?? names.of(code);
      if (!raw || raw === code) continue;
      const place = { kind: "country", code, name: raw.replace(/ & /g, " and ") };
      countries.push(place);
      byCode.set(code, place);
      byKey.set(nameKey(raw), place);
      byKey.set(nameKey(place.name), place);
      const browserName = names.of(code);
      if (browserName) byKey.set(nameKey(browserName), place);
    }
    for (const [alias, code] of Object.entries(ALIASES)) {
      const place = byCode.get(code);
      if (place) byKey.set(nameKey(alias), place);
    }
    countries.sort((a2, b) => a2.name.localeCompare(b.name, "en"));
    const regions = /* @__PURE__ */ new Map();
    for (const label of REGION_LABELS) regions.set(nameKey(label), { kind: "region", name: label });
    cached = { countries, byKey, byCode, regions };
    return cached;
  }
  function resolveSelectable(raw) {
    if (typeof raw !== "string") return null;
    const key = nameKey(raw);
    if (!key || raw.length > 80) return null;
    const t2 = tables();
    return t2.byKey.get(key) ?? t2.regions.get(key) ?? null;
  }
  function placeKey(place) {
    return place.code ? `cc:${place.code}` : `rg:${nameKey(place.name)}`;
  }
  var REGIONAL_INDICATOR_A = 127462;
  function flagOf(place) {
    if (!place.code || !/^[A-Z]{2}$/.test(place.code)) return null;
    return String.fromCodePoint(
      ...[...place.code].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65)
    );
  }

  // src/lib/color.ts
  var WHITE = [255, 255, 255];
  var BLACK = [0, 0, 0];
  var HEX = /^#[0-9a-f]{6}$/i;
  var isHex = (value) => typeof value === "string" && HEX.test(value);
  var toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  var toHex = (rgb) => `#${rgb.map((c2) => Math.round(c2).toString(16).padStart(2, "0")).join("")}`;
  var mix = (a2, b, t2) => a2.map((c2, i) => c2 + (b[i] - c2) * t2);
  var luminance = ([r, g, b]) => {
    const [lr, lg, lb] = [r, g, b].map((c2) => {
      const s = c2 / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };
  var contrast = (a2, b) => {
    const [hi, lo] = [luminance(a2), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  function ensureContrast(color3, against, ratio, prefer) {
    const round = (rgb) => rgb.map((c2) => Math.round(c2));
    if (contrast(round(color3), against) >= ratio) return round(color3);
    const extreme = contrast(WHITE, against) >= contrast(BLACK, against) ? WHITE : BLACK;
    const target = contrast(round(prefer), against) >= ratio ? prefer : extreme;
    for (let step = 1; step <= 40; step++) {
      const next = round(mix(color3, target, step / 40));
      if (contrast(next, against) >= ratio) return next;
    }
    return round(target);
  }
  function toHslComponents([r, g, b]) {
    const [rs, gs, bs] = [r / 255, g / 255, b / 255];
    const max = Math.max(rs, gs, bs);
    const min = Math.min(rs, gs, bs);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === rs) h = (gs - bs) / d % 6;
      else if (max === gs) h = (bs - rs) / d + 2;
      else h = (rs - gs) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const fixed = (n) => Number(n.toFixed(1));
    return `${fixed(h)} ${fixed(s * 100)}% ${fixed(l * 100)}%`;
  }

  // src/themes/presets.ts
  var PRESETS = [
    {
      id: "dim",
      title: "Dim",
      description: "Twitter's classic blue-gray Dim",
      base: "dark",
      seed: {
        bg: "#15202b",
        raised: "#28323d",
        border: "#38444d",
        text: "#f7f9f9",
        muted: "#8b98a5",
        accent: "#1d9bf0"
      }
    },
    {
      id: "graphite",
      title: "Graphite",
      description: "Soft charcoal instead of pure black",
      base: "dark",
      seed: {
        bg: "#121212",
        raised: "#1e1e1e",
        border: "#2c2c2c",
        text: "#ececec",
        muted: "#9a9a9a",
        accent: "#1d9bf0"
      }
    },
    {
      id: "midnight",
      title: "Midnight",
      description: "Deep navy with a periwinkle accent",
      base: "dark",
      seed: {
        bg: "#0b1020",
        raised: "#151b30",
        border: "#232b45",
        text: "#e6e9f5",
        muted: "#8b93b0",
        accent: "#6c8cff"
      }
    },
    {
      id: "nord",
      title: "Nord",
      description: "Arctic, north-bluish calm",
      base: "dark",
      seed: {
        bg: "#2e3440",
        raised: "#3b4252",
        border: "#434c5e",
        text: "#eceff4",
        accent: "#88c0d0"
      }
    },
    {
      id: "dracula",
      title: "Dracula",
      description: "The dark theme for vampires",
      base: "dark",
      seed: {
        bg: "#282a36",
        raised: "#343746",
        border: "#44475a",
        text: "#f8f8f2",
        accent: "#bd93f9"
      }
    },
    {
      id: "mocha",
      title: "Catppuccin Mocha",
      description: "Soothing pastels on a warm dark base",
      base: "dark",
      seed: {
        bg: "#1e1e2e",
        raised: "#313244",
        border: "#45475a",
        text: "#cdd6f4",
        muted: "#a6adc8",
        accent: "#cba6f7"
      }
    },
    {
      id: "rosepine",
      title: "Rosé Pine",
      description: "Muted purples, all natural pine",
      base: "dark",
      seed: {
        bg: "#191724",
        raised: "#26233a",
        border: "#403d52",
        text: "#e0def4",
        muted: "#908caa",
        accent: "#c4a7e7"
      }
    },
    {
      id: "tokyo",
      title: "Tokyo Night",
      description: "Neon city lights after dark",
      base: "dark",
      seed: {
        bg: "#1a1b26",
        raised: "#292e42",
        border: "#3b4261",
        text: "#c0caf5",
        muted: "#9aa5ce",
        accent: "#7aa2f7"
      }
    },
    {
      id: "gruvbox",
      title: "Gruvbox",
      description: "Retro groove, warm and earthy",
      base: "dark",
      seed: {
        bg: "#282828",
        raised: "#3c3836",
        border: "#504945",
        text: "#ebdbb2",
        muted: "#a89984",
        accent: "#fabd2f"
      }
    },
    {
      id: "solarized",
      title: "Solarized Dark",
      description: "Precision colors for machines and people",
      base: "dark",
      seed: {
        bg: "#002b36",
        raised: "#073642",
        border: "#12414d",
        text: "#93a1a1",
        accent: "#268bd2"
      }
    },
    {
      id: "forest",
      title: "Forest",
      description: "Deep green with a bright leaf accent",
      base: "dark",
      seed: {
        bg: "#0f1a14",
        raised: "#182820",
        border: "#254033",
        text: "#e4f0e8",
        muted: "#8fb09b",
        accent: "#3ddc84"
      }
    },
    {
      id: "ember",
      title: "Ember",
      description: "Warm coal with an orange glow",
      base: "dark",
      seed: {
        bg: "#1a1210",
        raised: "#2a1d19",
        border: "#43302a",
        text: "#f5e9e4",
        muted: "#b99a8f",
        accent: "#ff8a3d"
      }
    }
  ];
  var CUSTOM_THEME_ID = "custom";
  var LIGHTS_OUT_SEED = {
    bg: "#000000",
    raised: "#202327",
    hover: "#16181c",
    border: "#2f3336",
    text: "#e7e9ea",
    muted: "#71767b",
    accent: "#1d9bf0"
  };
  var BY_ID = new Map(PRESETS.map((preset) => [preset.id, preset]));
  var isPresetId = (id) => BY_ID.has(id);

  // src/themes/types.ts
  var EXTRA_SEED_KEYS = ["mention", "badge", "badgeText"];

  // src/lib/settings.ts
  var SETTINGS_KEY = "bx.settings";
  var SETTINGS_VERSION = 8;
  var MAX_SAVED_THEMES = 30;
  var MAX_THEME_NAME = 40;
  var SAVED_THEME_ID = /^my-[a-z0-9]{4,16}$/;
  var MAX_COUNTRIES = 250;
  var MAX_ALWAYS_SHOW = 200;
  var DEFAULT_SETTINGS = {
    version: SETTINGS_VERSION,
    theme: "auto",
    accent: "blue",
    density: "comfortable",
    downloadsEnabled: true,
    afterSave: "downloadOffer",
    menuActions: { download: true, openLibrary: true },
    saveAs: false,
    openAs: "sidepanel",
    panelMode: "overlay",
    panelHandle: false,
    popupHeight: "standard",
    insights: { lookup: "hover" },
    filter: { countries: [], mode: "collapse", posts: true, quotes: true, alwaysShow: [] },
    xTheme: {
      active: null,
      custom: { ...LIGHTS_OUT_SEED },
      saved: [],
      chat: false,
      matchPanel: false
    },
    features: {},
    values: {}
  };
  var ACCENTS = {
    blue: {
      label: "Blue",
      brand: "#1d9bf0",
      text: "#006fd6",
      textDark: "#1d9bf0",
      softLight: "#eef7fe",
      softDark: "#0a1f30"
    },
    purple: {
      label: "Purple",
      brand: "#7856ff",
      text: "#5b37e6",
      textDark: "#9b85ff",
      softLight: "#f3f0ff",
      softDark: "#1b1540"
    },
    green: {
      label: "Green",
      brand: "#00ba7c",
      text: "#00704a",
      textDark: "#00ba7c",
      softLight: "#e8f8f1",
      softDark: "#07261b"
    },
    orange: {
      label: "Orange",
      brand: "#ff7a00",
      text: "#a84f00",
      textDark: "#ff7a00",
      softLight: "#fff3e8",
      softDark: "#2e1b07"
    },
    pink: {
      label: "Pink",
      brand: "#f91880",
      text: "#c0095f",
      textDark: "#f91880",
      softLight: "#feeef5",
      softDark: "#300a1d"
    }
  };
  var CUSTOM_ACCENT = /^#[0-9a-f]{6}$/i;
  function parseAccent(value) {
    if (typeof value !== "string") return null;
    if (Object.hasOwn(ACCENTS, value)) return value;
    return CUSTOM_ACCENT.test(value) ? value.toLowerCase() : null;
  }
  var normalizeAccent = (value, fallback) => parseAccent(value) ?? fallback;
  var THEMES = /* @__PURE__ */ new Set(["auto", "light", "dark"]);
  var AFTER_SAVE = /* @__PURE__ */ new Set(["downloadOffer", "confirmationOnly", "quiet"]);
  var DENSITIES = /* @__PURE__ */ new Set(["comfortable", "compact", "dense"]);
  var OPEN_AS = /* @__PURE__ */ new Set(["sidepanel", "popup", "window"]);
  var PANEL_MODES = /* @__PURE__ */ new Set(["native", "overlay"]);
  var POPUP_HEIGHTS = /* @__PURE__ */ new Set(["compact", "standard", "tall"]);
  var LOOKUPS = /* @__PURE__ */ new Set(["manual", "hover", "visible"]);
  var FILTER_MODES = /* @__PURE__ */ new Set(["collapse", "hide", "highlight"]);
  var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  var pick = (value, allowed, fallback) => allowed.has(value) ? value : fallback;
  var bool = (value, fallback) => typeof value === "boolean" ? value : fallback;
  var FEATURE_ID = /^[a-z][A-Za-z0-9]{0,31}\.[a-z][A-Za-z0-9]{0,47}$/;
  var MAX_FEATURES = 256;
  function normalizeById(input, valid) {
    const result = {};
    if (!isRecord(input)) return result;
    for (const [id, value] of Object.entries(input).slice(0, MAX_FEATURES))
      if (FEATURE_ID.test(id) && valid(value)) result[id] = value;
    return result;
  }
  var isBoolean = (value) => typeof value === "boolean";
  var isNumber = (value) => typeof value === "number" && Number.isFinite(value);
  function normalizeCountries(input) {
    if (!Array.isArray(input)) return [];
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const item of input.slice(0, MAX_COUNTRIES * 2)) {
      const place = resolveSelectable(item);
      if (!place || seen.has(placeKey(place))) continue;
      seen.add(placeKey(place));
      result.push(place.name);
      if (result.length >= MAX_COUNTRIES) break;
    }
    return result;
  }
  function normalizeHandle(input) {
    if (typeof input !== "string") return null;
    const handle = input.trim().replace(/^@/, "").toLowerCase();
    return /^[a-z0-9_]{1,15}$/.test(handle) ? handle : null;
  }
  function normalizeAlwaysShow(input) {
    if (!Array.isArray(input)) return [];
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const item of input.slice(0, MAX_ALWAYS_SHOW * 2)) {
      const entry = isRecord(item) ? item : { handle: item };
      const handle = normalizeHandle(entry.handle);
      if (!handle || seen.has(handle)) continue;
      seen.add(handle);
      const id = typeof entry.id === "string" && /^\d{1,25}$/.test(entry.id) ? entry.id : void 0;
      result.push(id ? { handle, id } : { handle });
      if (result.length >= MAX_ALWAYS_SHOW) break;
    }
    return result;
  }
  function normalizeFilter(input) {
    const value = isRecord(input) ? input : {};
    const d = DEFAULT_SETTINGS.filter;
    return {
      countries: normalizeCountries(value.countries),
      mode: pick(value.mode, FILTER_MODES, d.mode),
      posts: bool(value.posts, d.posts),
      quotes: bool(value.quotes, d.quotes),
      alwaysShow: normalizeAlwaysShow(value.alwaysShow)
    };
  }
  var SEED_KEYS = ["bg", "text", "accent", "raised", "hover", "border", "muted"];
  var parseThemeId = (value) => typeof value === "string" && (value === CUSTOM_THEME_ID || isPresetId(value) || SAVED_THEME_ID.test(value)) ? value : null;
  function normalizeThemeName(input) {
    if (typeof input !== "string") return null;
    const name = input.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_THEME_NAME).trim();
    return name || null;
  }
  function normalizeSavedThemes(input) {
    if (!Array.isArray(input)) return [];
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const item of input.slice(0, MAX_SAVED_THEMES * 2)) {
      if (!isRecord(item)) continue;
      const { id } = item;
      const name = normalizeThemeName(item.name);
      if (typeof id !== "string" || !SAVED_THEME_ID.test(id) || seen.has(id) || !name) continue;
      seen.add(id);
      result.push({ id, name, seed: normalizeSeed(item.seed) });
      if (result.length >= MAX_SAVED_THEMES) break;
    }
    return result;
  }
  function normalizeSeed(input) {
    const value = isRecord(input) ? input : {};
    const seed = { ...LIGHTS_OUT_SEED };
    for (const key of SEED_KEYS) {
      const color3 = value[key];
      if (isHex(color3)) seed[key] = color3.toLowerCase();
    }
    for (const key of EXTRA_SEED_KEYS) {
      const color3 = value[key];
      if (isHex(color3)) seed[key] = color3.toLowerCase();
    }
    return seed;
  }
  function normalizeXTheme(input) {
    const value = isRecord(input) ? input : {};
    const saved = normalizeSavedThemes(value.saved);
    let active = parseThemeId(value.active);
    if (active && SAVED_THEME_ID.test(active) && !saved.some((theme) => theme.id === active))
      active = null;
    return {
      active,
      custom: normalizeSeed(value.custom),
      saved,
      chat: bool(value.chat, DEFAULT_SETTINGS.xTheme.chat),
      matchPanel: bool(value.matchPanel, DEFAULT_SETTINGS.xTheme.matchPanel)
    };
  }
  function normalizeSettings(input) {
    const value = isRecord(input) ? input : {};
    const menu = isRecord(value.menuActions) ? value.menuActions : {};
    const d = DEFAULT_SETTINGS;
    return {
      version: SETTINGS_VERSION,
      theme: pick(value.theme, THEMES, d.theme),
      accent: normalizeAccent(value.accent, d.accent),
      density: pick(value.density, DENSITIES, d.density),
      downloadsEnabled: bool(value.downloadsEnabled, d.downloadsEnabled),
      afterSave: pick(value.afterSave, AFTER_SAVE, d.afterSave),
      menuActions: {
        download: bool(menu.download, d.menuActions.download),
        openLibrary: bool(menu.openLibrary, d.menuActions.openLibrary)
      },
      saveAs: bool(value.saveAs, d.saveAs),
      openAs: pick(value.openAs, OPEN_AS, d.openAs),
      panelMode: pick(value.panelMode, PANEL_MODES, d.panelMode),
      panelHandle: bool(value.panelHandle, d.panelHandle),
      popupHeight: pick(value.popupHeight, POPUP_HEIGHTS, d.popupHeight),
      insights: {
        lookup: pick(
          isRecord(value.insights) ? value.insights.lookup : void 0,
          LOOKUPS,
          d.insights.lookup
        )
      },
      filter: normalizeFilter(value.filter),
      xTheme: normalizeXTheme(value.xTheme),
      features: normalizeById(value.features, isBoolean),
      values: normalizeById(value.values, isNumber)
    };
  }
  function applyPatch(current, patch) {
    return normalizeSettings({
      ...current,
      ...patch,
      menuActions: { ...current.menuActions, ...patch.menuActions },
      insights: { ...current.insights, ...patch.insights },
      filter: { ...current.filter, ...patch.filter },
      xTheme: {
        ...current.xTheme,
        ...patch.xTheme,
        custom: { ...current.xTheme.custom, ...patch.xTheme?.custom }
      },
      features: { ...current.features, ...patch.features },
      values: { ...current.values, ...patch.values }
    });
  }
  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      return normalizeSettings(stored[SETTINGS_KEY]);
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  var writes = Promise.resolve();
  function updateSettings(change) {
    const write = writes.then(async () => {
      const current = await loadSettings();
      const patch = change(current);
      if (!patch) return current;
      const next = applyPatch(current, patch);
      await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      return next;
    });
    writes = write.catch(() => {
    });
    return write;
  }
  function watchSettings(listener) {
    const onChanged = (changes, area) => {
      if (area === "local" && changes[SETTINGS_KEY])
        listener(normalizeSettings(changes[SETTINGS_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }

  // src/media/urls.ts
  var PHOTO_FORMATS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  var VIDEO_PATH = /^\/(tweet_video|ext_tw_video|amplify_video)\/[A-Za-z0-9_/-]{1,200}\.mp4$/;
  function parse(value, host) {
    if (typeof value !== "string" || value.length > 2e3) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === host && !url.username && !url.port ? url : null;
    } catch {
      return null;
    }
  }
  function originalPhotoUrl(value) {
    const url = parse(value, "pbs.twimg.com");
    const match = url?.pathname.match(/^\/media\/([A-Za-z0-9_-]{1,64})(?:\.([a-z]{3,4}))?$/);
    if (!url || !match) return null;
    const format = (url.searchParams.get("format") ?? match[2] ?? "").toLowerCase();
    if (!PHOTO_FORMATS.has(format)) return null;
    return `https://pbs.twimg.com/media/${match[1]}?format=${format}&name=orig`;
  }
  function safeVideoUrl(value) {
    const url = parse(value, "video.twimg.com");
    if (!url || !VIDEO_PATH.test(url.pathname) || url.pathname.includes("..")) return null;
    return url.href;
  }

  // src/x/url.ts
  var HOSTS = /* @__PURE__ */ new Set([
    "x.com",
    "www.x.com",
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com"
  ]);
  function parsePostUrl(input) {
    let parsed;
    try {
      parsed = new URL(input);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!HOSTS.has(parsed.hostname.toLowerCase())) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const statusIndex = segments.findIndex((segment) => segment === "status");
    if (statusIndex < 1 || statusIndex + 1 >= segments.length) return null;
    const id = segments[statusIndex + 1];
    if (!id || !/^\d+$/.test(id)) return null;
    const handle = segments[statusIndex - 1] ?? null;
    if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
    return { tweetId: id, url: `https://x.com/${handle}/status/${id}`, handle };
  }
  var TWITTER_EPOCH = 1288834974657n;
  function postDateFromId(tweetId) {
    if (!/^\d{15,20}$/.test(tweetId)) return null;
    const ms = Number((BigInt(tweetId) >> 22n) + TWITTER_EPOCH);
    return ms > Number(TWITTER_EPOCH) && ms < Date.now() + 864e5 ? new Date(ms).toISOString() : null;
  }

  // src/x/selectors.ts
  var X_SELECTORS = {
    post: "article",
    postLink: 'a[href*="/status/"]',
    time: "time",
    text: '[data-testid="tweetText"]',
    author: '[data-testid="User-Name"]',
    avatar: '[data-testid="Tweet-User-Avatar"] img, [data-testid^="UserAvatar-Container-"] img',
    actionRow: '[role="group"]',
    reply: '[data-testid="reply"]',
    card: '[data-testid="card.wrapper"]',
    profileImage: 'img[src*="/profile_images/"]'
  };
  var HANDLE = /^@?([A-Za-z0-9_]{1,15})$/;
  var VIDEO_THUMB = /\/(amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\//;
  function isQuoteBlock(element) {
    return element.matches('[role="link"]') && !(element.matches("a[href]") && profileHandle(element)) && (!!element.querySelector(`article, ${X_SELECTORS.author}`) || !!element.querySelector(X_SELECTORS.profileImage) && !!element.querySelector(X_SELECTORS.postLink));
  }
  function owner(element, root) {
    for (let node = element.parentElement; node; node = node.parentElement) {
      if (node === root) return root;
      if (node.matches(X_SELECTORS.post) || isQuoteBlock(node)) return node;
    }
    return null;
  }
  function own(root, selector) {
    return [...root.querySelectorAll(selector)].filter((element) => owner(element, root) === root);
  }
  function readText(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element)) return "";
    const tag = node.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "svg") return "";
    if (tag === "IMG") return node.getAttribute("alt") ?? "";
    if (tag === "BR") return "\n";
    let text = "";
    node.childNodes.forEach((child) => text += readText(child));
    return text;
  }
  var clean = (value, max = 2e4) => value?.replace(/ /g, " ").trim().slice(0, max) || null;
  function safeTwimg(value) {
    return value && /^https:\/\/([a-z0-9-]+\.)*twimg\.com\//i.test(value) ? value : null;
  }
  function thumbnail(value) {
    const safe = safeTwimg(value);
    if (!safe) return null;
    try {
      const url = new URL(safe);
      if (url.pathname.startsWith("/media/") || url.pathname.startsWith("/card_img/"))
        url.searchParams.set("name", "small");
      return url.href;
    } catch {
      return null;
    }
  }
  function attempt(read, fallback) {
    try {
      return read();
    } catch {
      return fallback;
    }
  }
  function identityIn(root) {
    const time = own(root, X_SELECTORS.time)[0];
    const timeLink = time?.closest(X_SELECTORS.postLink);
    const links2 = timeLink && root.contains(timeLink) ? [timeLink] : own(root, X_SELECTORS.postLink);
    for (const link of links2) {
      const identity = parsePostUrl(link.href);
      if (identity) return identity;
    }
    return null;
  }
  function profileHandle(link) {
    try {
      const url = new URL(link.href);
      if (!/(^|\.)(x|twitter)\.com$/.test(url.hostname)) return null;
      return url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] ?? null;
    } catch {
      return null;
    }
  }
  function authorIn(root, knownHandle) {
    let handle = knownHandle;
    let displayName = null;
    const block = own(root, X_SELECTORS.author)[0];
    if (block) {
      const nameLink = block.querySelector("a[href]");
      displayName = clean(readText(nameLink), 160);
      const lines = (block.innerText || readText(block)).split("\n").map((line2) => line2.trim());
      if (!displayName) displayName = lines.find((line2) => line2 && !/^[@·]/.test(line2)) ?? null;
      handle ?? (handle = lines.map((line2) => line2.match(/^@([A-Za-z0-9_]{1,15})$/)?.[1]).find(Boolean) ?? null);
    } else {
      for (const link of own(root, "a[href]")) {
        const linkHandle = profileHandle(link);
        if (!linkHandle || handle && linkHandle.toLowerCase() !== handle.toLowerCase()) continue;
        const text = clean(readText(link), 160);
        if (!text) continue;
        if (text.startsWith("@")) handle ?? (handle = linkHandle);
        else {
          handle ?? (handle = linkHandle);
          displayName ?? (displayName = text);
        }
        if (displayName) break;
      }
      if (!handle || !displayName)
        for (const element of own(root, "span, div")) {
          if (element.childElementCount > 1) continue;
          const text = clean(readText(element), 160);
          const match = text?.match(HANDLE);
          if (!handle && text?.startsWith("@") && match?.[1]) handle = match[1];
          else if (!displayName && text && element.matches('.font-bold, [class*="font-bold"]'))
            displayName = text;
          if (handle && displayName) break;
        }
    }
    const avatar = own(root, X_SELECTORS.avatar)[0] ?? own(root, X_SELECTORS.profileImage)[0];
    return {
      handle,
      displayName,
      avatarUrl: safeTwimg(avatar?.currentSrc || avatar?.src)
    };
  }
  function textIn(root) {
    const legacy = own(root, X_SELECTORS.text)[0];
    if (legacy) return clean(readText(legacy));
    if (root.querySelector(X_SELECTORS.author)) return null;
    const block = own(root, 'div[dir="auto"]').find((element) => !element.closest("a"));
    return clean(readText(block));
  }
  function createdAtIn(root, identity) {
    const time = own(root, X_SELECTORS.time)[0]?.dateTime;
    if (time && !Number.isNaN(Date.parse(time))) return time;
    return identity ? postDateFromId(identity.tweetId) : null;
  }
  function mediaIn(root, exclude) {
    const found = [];
    const used = /* @__PURE__ */ new Set();
    const skip = (node) => used.has(node) || (exclude?.contains(node) ?? false);
    const genericAlt = (alt) => alt && !/^(image|video|gif|embedded video)$/i.test(alt.trim()) ? clean(alt, 1e3) : null;
    for (const video of own(root, "video")) {
      if (skip(video)) continue;
      const frame = video.parentElement?.parentElement ?? video;
      const poster = frame.querySelector('img[src*="twimg.com"]');
      if (poster) used.add(poster);
      const source = video.currentSrc || video.src || video.querySelector("source")?.src || "";
      const thumb = video.poster || poster?.src || null;
      const kind = /\/tweet_video(_thumb)?\//.test(`${thumb} ${source}`) ? "gif" : "video";
      found.push({
        node: video,
        item: { kind, thumbnailUrl: thumbnail(thumb), sourceUrl: safeVideoUrl(source), alt: null }
      });
      used.add(video);
    }
    for (const image of own(root, 'img[src*="twimg.com"]')) {
      if (skip(image)) continue;
      const src = image.currentSrc || image.src;
      const isVideo = VIDEO_THUMB.test(src);
      if (!isVideo && !src.includes("/media/")) continue;
      const kind = !isVideo ? "image" : src.includes("tweet_video_thumb") ? "gif" : "video";
      found.push({
        node: image,
        item: {
          kind,
          thumbnailUrl: thumbnail(src),
          sourceUrl: kind === "image" ? originalPhotoUrl(src) : null,
          alt: genericAlt(image.alt)
        }
      });
      used.add(image);
    }
    const seen = /* @__PURE__ */ new Set();
    for (const link of own(root, 'a[href*="/photo/"], a[href*="/video/"]')) {
      if (skip(link) || seen.has(link.href)) continue;
      seen.add(link.href);
      if ([...used].some((node) => link.contains(node) || node.contains(link))) continue;
      const kind = link.href.includes("/video/") ? "video" : "image";
      found.push({ node: link, item: { kind, thumbnailUrl: null, sourceUrl: null, alt: null } });
    }
    return found.sort(
      (a2, b) => a2.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    ).map(({ item }) => item).filter(
      (item, index, all) => !item.thumbnailUrl || all.findIndex((other) => other.thumbnailUrl === item.thumbnailUrl) === index
    ).slice(0, 4);
  }
  var isXUrl = (url) => /(^|\.)(x|twitter)\.com$/i.test(url.hostname);
  var DOMAIN = /^(?:From\s+)?((?:[a-z0-9-]+\.)+[a-z]{2,})$/i;
  function textLines(root) {
    const lines = [];
    let lastBlock = null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (!text || node.parentElement?.closest("script, style")) continue;
      let block = node.parentElement;
      while (block && block !== root && /^(inline|contents)$/.test(getComputedStyle(block).display))
        block = block.parentElement;
      if (block === lastBlock && lines.length) lines[lines.length - 1] += ` ${text}`;
      else lines.push(text);
      lastBlock = block;
    }
    return lines;
  }
  function cardContainer(root) {
    const wrapper = own(root, X_SELECTORS.card)[0];
    if (wrapper) return wrapper;
    const image = own(root, 'a[href] img[src*="/card_img/"]')[0];
    return image?.closest("a")?.parentElement ?? null;
  }
  function cardIn(root, container) {
    if (container) {
      const links2 = [...container.querySelectorAll("a[href]")];
      const link = links2.find((anchor) => /^https?:/.test(anchor.href));
      const lines = textLines(container);
      const domainLine = lines.find((line2) => DOMAIN.test(line2));
      let domain = domainLine?.match(DOMAIN)?.[1] ?? null;
      const rest = lines.filter((line2) => line2 !== domainLine && !/^\d+:\d+$/.test(line2));
      if (link) {
        const url = new URL(link.href);
        domain ?? (domain = own(root, "a[href]").filter((anchor) => anchor.href === link.href && !container.contains(anchor)).map((anchor) => clean(readText(anchor))?.match(DOMAIN)?.[1]).find(Boolean) ?? null);
        if (!domain && url.hostname !== "t.co") domain = url.hostname.replace(/^www\./, "");
        const image = container.querySelector('img[src*="twimg.com"]');
        return {
          kind: "link",
          url: url.href,
          domain,
          title: clean(rest[0], 300),
          description: clean(rest[1], 500),
          imageUrl: thumbnail(image?.src)
        };
      }
    }
    const article = own(root, 'a[href*="/article/"]').find(
      (anchor) => /\/(i\/)?article\/\d+/.test(anchor.href)
    );
    if (article) {
      const lines = textLines(article).filter((line2) => !/^article$/i.test(line2));
      return {
        kind: "article",
        url: article.href,
        domain: "x.com",
        title: clean(lines[0], 300),
        description: clean(lines[1], 500),
        imageUrl: thumbnail(article.querySelector("img")?.src)
      };
    }
    const text = own(root, X_SELECTORS.text)[0] ?? root;
    for (const anchor of own(text, 'a[href^="http"]')) {
      if (owner(anchor, root) !== root) continue;
      const url = new URL(anchor.href);
      if (isXUrl(url)) continue;
      const shown = readText(anchor).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/…$/, "");
      const domain = url.hostname === "t.co" ? shown.split("/")[0] ?? null : url.hostname.replace(/^www\./, "");
      return {
        kind: "link",
        url: url.href,
        domain: domain && DOMAIN.test(domain) ? domain : null,
        title: null,
        description: null,
        imageUrl: null
      };
    }
    return null;
  }
  function quoteIn(article) {
    const block = own(article, '[role="link"]').find(isQuoteBlock) ?? own(article, X_SELECTORS.post)[0];
    if (!block) return null;
    const scope = block.matches(X_SELECTORS.post) ? block : own(block, X_SELECTORS.post)[0] ?? block;
    const identity = identityIn(scope);
    const author = authorIn(scope, identity?.handle ?? null);
    return {
      tweetId: identity?.tweetId ?? null,
      url: identity?.url ?? null,
      authorHandle: author.handle,
      authorDisplayName: author.displayName,
      authorAvatarUrl: author.avatarUrl,
      text: textIn(scope),
      createdAt: createdAtIn(scope, identity),
      media: mediaIn(scope, cardContainer(scope))
    };
  }
  var isVisible = (rect) => rect.width > 0 && rect.height > 0;
  function connector(article, edge) {
    const box = article.getBoundingClientRect();
    for (const element of own(article, "div, span")) {
      if (element.childElementCount) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.width > 4 || rect.height < 6 || rect.left > box.left + 100) continue;
      const touches = edge === "bottom" ? rect.bottom >= box.bottom - 16 && rect.top > box.top + 16 : rect.top <= box.top + 16;
      if (!touches) continue;
      const color3 = getComputedStyle(element).backgroundColor;
      if (color3 && color3 !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color3)) return true;
    }
    return false;
  }
  function replyIn(article) {
    for (const element of own(article, "div, span")) {
      const first = element.firstChild;
      if (first?.nodeType !== Node.TEXT_NODE || !/^\s*Replying to\b/i.test(first.textContent ?? ""))
        continue;
      const handle = [...element.querySelectorAll("a[href]")].map(profileHandle).find(Boolean);
      const typed = readText(element).match(/@([A-Za-z0-9_]{1,15})/)?.[1];
      if (handle || typed)
        return {
          tweetId: null,
          url: null,
          authorHandle: handle ?? typed ?? null,
          authorDisplayName: null,
          text: null
        };
    }
    const box = article.getBoundingClientRect();
    if (!isVisible(box)) return null;
    let parent = null;
    let parentBottom = -Infinity;
    for (const candidate of document.querySelectorAll(X_SELECTORS.post)) {
      if (candidate === article || candidate.parentElement?.closest(X_SELECTORS.post)) continue;
      const rect = candidate.getBoundingClientRect();
      if (!isVisible(rect) || rect.bottom > box.top + 4 || rect.bottom <= parentBottom) continue;
      if (rect.right < box.left || rect.left > box.right) continue;
      parent = candidate;
      parentBottom = rect.bottom;
    }
    if (!parent || box.top - parentBottom > 40) return null;
    if (!connector(parent, "bottom") && !connector(article, "top")) return null;
    const identity = identityIn(parent);
    const author = authorIn(parent, identity?.handle ?? null);
    return {
      tweetId: identity?.tweetId ?? null,
      url: identity?.url ?? null,
      authorHandle: author.handle,
      authorDisplayName: author.displayName,
      text: clean(textIn(parent), 280)
    };
  }
  var PROFILE_PATH = /^\/([A-Za-z0-9_]{1,15})\/?$/;
  var RESERVED_PATH = /* @__PURE__ */ new Set(["i", "home", "explore", "search", "settings", "messages", "intent"]);
  function handleOfHref(href) {
    if (!href) return null;
    let path = href;
    if (!href.startsWith("/")) {
      try {
        const url = new URL(href);
        if (!/(^|\.)(x|twitter)\.com$/.test(url.hostname)) return null;
        path = url.pathname;
      } catch {
        return null;
      }
    }
    const handle = PROFILE_PATH.exec(path.split(/[?#]/)[0] ?? "")?.[1];
    return handle && !RESERVED_PATH.has(handle.toLowerCase()) ? handle.toLowerCase() : null;
  }
  function nameBlockHandle(block) {
    for (const link of block.querySelectorAll("a[href]")) {
      const handle = handleOfHref(link.getAttribute("href"));
      if (handle) return handle;
    }
    for (const span of block.querySelectorAll("span")) {
      if (span.childElementCount || span.closest(X_SELECTORS.text)) continue;
      const typed = span.textContent?.match(HANDLE);
      if (typed?.[1] && span.textContent?.trim().startsWith("@")) return typed[1].toLowerCase();
    }
    return null;
  }
  function postNameBlock(article) {
    return own(article, X_SELECTORS.author)[0] ?? null;
  }
  function postAuthorHandle(article, fallback) {
    const block = postNameBlock(article);
    const fromBlock = block ? nameBlockHandle(block) : null;
    if (fromBlock) return fromBlock;
    const handle = fallback && /^[A-Za-z0-9_]{1,15}$/.test(fallback) ? fallback.toLowerCase() : null;
    return handle && !RESERVED_PATH.has(handle) && handle !== "web" ? handle : null;
  }
  function quotedAuthors(article) {
    const candidates = /* @__PURE__ */ new Set([
      ...own(article, '[data-testid="quoteTweet"]'),
      ...own(article, '[role="link"]').filter(isQuoteBlock),
      ...own(article, X_SELECTORS.post)
    ]);
    return [...candidates].filter((block) => ![...candidates].some((other) => other !== block && other.contains(block))).map((block) => ({
      block,
      handle: nameBlockHandle(block.querySelector(X_SELECTORS.author) ?? block)
    }));
  }
  function extractPost(article) {
    const identity = identityIn(article);
    if (!identity) return null;
    const author = authorIn(article, identity.handle);
    const container = attempt(() => cardContainer(article), null);
    return {
      tweetId: identity.tweetId,
      url: identity.url,
      authorHandle: identity.handle,
      authorDisplayName: author.displayName,
      authorAvatarUrl: author.avatarUrl,
      text: textIn(article),
      createdAt: createdAtIn(article, identity),
      media: attempt(() => mediaIn(article, container), []),
      quote: attempt(() => quoteIn(article), null),
      replyTo: attempt(() => replyIn(article), null),
      card: attempt(() => cardIn(article, container), null)
    };
  }

  // node_modules/simple-icons/index.mjs
  var c = '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>';
  var t = '</title><path d="';
  var a = '"/></svg>';
  var siAndroid = { title: "Android", slug: "android", get svg() {
    return c + "Android" + t + this.path + a;
  }, path: "M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z", source: "https://partnermarketinghub.withgoogle.com/brands/android/visual-identity/visual-identity/logo-lock-ups", hex: "3DDC84", guidelines: "https://developer.android.com/distribute/marketing-tools/brand-guidelines#brand-android", license: { type: "CC-BY-3.0", url: "https://spdx.org/licenses/CC-BY-3.0" } };
  var siApple = { title: "Apple", slug: "apple", get svg() {
    return c + "Apple" + t + this.path + a;
  }, path: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701", source: "https://www.apple.com", hex: "000000" };

  // src/insights/icons.ts
  var line = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  var mark = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" stroke="none"><path d="${path}"/></svg>`;
  var ACCOUNT_ICONS = {
    globe: line(
      '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'
    ),
    mapPin: line(
      '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
    ),
    alert: line(
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
    ),
    refresh: line(
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
    ),
    eye: line(
      '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'
    ),
    close: line('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    info: line('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
    shield: line(
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
    ),
    chevron: line('<path d="m9 18 6-6-6-6"/>'),
    apple: mark(siApple.path),
    android: mark(siAndroid.path)
  };

  // src/insights/verdict.ts
  function selectionOf(filter) {
    const keys = /* @__PURE__ */ new Set();
    for (const name of filter.countries) {
      const place = resolveSelectable(name);
      if (place) keys.add(placeKey(place));
    }
    return { keys, alwaysShow: filter.alwaysShow };
  }
  function isExempt(entries, handle, info) {
    for (const entry of entries) {
      if (entry.id && info?.id) {
        if (entry.id === info.id) return true;
        continue;
      }
      if (entry.handle === handle) return true;
    }
    return false;
  }
  var NO = { match: false };
  function verdictFor(selection, handle, entry, exemptions = {}) {
    if (!handle || selection.keys.size === 0) return NO;
    if (entry?.state !== "ok") return NO;
    const place = entry.info.basedIn;
    if (!place || !selection.keys.has(placeKey(place))) return NO;
    if (exemptions.focal) return NO;
    if (exemptions.self && exemptions.self === handle) return NO;
    if (isExempt(selection.alwaysShow, handle, entry.info)) return NO;
    return { match: true, place };
  }
  function reasonText(place) {
    return `${place.kind === "region" ? "Region" : "Country"}: ${place.name}`;
  }

  // src/insights/filter.ts
  var CELL2 = '[data-testid="cellInnerDiv"]';
  var MAX_REVEALED = 500;
  function placeholderText(kind, place) {
    return kind === "post" ? { title: "Post hidden by Better X", reason: reasonText(place), action: "Show post" } : {
      title: "Quoted post hidden by Better X",
      reason: reasonText(place),
      action: "Show quoted post"
    };
  }
  function placeholder(kind, place, theme, onShow) {
    const text = placeholderText(kind, place);
    const card = el("div", "bx-filter-card", "", { role: "group", "data-kind": kind });
    card.dataset.theme = theme;
    card.setAttribute("aria-label", text.title);
    card.insertAdjacentHTML("afterbegin", ACCOUNT_ICONS.shield);
    const copy = el("div", "bx-fc-text");
    copy.append(el("strong", "", text.title), el("span", "", text.reason));
    const show = el("button", "bx-fc-show", text.action, { type: "button" });
    show.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      onShow();
    });
    card.append(copy, show);
    return card;
  }
  function startCountryFilter({ scope, runtime }) {
    const accounts = runtime.accounts;
    const owner2 = {};
    let config = DEFAULT_SETTINGS.filter;
    let selection = selectionOf(config);
    const seen = /* @__PURE__ */ new Map();
    const postMarks = /* @__PURE__ */ new Map();
    const cellOwner = /* @__PURE__ */ new WeakMap();
    const quoteMarks = /* @__PURE__ */ new Map();
    const articleQuotes = /* @__PURE__ */ new Map();
    const revealed = /* @__PURE__ */ new Set();
    let theme = "light";
    let themeAt = 0;
    const currentTheme = () => {
      const now = Date.now();
      if (now - themeAt > 2e3) {
        theme = xTheme();
        themeAt = now;
      }
      return theme;
    };
    let selfAt = 0;
    let self = null;
    const selfHandle = () => {
      const now = Date.now();
      if (now - selfAt > 3e3) {
        selfAt = now;
        const href = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute("href");
        self = normalizeHandle(href?.replace(/^\//, ""));
      }
      return self;
    };
    const remember = (key) => {
      revealed.add(key);
      if (revealed.size > MAX_REVEALED) revealed.delete(revealed.values().next().value);
    };
    function clearPost(article) {
      const mark2 = postMarks.get(article);
      if (!mark2) return;
      postMarks.delete(article);
      mark2.card?.remove();
      if (cellOwner.get(mark2.cell) === article) {
        mark2.cell.removeAttribute("data-bx-filter");
        cellOwner.delete(mark2.cell);
      }
    }
    function applyPost(article, tweetId, place) {
      const cell = article.closest(CELL2);
      if (!cell) return clearPost(article);
      let mark2 = postMarks.get(article);
      if (mark2 && mark2.cell !== cell) {
        clearPost(article);
        mark2 = void 0;
      }
      mark2 ?? (mark2 = { cell });
      postMarks.set(article, mark2);
      cellOwner.set(cell, article);
      keepSweeping();
      const key = `p:${tweetId}`;
      if (revealed.has(key)) {
        cell.setAttribute("data-bx-filter", "revealed");
        mark2.card?.remove();
        mark2.card = void 0;
        return;
      }
      cell.setAttribute("data-bx-filter", config.mode);
      if (config.mode !== "collapse") {
        mark2.card?.remove();
        mark2.card = void 0;
        return;
      }
      if (!mark2.card?.isConnected) {
        mark2.card = placeholder("post", place, currentTheme(), () => {
          remember(key);
          const seenIdentity = seen.get(article);
          if (seenIdentity) visit(article, seenIdentity);
        });
        cell.append(mark2.card);
      }
    }
    function clearQuote(block) {
      const mark2 = quoteMarks.get(block);
      quoteMarks.delete(block);
      mark2?.card?.remove();
      block.removeAttribute("data-bx-quote");
    }
    function applyQuote(block, article, key, place) {
      let mark2 = quoteMarks.get(block);
      mark2 ?? (mark2 = { article, key });
      mark2.key = key;
      quoteMarks.set(block, mark2);
      if (revealed.has(key)) {
        block.setAttribute("data-bx-quote", "revealed");
        mark2.card?.remove();
        mark2.card = void 0;
        return;
      }
      block.setAttribute("data-bx-quote", config.mode);
      if (config.mode !== "collapse") {
        mark2.card?.remove();
        mark2.card = void 0;
        return;
      }
      if (!mark2.card?.isConnected) {
        mark2.card = placeholder("quote", place, currentTheme(), () => {
          remember(key);
          const identity = seen.get(article);
          if (identity) visit(article, identity);
        });
        block.after(mark2.card);
      }
    }
    function visit(article, identity) {
      seen.set(article, identity);
      const active = selection.keys.size > 0;
      const author = config.posts && active ? postAuthorHandle(article, identity.handle) : null;
      const quotes = config.quotes && active ? quotedAuthors(article) : [];
      const handles = [author, ...quotes.map((quote) => quote.handle)].filter(
        (handle) => Boolean(handle)
      );
      if (handles.length) accounts.track(owner2, article, handles, { auto: true });
      else accounts.untrack(owner2, article);
      const route = runtime.routes.route;
      const focal = route.id === "post" && route.tweetId === identity.tweetId;
      const verdict = verdictFor(
        selection,
        author,
        author ? accounts.service.peek(author) : void 0,
        {
          self: selfHandle(),
          focal
        }
      );
      if (verdict.match) applyPost(article, identity.tweetId, verdict.place);
      else clearPost(article);
      const present = /* @__PURE__ */ new Set();
      for (const quote of quotes) {
        present.add(quote.block);
        const quoteVerdict = verdictFor(
          selection,
          quote.handle,
          quote.handle ? accounts.service.peek(quote.handle) : void 0,
          { self: selfHandle() }
        );
        if (quoteVerdict.match && quote.handle)
          applyQuote(
            quote.block,
            article,
            `q:${identity.tweetId}>${quote.handle}`,
            quoteVerdict.place
          );
        else clearQuote(quote.block);
      }
      for (const block of articleQuotes.get(article) ?? [])
        if (!present.has(block)) clearQuote(block);
      if (present.size) articleQuotes.set(article, present);
      else articleQuotes.delete(article);
    }
    function redrawAll() {
      for (const [article, identity] of [...seen]) {
        if (article.isConnected) visit(article, identity);
      }
    }
    function forget(article) {
      clearPost(article);
      for (const block of articleQuotes.get(article) ?? []) clearQuote(block);
      articleQuotes.delete(article);
      seen.delete(article);
    }
    function sweep() {
      for (const [article, mark2] of postMarks) if (!mark2.cell.contains(article)) clearPost(article);
    }
    let sweeping = false;
    function keepSweeping() {
      if (sweeping || !postMarks.size) return;
      sweeping = true;
      const tick = () => {
        sweeping = false;
        sweep();
        keepSweeping();
      };
      scope.setTimeout(tick, 1e3);
    }
    scope.add(runtime.posts.onPost((post) => visit(post.article, post.identity), { replay: true }));
    scope.add(
      runtime.posts.onBatch((gone) => {
        for (const article of gone) forget(article);
        sweep();
      })
    );
    scope.add(
      accounts.onChange((articles) => {
        for (const article of articles) {
          const identity = seen.get(article);
          if (identity && article.isConnected) visit(article, identity);
        }
      })
    );
    scope.add(runtime.routes.onRoute(() => redrawAll()));
    const resolving = /* @__PURE__ */ new Set();
    function resolveIds() {
      for (const entry of config.alwaysShow) {
        if (entry.id || resolving.has(entry.handle)) continue;
        resolving.add(entry.handle);
        void accounts.service.request(entry.handle, { priority: "hover" }).then((result) => {
          const id = result?.state === "ok" ? result.info.id : void 0;
          if (!id || scope.disposed) return;
          return updateSettings((current) => {
            const list = current.filter.alwaysShow;
            if (!list.some((item) => item.handle === entry.handle && !item.id)) return null;
            return {
              filter: {
                alwaysShow: list.map(
                  (item) => item.handle === entry.handle && !item.id ? { ...item, id } : item
                )
              }
            };
          });
        }).catch(() => {
        }).finally(() => resolving.delete(entry.handle));
      }
    }
    function setConfig(next) {
      config = next;
      selection = selectionOf(next);
      redrawAll();
      resolveIds();
    }
    void loadSettings().then((settings) => {
      if (!scope.disposed) setConfig(settings.filter);
    });
    scope.add(watchSettings((settings) => setConfig(settings.filter)));
    scope.add(() => {
      for (const article of [...postMarks.keys()]) clearPost(article);
      for (const block of [...quoteMarks.keys()]) clearQuote(block);
      accounts.release(owner2);
      seen.clear();
      articleQuotes.clear();
    });
  }

  // src/features/filtering.ts
  var countryFilter = {
    id: "filtering.country",
    category: "filtering",
    kind: "toggle",
    title: "Filter posts by account country",
    description: "Collapse, hide or highlight posts from accounts X says are based in the countries you choose. Needs a lookup of each account on screen, paced and cached. Only changes your own view.",
    keywords: ["country", "region", "location", "collapse", "hide", "quote", "based in", "block"],
    defaultEnabled: false,
    activate: (context) => startCountryFilter(context)
  };
  var FILTERING_FEATURES = [countryFilter];

  // src/features/hide-ads.ts
  var PROMOTED_ICON = "M19.498 3h-15c-1.381 0-2.5 1.12-2.5 2.5v13c0 1.38 1.119 2.5 2.5 2.5h15c1.381 0 2.5-1.12 2.5-2.5v-13c0-1.38-1.119-2.5-2.5-2.5zm-3.502 12h-2v-3.59l-5.293 5.3-1.414-1.42L12.581 10H8.996V8h7v7z";
  var PROMOTED_NOTIFICATION_ICON = "M18.766 2H7.323l-4.8 12h5.324l";
  var ADS_LINK = ':is([href*="ads.twitter.com"], [href*="ads.x.com"])';
  var hideAds = {
    id: "cleanup.hideAds",
    category: "cleanup",
    title: "Hide Ads",
    description: "Remove promoted posts and trends from X.",
    kind: "toggle",
    keywords: ["promoted", "sponsored", "advertising"],
    defaultEnabled: false,
    css: `
${cellWhere(':has([data-testid="placementTracking"] [data-testid="tweet"])')},
${cellWhere(`:has([data-testid="notification"] svg path[d^="${PROMOTED_NOTIFICATION_ICON}"])`, onRoute("notifications"))},
[data-testid="trend"]:has(path[d="${PROMOTED_ICON}"]),
[role="menu"] a${ADS_LINK},
html[data-bx-layout="narrow"] [role="dialog"] a${ADS_LINK} {
  display: none !important;
}`
  };

  // src/runtime/wait.ts
  function waitFor(target, { signal, timeout, root = document, attributes = true } = {}) {
    const find = typeof target === "string" ? () => root.querySelector(target) : target;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason);
      const found = find();
      if (found) return resolve(found);
      let timer;
      const observer = new MutationObserver(() => {
        const match = find();
        if (match) settle(() => resolve(match));
      });
      const onAbort = () => settle(() => reject(signal.reason));
      function settle(finish) {
        observer.disconnect();
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        finish();
      }
      observer.observe(root instanceof Document ? root.documentElement : root, {
        childList: true,
        subtree: true,
        attributes
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      if (timeout !== void 0)
        timer = setTimeout(
          () => settle(
            () => reject(
              new DOMException(
                `Timed out after ${timeout}ms waiting for ${target}`,
                "TimeoutError"
              )
            )
          ),
          timeout
        );
    });
  }

  // src/features/hide-for-you.ts
  var HIDE_ATTR = "data-bx-hide-for-you";
  var MAX_FAILED_CLICKS = 2;
  var VERIFY_MS = 400;
  var HOME_NAV_AREA = '[data-testid="TopNavBar"], [data-testid="primaryColumn"]';
  var isSelected = (tab) => tab.getAttribute("aria-selected") === "true";
  var hideForYou = {
    id: "feed.hideForYou",
    category: "feed",
    title: "Hide For You",
    description: "Use Following instead of the For You timeline.",
    kind: "toggle",
    defaultEnabled: false,
    css: `
html[${HIDE_ATTR}] :is([data-testid="primaryColumn"], [data-testid="TopNavBar"]) nav [role="tablist"] > div:first-child {
  display: none !important;
}`,
    activate({ scope, runtime: { routes, layout, posts } }) {
      const root = document.documentElement;
      const setHidden = (hidden) => hidden ? root.setAttribute(HIDE_ATTR, "") : root.removeAttribute(HIDE_ATTR);
      scope.add(() => setHidden(false));
      let tablist = null;
      let watching = null;
      let failedClicks = 0;
      const findTablist = () => {
        let other = null;
        for (const nav of document.getElementsByTagName("nav")) {
          const list = nav.querySelector('[role="tablist"]');
          const area = list && nav.closest(HOME_NAV_AREA);
          if (!list || !area) continue;
          const inTopBar = area.getAttribute("data-testid") === "TopNavBar";
          if (inTopBar === (layout.layout === "narrow")) return list;
          other ?? (other = list);
        }
        return other;
      };
      function watch(list) {
        watching?.dispose();
        watching = scope.child();
        tablist = list;
        failedClicks = 0;
        observe(
          watching,
          list,
          { attributes: true, attributeFilter: ["aria-selected"], subtree: true },
          ensure
        );
      }
      function ensure() {
        if (routes.page.id !== "home") return setHidden(false);
        const list = tablist?.isConnected ? tablist : findTablist();
        if (!list) return setHidden(false);
        if (list !== tablist) watch(list);
        const forYou = list.children[0]?.querySelector('[role="tab"]');
        const following = list.children[1]?.querySelector('[role="tab"]');
        if (!forYou || !following) return setHidden(false);
        if (isSelected(following)) failedClicks = 0;
        else if (isSelected(forYou)) {
          if (failedClicks >= MAX_FAILED_CLICKS) return setHidden(false);
          failedClicks++;
          following.click();
          scope.setTimeout(ensure, VERIFY_MS);
        }
        setHidden(true);
      }
      let pending = null;
      function enter() {
        pending?.dispose();
        pending = null;
        watching?.dispose();
        watching = null;
        tablist = null;
        failedClicks = 0;
        if (routes.page.id !== "home") return setHidden(false);
        if (findTablist()) return ensure();
        const waiting = pending = scope.child();
        waiting.add(routes.pageScope.add(() => waiting.dispose()));
        waitFor(findTablist, { signal: waiting.signal, attributes: false }).then(
          () => {
            waiting.dispose();
            ensure();
          },
          () => {
          }
        );
      }
      scope.add(routes.onRoute((change) => change.pageChanged && enter()));
      scope.add(layout.onLayout(enter));
      scope.add(
        posts.onBatch(() => {
          if (tablist && !tablist.isConnected && routes.page.id === "home") enter();
        })
      );
      enter();
    }
  };

  // src/features/hide-grok.ts
  var GROK = "/i/grok";
  var hideGrok = {
    id: "cleanup.hideGrok",
    category: "cleanup",
    title: "Hide Grok",
    description: "Remove Grok buttons, shortcuts and promotions.",
    kind: "toggle",
    defaultEnabled: false,
    css: `
nav a[href$="${GROK}"],
[role="menu"] a[href="${GROK}"],
html[data-bx-layout="narrow"] [role="dialog"] a[href="${GROK}"],
[aria-labelledby="modal-header"] a[href$="${GROK}"],
div[data-testid="GrokDrawer"],
button[data-testid="grokImgGen"],
button[aria-label="Grok actions"],
[data-testid="tweet"] a[href="${GROK}"],
[data-testid="tweet"] [data-testid^="followups_"],
[data-testid="tweet"] [data-testid^="followups_"] + nav,
html[data-bx-route="search"] [data-testid="primaryColumn"] > div > div:has(> [data-testid="followups_search"]),
[data-testid="sidebarColumn"] aside[role="complementary"]:has(> a[href^="https://grok.com/imagine"]) {
  display: none !important;
}`
  };

  // src/insights/model.ts
  function connectionLabel(connection) {
    switch (connection.platform) {
      case "ios":
        return "Apple App Store";
      case "android":
        return "Android app";
      case "web":
        return "Web";
      default:
        return connection.raw;
    }
  }
  var placeLabel = (place) => place.name;
  var WARNING_TITLE = "X reports that this account’s location may not be accurate. That is a note from X, not proof of anything.";
  var basedInTitle = (place) => `Account based in ${placeLabel(place)}. X’s estimate for the account, not nationality and not where a post was written.`;
  var connectionTitle = (connection) => `Account connected via ${connectionLabel(connection)}. This is the account’s platform, not necessarily the app used for this post.`;
  function badgeView(entry, parts, automatic) {
    if (!entry) return { state: automatic ? "waiting" : "idle", items: [] };
    if (entry.state === "missing") return { state: "none", items: [] };
    if (entry.state === "failed") return { state: automatic ? "none" : "failed", items: [] };
    return { state: "loaded", items: itemsFor(entry.info, parts) };
  }
  function itemsFor(info, parts) {
    const items = [];
    if (parts.has("flags") && info.basedIn) {
      const glyph = flagOf(info.basedIn);
      items.push(
        glyph ? { kind: "flag", glyph, title: basedInTitle(info.basedIn) } : { kind: "region", title: basedInTitle(info.basedIn) }
      );
    }
    if (parts.has("connection") && info.connection && info.connection.platform !== "unknown") {
      items.push({
        kind: "connection",
        platform: info.connection.platform,
        title: connectionTitle(info.connection)
      });
    }
    if (parts.has("warnings") && info.locationAccurate === false)
      items.push({ kind: "warning", title: WARNING_TITLE });
    return items;
  }
  function badgeSummary(handle, view) {
    const facts = view.items.map((item) => item.title.split(". ")[0]);
    return facts.length ? `@${handle}: ${facts.join("; ")}` : `Account information for @${handle}`;
  }
  var viewKey = (view, interactive, handle) => `${handle}|${view.state}|${interactive ? 1 : 0}|${view.items.map((item) => `${item.kind}:${item.glyph ?? item.platform ?? ""}`).join(",")}`;
  function joinedLabel(info) {
    if (!info.createdAt) return null;
    const date = new Date(info.createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(void 0, { month: "long", year: "numeric" }).format(date);
  }

  // src/insights/card.ts
  var MARGIN = 8;
  var GAP = 6;
  var OPEN_DELAY = 350;
  var CLOSE_DELAY = 220;
  function row(icon, label, value) {
    const item = el("div", "bx-acct-row");
    const term = el("dt", "bx-acct-term");
    term.insertAdjacentHTML("afterbegin", ACCOUNT_ICONS[icon]);
    term.append(el("span", "", label));
    const detail = el("dd", "bx-acct-detail");
    detail.append(value);
    item.append(term, detail);
    return item;
  }
  function ago(at) {
    const seconds = Math.max(0, (Date.now() - at) / 1e3);
    const rtf = new Intl.RelativeTimeFormat(void 0, { numeric: "auto" });
    if (seconds < 90) return "just now";
    if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
    if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), "hour");
    return rtf.format(-Math.round(seconds / 86400), "day");
  }
  function verificationText(info) {
    const v = info.verification;
    if (!v) return null;
    const parts = [];
    if (v.type === "government") parts.push("Government account");
    else if (v.type === "business") parts.push("Verified organization");
    if (v.blue) parts.push("Premium verification");
    if (!parts.length) return null;
    if (v.since) {
      const date = new Date(v.since);
      if (!Number.isNaN(date.getTime()))
        parts[parts.length - 1] += ` since ${new Intl.DateTimeFormat(void 0, { month: "short", year: "numeric" }).format(date)}`;
    }
    return parts.join(" · ");
  }
  function cardRows(info) {
    const rows = [];
    if (info.basedIn) {
      const value = el("span", "bx-acct-value");
      const glyph = flagOf(info.basedIn);
      if (glyph) value.append(el("span", "bx-acct-flag", glyph, { "aria-hidden": "true" }));
      value.append(placeLabel(info.basedIn));
      rows.push(row("mapPin", "Based in", value));
    }
    if (info.connection) {
      const text = el("span", "bx-acct-value");
      const icon = info.connection.platform === "ios" ? "apple" : info.connection.platform === "android" ? "android" : null;
      if (icon) text.insertAdjacentHTML("afterbegin", ACCOUNT_ICONS[icon]);
      text.append(
        connectionLabel(info.connection) + (info.connection.storeCountry ? ` · ${info.connection.storeCountry} store` : "")
      );
      rows.push(row("globe", "Connected via", text));
    }
    if (info.locationAccurate === false)
      rows.push(row("alert", "Location accuracy", "X reports possible uncertainty"));
    const joined = joinedLabel(info);
    if (joined) rows.push(row("info", "Joined", joined));
    if (info.usernameChanges !== void 0)
      rows.push(row("info", "Username changes", String(info.usernameChanges)));
    if (info.affiliate) rows.push(row("shield", "Affiliation", info.affiliate.name));
    const verified = verificationText(info);
    if (verified) rows.push(row("shield", "Verification", verified));
    return rows;
  }
  function createAccountCard(scope, service) {
    let node;
    let anchor;
    let handle = "";
    let pinned = false;
    let openTimer;
    let closeTimer;
    let removeListeners = [];
    let refreshing = false;
    let frame = 0;
    const isOpen = () => Boolean(node);
    function build() {
      if (!node || !anchor) return;
      const entry = service.peek(handle);
      const card = node;
      const info = entry?.state === "ok" ? entry.info : void 0;
      const head = el("header", "bx-acct-head");
      const title = el("div", "bx-acct-title");
      title.append(el("strong", "", info?.displayName ?? `@${handle}`));
      if (info?.displayName) title.append(el("span", "bx-acct-handle", `@${handle}`));
      const close = el("button", "bx-acct-close", "", {
        type: "button",
        "aria-label": "Close account details"
      });
      close.insertAdjacentHTML("afterbegin", ACCOUNT_ICONS.close);
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        api.close(true);
      });
      head.append(title, close);
      const body = el("div", "bx-acct-body");
      if (info) {
        const rows = cardRows(info);
        if (rows.length) {
          const list = el("dl", "bx-acct-rows");
          list.append(...rows);
          body.append(list);
        } else
          body.append(el("p", "bx-acct-empty", "X did not report anything more for this account."));
        const notes = [];
        if (info.basedIn)
          notes.push(
            "Based in is X’s estimate from account activity. It is not nationality, birthplace or where a post was written."
          );
        if (info.connection)
          notes.push("Connected via is the account’s platform, not the app used for any one post.");
        if (info.locationAccurate === false) notes.push(WARNING_TITLE);
        for (const note of notes) body.append(el("p", "bx-acct-note", note));
      } else if (entry?.state === "failed") {
        body.append(el("p", "bx-acct-empty", "Could not load this account. Try refreshing."));
      } else if (entry?.state === "missing") {
        body.append(el("p", "bx-acct-empty", "X reports this account as unavailable."));
      } else {
        body.append(el("p", "bx-acct-empty", "Looking up this account…"));
      }
      const foot = el("footer", "bx-acct-foot");
      foot.append(
        el(
          "span",
          "bx-acct-updated",
          entry && entry.state !== "failed" ? `Updated ${ago(entry.at)}` : "Not updated yet"
        )
      );
      const refresh = el("button", "bx-acct-refresh", "", { type: "button" });
      refresh.insertAdjacentHTML("afterbegin", ACCOUNT_ICONS.refresh);
      refresh.append(el("span", "", refreshing ? "Refreshing…" : "Refresh"));
      refresh.disabled = refreshing;
      refresh.addEventListener("click", (event) => {
        event.stopPropagation();
        refreshing = true;
        build();
        void service.request(handle, { priority: "manual", force: true }).finally(() => {
          refreshing = false;
          if (isOpen()) build();
        });
      });
      foot.append(refresh);
      const hadFocus = card.contains(document.activeElement);
      const focusedRefresh = hadFocus && document.activeElement?.className === "bx-acct-refresh";
      card.replaceChildren(head, body, foot);
      card.setAttribute("aria-label", `Account details for @${handle}`);
      if (focusedRefresh) refresh.focus({ preventScroll: true });
      reposition();
    }
    function position() {
      if (!node || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const below = rect.bottom + GAP;
      const above = rect.top - GAP - height;
      const fitsBelow = below + height <= innerHeight - MARGIN;
      const top = Math.max(
        MARGIN,
        Math.min(fitsBelow || above < MARGIN ? below : above, innerHeight - MARGIN - height)
      );
      const left = Math.max(MARGIN, Math.min(rect.left, innerWidth - MARGIN - width));
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.dataset.side = top >= rect.bottom ? "below" : "above";
    }
    function reposition() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!node || !anchor) return;
        if (!anchorVisible(anchor) || anchor.dataset.bxAcct !== handle) return api.close();
        position();
      });
    }
    function show(target, forHandle, pin) {
      closeTimer?.();
      openTimer?.();
      if (node && anchor === target && handle === forHandle) {
        pinned || (pinned = pin);
        return;
      }
      api.close();
      anchor = target;
      handle = forHandle;
      pinned = pin;
      node = el("div", "bx-acctcard", "", { role: "dialog" });
      node.dataset.theme = xTheme();
      node.id = "bx-acctcard";
      document.body.append(node);
      target.setAttribute("aria-expanded", "true");
      target.setAttribute("aria-controls", node.id);
      build();
      position();
      const card = node;
      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        event.preventDefault();
        api.close(card.contains(document.activeElement) || document.activeElement === target);
      };
      const onPointer = (event) => {
        const at = event.target;
        if (!card.contains(at) && !target.contains(at)) api.close();
      };
      const onEnter = () => {
        closeTimer?.();
      };
      const onLeave = () => {
        if (!pinned) api.hoverOut();
      };
      const onFocusOut = (event) => {
        const next = event.relatedTarget;
        if (pinned && next && !card.contains(next) && next !== target) api.close();
      };
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("pointerdown", onPointer, true);
      addEventListener("scroll", reposition, { capture: true, passive: true });
      addEventListener("resize", reposition, { passive: true });
      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointerleave", onLeave);
      card.addEventListener("focusout", onFocusOut);
      removeListeners = [
        () => document.removeEventListener("keydown", onKey, true),
        () => document.removeEventListener("pointerdown", onPointer, true),
        () => removeEventListener("scroll", reposition, { capture: true }),
        () => removeEventListener("resize", reposition)
      ];
    }
    scope.add(
      service.subscribe((changed) => {
        if (isOpen() && (changed.has(handle) || changed.has("*"))) build();
      })
    );
    scope.add(() => api.close());
    const api = {
      get open() {
        return isOpen();
      },
      toggle(target, forHandle) {
        if (node && anchor === target && handle === forHandle && pinned) return api.close(true);
        show(target, forHandle, true);
        node?.querySelector("button")?.focus({ preventScroll: true });
      },
      hoverIn(target, forHandle) {
        closeTimer?.();
        if (node && anchor === target) return;
        if (node && pinned) return;
        openTimer?.();
        openTimer = scope.setTimeout(() => show(target, forHandle, false), OPEN_DELAY);
      },
      hoverOut() {
        openTimer?.();
        openTimer = void 0;
        if (!node || pinned) return;
        closeTimer?.();
        closeTimer = scope.setTimeout(() => api.close(), CLOSE_DELAY);
      },
      close(restoreFocus = false) {
        openTimer?.();
        closeTimer?.();
        cancelAnimationFrame(frame);
        if (!node) return;
        const card = node;
        const target = anchor;
        node = void 0;
        anchor = void 0;
        pinned = false;
        refreshing = false;
        removeListeners.forEach((stop) => stop());
        removeListeners = [];
        card.remove();
        target?.removeAttribute("aria-expanded");
        target?.removeAttribute("aria-controls");
        if (restoreFocus && target?.isConnected) target.focus({ preventScroll: true });
      }
    };
    return api;
  }

  // src/insights/badges.ts
  var HOVER_LOOKUP_DELAY = 350;
  var BADGE = ".bx-acct";
  var controllers = /* @__PURE__ */ new WeakMap();
  function badgesFor(runtime) {
    let controller = controllers.get(runtime);
    if (!controller) controllers.set(runtime, controller = createBadgeController(runtime));
    return controller;
  }
  function itemElement(item) {
    const node = el("span", "bx-acct-item", "", { "data-kind": item.kind, title: item.title });
    if (item.kind === "flag") node.textContent = item.glyph ?? "";
    else if (item.kind === "region") node.innerHTML = ACCOUNT_ICONS.mapPin;
    else if (item.kind === "warning") node.innerHTML = ACCOUNT_ICONS.alert;
    else
      node.innerHTML = item.platform === "ios" ? ACCOUNT_ICONS.apple : item.platform === "android" ? ACCOUNT_ICONS.android : ACCOUNT_ICONS.globe;
    return node;
  }
  function badgeSlot(article, handle) {
    const nameBlock = postNameBlock(article);
    if (!nameBlock) return null;
    for (const link of nameBlock.querySelectorAll("a[href]")) {
      if (handleOfHref(link.getAttribute("href")) !== handle) continue;
      if (!link.textContent?.trim().startsWith("@")) continue;
      let cell = link;
      while (cell.parentElement && cell.parentElement.parentElement !== nameBlock)
        cell = cell.parentElement;
      const row2 = cell.parentElement;
      if (!row2 || row2 === nameBlock) return null;
      return { parent: row2, after: cell };
    }
    return null;
  }
  function createBadgeController(runtime) {
    const parts = /* @__PURE__ */ new Map();
    let live;
    let render;
    function start() {
      const scope = runtime.scope.child();
      live = scope;
      const accounts = runtime.accounts;
      const owner2 = {};
      const states = /* @__PURE__ */ new WeakMap();
      const shown = /* @__PURE__ */ new Set();
      let mode = "hover";
      let card;
      const getCard = () => card ?? (card = createAccountCard(scope, accounts.service));
      const wanted = () => new Set(parts.keys());
      const automatic = () => mode === "visible";
      const interactive = (view) => view.state === "idle" || view.state === "failed" || view.state === "loaded" && parts.has("details");
      function remove(article) {
        const state = states.get(article);
        state?.element?.remove();
        if (state?.element) shown.delete(state.element);
        states.delete(article);
        accounts.untrack(owner2, article);
      }
      function draw(article, state) {
        const view = badgeView(accounts.service.peek(state.handle), wanted(), automatic());
        const loadedItems = view.state === "loaded" ? view.items : [];
        const empty = view.state === "loaded" && loadedItems.length === 0 && !parts.has("details");
        const nothing = view.state === "none" || view.state === "waiting" || empty;
        if (nothing) {
          if (state.element) {
            state.element.remove();
            shown.delete(state.element);
            state.element = void 0;
            state.key = void 0;
          }
          return;
        }
        const clickable = interactive(view);
        const key = viewKey(view, clickable, state.handle);
        if (state.element?.isConnected && state.key === key) return;
        const slot = badgeSlot(article, state.handle);
        if (!slot) {
          state.element?.remove();
          state.element = void 0;
          state.key = void 0;
          return;
        }
        const tag = clickable ? "BUTTON" : "SPAN";
        let target = state.element;
        if (!target || target.tagName !== tag) {
          if (target) {
            target.remove();
            shown.delete(target);
          }
          target = el(clickable ? "button" : "span", "bx-acct");
        }
        target.dataset.bxAcct = state.handle;
        target.dataset.state = view.state;
        target.replaceChildren();
        target.removeAttribute("aria-haspopup");
        target.removeAttribute("aria-expanded");
        if (target instanceof HTMLButtonElement) target.type = "button";
        if (view.state === "idle") {
          target.setAttribute("aria-label", `Look up where @${state.handle} is based`);
          target.title = mode === "manual" ? "Click to look up where this account is based and how it connects." : "Hover or click to look up where this account is based and how it connects.";
          target.insertAdjacentHTML("beforeend", ACCOUNT_ICONS.globe);
        } else if (view.state === "failed") {
          target.setAttribute(
            "aria-label",
            `Could not load account information for @${state.handle}. Click to try again`
          );
          target.title = "Could not load account information. Click to try again.";
          target.insertAdjacentHTML("beforeend", ACCOUNT_ICONS.alert);
        } else {
          target.setAttribute("aria-label", badgeSummary(state.handle, view));
          target.removeAttribute("title");
          if (loadedItems.length) target.append(...loadedItems.map(itemElement));
          else target.insertAdjacentHTML("beforeend", ACCOUNT_ICONS.info);
          if (clickable) {
            target.setAttribute("aria-haspopup", "dialog");
            target.setAttribute("aria-expanded", "false");
            target.title = "Show account details";
          }
        }
        if (!target.isConnected || target.parentElement !== slot.parent)
          slot.after.parentNode?.insertBefore(target, slot.after.nextSibling);
        state.element = target;
        state.key = key;
        shown.add(target);
      }
      function visit(article, tweetHandle, reason) {
        let state = states.get(article);
        const handle = postAuthorHandle(article, tweetHandle);
        if (!handle) {
          if (state) remove(article);
          return;
        }
        if (state && state.handle !== handle) {
          remove(article);
          state = void 0;
        }
        if (!state) states.set(article, state = { handle });
        if (reason === "changed" && state.element?.isConnected) return;
        accounts.track(owner2, article, [handle], { auto: automatic() });
        draw(article, state);
      }
      function redrawAll() {
        for (const { article, identity } of runtime.posts.posts()) {
          const state = states.get(article);
          if (state) {
            accounts.track(owner2, article, [state.handle], { auto: automatic() });
            draw(article, state);
          } else visit(article, identity.handle, "new");
        }
      }
      render = redrawAll;
      scope.add(
        runtime.posts.onPost((post) => visit(post.article, post.identity.handle, post.reason), {
          replay: true
        })
      );
      scope.add(
        runtime.posts.onBatch((gone) => {
          for (const article of gone) {
            const state = states.get(article);
            if (state?.element) shown.delete(state.element);
            states.delete(article);
          }
        })
      );
      scope.add(
        accounts.onChange((articles) => {
          for (const article of articles) {
            const state = states.get(article);
            if (state) draw(article, state);
          }
        })
      );
      void loadSettings().then((settings) => {
        if (scope.disposed) return;
        mode = settings.insights.lookup;
        redrawAll();
      });
      scope.add(
        watchSettings((settings) => {
          if (settings.insights.lookup === mode) return;
          mode = settings.insights.lookup;
          redrawAll();
        })
      );
      let hoverTimer;
      const badgeOf = (event) => event.target instanceof Element ? event.target.closest(BADGE) : null;
      const owns = (node) => shown.has(node);
      scope.listen(
        document,
        "click",
        (event) => {
          const node = badgeOf(event);
          if (!node || !owns(node)) return;
          event.stopPropagation();
          event.preventDefault();
          const handle = node.dataset.bxAcct;
          const state = node.dataset.state;
          if (state === "idle" || state === "failed") {
            node.setAttribute("aria-busy", "true");
            void accounts.service.request(handle, { priority: "manual", force: state === "failed" }).finally(() => node.removeAttribute("aria-busy"));
          } else if (state === "loaded" && parts.has("details")) getCard().toggle(node, handle);
        },
        { capture: true }
      );
      scope.listen(
        document,
        "pointerover",
        (event) => {
          const node = badgeOf(event);
          if (!node || !owns(node)) return;
          const from = event.relatedTarget;
          if (from instanceof Node && node.contains(from)) return;
          const handle = node.dataset.bxAcct;
          if (node.dataset.state === "idle" && mode === "hover") {
            hoverTimer?.();
            hoverTimer = scope.setTimeout(() => {
              if (node.isConnected && node.dataset.state === "idle")
                void accounts.service.request(handle, { priority: "hover" });
            }, HOVER_LOOKUP_DELAY);
          } else if (node.dataset.state === "loaded" && parts.has("details")) {
            getCard().hoverIn(node, handle);
          }
        },
        { capture: true, passive: true }
      );
      scope.listen(
        document,
        "pointerout",
        (event) => {
          const node = badgeOf(event);
          if (!node || !owns(node)) return;
          const to = event.relatedTarget;
          if (to instanceof Node && node.contains(to)) return;
          hoverTimer?.();
          card?.hoverOut();
        },
        { capture: true, passive: true }
      );
      scope.add(() => {
        for (const node of shown) node.remove();
        shown.clear();
        accounts.release(owner2);
        card?.close();
      });
    }
    function stop() {
      live?.dispose();
      live = void 0;
      render = void 0;
    }
    return {
      retain(part) {
        parts.set(part, (parts.get(part) ?? 0) + 1);
        if (!live) start();
        else render?.();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          const left = (parts.get(part) ?? 1) - 1;
          if (left > 0) parts.set(part, left);
          else parts.delete(part);
          if (!parts.size) stop();
          else render?.();
        };
      }
    };
  }

  // src/features/insights.ts
  function badgePart(name, part, title, description, keywords) {
    return {
      id: `insights.${name}`,
      category: "insights",
      kind: "toggle",
      title,
      description,
      keywords,
      defaultEnabled: false,
      activate({ scope, runtime }) {
        scope.add(badgesFor(runtime).retain(part));
      }
    };
  }
  var INSIGHT_FEATURES = [
    badgePart(
      "flags",
      "flags",
      "Show country flags",
      "Add a flag beside a username for the country or region X says the account is based in. X estimates this from account activity; it is not nationality.",
      ["country", "location", "based in", "region"]
    ),
    badgePart(
      "connection",
      "connection",
      "Show connection-source badges",
      "Add an Apple, Android or Web mark for the platform X says the account connects through. It is the account’s platform, not the app used for a post.",
      ["apple", "android", "web", "connected via", "platform", "app store"]
    ),
    badgePart(
      "details",
      "details",
      "Show account details",
      "Open a small card from the badge with what X reports: based in, connected via, joined date, username changes and affiliation. Only facts X sent are shown.",
      ["popover", "card", "joined", "username changes"]
    ),
    badgePart(
      "warnings",
      "warnings",
      "Show location warnings",
      "Mark accounts where X says the based-in location may not be accurate. It is a note from X, not proof of a VPN or of anything else.",
      ["accuracy", "vpn", "uncertain"]
    )
  ];

  // src/features/nav-items.ts
  var MONEY_HREF = ':is([href="/i/money"], [href^="/i/money/"], [href="/i/xmoney"], [href^="/i/x_money"])';
  var MONEY_LABEL = ':is([aria-label="X Money"], [aria-label="Money"])';
  var ARTICLES_HREF = ':is([href="/i/articles"], [href^="/i/articles/"], [href="/articles"], [href="/i/article"])';
  var ARTICLES_LABEL = '[aria-label="Articles"]';
  var MONEY_TEXT = /^(x\s+)?money$/i;
  var ARTICLES_TEXT = /^articles$/i;
  var NAV_ROOTS = 'header[role="banner"] nav, #layers nav, [role="menu"], [aria-labelledby="modal-header"]';
  var NARROW_MENU = '#layers [role="dialog"]';
  function scanNav(mark2) {
    const scan = (selector, suffix) => {
      for (const container of document.querySelectorAll(selector)) {
        for (const link of container.querySelectorAll("a[href]")) {
          const text = link.textContent?.trim() ?? "";
          if (!text || text.length > 24) continue;
          for (const [pattern, name] of mark2)
            if (pattern.test(text)) link.setAttribute("data-bx-nav", name + suffix);
        }
      }
    };
    scan(NAV_ROOTS, "");
    scan(NARROW_MENU, "-dialog");
  }
  function markByLabel(name, pattern) {
    return ({ scope, runtime }) => {
      const run = () => scanNav([[pattern, name]]);
      run();
      let queued = false;
      const later = () => {
        if (queued) return;
        queued = true;
        scope.requestFrame(() => {
          queued = false;
          run();
        });
      };
      scope.add(runtime.routes.onRoute(later));
      scope.add(runtime.layout.onLayout(later));
      const layers = document.getElementById("layers");
      if (layers) observe(scope, layers, { childList: true, subtree: true }, later);
      const banner = document.querySelector('header[role="banner"]');
      if (banner) observe(scope, banner, { childList: true, subtree: true }, later);
      scope.add(() => {
        for (const link of document.querySelectorAll(`[data-bx-nav^="${name}"]`))
          link.removeAttribute("data-bx-nav");
      });
    };
  }
  var rule2 = (href, label, name) => hide(links(href), links(label), [
    `[data-bx-nav="${name}"]`,
    `html[data-bx-layout="narrow"] [data-bx-nav="${name}-dialog"]`
  ]);
  var hideXMoney = {
    id: "navigation.hideXMoney",
    category: "navigation",
    kind: "toggle",
    title: "Hide X Money",
    description: "Remove X Money from the menu. Premium, Creator Studio and the other entries stay.",
    keywords: ["money", "payments", "wallet", "xmoney"],
    defaultEnabled: false,
    css: rule2(MONEY_HREF, MONEY_LABEL, "money"),
    activate: markByLabel("money", MONEY_TEXT)
  };
  var hideArticles = {
    id: "navigation.hideArticles",
    category: "navigation",
    kind: "toggle",
    title: "Hide Articles",
    description: "Remove the Articles entry from the menu. Article posts, and the Articles tab on profiles, are not touched.",
    keywords: ["article", "long-form", "writing"],
    defaultEnabled: false,
    css: rule2(ARTICLES_HREF, ARTICLES_LABEL, "articles"),
    activate: markByLabel("articles", ARTICLES_TEXT)
  };
  var NAV_ITEM_FEATURES = [hideXMoney, hideArticles];

  // src/features/navigation.ts
  var { toggle: toggle4 } = definitions("navigation");
  var NAVIGATION_FEATURES = [
    toggle4(
      "hideExplore",
      "Hide Explore",
      "Remove Explore from the menu while X shows its sidebar, which has search. With no sidebar it stays, so search is never lost.",
      hide(links('[href="/explore"]', "[data-bx-sidebar]")),
      ["search", "trending"]
    ),
    toggle4(
      "hideCommunities",
      "Hide Communities",
      "Remove Communities from the menu.",
      hide(links('[href$="/communities"]'))
    ),
    toggle4("hideLists", "Hide Lists", "Remove Lists from the menu.", hide(links('[href$="/lists"]'))),
    toggle4(
      "hideMessages",
      "Hide Messages",
      "Remove Messages and Chat from the menu.",
      hide(links(':is([href="/messages"], [href="/i/chat"])')),
      ["chat", "dm", "inbox"]
    ),
    toggle4(
      "hideNotifications",
      "Hide Notifications",
      "Remove Notifications from the menu. The Notifications page still works if you open it.",
      hide(
        navLinks('[href^="/notifications"]'),
        '[aria-labelledby="modal-header"] a[href^="/notifications"]'
      )
    ),
    toggle4(
      "hideBadges",
      "Hide notification counts",
      "Remove the unread-count dots from Notifications, Messages and your account.",
      [
        hide(
          within('html[data-bx-layout="wide"]', [
            `${PRIMARY_NAV} > :is(a[href^="/notifications"], a[href="/messages"], a[href="/i/chat"]) div[aria-live]`,
            'button[data-testid="SideNav_AccountSwitcher_Button"] > div > div[aria-label]',
            '[data-testid="HoverCard"] button[data-testid="UserCell"] div[aria-live]',
            '[data-testid="DMDrawerHeader"] h2 svg[role="img"]'
          ]),
          within('html[data-bx-layout="narrow"]', [
            `${PRIMARY_NAV} > :is(a[href^="/notifications"], a[href="/messages"], a[href="/i/chat"]) div[aria-label]`,
            'button[data-testid="DashButton_ProfileIcon_Link"] div[aria-label]',
            '[role="dialog"] [data-testid^="UserAvatar-Container"] div[dir]'
          ])
        )
      ].join("\n"),
      ["unread", "dot", "badge"]
    ),
    toggle4(
      "hideBookmarks",
      "Hide Bookmarks",
      "Remove X’s own Bookmarks from the menu. Your Better X Library is separate and stays.",
      hide(links('[href="/i/bookmarks"]')),
      ["saved"]
    ),
    toggle4(
      "hidePremium",
      "Hide Premium",
      "Remove Premium and Verified from the menu and from profile hover cards.",
      hide(
        links(
          ':is([href^="/i/premium"], [href^="/i/verified"]):not([href^="/i/premium-business"], [href^="/i/verified-orgs"])'
        ),
        '[data-testid="HoverCard"] a[href^="/i/premium"]'
      ),
      ["subscription", "blue", "verified"]
    ),
    toggle4(
      "hideBusiness",
      "Hide Business",
      "Remove Premium Business and Verified Organizations from the menu.",
      hide(links(':is([href^="/i/premium-business"], [href^="/i/verified-orgs-signup"])'))
    ),
    toggle4(
      "hideJobs",
      "Hide Jobs",
      "Remove Jobs from the menu and your profile.",
      [
        hide(links('[href="/jobs"]')),
        hide(within('html[data-bx-route="profile"]', '[data-testid="jobs"]'))
      ].join("\n")
    ),
    toggle4(
      "hideCreatorStudio",
      "Hide Creator Studio and subscriptions",
      "Remove Creator Studio, and Monetization and Subscriptions in Settings.",
      hide(
        links('[href$="/creators/studio"]'),
        within('html[data-bx-route="settings"]', [
          'a[href="/settings/monetization"]',
          'a[href="/settings/manage_subscriptions"]'
        ])
      ),
      ["monetization", "subscription"]
    ),
    toggle4(
      "hideConnect",
      "Hide Connect",
      "Remove “Connect” and “Follow people” from menus.",
      hide(links(':is([href$="/i/connect_people"], [href$="/i/follow_people"])')),
      ["people", "suggestions"]
    ),
    toggle4(
      "hideSpaces",
      "Hide Spaces",
      "Remove Spaces from menus.",
      hide(links('[href="/i/spaces/start"]'))
    ),
    toggle4(
      "hideCalls",
      "Hide Calls",
      "Remove Calls from the menu.",
      hide(
        links(
          // X has moved this link around (/i/calls, /i/chat/call...), so match any /i/ route with
          // "call" in it. Limited to /i/ so a profile link like /callum is never touched.
          ':is([href^="/i/"][href*="call" i], [data-testid="AppTabBar_Calls_Link"], [aria-label="Calls" i])'
        )
      ),
      ["call", "voice", "video"]
    ),
    toggle4(
      "hideHistory",
      "Hide History",
      "Remove History from menus.",
      hide(links('[href="/i/history"]'))
    ),
    toggle4(
      "hideComposeButton",
      "Hide the Post button",
      "Remove the Post button from the menu and the floating Post button. The composer on Home is separate.",
      hide(
        '[data-testid="SideNav_NewTweet_Button"]',
        '[data-testid="FloatingActionButtons_Tweet_Button"]'
      ),
      ["compose", "tweet", "write"]
    ),
    toggle4(
      "hideAccountSwitcher",
      "Hide account switcher details",
      "Keep the account button at the bottom of the menu but drop your avatar and name from it.",
      [
        rule(
          'header[role="banner"] > div > div > div > div:last-child',
          "flex-shrink: 1 !important;\n  align-items: flex-end !important;"
        ),
        hide(
          '[data-testid="SideNav_AccountSwitcher_Button"] > div:first-child:not(:only-child)',
          '[data-testid="SideNav_AccountSwitcher_Button"] > div:first-child + div'
        )
      ].join("\n"),
      ["profile", "avatar"]
    ),
    toggle4(
      "hideMessagesDrawer",
      "Hide the Messages drawer",
      "Hide the chat panel that sits at the bottom right of X.",
      rule(
        'div:is([data-testid="DMDrawer"], [data-testid="chat-drawer-root"])',
        "visibility: hidden;"
      ),
      ["chat", "dm"]
    )
  ];

  // src/features/posts.ts
  var { toggle: toggle5, color } = definitions("posts");
  var TIMELINE_POST = `${POST}[tabindex="0"]`;
  var FOCUSED_POST2 = `${POST}[tabindex="-1"]`;
  var ACTIONS = '[role="group"]';
  var NOT_OURS = ":not([data-bx-slot])";
  var count = (testIds) => rule(`${ACTIONS} button:is(${testIds}) span`, "visibility: hidden;");
  var POST_FEATURES = [
    toggle5(
      "hideViews",
      "Hide view counts",
      "Remove the views number under posts and on a post’s own page.",
      [
        hide(
          `${TIMELINE_POST} ${ACTIONS} > div:has(> a[href$="/analytics"])`,
          `[aria-modal="true"] ${ACTIONS} > div:has(> a[href$="/analytics"])`,
          // The line under a post's text ("10:32 AM · Mar 21, 2025 · 1.2M Views"): the separator and
          // the views, which are its 2nd and 3rd children.
          `${FOCUSED_POST2} div:has(> div > a > time) > :is(:nth-child(2), :nth-child(3))`
        )
      ].join("\n"),
      ["impressions", "analytics", "metrics"]
    ),
    toggle5(
      "hideReplyCount",
      "Hide reply counts",
      "Remove the number beside the reply button. The button stays.",
      count('[data-testid="reply"]'),
      ["comments", "metrics"]
    ),
    toggle5(
      "hideRepostCount",
      "Hide repost counts",
      "Remove the number beside the repost button. The button stays.",
      count('[data-testid$="retweet"]'),
      ["retweet", "metrics"]
    ),
    toggle5(
      "hideLikeCount",
      "Hide like counts",
      "Remove the number beside the like button. The button stays.",
      count('[data-testid$="like"]'),
      ["hearts", "metrics"]
    ),
    toggle5(
      "hideBookmarkCount",
      "Hide bookmark counts",
      "Remove the number beside the bookmark button. The button stays.",
      count('[data-testid$="ookmark"]'),
      ["metrics"]
    ),
    toggle5(
      "hideFollowCounts",
      "Hide follower counts",
      "Remove follower and following numbers on profiles and hover cards.",
      [
        hide(
          within(`:is(#layers, ${onRoute("profile")})`, [
            'a:is([href$="/following"], [href$="/followers"], [href$="/verified_followers"]) > span:first-child'
          ])
        ),
        rule(
          within(`:is(#layers, ${onRoute("profile")})`, [
            'a:is([href$="/following"], [href$="/followers"], [href$="/verified_followers"])'
          ]),
          "white-space: pre-line;"
        )
      ].join("\n"),
      ["followers", "following", "metrics"]
    ),
    toggle5(
      "hidePostCount",
      "Hide post totals on profiles",
      "Remove the “1,234 posts” line under a profile’s name.",
      hide(`${onRoute("profile")} ${PRIMARY_COLUMN} > div > div:first-of-type h2 + div[dir]`),
      ["tweets", "metrics"]
    ),
    toggle5(
      "hideBookmarkButton",
      "Hide X’s bookmark button",
      "Remove X’s own bookmark button from posts in your timeline. Better X’s Save button stays, and so does the button on a post’s own page.",
      hide(
        `html:not([data-bx-route="bookmarks"]) ${TIMELINE_POST} ${ACTIONS} > div:has(> button[data-testid$="ookmark"])`
      ),
      ["save"]
    ),
    toggle5(
      "hideShareButton",
      "Hide the share button",
      "Remove the share button from posts and from the media viewer.",
      hide(
        `${TIMELINE_POST} ${ACTIONS} > div[style]${NOT_OURS}`,
        `${FOCUSED_POST2} ${ACTIONS} > div[style]${NOT_OURS}`,
        `[aria-modal="true"] ${ACTIONS} > div[style]${NOT_OURS}:not([role])`
      ),
      ["upload"]
    ),
    toggle5(
      "hideViewActivity",
      "Hide “View post engagements”",
      "Remove the engagements link under your own posts and in post menus.",
      hide(
        `[role="menu"] a[href$="/quotes"]`,
        `html[data-bx-layout="narrow"] [role="dialog"] a[href$="/quotes"]`,
        `${FOCUSED_POST2} div:has(> ${ACTIONS}[id^="id__"]) + div > div:has(a[href$="/quotes"])`
      ),
      ["activity", "quotes"]
    ),
    toggle5(
      "hideSortReplies",
      "Hide “Sort replies”",
      "Remove the reply sorting menu on a post’s page.",
      hide(
        `${FOCUSED_POST2} div:has(> ${ACTIONS}[id^="id__"]) + div > div:has(button[aria-haspopup="menu"])`
      ),
      ["relevant", "conversation"]
    ),
    toggle5(
      "simplifyActions",
      "Simplify post actions",
      "Remove X’s reply, repost, like and share buttons from posts, leaving Better X’s Save and download buttons.",
      // Only a row that holds X's reply button is an action row; other groups inside a post are left alone.
      hide(`${POST} ${ACTIONS}:has(button[data-testid="reply"]) > ${NOT_OURS}`),
      ["reduced interaction", "buttons", "calm"]
    ),
    toggle5(
      "hideVerifiedBadges",
      "Hide verification badges",
      "Remove the check marks beside names. Hides every kind of badge, not only Premium ones.",
      hide('svg[data-testid="icon-verified"]', '[data-testid="verificationBadge"]'),
      ["blue check", "premium", "verified"]
    ),
    color(
      "verifiedColor",
      "Verification badge color",
      "Recolor the check marks beside names. Applies to every kind of badge, including gold and gray ones.",
      1940464,
      (value) => {
        const hex = `#${value.toString(16).padStart(6, "0")}`;
        return rule(
          ['svg[data-testid="icon-verified"]', 'svg[data-testid="icon-verified"] :is(g, path)'],
          `color: ${hex} !important;
  fill: ${hex} !important;`
        );
      },
      ["blue check", "premium", "verified", "colour", "hex"]
    ),
    toggle5(
      "plainText",
      "Plain post text",
      "Show post text without bold or italic styling.",
      rule(`div[data-testid="tweetText"] span`, "font-style: normal;\n  font-weight: normal;"),
      ["formatting", "bold", "italic"]
    )
  ];

  // src/features/registry.ts
  var ID = /^[a-z][A-Za-z0-9]{0,31}\.[a-z][A-Za-z0-9]{0,47}$/;
  var decimals = (step) => (String(step).split(".")[1] ?? "").length;
  var onGrid = (def, value) => {
    const steps = (value - def.min) / def.step;
    return Math.abs(steps - Math.round(steps)) < 1e-9;
  };
  function resolveSliderValue(def, stored) {
    if (typeof stored !== "number" || !Number.isFinite(stored)) return def.defaultValue;
    const clamped = Math.min(def.max, Math.max(def.min, stored));
    const snapped = def.min + Math.round((clamped - def.min) / def.step) * def.step;
    return Number(Math.min(def.max, snapped).toFixed(decimals(def.step)));
  }
  var isColorNumber = (value) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 16777215;
  function resolveValue(def, stored) {
    if (def.kind === "slider") return resolveSliderValue(def, stored);
    return isColorNumber(stored) ? stored : def.defaultValue;
  }
  function checkSlider(def) {
    const where = `Slider "${def.id}"`;
    if (!(def.min < def.max)) throw new Error(`${where} needs min below max`);
    if (!(def.step > 0)) throw new Error(`${where} needs a positive step`);
    if (!onGrid(def, def.max))
      throw new Error(`${where} max is not a whole number of steps from min`);
    if (def.defaultValue < def.min || def.defaultValue > def.max || !onGrid(def, def.defaultValue))
      throw new Error(`${where} default is outside its range or off its step`);
  }
  function createFeatureRegistry(defs) {
    const byId = /* @__PURE__ */ new Map();
    for (const def of defs) {
      if (!ID.test(def.id)) throw new Error(`Invalid feature id "${def.id}"`);
      if (!def.id.startsWith(`${def.category}.`))
        throw new Error(`Feature "${def.id}" is not in category "${def.category}"`);
      if (byId.has(def.id)) throw new Error(`Feature "${def.id}" is registered twice`);
      if (def.requires !== void 0 && !byId.has(def.requires))
        throw new Error(
          `Feature "${def.id}" requires "${def.requires}", which is not listed before it`
        );
      if (def.kind === "slider") checkSlider(def);
      byId.set(def.id, def);
    }
    return {
      list: () => defs,
      get: (id) => byId.get(id),
      enabled(stored) {
        const result = {};
        for (const def of defs) {
          const value = stored?.[def.id];
          const own2 = typeof value === "boolean" ? value : def.defaultEnabled;
          result[def.id] = own2 && (def.requires === void 0 || result[def.requires] === true);
        }
        return result;
      },
      values(stored) {
        const result = {};
        for (const def of defs)
          if (def.kind !== "toggle") result[def.id] = resolveValue(def, stored?.[def.id]);
        return result;
      }
    };
  }

  // src/features/sidebar-cards.ts
  var LANDMARKS = 'aside[role="complementary"], [role="search"], section, [data-testid="news_sidebar"], [data-testid="trend"]';
  var MAX_CLIMB = 8;
  function climbToCard(node, column) {
    let card = node;
    for (let depth = 0; depth < MAX_CLIMB; depth++) {
      const parent = card.parentElement;
      if (!parent || parent === column || !column.contains(parent)) break;
      if (parent.matches(SIDEBAR_SECTIONS)) return card;
      const shared = [...parent.querySelectorAll(LANDMARKS)].some(
        (other) => other !== node && !node.contains(other) && !card.contains(other)
      );
      if (shared) break;
      if (hasContentfulSibling(card)) break;
      card = parent;
    }
    return card.parentElement === column ? node : card;
  }
  var VISIBLE_CONTENT = 'img, svg, video, picture, canvas, input, button, a, [role="button"]';
  function hasContentfulSibling(element) {
    for (const sibling of element.parentElement?.children ?? []) {
      if (sibling === element) continue;
      if ((sibling.textContent ?? "").trim()) return true;
      if (sibling.matches(VISIBLE_CONTENT) || sibling.querySelector(VISIBLE_CONTENT)) return true;
      if (sibling.matches(LANDMARKS) || sibling.querySelector(LANDMARKS)) return true;
    }
    return false;
  }
  var hiddenCardAttribute = (name) => `data-bx-hide-${name}`;
  function hideSidebarCards(name, find) {
    const attribute = hiddenCardAttribute(name);
    return (context) => {
      const { scope, runtime } = context;
      const marked = /* @__PURE__ */ new Set();
      function scan() {
        const column = runtime.sidebar.column;
        const wanted = /* @__PURE__ */ new Set();
        if (column) for (const node of find(column, context)) wanted.add(climbToCard(node, column));
        for (const card of marked)
          if (!wanted.has(card)) {
            card.removeAttribute(attribute);
            marked.delete(card);
          }
        if (column) {
          for (const stray of column.querySelectorAll(`[${attribute}]`))
            if (!wanted.has(stray)) stray.removeAttribute(attribute);
        }
        for (const card of wanted)
          if (!marked.has(card)) {
            card.setAttribute(attribute, "");
            marked.add(card);
          }
      }
      scope.add(runtime.sidebar.onChange(scan));
      scope.add(runtime.routes.onRoute(scan));
      scope.add(() => {
        for (const card of marked) card.removeAttribute(attribute);
        marked.clear();
        for (const stray of document.querySelectorAll(`[${attribute}]`))
          stray.removeAttribute(attribute);
      });
    };
  }

  // src/features/sidebar.ts
  var { toggle: toggle6 } = definitions("sidebar");
  var SIDEBAR_FEATURES = [
    toggle6(
      "hideSidebar",
      "Hide the sidebar",
      "Remove the whole column beside your timeline, including its search box.",
      hide(SIDEBAR),
      ["right column", "search"]
    ),
    toggle6(
      "keepOnlySearch",
      "Keep only search in the sidebar",
      "Hide every sidebar section except the search box. Search results and community pages keep the section X shows there.",
      [
        // Not `!important`: the re-show rules below must be able to win on the pages that need them.
        rule(`${SIDEBAR_SECTIONS} > div:not(:first-of-type)`, "display: none;"),
        rule(`${onRoute("search")} ${SIDEBAR_SECTIONS} > div:nth-of-type(2)`, "display: block;"),
        rule(`${onRoute("community")} ${SIDEBAR_SECTIONS} > div:nth-of-type(3)`, "display: block;")
      ].join("\n"),
      ["minimal", "clean", "trends"]
    ),
    toggle6(
      "hideWhatsHappening",
      "Hide “What’s happening”",
      "Remove the trending section from the sidebar.",
      hide(`${SIDEBAR} div:has(> section > div[aria-label] > div)`),
      ["trends", "trending"]
    ),
    toggle6(
      "hideTodaysNews",
      "Hide “Today’s News”",
      "Remove the news section from the sidebar.",
      hide(`${SIDEBAR_SECTIONS} > div:has(> [data-testid="news_sidebar"])`),
      ["headlines"]
    ),
    {
      ...toggle6(
        "hideWhoToFollow",
        "Hide “Who to follow”",
        "Remove suggested accounts from the sidebar. “Relevant people” on a post’s own page stays.",
        // The `aside` that holds user cells is hidden at once by CSS (anchored on the aside, which
        // has a role; see `cellWhere` in css.ts). `activate` then marks the whole card around it,
        // border and spacing included, and the second rule hides that.
        // A third rule hides the section around it the way “Today’s News” is hidden, so the card's
        // bordered wrapper goes too even before `activate` runs or if its climb stops early.
        hide(
          `html:not([data-bx-route="post"]) ${SIDEBAR} aside[role="complementary"]:has([data-testid="UserCell"])`,
          `html:not([data-bx-route="post"]) ${SIDEBAR_SECTIONS} > div:has(aside[role="complementary"] [data-testid="UserCell"]):not(:has([role="search"], [data-testid="news_sidebar"], [data-testid="trend"]))`,
          `[${hiddenCardAttribute("whoToFollow")}]`
        ),
        ["suggested accounts", "recommended accounts", "people"]
      ),
      activate: hideSidebarCards(
        "whoToFollow",
        (column, { runtime }) => (
          // “Relevant people” on a post's own page is useful, so that route keeps its card.
          runtime.routes.route.id === "post" ? [] : [...column.querySelectorAll('aside[role="complementary"]')].filter(
            (aside) => aside.querySelector('[data-testid="UserCell"]')
          )
        )
      )
    },
    {
      ...toggle6(
        "hidePremiumPromo",
        "Hide the Premium card",
        "Remove the “Subscribe to Premium” and similar cards from the sidebar.",
        hide(
          `${SIDEBAR} aside[role="complementary"]:has(a[href^="/i/premium_sign_up"])`,
          `${SIDEBAR} [data-testid="super-upsell-UpsellCardRenderProperties"]`,
          `[${hiddenCardAttribute("premiumCard")}]`
        ),
        ["upsell", "subscribe"]
      ),
      activate: hideSidebarCards("premiumCard", (column) => [
        ...[...column.querySelectorAll('aside[role="complementary"]')].filter(
          (aside) => aside.querySelector('a[href^="/i/premium_sign_up"]')
        ),
        ...column.querySelectorAll(
          '[data-testid="super-upsell-UpsellCardRenderProperties"]'
        )
      ])
    },
    toggle6(
      "hideFooter",
      "Hide footer links",
      "Remove “Terms of Service”, “Privacy Policy” and the other links at the bottom of the sidebar. English only.",
      hide(`${SIDEBAR} nav[aria-label="Footer"]`),
      ["terms", "privacy", "cookies"]
    )
  ];

  // src/features/index.ts
  var FEATURES = [
    ...NAVIGATION_FEATURES,
    ...NAV_ITEM_FEATURES,
    hideForYou,
    ...FEED_FEATURES,
    ...POST_FEATURES,
    dragPhotos,
    dragTimelinePhotos,
    ...INSIGHT_FEATURES,
    ...FILTERING_FEATURES,
    ...SIDEBAR_FEATURES,
    ...APPEARANCE_FEATURES,
    ...BRANDING_FEATURES,
    hideAds,
    hideGrok,
    ...CLEANUP_FEATURES
  ];
  var featureRegistry = createFeatureRegistry(FEATURES);

  // src/features/types.ts
  var CATEGORY_TITLES = {
    navigation: "Navigation",
    feed: "Home & feed",
    posts: "Posts",
    insights: "Account insights",
    filtering: "Smart filtering",
    sidebar: "Sidebar",
    appearance: "Appearance",
    cleanup: "Ads, Grok & Premium"
  };
  var CATEGORY_SHORT = {
    navigation: "Navigation",
    feed: "Home",
    posts: "Posts",
    insights: "Insights",
    filtering: "Filtering",
    sidebar: "Sidebar",
    appearance: "Appearance",
    cleanup: "Ads & Grok"
  };
  var CATEGORY_HINTS = {
    navigation: "Menu items and buttons you do not use",
    feed: "What shows up in your timelines",
    posts: "Counts, buttons and details on posts",
    insights: "Where an account is based and how it connects, from X",
    filtering: "Collapse, hide or highlight posts by account country",
    sidebar: "The column beside your timeline",
    appearance: "Widths, spacing, type and Twitter branding",
    cleanup: "Promotions, Grok and upsells"
  };

  // src/features/presets.ts
  var CLEAN = [
    "cleanup.hideAds",
    "cleanup.hideGrok",
    "cleanup.hideGrokImageEdit",
    "cleanup.hideGrokPosts",
    "cleanup.hidePremiumUpsells",
    "cleanup.hideSubscriptions",
    "feed.hideInlinePrompts",
    "feed.hideSuggestedModules",
    "navigation.hidePremium",
    "navigation.hideBusiness",
    "sidebar.hidePremiumPromo",
    "sidebar.hideWhoToFollow"
  ];
  var PRESETS2 = [
    {
      id: "clean",
      title: "Clean",
      description: "No ads, Grok, upsells or suggested accounts. X otherwise as it is.",
      features: CLEAN
    },
    {
      id: "minimal",
      title: "Minimal",
      description: "Clean, plus a leaner menu, a search-only sidebar and no engagement numbers.",
      features: [
        ...CLEAN,
        "navigation.hideCommunities",
        "navigation.hideJobs",
        "navigation.hideConnect",
        "navigation.hideSpaces",
        "navigation.hideCalls",
        "navigation.hideHistory",
        "navigation.hideCreatorStudio",
        "navigation.hideBadges",
        "feed.hideNewPostsPill",
        "feed.hideManageTimelines",
        "feed.hideProfileSuggestions",
        "posts.hideViews",
        "posts.hideReplyCount",
        "posts.hideRepostCount",
        "posts.hideLikeCount",
        "posts.hideBookmarkCount",
        "posts.hideFollowCounts",
        "posts.hideVerifiedBadges",
        "sidebar.keepOnlySearch",
        "sidebar.hideFooter"
      ]
    },
    {
      id: "focus",
      title: "Focus",
      description: "Following only, no sidebar, no counts, no reposts, no reasons to scroll.",
      features: [
        "cleanup.hideAds",
        "cleanup.hideGrok",
        "cleanup.hidePremiumUpsells",
        "feed.hideForYou",
        "feed.hideReposts",
        "feed.hideInlinePrompts",
        "feed.hideSuggestedModules",
        "feed.hideNewPostsPill",
        "feed.hideExploreContents",
        "feed.hideNotificationLikes",
        "navigation.hideBadges",
        "navigation.hideMessagesDrawer",
        "posts.hideViews",
        "posts.hideReplyCount",
        "posts.hideRepostCount",
        "posts.hideLikeCount",
        "posts.hideBookmarkCount",
        "posts.hideFollowCounts",
        "sidebar.hideSidebar"
      ]
    }
  ];
  function presetPatch(preset, registry) {
    const on = new Set(preset.features);
    const features = {};
    const values = {};
    for (const def of registry.list()) {
      features[def.id] = on.has(def.id) ? true : null;
      if (def.kind !== "toggle") values[def.id] = preset.values?.[def.id] ?? null;
    }
    return { features, values };
  }

  // src/themes/derive.ts
  var color2 = (value, fallback) => toRgb(isHex(value) ? value : fallback);
  var rgba = ([r, g, b], alpha) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
  function deriveTokens(seed) {
    const bg = color2(seed.bg, LIGHTS_OUT_SEED.bg);
    const text = color2(seed.text, LIGHTS_OUT_SEED.text);
    const accent = color2(seed.accent, LIGHTS_OUT_SEED.accent);
    const pick2 = (value, derived) => isHex(value) ? toRgb(value) : derived;
    const raised = pick2(seed.raised, mix(bg, text, 0.08));
    const hover = pick2(seed.hover, mix(bg, text, 0.04));
    const border = pick2(seed.border, mix(bg, text, 0.16));
    const muted = ensureContrast(pick2(seed.muted, mix(bg, text, 0.62)), bg, 4.5, text);
    const accentText = ensureContrast(accent, bg, 4.5, text);
    const mention = pick2(seed.mention, accentText);
    const badge = pick2(seed.badge, accent);
    const badgeText = pick2(
      seed.badgeText,
      contrast(WHITE, badge) >= 2.2 ? WHITE : [15, 20, 25]
    );
    return {
      bg: toHex(bg),
      raised: toHex(raised),
      hover: toHex(hover),
      border: toHex(border),
      text: toHex(text),
      muted: toHex(muted),
      accent: toHex(accent),
      accentText: toHex(accentText),
      accentHover: toHex(mix(accent, BLACK, 0.1)),
      accentActive: toHex(mix(accent, BLACK, 0.2)),
      ring: toHex(mix(accent, WHITE, 0.5)),
      accentTint: rgba(accent, 0.1),
      backdrop: rgba(bg, 0.85),
      scrim: rgba(mix(bg, BLACK, 0.5), 0.6),
      mention: toHex(mention),
      badge: toHex(badge),
      badgeText: toHex(badgeText)
    };
  }
  function contrastWarnings(seed) {
    const tokens = deriveTokens(seed);
    const bg = toRgb(tokens.bg);
    const checks = [
      ["text", tokens.text, 4.5],
      ["accent", tokens.accent, 3],
      ["border", tokens.border, 1.25]
    ];
    const warnings = checks.map(([pair, value, minimum]) => ({ pair, ratio: contrast(toRgb(value), bg), minimum })).filter((warning) => warning.ratio < warning.minimum);
    const label = contrast(WHITE, toRgb(tokens.accent));
    if (label < 2.2) warnings.push({ pair: "label", ratio: label, minimum: 2.2 });
    return warnings;
  }

  // src/themes/css.ts
  var THEME_ATTR = "data-bx-theme";
  var ROOT = `html[${THEME_ATTR}]`;
  var RGBA = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0?\.\d{1,3})\)$/;
  var HEX_KEYS = [
    "bg",
    "raised",
    "hover",
    "border",
    "text",
    "muted",
    "accent",
    "accentText",
    "accentHover",
    "accentActive",
    "ring",
    "mention",
    "badge",
    "badgeText"
  ];
  function safeTokens(tokens) {
    const fallback = deriveTokens(LIGHTS_OUT_SEED);
    const result = { ...tokens };
    for (const key of HEX_KEYS) if (!isHex(result[key])) result[key] = fallback[key];
    for (const key of ["backdrop", "scrim", "accentTint"])
      if (!RGBA.test(result[key])) result[key] = fallback[key];
    return result;
  }
  function themeVars(input) {
    const t2 = safeTokens(input);
    const hsl = (hex) => toHslComponents(toRgb(hex));
    const lines = [
      `--bx-t-bg: ${t2.bg};`,
      `--bx-t-raised: ${t2.raised};`,
      `--bx-t-hover: ${t2.hover};`,
      `--bx-t-border: ${t2.border};`,
      `--bx-t-text: ${t2.text};`,
      `--bx-t-muted: ${t2.muted};`,
      `--bx-t-accent: ${t2.accent};`,
      `--bx-t-accent-text: ${t2.accentText};`,
      `--bx-t-accent-fill: ${t2.accent};`,
      `--bx-t-accent-hover: ${t2.accentHover};`,
      `--bx-t-accent-active: ${t2.accentActive};`,
      `--bx-t-accent-tint: ${t2.accentTint};`,
      `--bx-t-ring: ${t2.ring};`,
      `--bx-t-backdrop: ${t2.backdrop};`,
      `--bx-t-scrim: ${t2.scrim};`,
      `--bx-t-mention: ${t2.mention};`,
      `--bx-t-badge: ${t2.badge};`,
      `--bx-t-badge-text: ${t2.badgeText};`,
      `--bx-t-bg-hsl: ${hsl(t2.bg)};`,
      `--bx-t-raised-hsl: ${hsl(t2.raised)};`,
      `--bx-t-hover-hsl: ${hsl(t2.hover)};`,
      `--bx-t-border-hsl: ${hsl(t2.border)};`,
      `--bx-t-text-hsl: ${hsl(t2.text)};`,
      `--bx-t-muted-hsl: ${hsl(t2.muted)};`
    ];
    return `${ROOT} {
  ${lines.join("\n  ")}
}
`;
  }

  // src/lib/brand.ts
  var PRODUCT_NAME = "Better X";
  return __toCommonJS(engine_exports);
})();
