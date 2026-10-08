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

Control Panel's own bundled `dedent()` (tiny-dedent, MIT, Copyright (c) 2021 Victor) is not used
in Better X.
