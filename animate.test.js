import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import * as dodo from './index.js';
import reactiveFactory from './src/reactive.js';
import animateFactory, {
  DESPAWNED,
  DESPAWNING,
  SPAWNED,
  SPAWNING,
  computedAnimationDuration,
  runAnimation,
} from './src/animate.js';

const {h, reconcile, flush, clear} = dodo;

// A synchronous scheduler keeps the tests deterministic: presence renders and
// the frame that applies transition classes both land immediately.
const syncSchedule = fn => fn();
const {withPresence} = animateFactory({
  dodo,
  reactive: reactiveFactory({dodo, schedule: syncSchedule}),
  schedule: syncSchedule,
});

let container;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe('runAnimation', () => {
  let element;
  beforeEach(() => {
    element = document.createElement('div');
    container.appendChild(element);
  });

  test('resolves immediately when there is nothing to do', async () => {
    await runAnimation(element, {}, {schedule: syncSchedule});
    await runAnimation(element, null, {schedule: syncSchedule});
  });

  test('applies classes and removes them again when finished', async () => {
    const promise = runAnimation(
      element,
      {classes: ['enter'], duration: 0},
      {schedule: syncSchedule},
    );
    expect(element.classList.contains('enter')).toBe(true);
    await promise;
    expect(element.classList.contains('enter')).toBe(false);
  });

  test('applies and removes styling', async () => {
    const promise = runAnimation(
      element,
      {styling: {opacity: '0'}, duration: 0},
      {schedule: syncSchedule},
    );
    expect(element.style.getPropertyValue('opacity')).toBe('0');
    await promise;
    expect(element.style.getPropertyValue('opacity')).toBe('');
  });

  test('waits for the declared duration', async () => {
    let resolved = false;
    const promise = runAnimation(
      element,
      {classes: ['enter'], duration: 30},
      {schedule: syncSchedule},
    ).then(() => {
      resolved = true;
    });

    await tick();
    expect(resolved).toBe(false);
    await promise;
    expect(resolved).toBe(true);
  });

  test('does not hang when a transition never fires', async () => {
    // No duration declared and no computed transition: the old transitionend
    // approach would wait forever here.
    await runAnimation(element, {classes: ['enter']}, {schedule: syncSchedule});
    expect(element.classList.contains('enter')).toBe(false);
  });

  test('awaits a custom fn and hands it the signal', async () => {
    const controller = new AbortController();
    const seen = [];
    await runAnimation(
      element,
      {
        fn: (el, {signal}) => {
          seen.push({el, signal});
          return Promise.resolve();
        },
      },
      {signal: controller.signal, schedule: syncSchedule},
    );
    expect(seen.length).toBe(1);
    expect(seen[0].el).toBe(element);
    expect(seen[0].signal).toBe(controller.signal);
  });

  test('aborting stops the wait and undoes what was applied', async () => {
    const controller = new AbortController();
    const promise = runAnimation(
      element,
      {classes: ['enter'], duration: 10_000},
      {signal: controller.signal, schedule: syncSchedule},
    );
    expect(element.classList.contains('enter')).toBe(true);

    controller.abort();
    await promise;
    expect(element.classList.contains('enter')).toBe(false);
  });

  test('an already aborted signal does nothing at all', async () => {
    const controller = new AbortController();
    controller.abort();
    await runAnimation(
      element,
      {classes: ['enter'], duration: 10_000},
      {signal: controller.signal, schedule: syncSchedule},
    );
    expect(element.classList.contains('enter')).toBe(false);
  });

  test('cancels a web animation when aborted', async () => {
    const cancel = mock();
    let settle;
    element.animate = () => ({
      playState: 'running',
      finished: new Promise(resolve => {
        settle = resolve;
      }),
      cancel,
    });

    const controller = new AbortController();
    const promise = runAnimation(
      element,
      {animation: {keyframes: [{opacity: 0}], options: {duration: 10_000}}},
      {signal: controller.signal, schedule: syncSchedule},
    );
    controller.abort();
    await promise;
    expect(cancel).toHaveBeenCalledTimes(1);
    settle?.();
  });
});

describe('computedAnimationDuration', () => {
  test('reads the longest transition or animation time', () => {
    const element = document.createElement('div');
    container.appendChild(element);
    element.style.setProperty('transition-duration', '0.2s, 100ms');
    element.style.setProperty('transition-delay', '50ms');
    expect(computedAnimationDuration(element)).toBe(250);
  });

  test('is zero when nothing is declared', () => {
    const element = document.createElement('div');
    container.appendChild(element);
    expect(computedAnimationDuration(element)).toBe(0);
  });
});

describe('withPresence', () => {
  const render = (present, config, builder = phase => h('p', null, phase)) =>
    reconcile(container, [withPresence(present, builder, config)]);

  test('animates in on first render and reports its phases', async () => {
    const phases = [];
    render(true, {spawn: {classes: ['enter'], duration: 0}}, phase => {
      phases.push(phase);
      return h('p', null, phase);
    });

    expect(container.textContent).toBe(SPAWNING);
    await tick();
    flush();
    expect(container.textContent).toBe(SPAWNED);
    expect(phases).toEqual([SPAWNING, SPAWNED]);
  });

  test('starts hidden and silent when it begins absent', () => {
    render(false, {});
    expect(container.textContent).toBe(DESPAWNED);
    expect(container.firstChild.style.display).toBe('none');
  });

  test('animates out and hides when presence is withdrawn', async () => {
    render(true, {despawn: {classes: ['leave'], duration: 0}});
    await tick();
    flush();

    render(false, {despawn: {classes: ['leave'], duration: 0}});
    expect(container.textContent).toBe(DESPAWNING);
    expect(container.firstChild.style.display).not.toBe('none');

    await tick();
    flush();
    expect(container.textContent).toBe(DESPAWNED);
    expect(container.firstChild.style.display).toBe('none');
  });

  test('renders nothing once despawned in remove mode', async () => {
    const config = {mode: 'remove', despawn: {duration: 0}};
    render(true, config);
    await tick();
    flush();
    expect(container.textContent).toBe(SPAWNED);

    render(false, config);
    await tick();
    flush();
    expect(container.textContent).toBe('');
  });

  test('a reversal mid animation wins and the stale one cannot land', async () => {
    const config = {
      spawn: {classes: ['enter'], duration: 10_000},
      despawn: {classes: ['leave'], duration: 0},
    };

    render(true, config);
    expect(container.textContent).toBe(SPAWNING);
    const node = container.firstChild;
    expect(node.classList.contains('enter')).toBe(true);

    // Reverse while the entrance is still running.
    render(false, config);
    expect(container.textContent).toBe(DESPAWNING);
    // The aborted entrance cleaned up after itself.
    expect(node.classList.contains('enter')).toBe(false);

    await tick();
    flush();
    expect(container.textContent).toBe(DESPAWNED);

    // Give the abandoned 10s entrance every chance to clobber the result.
    await tick();
    flush();
    expect(container.textContent).toBe(DESPAWNED);
  });

  test('does not restart the animation when other args change', async () => {
    const spawn = {classes: ['enter'], duration: 0};
    render(true, {spawn});
    await tick();
    flush();
    expect(container.textContent).toBe(SPAWNED);

    // Same presence, new builder: no new transition, so the phase holds.
    render(true, {spawn}, phase => h('p', null, `${phase}!`));
    expect(container.textContent).toBe(`${SPAWNED}!`);
  });

  test('gives its node the configured display while present', () => {
    render(true, {display: 'flex', spawn: {duration: 0}});
    expect(container.firstChild.style.display).toBe('flex');
  });

  test('aborts and tears down its subtree when detached', async () => {
    const detached = mock();
    render(true, {spawn: {classes: ['enter'], duration: 10_000}}, phase =>
      h('p', null, phase).on({$detach: detached}),
    );
    const node = container.firstChild;
    expect(node.classList.contains('enter')).toBe(true);

    reconcile(container, null);
    expect(detached).toHaveBeenCalledTimes(1);
    expect(node.classList.contains('enter')).toBe(false);

    await tick();
    flush();
  });

  test('builds a fresh spec per element rather than sharing one', async () => {
    // Bones reused a single result object here, so the most recently attached
    // element's config won for every other element too.
    const first = document.createElement('div');
    const second = document.createElement('div');
    container.append(first, second);

    reconcile(first, [
      withPresence(true, p => h('p', null, p), {spawn: {classes: ['a'], duration: 10_000}}),
    ]);
    reconcile(second, [
      withPresence(true, p => h('p', null, p), {spawn: {classes: ['b'], duration: 10_000}}),
    ]);

    expect(first.firstChild.classList.contains('a')).toBe(true);
    expect(first.firstChild.classList.contains('b')).toBe(false);
    expect(second.firstChild.classList.contains('b')).toBe(true);
    expect(second.firstChild.classList.contains('a')).toBe(false);

    reconcile(first, null);
    reconcile(second, null);
    await tick();
  });
});

describe('animate factory', () => {
  test('requires an injected reactive api', () => {
    expect(() => animateFactory({dodo})).toThrow(
      'animate() requires a reactive API providing a watch component',
    );
  });

  test('requires a dodo instance', () => {
    expect(() => animateFactory({reactive: {watch: () => {}}})).toThrow(
      'a dodo instance must be provided',
    );
  });
});
