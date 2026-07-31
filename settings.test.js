import {test, expect, describe, beforeEach, mock, createRealm} from './test-helpers.js';
import * as defaultDodo from './index.js';
import {dodo as dodoFactory, h} from './index.js';
import reactiveFactory, {cell} from './src/reactive.js';
import contextFactory from './src/context.js';
import {settings} from './src/settings.js';

let window;
let document;

let container;

beforeEach(() => {
  ({window, document} = createRealm());
  defaultDodo.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

describe('module factory pattern', () => {
  const reactiveFor = () => reactiveFactory({dodo: defaultDodo});

  test('context requires an injected reactive api', () => {
    expect(() => contextFactory({dodo: defaultDodo})).toThrow(
      'context() requires a reactive API providing a watch component',
    );
    expect(() => contextFactory({dodo: defaultDodo, reactive: {}})).toThrow(
      'context() requires a reactive API providing a watch component',
    );
    expect(() => contextFactory(defaultDodo)).toThrow(
      'context() requires a reactive API providing a watch component',
    );
  });

  test('context does not re-export the reactive api', () => {
    const api = contextFactory({dodo: defaultDodo, reactive: reactiveFor()});
    expect(api.watch).toBeUndefined();
    expect(Object.keys(api).sort()).toEqual([
      'attachContext',
      'contextCell',
      'detachContext',
      'readContext',
      'updateContext',
      'useContext',
      'withContext',
      'withEncapsulatedContext',
    ]);
  });

  test('consumers render through the injected watch', () => {
    const rendered = [];
    const {watch: realWatch} = reactiveFor();
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
        useContext(['color'], d => h('p', d.color)),
      ),
    ]);

    expect(container.textContent).toBe('red');
    expect(rendered.length).toBe(1);
  });

  test('the bundled context entry point uses the bundled watch', async () => {
    const [reactiveEntry, contextEntry] = await Promise.all([
      import('./reactive.js'),
      import('./context.js'),
    ]);
    expect(typeof reactiveEntry.watch).toBe('function');
    expect(contextEntry.watch).toBeUndefined();

    // The components work, which is only possible with a valid injected watch.
    defaultDodo.reconcile(container, [
      contextEntry.withContext(
        {v: 'ok'},
        contextEntry.useContext(['v'], d => h('p', d.v)),
      ),
    ]);
    expect(container.textContent).toBe('ok');
  });

  test('each factory call builds a distinct component', () => {
    expect(reactiveFor().watch).not.toBe(reactiveFor().watch);
  });

  test('reactive accepts a bare dodo instance in place of settings', () => {
    expect(typeof reactiveFactory(defaultDodo).watch).toBe('function');
  });

  test('requires a dodo instance', () => {
    expect(() => reactiveFactory({})).toThrow('a dodo instance must be provided');
    expect(() => reactiveFactory(null)).toThrow('a dodo instance must be provided');
    expect(() => contextFactory({dodo: {}})).toThrow('a dodo instance must be provided');
  });

  test('works with a frozen settings object', () => {
    const userSettings = Object.freeze({dodo: defaultDodo, reactive: reactiveFor()});
    expect(typeof contextFactory(userSettings).useContext).toBe('function');
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
    defaultDodo.reconcile(container, [watch(c, v => h('p', v))]);
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
    defaultDodo.reconcile(container, [watch(c, v => h('p', String(v)))]);
    c.setValue(2);
    expect(container.textContent).toBe('2');
  });
});

describe('pluggable error view', () => {
  test('watch falls back to the settings renderError', () => {
    const renderError = mock(err => h('b', `custom: ${err.message}`));
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
      defaultDodo.reconcile(container, [watch(failing, () => h('p', 'never'))]);
    } finally {
      console.error = consoleError;
    }
    expect(container.textContent).toBe('custom: nope');
    expect(renderError).toHaveBeenCalledTimes(1);
  });
});
