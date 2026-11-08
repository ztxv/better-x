# Third-party notices

Better X includes selectors, icon paths and small behaviors adapted from the projects below.
Their licenses require that the copyright notice and permission notice accompany copies or
substantial portions of the software; they are reproduced here and referenced from the files that
use the adapted material.

## Control Panel for Twitter

- Source: <https://github.com/insin/control-panel-for-twitter>
- License: MIT-style permission notice (below)
- Copyright (c) 2019, Jonny Buchanan

Better X does not include Control Panel's code as a whole and does not share its structure. What
it adapts is X-specific knowledge that Control Panel established and keeps current:

- CSS selectors that identify X's interface elements by test ID, link target, role and nesting
  (navigation links, the sidebar's sections, post action buttons and counts, timeline cells,
  promoted content, Premium and Grok surfaces).
- SVG icon path prefixes that identify an item that has no other stable marker (a promoted trend,
  a promoted, liked or reposted notification, a pinned or community post, the "manage timelines"
  button).
- The way its processors walk X's markup to find a section or a tab, written here as selectors.
- Its behaviors for the Home tabs (Hide For You), full-width timeline, navigation spacing and
  navigation text size, redone as Better X features with sliders.

The features and files affected are listed in `docs/CONTROL-PANEL-INVENTORY.md`; each of these
source files carries a header comment pointing here (`src/runtime/layout.ts` and
`src/x/routes.ts` follow Control Panel's route and layout _ideas_ but contain none of its code):

- `src/features/hide-ads.ts`, `hide-grok.ts`, `hide-for-you.ts`
- `src/features/navigation.ts`, `feed.ts`, `posts.ts`, `sidebar.ts`, `appearance.ts`, `cleanup.ts`

```
Copyright (c) 2019, Jonny Buchanan

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

For X themes (`src/themes/surfaces.ts`, `src/themes/detect.ts`), Better X also uses Control
Panel's X theme detection signals (`<body>`'s inline background: white Default, black or
`rgb(5, 5, 5)` Lights out), its documented Lights Out and Dim palette values, and its map of
which X classes and Tailwind tokens paint which surface.

Control Panel's own bundled `dedent()` (tiny-dedent, MIT, Copyright (c) 2021 Victor) is not used
in Better X.

## Dim Mode for Twitter / X

- Source: <https://github.com/juanbuis/x-dim-mode>
- License: MIT (below)
- Copyright (c) 2026 Juan Buis

Better X's X themes adapt Dim Mode's surface map: which inline colors, React Native Web classes,
jetfuel classes and test IDs paint X's page, cards, sticky bars, borders and secondary text, and
which must be left alone (crop selection, hover circles, Premium promo images). Written as data in
`src/themes/surfaces.ts`, which carries a header comment pointing here. Its technique for theming
X's Chat inside shadow DOM (adopting one stylesheet into every shadow root) is the reference for
Better X's experimental Chat theming, when built.

```
MIT License

Copyright (c) 2026 Juan Buis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## X-Posed

- Source: <https://github.com/xaitax/x-account-location-device>
- License: MIT, as declared in its README and `package.json` (Alexander Hagenah). The repository
  ships no LICENSE file and no copyright year, so none is reproduced here.

Better X does not include X-Posed's code as a whole and shares none of its interface or structure.
What it takes is knowledge of X's data, with the credit it asks for in its license:

- The shape of X's `AboutAccountQuery` response (`user_result_by_screen_name.result.about_profile`
  with `account_based_in`, `source`, `location_accurate`, `username_changes`, and the identity and
  verification fields beside it) and the query's name and id. Written as `src/x/about-account.ts`
  and `src/x/about-transport.ts`.
- The rate-limit idea in `src/x/about-transport.ts` (`readRate`): honor `x-rate-limit-reset` and
  `retry-after`, and fall back to a minute.
- The spellings of countries that X and other sources use for the same country, in the `ALIASES`
  table of `src/insights/places.ts`, and the list of region labels in `REGION_LABELS`.
- The approach to telling a quoted post's author apart from the quoting post's (the quote card is
  the nearest `role="link"` block). Re-implemented in `src/x/selectors.ts`.

## X Profile Location

- Source: <https://github.com/asmyshlyaev177/x-profile-location>
- License: MIT, Copyright (c) 2026 Aleksandr Smyshliaev (permission notice as for Control Panel
  above, with that name and year).

What Better X adapts: the way a `source` string is read ("web", "Japan App Store", "Nigeria Android
App") into a platform and an optional store country (`parseConnection` in
`src/x/about-account.ts`), and, for tests only, response bodies recorded from x.com by its end-to-end
suite (`src/x/about-account.test.ts` uses the `about_profile` objects it recorded). Its optional
shared community cache and its server are not used or included.

## X-Source-label and Twitter Region Viewer

- X-Source-label (<https://github.com/Yu08083/X-Source-label>, MIT, Copyright (c) 2026 @yu_) was
  studied for the per-post client label (`TweetResultByRestId`). Nothing from it is included: the
  posting client is not built (see docs/ARCHITECTURE.md).
- Twitter Region Viewer (<https://github.com/masooddalman/Twitter-Region-Viewer>) was studied and
  nothing from it is included. It has no license, and it works by loading `/about` pages in hidden
  frames with `declarativeNetRequest` rules that remove X's frame protections, which Better X does
  not do.

## Lucide and Simple Icons

- The small glyphs drawn on the X page (globe, map pin, alert, refresh, shield and others) are
  Lucide's (ISC License), inlined in `src/insights/icons.ts`.
- The Apple and Android marks are Simple Icons' paths (CC0 1.0), from the `simple-icons` package
  (a build-time dependency). They identify the platform X reports; the marks remain their owners'
  trademarks.
