// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startRuntime, type Runtime } from '../runtime';
import { Scope } from '../runtime/scope';
import { startSaved } from '.';

const ID = '1100000000000000001';

/** A post as X renders it (the shape the smoke fixture serves), optionally with a photo. */
const post = (id: string, withPhoto = false) => `
  <article>
    <div data-testid="Tweet-User-Avatar"><img src="https://pbs.twimg.com/profile_images/1/a_normal.jpg"></div>
    <div data-testid="User-Name"><a href="https://x.com/texter">texter Name</a><span>@texter</span></div>
    <a href="https://x.com/texter/status/${id}"><time datetime="2024-03-21T00:00:00Z">Mar 21</time></a>
    <div data-testid="tweetText">Hello</div>
    ${withPhoto ? `<a href="https://x.com/texter/status/${id}/photo/1"><img src="https://pbs.twimg.com/media/Abc?format=jpg&name=small"></a>` : ''}
    <div role="group"><button data-testid="reply"><svg></svg></button><button><svg></svg></button></div>
  </article>`;

/** The background, as far as the content script can tell: ids already saved, and a save that answers when told to. */
function fakeBackground() {
  const reply: Array<(value: unknown) => void> = [];
  const sent: string[] = [];
  const sendMessage = vi.fn(async (message: { type: string }) => {
    sent.push(message.type);
    if (message.type === 'save')
      return new Promise((resolve) => reply.push(() => resolve({ ok: true, data: {} })));
    return { ok: true, data: message.type === 'savedIds' ? [] : [] };
  });
  globalThis.chrome = {
    storage: {
      local: { get: async () => ({}) },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
    runtime: { sendMessage },
  } as unknown as typeof chrome;
  return { finishSave: () => reply.shift()?.(undefined), sent };
}

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
const runFrames = () => {
  const due = [...frames.values()];
  frames.clear();
  due.forEach((callback) => callback(0));
};
/** Lets the observer deliver, frames run, and pending promises settle. */
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    runFrames();
  }
};

let scope: Scope;
let runtime: Runtime;
const control = () => document.querySelector<HTMLButtonElement>('.bx-control')!;
const chip = () => document.getElementById('bx-chip');
const keydown = (target: Element, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

async function start(html: string) {
  document.body.innerHTML = html;
  const background = fakeBackground();
  scope = new Scope();
  runtime = startRuntime(scope);
  startSaved(scope, runtime);
  await settle();
  return background;
}

beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  scope?.dispose();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Saved on the shared runtime', () => {
  it('puts the save control in the post’s action row, unsaved', async () => {
    await start(post(ID));
    const save = document.querySelector('[role="group"] > .bx-control')!;
    expect(save.getAttribute('data-bx-slot')).toBe('save');
    expect(save.getAttribute('aria-pressed')).toBe('false');
  });

  it('saves on click and offers the confirmation chip', async () => {
    const background = await start(post(ID));
    control().click();
    background.finishSave();
    await settle();
    expect(background.sent).toContain('save');
    expect(control().getAttribute('aria-pressed')).toBe('true');
    expect(chip()?.textContent).toContain('Saved');
  });
});

describe('Saved: keyboard and focus', () => {
  it('keeps focus on the control while the save is in flight (it is aria-disabled, never disabled)', async () => {
    const background = await start(post(ID));
    control().focus();
    control().click();
    await settle();
    expect(control().getAttribute('aria-disabled')).toBe('true');
    expect(control().hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(control());
    background.finishSave();
    await settle();
    expect(control().getAttribute('aria-disabled')).toBe('false');
    expect(document.activeElement).toBe(control());
  });

  it('ignores a second click while the save is in flight', async () => {
    const background = await start(post(ID));
    control().click();
    control().click();
    await settle();
    expect(background.sent.filter((type) => type === 'save')).toHaveLength(1);
  });

  it('moves focus from the control into the chip on Tab, and back out on Shift+Tab or Escape', async () => {
    const background = await start(post(ID, true));
    control().focus();
    control().click();
    background.finishSave();
    await settle();
    const action = chip()!.querySelector<HTMLElement>('.bx-chip-action')!;
    expect(action).toBeTruthy();

    const tab = keydown(control(), 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(action);

    keydown(action, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(control());

    keydown(control(), 'Tab');
    keydown(document.activeElement!, 'Escape');
    expect(chip()).toBeNull();
    expect(document.activeElement).toBe(control());
  });
});

describe('Saved: recycled posts and navigation', () => {
  it('re-targets the control and drops its overlay when X reuses the post element', async () => {
    const background = await start(post(ID, true));
    control().click();
    background.finishSave();
    await settle();
    expect(chip()).not.toBeNull();
    const before = control();
    document
      .querySelector('a[href$="/status/' + ID + '"]')!
      .setAttribute('href', 'https://x.com/texter/status/1100000000000000002');
    await settle();
    expect(control()).toBe(before);
    expect(document.querySelectorAll('.bx-control')).toHaveLength(1);
    expect(chip()).toBeNull();
    expect(control().getAttribute('aria-pressed')).toBe('false');
  });

  it('closes an open overlay when the page changes', async () => {
    const background = await start(post(ID, true));
    control().click();
    background.finishSave();
    await settle();
    expect(chip()).not.toBeNull();
    history.pushState({}, '', '/elonmusk');
    runtime.routes.check();
    expect(chip()).toBeNull();
  });
});

describe('Saved: runtime disposal', () => {
  it('takes its controls, overlay and accent style off the page', async () => {
    const background = await start(post(ID, true));
    control().click();
    background.finishSave();
    await settle();
    expect(document.getElementById('bx-accent')).not.toBeNull();
    scope.dispose();
    expect(document.querySelector('.bx-control')).toBeNull();
    expect(chip()).toBeNull();
    expect(document.getElementById('bx-accent')).toBeNull();
    expect(document.documentElement.hasAttribute('data-bx-route')).toBe(false);
  });

  it('shows nothing when a save finishes after the script was taken down', async () => {
    const background = await start(post(ID, true));
    control().click();
    await settle();
    scope.dispose();
    background.finishSave();
    await settle();
    expect(chip()).toBeNull();
    expect(document.querySelector('.bx-control')).toBeNull();
  });
});
