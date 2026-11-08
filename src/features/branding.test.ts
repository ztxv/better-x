// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { birdIcon, twitterBird, twitterName, twitterTitle } from './branding';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const runtime = {} as Runtime;
const icon = () => document.head.querySelector<HTMLLinkElement>('link[rel~="icon"]')!;

beforeEach(() => {
  document.head.innerHTML =
    '<title>Home / X</title><link rel="shortcut icon" href="//abs.twimg.com/favicons/twitter.3.ico">';
});
afterEach(() => {
  document.head.innerHTML = '';
});

describe('twitterTitle', () => {
  it('names the site Twitter where X names itself, and leaves the rest alone', () => {
    expect(twitterTitle('Home / X')).toBe('Home / Twitter');
    expect(twitterTitle('(2) Home / X')).toBe('(2) Home / Twitter');
    expect(twitterTitle('X')).toBe('Twitter');
    expect(twitterTitle('Jack (@jack) on X: "just setting up my twttr" / X')).toBe(
      'Jack (@jack) on Twitter: "just setting up my twttr" / Twitter',
    );
    expect(twitterTitle('Xavier (@xavier) / X')).toBe('Xavier (@xavier) / Twitter');
    expect(twitterTitle('SpaceX launch')).toBe('SpaceX launch');
    expect(twitterTitle('Home / Twitter')).toBe('Home / Twitter');
  });
});

describe('Twitter tab title', () => {
  it('renames the title, follows X’s changes, and restores X’s own when switched off', async () => {
    const scope = new Scope();
    twitterName.activate!({ scope, runtime });
    expect(document.title).toBe('Home / Twitter');
    document.title = '(3) Notifications / X';
    await flush();
    expect(document.title).toBe('(3) Notifications / Twitter');
    scope.dispose();
    expect(document.title).toBe('(3) Notifications / X');
  });
});

describe('Twitter bird icon', () => {
  it('swaps X’s icon for the bird, adds the dot for notifications, and puts X’s back', async () => {
    const scope = new Scope();
    twitterBird.activate!({ scope, runtime });
    expect(icon().getAttribute('href')).toBe(birdIcon());
    icon().setAttribute('href', '//abs.twimg.com/favicons/twitter-pip.3.ico');
    await flush();
    expect(icon().getAttribute('href')).toBe(birdIcon(true));
    scope.dispose();
    expect(icon().getAttribute('href')).toBe('//abs.twimg.com/favicons/twitter-pip.3.ico');
  });

  it('also catches an icon link X adds later', async () => {
    const scope = new Scope();
    twitterBird.activate!({ scope, runtime });
    const added = document.createElement('link');
    added.rel = 'icon';
    added.href = 'https://abs.twimg.com/favicons/twitter.3.ico';
    document.head.append(added);
    await flush();
    expect(added.getAttribute('href')).toBe(birdIcon());
    scope.dispose();
  });

  it('is a well-formed SVG data URL in the Twitter blue', () => {
    const svg = decodeURIComponent(birdIcon().replace('data:image/svg+xml,', ''));
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 24 24">/);
    expect(svg).toContain('fill="#1d9bf0"');
    expect(svg).not.toContain('circle');
    expect(decodeURIComponent(birdIcon(true))).toContain('circle');
  });
});
