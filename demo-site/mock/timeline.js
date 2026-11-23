/*
 * The simulated timeline's own behavior: it renders the made-up posts, keeps the <html> layout
 * attributes Better X's runtime would set on x.com, and exposes a tiny API to the demo page.
 * Saving runs the extension's real post extractor (BetterXEngine.extractPost) on the post's
 * markup, the same function the extension calls on x.com.
 */
(function () {
  'use strict';

  var EPOCH = 1288834974657;
  // Post ids are Snowflakes, so each post's date is encoded in its id, as on x.com.
  function idAt(iso, n) {
    var ms = Date.parse(iso) - EPOCH;
    return (BigInt(ms) * 4194304n + BigInt(n)).toString();
  }

  var REPOST_ICON = 'M7 7h10v4l4-5-4-5v4H5v6h2zM17 17H7v-4l-4 5 4 5v-4h12v-6h-2z';
  var ICONS = {
    reply: 'M4 5h16v11H9l-5 4z',
    retweet: 'M7 7h10v4l4-5-4-5v4H5v6h2zM17 17H7v-4l-4 5 4 5v-4h12v-6h-2z',
    like: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    views: 'M5 20V12M10 20V6M15 20v-9M20 20V4',
    bookmark: 'M6 3h12v18l-6-4-6 4z',
    share: 'M12 15V3M7 8l5-5 5 5M5 14v6h14v-6',
  };
  // Better X's own Save mark (lucide "layers-2"), the icon the extension adds to every post.
  var SAVE_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16.02 12 5.48 3.13a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74L7.98 12"/><path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74Z"/></svg>';
  var VERIFIED =
    '<svg data-testid="icon-verified" class="verified" viewBox="0 0 24 24" aria-label="Verified account"><path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.2 3 1.2 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.2-3-1.2-3 2.8-1.6.9-3.1 3.2.3z"/><path class="tick" d="M8 12.5l2.6 2.5L16 9.5"/></svg>';

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var icon = function (d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  };
  var fmtDate = function (iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  function actionRow(p) {
    var url = 'https://x.com/' + p.handle + '/status/' + p.id;
    return (
      '<div role="group" aria-label="Post actions">' +
      '<div><button type="button" data-testid="reply" aria-label="Reply">' + icon(ICONS.reply) + '<span>' + p.counts[0] + '</span></button></div>' +
      '<div><button type="button" data-testid="retweet" aria-label="Repost">' + icon(ICONS.retweet) + '<span>' + p.counts[1] + '</span></button></div>' +
      '<div><button type="button" data-testid="like" aria-label="Like">' + icon(ICONS.like) + '<span>' + p.counts[2] + '</span></button></div>' +
      '<div><a href="' + url + '/analytics" aria-label="Views">' + icon(ICONS.views) + '<span>' + p.counts[3] + '</span></a></div>' +
      '<div><button type="button" data-testid="bookmark" aria-label="Bookmark">' + icon(ICONS.bookmark) + '<span>' + p.counts[4] + '</span></button></div>' +
      '<div style="display:inline-flex"><button type="button" data-testid="share" aria-label="Share">' + icon(ICONS.share) + '</button></div>' +
      '<div data-bx-slot="save"><button type="button" class="bx-control" aria-label="Save to Better X" aria-pressed="false" title="Save to your Better X library">' + SAVE_ICON + '</button></div>' +
      '</div>'
    );
  }

  function article(p) {
    var url = 'https://x.com/' + p.handle + '/status/' + p.id;
    var date = new Date(Number((BigInt(p.id) >> 22n) + BigInt(EPOCH))).toISOString();
    var social = p.social
      ? '<div data-testid="socialContext" class="social">' + icon(REPOST_ICON) + '<span>' + esc(p.social) + '</span></div>'
      : '';
    return (
      '<article data-testid="tweet" tabindex="0" aria-label="Post by ' + esc(p.name) + '">' + social +
      '<div class="p-grid">' +
      '<div data-testid="Tweet-User-Avatar"><div class="av" style="--h:' + p.hue + '">' + esc(p.name[0]) + '</div></div>' +
      '<div class="p-body">' +
      '<div class="p-head"><div data-testid="User-Name"><a href="https://x.com/' + p.handle + '" class="name">' + esc(p.name) + (p.verified ? VERIFIED : '') + '</a>' +
      '<span class="handle">@' + p.handle + '</span><span class="dot">·</span>' +
      '<a href="' + url + '" class="when"><time datetime="' + date + '">' + (p.ad ? 'Ad' : fmtDate(date)) + '</time></a></div>' +
      (p.grokButton ? '<button type="button" aria-label="Grok actions" class="grok-actions">' + icon('M4 20L20 4M8 4h12v12') + '</button>' : '') +
      '</div>' +
      '<div data-testid="tweetText" dir="auto">' + p.html + '</div>' +
      (p.media || '') +
      actionRow(p) +
      '</div></div></article>'
    );
  }

  var cell = function (inner, extra) {
    return '<div data-testid="cellInnerDiv"' + (extra || '') + '><div>' + inner + '</div></div>';
  };

  var POSTS = [
    {
      id: idAt('2026-11-21T15:42:00Z', 1), name: 'Priya Raman', handle: 'priyabuilds', hue: 265, verified: true,
      html: '<span>Shipped dark mode for our docs today. It took 40 minutes. Then we spent three days arguing about the exact gray.</span>',
      counts: ['48', '112', '1.9K', '64K', '210'],
    },
    {
      id: idAt('2026-11-21T13:05:00Z', 2), name: 'Nimbus Notes', handle: 'nimbusnotes', hue: 200, ad: true,
      html: '<span>Your notes, finally in one place. Try Nimbus free for 30 days at nimbus.example.</span>',
      counts: ['3', '9', '41', '220K', '1'],
    },
    {
      id: idAt('2026-11-20T19:17:00Z', 3), name: 'Ada Okafor', handle: 'adaokafor', hue: 30, verified: true,
      html: '<span>Morning light over the harbor before anyone else was awake. </span><a href="/hashtag/photography" class="mention">#photography</a>',
      media: '<div class="media" aria-labelledby="media-ada"><div class="photo" id="media-ada" role="img" aria-label="Photo: a harbor at sunrise"></div><a href="/i/imagine/ada" class="edit-image">Edit image</a></div>',
      counts: ['86', '240', '3.4K', '91K', '512'],
    },
    {
      id: idAt('2026-11-20T11:30:00Z', 4), name: 'Mika Sato', handle: 'mikasato', hue: 330, social: 'Theo Lindqvist reposted',
      html: '<span>Reminder that you are allowed to close the app.</span>',
      counts: ['220', '4.1K', '22K', '1.2M', '3K'],
    },
    {
      id: idAt('2026-11-19T21:02:00Z', 5), name: 'Sam Reyes', handle: 'samreyes', hue: 95, grokButton: true,
      html: '<span class="strong">Hot take:</span><span> bookmarks are a graveyard. Saving is easy. Finding it again six months later is the hard part.</span>',
      counts: ['301', '95', '2.2K', '140K', '880'],
    },
    {
      id: idAt('2026-11-19T16:44:00Z', 6), name: 'Jordan Vale', handle: 'jordanvale', hue: 175,
      html: '<span>I asked an AI to plan my week and it scheduled nine hours of “deep work” on Saturday.</span>',
      media: '<a href="/i/grok/share/demo-chat" class="card-link"><b>Shared chat</b><span>A conversation about planning a week</span></a>',
      counts: ['57', '33', '870', '48K', '19'],
    },
    {
      id: idAt('2026-11-18T09:12:00Z', 7), name: 'Lena Fischer', handle: 'lenafischer', hue: 5, verified: true,
      html: '<span>Wrote up how we cut our build from 11 minutes to 90 seconds. Mostly by deleting things. Thread below.</span>',
      counts: ['39', '410', '2.7K', '77K', '1.4K'],
    },
  ];

  var html = '';
  POSTS.forEach(function (p, i) {
    if (p.ad) html += cell('<div data-testid="placementTracking">' + article(p) + '</div>');
    else html += cell(article(p));
    if (i === 1) {
      html += cell('<div data-testid="inlinePrompt" class="prompt"><div><b>Get verified</b><span>Subscribe to unlock new features and a reply boost.</span></div><a href="/i/premium_sign_up" class="btn-light">Subscribe</a></div>');
    }
    if (i === 3) {
      html += cell('<h2 role="heading" class="module-h">Who to follow</h2>');
      html += cell('<div data-testid="UserCell" class="user"><div class="av" style="--h:150">R</div><div><b>River Chen</b><span>@riverchen · Makes maps of places that don’t exist</span></div><button type="button" class="btn-light">Follow</button></div>');
      html += cell('<div data-testid="UserCell" class="user"><div class="av" style="--h:20">N</div><div><b>Noor Haddad</b><span>@noorhaddad · Type designer</span></div><button type="button" class="btn-light">Follow</button></div>');
      html += cell('<a href="/i/connect_people" class="more">Show more</a>');
    }
  });
  document.getElementById('timeline').innerHTML = html;

  /* ------------------------------------------------------------ layout attributes */
  // Better X's runtime marks <html> with the layout and whether X shows a sidebar; some rules
  // (Hide Explore, for example) only apply while the sidebar's search box is there.
  var root = document.documentElement;
  var sidebar = document.querySelector('[data-testid="sidebarColumn"]');
  function refresh() {
    root.setAttribute('data-bx-layout', innerWidth < 600 ? 'narrow' : 'wide');
    root.classList.toggle('labels', innerWidth >= 940);
    if (innerWidth >= 800) root.setAttribute('data-sidebar-room', '');
    else root.removeAttribute('data-sidebar-room');
    var shown = getComputedStyle(sidebar).display !== 'none';
    if (shown) root.setAttribute('data-bx-sidebar', '');
    else root.removeAttribute('data-bx-sidebar');
  }
  addEventListener('resize', refresh);
  refresh();

  /* ------------------------------------------------------------ links and tabs */
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a');
    if (link) event.preventDefault();
    var tab = event.target.closest('[role="tab"]');
    if (tab) selectTab(tab.id === 'tab-following' ? 'following' : 'foryou');
  });
  function selectTab(which) {
    document.getElementById('tab-foryou').setAttribute('aria-selected', String(which === 'foryou'));
    document.getElementById('tab-following').setAttribute('aria-selected', String(which === 'following'));
  }

  /* ------------------------------------------------------------ saving */
  var saved = new Set();
  function setSaved(tweetId, on) {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(function (a) {
      var draft = window.BetterXEngine.extractPost(a);
      if (!draft || draft.tweetId !== tweetId) return;
      var btn = a.querySelector('.bx-control');
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Saved. Click to remove from Better X' : 'Save to Better X');
      btn.title = on ? 'Saved to your library' : 'Save to your Better X library';
    });
    if (on) saved.add(tweetId);
    else saved.delete(tweetId);
  }
  function chip(btn, text) {
    var old = btn.parentElement.querySelector('.bx-chip');
    if (old) old.remove();
    var c = document.createElement('span');
    c.className = 'bx-chip';
    c.setAttribute('role', 'status');
    c.textContent = text;
    btn.parentElement.appendChild(c);
    setTimeout(function () { c.remove(); }, 1800);
  }
  document.addEventListener('click', function (event) {
    var btn = event.target.closest('.bx-control');
    if (!btn) return;
    var a = btn.closest('article');
    // The real extractor, reading this post's markup.
    var draft = window.BetterXEngine.extractPost(a);
    if (!draft) return;
    var demo = window.parent && window.parent.bxDemo;
    if (saved.has(draft.tweetId)) {
      setSaved(draft.tweetId, false);
      chip(btn, 'Removed');
      if (demo) demo.removed(draft.tweetId);
    } else {
      setSaved(draft.tweetId, true);
      chip(btn, 'Saved');
      if (demo) demo.saved(draft);
    }
  });

  /* ------------------------------------------------------------ API for the demo page */
  window.bxMock = {
    refresh: refresh,
    selectTab: selectTab,
    setSaved: setSaved,
    setTitle: function (t) { document.title = t; },
  };
  if (window.parent && window.parent.bxDemo) window.parent.bxDemo.ready(window);
})();
