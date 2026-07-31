import {test, expect, describe, beforeEach, mock} from 'bun:test';
import {Window} from 'happy-dom';
import * as dodo from './index.js';
import reactiveFactory, {
  PENDING,
  cell,
  constant,
  derive,
  effect,
  fromObservable,
  fromSignal,
  fromSubscribe,
  isCell,
  mapCell,
  readCell,
  toObservable,
} from './src/reactive.js';

const {h, flush, clear} = dodo;
const {watch} = reactiveFactory({dodo});

let container;

beforeEach(() => {
  globalThis.window = new Window();
  globalThis.document = window.document;
  clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

describe('cell', () => {
  test('holds a value and notifies on change', () => {
    const c = cell(1);
    const seen = mock();
    const unsubscribe = c.onDirty(seen);

    expect(c.getValue()).toBe(1);
    c.setValue(2);
    expect(c.getValue()).toBe(2);
    expect(seen).toHaveBeenCalledTimes(1);

    // Setting the same value is not a change.
    c.setValue(2);
    expect(seen).toHaveBeenCalledTimes(1);

    unsubscribe();
    c.setValue(3);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(c.getValue()).toBe(3);
  });

  test('update applies a function to the current value', () => {
    const c = cell(1);
    c.update(n => n + 1);
    expect(c.getValue()).toBe(2);
  });

  test('satisfies the Cell protocol', () => {
    expect(isCell(cell(1))).toBe(true);
    expect(isCell(constant(1))).toBe(true);
    expect(isCell(1)).toBe(false);
    expect(isCell(null)).toBe(false);
    expect(isCell({onDirty() {}})).toBe(false);
    expect(readCell(cell('a'))).toBe('a');
    expect(readCell('a')).toBe('a');
  });
});

describe('derive', () => {
  test('computes from several cells and recomputes on change', () => {
    const price = cell(2);
    const qty = cell(3);
    const compute = mock((p, q) => p * q);
    const total = derive([price, qty], compute);

    total.onDirty(() => {});
    expect(total.getValue()).toBe(6);
    // Memoised while subscribed.
    expect(total.getValue()).toBe(6);
    expect(compute).toHaveBeenCalledTimes(1);

    qty.setValue(4);
    expect(total.getValue()).toBe(8);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  test('accepts plain values alongside cells', () => {
    const c = cell(2);
    const d = derive([c, 10], (a, b) => a + b);
    expect(d.getValue()).toBe(12);
  });

  test('propagates PENDING without calling compute', () => {
    const compute = mock(x => x);
    const pending = {onDirty: () => () => {}, getValue: () => PENDING};
    const d = derive([pending], compute);
    expect(d.getValue()).toBe(PENDING);
    expect(compute).not.toHaveBeenCalled();
  });

  test('unsubscribes from its dependencies when the last listener leaves', () => {
    const source = cell(1);
    const d = mapCell(source, n => n * 2);
    const unsubscribe = d.onDirty(() => {});
    expect(d.getValue()).toBe(2);
    unsubscribe();
    // Still readable, just no longer memoised.
    source.setValue(5);
    expect(d.getValue()).toBe(10);
  });
});

describe('observable adaptors', () => {
  function subject(initial) {
    const observers = new Set();
    return {
      value: initial,
      subscribe(observer) {
        observers.add(observer);
        if (this.value !== undefined) observer.next?.(this.value);
        return {unsubscribe: () => observers.delete(observer)};
      },
      next(value) {
        this.value = value;
        for (const observer of observers) observer.next?.(value);
      },
      error(err) {
        for (const observer of observers) observer.error?.(err);
      },
      get observerCount() {
        return observers.size;
      },
    };
  }

  test('fromObservable tracks emissions and disconnects when unwatched', () => {
    const source = subject('a');
    const c = fromObservable(source);

    expect(source.observerCount).toBe(0);
    const unsubscribe = c.onDirty(() => {});
    expect(source.observerCount).toBe(1);
    expect(c.getValue()).toBe('a');

    source.next('b');
    expect(c.getValue()).toBe('b');

    unsubscribe();
    expect(source.observerCount).toBe(0);
  });

  test('fromObservable reports PENDING before the first value', () => {
    const source = subject(undefined);
    const c = fromObservable(source);
    c.onDirty(() => {});
    expect(c.getValue()).toBe(PENDING);
  });

  test('fromObservable rethrows source errors from getValue', () => {
    const source = subject('a');
    const c = fromObservable(source);
    c.onDirty(() => {});
    source.error(new Error('boom'));
    expect(() => c.getValue()).toThrow('boom');
  });

  test('fromSubscribe adapts a callback subscription', () => {
    let emit;
    let disposed = false;
    const store = {
      subscribe(fn) {
        emit = fn;
        fn('first');
        return () => {
          disposed = true;
        };
      },
    };

    const c = fromSubscribe(store);
    const unsubscribe = c.onDirty(() => {});
    expect(c.getValue()).toBe('first');
    emit('second');
    expect(c.getValue()).toBe('second');
    unsubscribe();
    expect(disposed).toBe(true);
  });

  test('toObservable exposes a cell as an observable', () => {
    const c = cell(1);
    const seen = [];
    const sub = toObservable(c).subscribe(v => seen.push(v));
    c.setValue(2);
    sub.unsubscribe();
    c.setValue(3);
    expect(seen).toEqual([1, 2]);
  });
});

describe('fromSignal', () => {
  // A stand-in with the shape of a preact signal.
  function signal(initial) {
    let value = initial;
    const subscribers = new Set();
    return {
      get value() {
        return value;
      },
      set value(next) {
        value = next;
        for (const fn of subscribers) fn(value);
      },
      peek: () => value,
      subscribe(fn) {
        subscribers.add(fn);
        fn(value);
        return () => subscribers.delete(fn);
      },
      get subscriberCount() {
        return subscribers.size;
      },
    };
  }

  test('reads through peek and invalidates on change', () => {
    const s = signal(1);
    const c = fromSignal(s);
    const dirty = mock();
    const unsubscribe = c.onDirty(dirty);

    expect(c.getValue()).toBe(1);
    // The subscribe-time callback carries no news and must not mark dirty.
    expect(dirty).not.toHaveBeenCalled();

    s.value = 2;
    expect(dirty).toHaveBeenCalledTimes(1);
    expect(c.getValue()).toBe(2);

    unsubscribe();
    expect(s.subscriberCount).toBe(0);
  });

  test('can be driven by an effect function instead', () => {
    const s = signal('x');
    let effectFn = null;
    const fakeEffect = fn => {
      effectFn = fn;
      fn();
      return () => {
        effectFn = null;
      };
    };

    const c = fromSignal(s, {effect: fakeEffect});
    const dirty = mock();
    c.onDirty(dirty);
    expect(c.getValue()).toBe('x');
    expect(dirty).not.toHaveBeenCalled();

    s.value = 'y';
    effectFn();
    expect(dirty).toHaveBeenCalledTimes(1);
    expect(c.getValue()).toBe('y');
  });
});

describe('effect', () => {
  test('runs immediately and on every change', () => {
    const c = cell(1);
    const seen = [];
    const dispose = effect(c, v => seen.push(v));
    c.setValue(2);
    dispose();
    c.setValue(3);
    expect(seen).toEqual([1, 2]);
  });
});

describe('watch', () => {
  test('renders the current value and re-renders on change', () => {
    const name = cell('world');
    dodo.reconcile(container, [watch(name, v => h('p', `hello ${v}`))]);
    expect(container.textContent).toBe('hello world');

    name.setValue('dodo');
    flush();
    expect(container.textContent).toBe('hello dodo');
  });

  test('coalesces several invalidations into one render', () => {
    const c = cell(0);
    const builder = mock(v => h('p', String(v)));
    dodo.reconcile(container, [watch(c, builder)]);
    expect(builder).toHaveBeenCalledTimes(1);

    c.setValue(1);
    c.setValue(2);
    c.setValue(3);
    flush();

    expect(builder).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('3');
  });

  test('skips the render when the value did not actually change', () => {
    const c = cell({a: 1});
    const builder = mock(v => h('p', String(v.a)));
    dodo.reconcile(container, [watch(c, builder)]);
    expect(builder).toHaveBeenCalledTimes(1);

    // A different object with equal contents is not a change.
    c.setValue({a: 1});
    flush();
    expect(builder).toHaveBeenCalledTimes(1);
  });

  test('renders the placeholder while PENDING', () => {
    const source = {
      subscribe(observer) {
        this.observer = observer;
        return {unsubscribe: () => {}};
      },
    };
    const c = fromObservable(source);
    dodo.reconcile(container, [watch(c, v => h('p', v), {placeholder: () => h('em', 'loading')})]);
    expect(container.textContent).toBe('loading');

    source.observer.next('ready');
    flush();
    expect(container.textContent).toBe('ready');
  });

  test('renders the error view when the source fails', () => {
    const failing = {
      onDirty: () => () => {},
      getValue() {
        throw new Error('nope');
      },
    };
    dodo.reconcile(container, [
      watch(failing, () => h('p', 'never'), {error: err => h('b', err.message)}),
    ]);
    expect(container.textContent).toBe('nope');
  });

  test('renders a built in error view when no error builder is given', () => {
    const failing = {
      onDirty: () => () => {},
      getValue() {
        throw new Error('kaput');
      },
    };
    dodo.reconcile(container, [watch(failing, () => h('p', 'never'))]);
    expect(container.textContent).toContain('kaput');
  });

  test('catches an error thrown by the builder', () => {
    const c = cell(1);
    dodo.reconcile(container, [
      watch(
        c,
        () => {
          throw new Error('builder blew up');
        },
        {error: err => h('b', err.message)},
      ),
    ]);
    expect(container.textContent).toBe('builder blew up');
  });

  test('unsubscribes from the cell when detached', () => {
    const c = cell(1);
    dodo.reconcile(container, [watch(c, v => h('p', String(v)))]);
    dodo.reconcile(container, null);

    c.setValue(2);
    flush();
    expect(container.textContent).toBe('');
  });

  test('switches sources without leaking the old subscription', () => {
    const first = cell('a');
    const second = cell('b');
    const builder = v => h('p', v);

    dodo.reconcile(container, [watch(first, builder)]);
    expect(container.textContent).toBe('a');

    dodo.reconcile(container, [watch(second, builder)]);
    expect(container.textContent).toBe('b');

    first.setValue('stale');
    flush();
    expect(container.textContent).toBe('b');
  });

  test('accepts a plain value as its source', () => {
    dodo.reconcile(container, [watch('static', v => h('p', v))]);
    expect(container.textContent).toBe('static');
  });
});
