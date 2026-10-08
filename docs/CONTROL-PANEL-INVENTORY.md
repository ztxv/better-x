# Control Panel for Twitter: feature-porting inventory

Source inspected: `control-panel-for-twitter/script.js` (`config` defaults, `configureCss`, the
timeline/sidebar/focused-post processors) and `options.html`. Control Panel (CP) is MIT, by Jonny
Buchanan; Better X shares no code with it, but several selectors and icon paths are CP's and are
credited in `THIRD_PARTY_NOTICES.md`.

How to read it:

- **Mechanism**: CSS (one rule, no JS), DOM (needs an observer that tags or edits elements), State
  (reads page state such as the current route), React (reads React props or fibers), GraphQL/XHR
  (needs network interception), Flags (X's internal feature flags).
- **CP tags elements with classes** (`.Views`, `.SidebarContents`, `.ManageTimelines` ...) and then
  styles the class. Where the tag is derivable from the element's position, Better X writes the
  same intent as one `:has()` / structural selector instead, so there is no observer to leak and no
  tag to restore. Those rows are CSS here but "DOM" in CP.
- **Status**: `Implemented`, `Existing` (shipped before this sprint), `Deferred` (needs a capability
  this sprint excludes, or a design decision), `Not ported` (obsolete, rebranding, or not wanted).
- Nothing below was verified against live x.com (X blocks automated browsers). "Implemented" means
  the rule is written from CP's selectors or CP's DOM walk, and behaves correctly on X-shaped
  fixtures in real Chrome. See `docs/MANUAL-CHECKLIST.md`.

## Navigation

| Control Panel option                                  | Better X option                  | Mechanism            | Status      | Limitation                                                                                          |
| ----------------------------------------------------- | -------------------------------- | -------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `hideExploreNav` (+`WithSidebar`)                     | `navigation.hideExplore`         | CSS + sidebar marker | Implemented | Only while X shows its sidebar (which has search); otherwise Explore stays, so search is never lost |
| `hideCommunitiesNav`                                  | `navigation.hideCommunities`     | CSS                  | Implemented | Nav, menus, More dialog                                                                             |
| `hideListsNav`                                        | `navigation.hideLists`           | CSS                  | Implemented |                                                                                                     |
| `hideChatNav`, `hideMessagesBottomNavItem`            | `navigation.hideMessages`        | CSS                  | Implemented | Covers `/messages` and `/i/chat`                                                                    |
| `hideNotifications: hide`                             | `navigation.hideNotifications`   | CSS                  | Implemented | Primary nav only; the Notifications page tabs are untouched                                         |
| `hideNotifications: badges`                           | `navigation.hideBadges`          | CSS                  | Implemented | Count pips on Notifications, Messages, account switcher                                             |
| (none; CP has no bookmarks nav option)                | `navigation.hideBookmarks`       | CSS                  | Implemented | Requested in the sprint brief                                                                       |
| `hideTwitterBlueUpsells` (nav part)                   | `navigation.hidePremium`         | CSS                  | Implemented | Premium / Verified nav entries and the hover-card link                                              |
| `hideBusinessNav`                                     | `navigation.hideBusiness`        | CSS                  | Implemented |                                                                                                     |
| `hideJobsNav`                                         | `navigation.hideJobs`            | CSS                  | Implemented |                                                                                                     |
| `hideCreatorStudioNav`                                | `navigation.hideCreatorStudio`   | CSS                  | Implemented | Also Monetization and Subscriptions in Settings                                                     |
| `hideConnectNav`                                      | `navigation.hideConnect`         | CSS                  | Implemented |                                                                                                     |
| `hideSpacesNav`                                       | `navigation.hideSpaces`          | CSS                  | Implemented | May be a no-op on current X                                                                         |
| `hideHistoryNav`                                      | `navigation.hideHistory`         | CSS                  | Implemented | May be a no-op on current X                                                                         |
| `hideComposeTweet`                                    | `navigation.hideComposeButton`   | CSS                  | Implemented | Side-nav and floating Post buttons; the composer on Home is separate                                |
| `hideAccountSwitcher`                                 | `navigation.hideAccountSwitcher` | CSS                  | Implemented | Uses CP's structural rule; layout-sensitive                                                         |
| `hideMessagesDrawer`                                  | `navigation.hideMessagesDrawer`  | CSS                  | Implemented |                                                                                                     |
| `hideToggleNavigation`                                | none                             | CSS                  | Not ported  | Targets a nav toggle from one layout experiment                                                     |
| `disableHomeTimeline`, `disabledHomeTimelineRedirect` | none                             | CSS + redirect       | Deferred    | The hiding is easy; the redirect is a navigation behavior that needs its own design                 |

## Home and timeline

| Control Panel option                                                                                       | Better X option                | Mechanism                               | Status      | Limitation                                                                |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `hideForYouTimeline`, `alwaysUseLatestTweets`                                                              | `feed.hideForYou`              | State + DOM click                       | Existing    |                                                                           |
| `hideSeeNewTweets`                                                                                         | `feed.hideNewPostsPill`        | CSS                                     | Implemented | Matches X's `transform` style on the pill                                 |
| `hideTimelineTweetBox`                                                                                     | `feed.hidePostBox`             | CSS (CP's `:scope > div:has(textarea)`) | Implemented | Home only                                                                 |
| `hideManageTimelines`                                                                                      | `feed.hideManageTimelines`     | CSS (CP tags by the plus icon)          | Implemented |                                                                           |
| `hideInlinePrompts`                                                                                        | `feed.hideInlinePrompts`       | CSS                                     | Implemented |                                                                           |
| `hideWhoToFollowEtc` (timeline headings)                                                                   | `feed.hideSuggestedModules`    | CSS                                     | Implemented | Home only; heading, user and "show more" cells that hold no post          |
| `hideWhoToFollowEtc` (profile)                                                                             | `feed.hideProfileSuggestions`  | CSS                                     | Implemented |                                                                           |
| `hideExplorePageContents`                                                                                  | `feed.hideExploreContents`     | CSS                                     | Implemented | CP also redirects Explore to search on narrow layouts; Better X does not  |
| `retweets: hide`                                                                                           | `feed.hideReposts`             | CSS (social-context icon)               | Implemented | Also hides other social-context posts on Home, as CP assumes              |
| `hideProfileRetweets`                                                                                      | `feed.hideProfileReposts`      | CSS                                     | Implemented | Pinned and community posts are kept                                       |
| `hideNotificationLikes`                                                                                    | `feed.hideNotificationLikes`   | CSS (icon path prefix)                  | Implemented |                                                                           |
| `hideNotificationRetweets`                                                                                 | `feed.hideNotificationReposts` | CSS (icon path prefix)                  | Implemented |                                                                           |
| `retweets: separate`, `quoteTweets`, `listRetweets`, `mutableQuoteTweets`, `mutedQuotes`, `hideQuotesFrom` | none                           | DOM + injected tab + per-user config    | Deferred    | Separated-posts tab and muted quotes are timeline filtering, not a toggle |
| `hideMoreFromThisAuthor`, `hideMoreTweets`, `hideSuggestedContentSearch`, `hideUnavailableQuoteTweets`     | none                           | DOM (item-sequence classification)      | Deferred    | CP infers these from the order of timeline cells and localized headings   |
| `sortFollowing`                                                                                            | none                           | GraphQL/XHR                             | Deferred    |                                                                           |
| `defaultToLatestSearch`                                                                                    | none                           | DOM / navigation rewrite                | Deferred    |                                                                           |

## Posts

| Control Panel option                                                                                                                              | Better X option            | Mechanism                   | Status      | Limitation                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `hideViews`                                                                                                                                       | `posts.hideViews`          | CSS                         | Implemented | Focused post: the 2nd and 3rd child of the time bar, as CP tags them                                          |
| `hideReplyMetrics`                                                                                                                                | `posts.hideReplyCount`     | CSS                         | Implemented | Counts only; the buttons stay                                                                                 |
| `hideRetweetMetrics`                                                                                                                              | `posts.hideRepostCount`    | CSS                         | Implemented |                                                                                                               |
| `hideLikeMetrics`                                                                                                                                 | `posts.hideLikeCount`      | CSS                         | Implemented |                                                                                                               |
| `hideBookmarkMetrics`                                                                                                                             | `posts.hideBookmarkCount`  | CSS                         | Implemented |                                                                                                               |
| `hideFollowingMetrics`                                                                                                                            | `posts.hideFollowCounts`   | CSS                         | Implemented | Profile and hover card                                                                                        |
| `hideTotalTweetsMetrics`                                                                                                                          | `posts.hidePostCount`      | CSS                         | Implemented | Profile header                                                                                                |
| `hideBookmarkButton`                                                                                                                              | `posts.hideBookmarkButton` | CSS                         | Implemented | Timeline posts; kept under the focused post (CP's default). Better X's own Save is never matched              |
| `hideShareTweetButton`                                                                                                                            | `posts.hideShareButton`    | CSS                         | Implemented | Excludes Better X slots                                                                                       |
| `hideViewActivityLinks`                                                                                                                           | `posts.hideViewActivity`   | CSS                         | Implemented |                                                                                                               |
| `hideSortRepliesMenu`                                                                                                                             | `posts.hideSortReplies`    | CSS                         | Implemented |                                                                                                               |
| `reducedInteractionMode`                                                                                                                          | `posts.simplifyActions`    | CSS                         | Implemented | Unlike CP it keeps Better X's Save button                                                                     |
| `twitterBlueChecks: hide`                                                                                                                         | `posts.hideVerifiedBadges` | CSS                         | Implemented | Hides every verification badge. CP hides only Premium (blue) checks, which it tells apart through React props |
| `disableTweetTextFormatting`                                                                                                                      | `posts.plainText`          | CSS                         | Implemented |                                                                                                               |
| `twitterBlueChecks: replace`, `replaceLogo`                                                                                                       | none                       | DOM                         | Not ported  | Rebranding                                                                                                    |
| `restoreTweetSource`, `restoreLinkHeadlines`, `restoreQuoteTweetsLink`, `restoreOtherInteractionLinks`, `hideQuoteTweetMetrics` (injected counts) | none                       | GraphQL/XHR + DOM injection | Deferred    | Needs post data from X's responses                                                                            |
| `hideTwitterBlueReplies`, `showPremiumReply*`, `showBlueReplyFollowersCount*`                                                                     | none                       | React + GraphQL             | Deferred    |                                                                                                               |
| `sortReplies`                                                                                                                                     | none                       | GraphQL/XHR                 | Deferred    |                                                                                                               |
| `addAddMutedWordMenuItem`                                                                                                                         | none                       | DOM (menu injection)        | Deferred    |                                                                                                               |
| `fastBlock`                                                                                                                                       | none                       | DOM (skips a confirmation)  | Deferred    | Removes a safety prompt; needs a deliberate design                                                            |
| `addFocusedTweetAccountLocation`, `addUserHoverCardAccountLocation`                                                                               | none                       | GraphQL/XHR                 | Deferred    |                                                                                                               |
| `tweakQuoteTweetsPage`                                                                                                                            | none                       | CSS                         | Deferred    | Needs the route's sub-view published on `<html>`                                                              |

## Sidebar

| Control Panel option                         | Better X option              | Mechanism                             | Status      | Limitation                                                                  |
| -------------------------------------------- | ---------------------------- | ------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| (none; hiding `sidebarColumn`)               | `sidebar.hideSidebar`        | CSS                                   | Implemented | Search in the sidebar goes with it                                          |
| `hideSidebarContent`                         | `sidebar.keepOnlySearch`     | CSS                                   | Implemented | Search results and community pages keep their extra section, as CP does     |
| `hideWhatsHappening`                         | `sidebar.hideWhatsHappening` | CSS (CP tags `section.parentElement`) | Implemented |                                                                             |
| `hideTodaysNews`                             | `sidebar.hideTodaysNews`     | CSS                                   | Implemented |                                                                             |
| `hideSuggestedFollows`, `showRelevantPeople` | `sidebar.hideWhoToFollow`    | CSS                                   | Implemented | "Relevant people" on a post's page stays, as with CP's `showRelevantPeople` |
| `hideTwitterBlueUpsells` (sidebar part)      | `sidebar.hidePremiumPromo`   | CSS                                   | Implemented |                                                                             |
| (none)                                       | `sidebar.hideFooter`         | CSS                                   | Implemented | Matches the English footer label                                            |
| `hideLiveBroadcasts`, `hideLiveBroadcastBar` | none                         | DOM (heading text / `data-branding`)  | Deferred    | CP finds it by localized heading text                                       |

## Appearance and layout

| Control Panel option                         | Better X option                     | Mechanism                                      | Status      | Limitation                                                                                   |
| -------------------------------------------- | ----------------------------------- | ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `fullWidthContent`, `fullWidthMedia`         | `appearance.timelineWidth` (slider) | CSS                                            | Implemented | Home, list and community pages, as CP restricts it; width is a number here, not just on/off  |
| (CP restores a 350px sidebar)                | `appearance.sidebarWidth` (slider)  | CSS                                            | Implemented |                                                                                              |
| `navDensity`                                 | `appearance.navSpacing` (slider)    | CSS                                            | Implemented | Continuous instead of default / comfortable / compact                                        |
| `navBaseFontSize`                            | `appearance.navTextSize` (slider)   | CSS                                            | Implemented | Fixed pixel size; CP reads the page's base size                                              |
| (none)                                       | `appearance.postTextSize` (slider)  | CSS                                            | Implemented |                                                                                              |
| `dontUseChirpFont`                           | `appearance.systemFont`             | CSS                                            | Implemented | Overrides the font on the page; CP edits X's own stylesheet rule                             |
| `dropdownMenuFontWeight`                     | `appearance.lighterMenuText`        | CSS                                            | Implemented |                                                                                              |
| `darkModeTheme`                              | none                                | CSS (hashed class names)                       | Deferred    | Depends on X's generated `r-...` classes and colors read from the page                       |
| `uninvertFollowButtons`, `followButtonStyle` | none                                | CSS + DOM, theme color from page               | Deferred    |                                                                                              |
| `unblurSensitiveContent`                     | none                                | State (finds X's blur rule in its stylesheets) | Deferred    |                                                                                              |
| `tweakNewLayout`                             | none                                | CSS                                            | Not ported  | Reverts to an older layout; broad structural selectors that cannot be checked without live X |
| `customCss`                                  | none                                | CSS                                            | Not ported  | Users have style extensions                                                                  |

## Ads, Grok and Premium

| Control Panel option                   | Better X option                    | Mechanism | Status      | Limitation                                                                                   |
| -------------------------------------- | ---------------------------------- | --------- | ----------- | -------------------------------------------------------------------------------------------- |
| `hideAdsNav`, promoted tweets / trends | `cleanup.hideAds`                  | CSS       | Existing    | Now also promoted notifications                                                              |
| `hideGrokNav`                          | `cleanup.hideGrok`                 | CSS       | Existing    |                                                                                              |
| `hideEditImage`                        | `cleanup.hideGrokImageEdit`        | CSS       | Implemented |                                                                                              |
| `hideGrokTweets`                       | `cleanup.hideGrokPosts`            | CSS       | Implemented | Posts that link to a shared Grok conversation                                                |
| `hideTwitterBlueUpsells` (in-page)     | `cleanup.hidePremiumUpsells`       | CSS       | Implemented |                                                                                              |
| `hideSubscriptions`                    | `cleanup.hideSubscriptions`        | CSS       | Implemented | Subscribe buttons, counts, menu items; profile Subscribe by its inline colour is not matched |
| `hideVerifiedNotificationsTab`         | `cleanup.hideVerifiedFollowersTab` | CSS       | Implemented | Hides the tab; CP also redirects a direct visit                                              |

## Needs the advanced layer (deferred by design)

| Capability                 | Control Panel options that need it                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature flags (MAIN world) | `bypassAgeVerification`, `disableNflFeatures`, `revertMediaCarousel`, `revertProfileTabs`, `revertTwemoji`                                                                                                   |
| React internals            | `hideTwitterBlueReplies`, `showPremiumReply*`, `showBlueReplyFollowersCount*`, blue-vs-gold check detection, `history.push` patching (verified followers redirect), retweet/quote item types read from props |
| GraphQL / XHR              | `sortFollowing`, `sortReplies`, `restoreTweetSource`, `restoreLinkHeadlines`, `restoreQuoteTweetsLink`, `restoreOtherInteractionLinks`, `addFocusedTweetAccountLocation`, `addUserHoverCardAccountLocation`  |
| Large DOM subsystems       | separated reposts / quotes tab, muted quotes, `hideMoreTweets`, `hideMoreFromThisAuthor`, `hideSuggestedContentSearch`, `hideUnavailableQuoteTweets`, `addAddMutedWordMenuItem`                              |
| Theme reading              | `darkModeTheme`, `uninvertFollowButtons`, `followButtonStyle`, `unblurSensitiveContent`                                                                                                                      |
