import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import * as defaultDodo from './index.js';
import {dodo as dodoFactory, h} from './index.js';
import reactiveFactory, {cell} from './src/reactive.js';
import contextFactory from './src/context.js';
import {settings} from './src/settings.js';

let container;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  defaultDodo.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

describe('module factory pattern', () => {
  test('memoises the api against the settings object', () => {
    const userSettings = {dodo: defaultDodo};
    expect(reactiveFactory(userSettings)).toBe(reactiveFactory(userSettings));
    expect(contextFactory(userSettings)).toBe(contextFactory(userSettings));
  });

  test('shares one watch between reactive and context', () => {
    const userSettings = {dodo: defaultDodo};
    expect(contextFactory(userSettings).watch).toBe(reactiveFactory(userSettings).watch);
  });

  test('the bundled entry points share one watch', async () => {
    const [reactiveEntry, contextEntry] = await Promise.all([
      import('./reactive.js'),
      import('./context.js'),
    ]);
    expect(contextEntry.watch).toBe(reactiveEntry.watch);
  });

  test('accepts a bare dodo instance and memoises against it too', () => {
    expect(reactiveFactory(defaultDodo)).toBe(reactiveFactory(defaultDodo));
    expect(contextFactory(defaultDodo).watch).toBe(reactiveFactory(defaultDodo).watch);
  });

  test('separate settings objects build separate apis', () => {
    expect(reactiveFactory({dodo: defaultDodo})).not.toBe(reactiveFactory({dodo: defaultDodo}));
  });

  test('requires a dodo instance', () => {
    expect(() => reactiveFactory({})).toThrow('a dodo instance must be provided');
    expect(() => reactiveFactory(null)).toThrow('a dodo instance must be provided');
    expect(() => contextFactory({dodo: {}})).toThrow('a dodo instance must be provided');
  });

  test('works with a frozen settings object', () => {
    const userSettings = Object.freeze({dodo: defaultDodo});
    expect(reactiveFactory(userSettings)).toBe(reactiveFactory(userSettings));
  });

  test('map settings always come from the dodo instance', () => {
    const mine = () => 'mine';
    const resolved = settings({dodo: defaultDodo, mapGet: mine});
    expect(resolved.mapGet).toBe(defaultDodo.settings.mapGet);
    expect(resolved.mapGet).not.toBe(mine);
  });
});

describe('pluggable scheduler', () => {
  test('dodo() accepts a replacement scheduler', () => {
    const tasks = [];
    const scheduler = {
      schedule: fn => tasks.push(fn),
      flush: () => tasks.splice(0).forEach(fn => fn()),
      clear: () => tasks.splice(0),
    };
    const custom = dodoFactory({scheduler});
    const ran = mock();
    custom.schedule(ran);
    expect(tasks.length).toBe(1);
    expect(ran).not.toHaveBeenCalled();
    custom.flush();
    expect(ran).toHaveBeenCalledTimes(1);
  });

  test('watch renders through the settings scheduler', () => {
    const queued = [];
    const {watch} = reactiveFactory({
      dodo: defaultDodo,
      schedule: fn => queued.push(fn),
    });

    const c = cell('a');
    defaultDodo.reconcile(container, [watch(c, v => h('p', null, v))]);
    expect(container.textContent).toBe('a');

    c.setValue('b');
    // Dodo's own scheduler was bypassed entirely.
    defaultDodo.flush();
    expect(container.textContent).toBe('a');
    expect(queued.length).toBe(1);

    queued.forEach(fn => fn());
    expect(container.textContent).toBe('b');
  });

  test('a synchronous scheduler makes watch render eagerly', () => {
    const {watch} = reactiveFactory({dodo: defaultDodo, schedule: fn => fn()});
    const c = cell(1);
    defaultDodo.reconcile(container, [watch(c, v => h('p', null, String(v)))]);
    c.setValue(2);
    expect(container.textContent).toBe('2');
  });
});

describe('pluggable error view', () => {
  test('watch falls back to the settings renderError', () => {
    const renderError = mock(err => h('b', null, `custom: ${err.message}`));
    const {watch} = reactiveFactory({dodo: defaultDodo, renderError});
    const failing = {
      onDirty: () => () => {},
      getValue() {
        throw new Error('nope');
      },
    };

    const consoleError = console.error;
    console.error = () => {};
    try {
      defaultDodo.reconcile(container, [watch(failing, () => h('p', null, 'never'))]);
    } finally {
      console.error = consoleError;
    }
    expect(container.textContent).toBe('custom: nope');
    expect(renderError).toHaveBeenCalledTimes(1);
  });
});
