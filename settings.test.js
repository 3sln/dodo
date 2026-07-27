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
  test('context renders through an injected reactive api', () => {
    const {watch} = reactiveFactory({dodo: defaultDodo});
    const api = contextFactory({dodo: defaultDodo, reactive: {watch}});
    expect(api.watch).toBe(watch);
  });

  test('context builds its own watch when none is injected', () => {
    const api = contextFactory({dodo: defaultDodo});
    expect(typeof api.watch).toBe('function');
    expect(api.watch).not.toBe(reactiveFactory({dodo: defaultDodo}).watch);
  });

  test('the injected watch is the one consumers actually render with', () => {
    const rendered = [];
    const {watch: realWatch} = reactiveFactory({dodo: defaultDodo});
    const spyWatch = (...args) => {
      rendered.push(args);
      return realWatch(...args);
    };
    const {withContext, useContext} = contextFactory({
      dodo: defaultDodo,
      reactive: {watch: spyWatch},
    });

    defaultDodo.reconcile(container, [
      withContext(
        {color: 'red'},
        useContext(['color'], d => h('p', null, d.color)),
      ),
    ]);

    expect(container.textContent).toBe('red');
    expect(rendered.length).toBe(1);
  });

  test('rejects an injected reactive api with no watch', () => {
    expect(() => contextFactory({dodo: defaultDodo, reactive: {}})).toThrow(
      'must provide a watch component',
    );
  });

  test('the bundled entry points share one watch', async () => {
    const [reactiveEntry, contextEntry] = await Promise.all([
      import('./reactive.js'),
      import('./context.js'),
    ]);
    expect(contextEntry.watch).toBe(reactiveEntry.watch);
  });

  test('each factory call builds a distinct component', () => {
    expect(reactiveFactory({dodo: defaultDodo}).watch).not.toBe(
      reactiveFactory({dodo: defaultDodo}).watch,
    );
  });

  test('accepts a bare dodo instance in place of settings', () => {
    expect(typeof reactiveFactory(defaultDodo).watch).toBe('function');
    expect(typeof contextFactory(defaultDodo).useContext).toBe('function');
  });

  test('requires a dodo instance', () => {
    expect(() => reactiveFactory({})).toThrow('a dodo instance must be provided');
    expect(() => reactiveFactory(null)).toThrow('a dodo instance must be provided');
    expect(() => contextFactory({dodo: {}})).toThrow('a dodo instance must be provided');
  });

  test('works with a frozen settings object', () => {
    const userSettings = Object.freeze({dodo: defaultDodo});
    expect(typeof reactiveFactory(userSettings).watch).toBe('function');
    expect(typeof contextFactory(userSettings).useContext).toBe('function');
  });

  test('map settings always come from the dodo instance', () => {
    const mine = () => 'mine';
    const resolved = settings({dodo: defaultDodo, mapGet: mine});
    expect(resolved.mapGet).toBe(defaultDodo.settings.mapGet);
    expect(resolved.mapGet).not.toBe(mine);
  });

  test('an injected reactive api inherits nothing from context settings', () => {
    // The injected watch keeps its own scheduler; context does not re-wrap it.
    const queued = [];
    const {watch} = reactiveFactory({dodo: defaultDodo, schedule: fn => queued.push(fn)});
    const api = contextFactory({dodo: defaultDodo, reactive: {watch}, schedule: fn => fn()});
    expect(api.watch).toBe(watch);
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
