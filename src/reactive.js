/**
 * Optional reactivity for dodo.
 *
 * Nothing in dodo's core imports this module, and this module only ever reads
 * the public dodo API it is handed. It is safe to ignore entirely.
 *
 * Everything here is built on one small protocol, the **Cell**:
 *
 *     { onDirty(fn) -> unsubscribe, getValue() -> any, hasValue?() -> boolean }
 *
 * `onDirty` registers a callback that fires when the value *may* have changed,
 * and `getValue` pulls the current value. Optional `hasValue()` reports whether
 * a value is available, independently of what that value is. It is
 * deliberately push-to-invalidate / pull-to-read: dodo can coalesce any number
 * of invalidations into a single render and then read once.
 *
 * Because the contract is this small, most reactive libraries adapt to it in a
 * few lines. `fromObservable`, `fromSubscribe` and `fromSignal` cover the
 * common shapes (RxJS-style observables, callback subscriptions such as Svelte
 * stores, and preact signals respectively).
 *
 * `hasValue() === false` makes `watch` render its placeholder without reading
 * the value. Errors are reported by throwing from `getValue()` or `hasValue()`.
 * Cells without the hook retain the deprecated `PENDING` fallback.
 */

import {settings as resolveSettings} from './settings.js';

/** @deprecated Implement hasValue() instead. Only legacy cells without the hook interpret this value as pending. */
export const PENDING = Symbol('dodo.reactive.PENDING');

const NOTHING = Symbol('dodo.reactive.NOTHING');
const UNAVAILABLE = Symbol('dodo.reactive.UNAVAILABLE');

/** Duck-types a Cell. Anything with both methods qualifies. */
export function isCell(value) {
  return (
    value != null && typeof value.onDirty === 'function' && typeof value.getValue === 'function'
  );
}

/** Reads a Cell, passing plain values straight through. */
export function readCell(value) {
  return isCell(value) ? value.getValue() : value;
}

// Availability is an independent part of the protocol. In particular, a
// hook-aware cell can hold undefined or even the deprecated symbol as data.
function hasCellValue(source) {
  if (!isCell(source)) return true;
  return typeof source.hasValue === 'function' ? source.hasValue() : source.getValue() !== PENDING;
}

function pull(source) {
  if (!isCell(source)) return source;
  if (typeof source.hasValue === 'function') {
    return source.hasValue() ? source.getValue() : UNAVAILABLE;
  }
  const value = source.getValue();
  return value === PENDING ? UNAVAILABLE : value;
}

function toUnsubscribe(subscription) {
  if (typeof subscription === 'function') return subscription;
  if (subscription && typeof subscription.unsubscribe === 'function') {
    return () => subscription.unsubscribe();
  }
  return () => {};
}

/**
 * A listener set plus a safe fan-out, for writing your own cells:
 *
 *     const {listeners, notify} = notifier();
 */
export function notifier() {
  const listeners = new Set();
  return {
    listeners,
    notify() {
      // Copied because a listener may unsubscribe itself while being notified.
      for (const listener of Array.from(listeners)) {
        try {
          listener();
        } catch (err) {
          console.error('Error in dodo cell listener:', err);
        }
      }
    },
  };
}

/**
 * Shared plumbing for adapted cells: connect to the upstream source on the
 * first listener and disconnect on the last. Staying disconnected while nobody
 * is listening is what keeps adapted sources from leaking subscriptions once
 * their `watch` has been detached — cleanup is structural rather than something
 * every adapter has to remember.
 *
 * `connect` receives a `notify` callback and returns either an unsubscribe
 * function or `{unsubscribe}`. `read` supplies `getValue`, and should cope with
 * being called while disconnected. The optional third callback supplies
 * `hasValue()` and defaults to always ready.
 *
 *     const online = connectable(
 *       notify => {
 *         addEventListener('online', notify);
 *         addEventListener('offline', notify);
 *         return () => {
 *           removeEventListener('online', notify);
 *           removeEventListener('offline', notify);
 *         };
 *       },
 *       () => navigator.onLine,
 *     );
 */
export function connectable(connect, read, hasValue = () => true) {
  const {listeners, notify} = notifier();
  let disconnect = null;

  return {
    onDirty(fn) {
      listeners.add(fn);
      if (listeners.size === 1) {
        try {
          disconnect = toUnsubscribe(connect(notify));
        } catch (err) {
          // Leaving the listener in place would make the cell look connected
          // for good, so a later subscriber would never retry.
          listeners.delete(fn);
          throw err;
        }
      }
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        listeners.delete(fn);
        if (listeners.size === 0 && disconnect) {
          const stop = disconnect;
          disconnect = null;
          stop();
        }
      };
    },
    getValue() {
      return read();
    },
    hasValue() {
      return hasValue();
    },
  };
}

/**
 * A writable cell. The simplest possible source, and enough on its own for
 * applications that do not want another dependency.
 *
 *     const count = cell(0);
 *     count.setValue(1);
 *     count.update(n => n + 1);
 */
export function cell(initialValue) {
  let value = initialValue;
  const {listeners, notify} = notifier();

  return {
    onDirty(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getValue() {
      return value;
    },
    hasValue() {
      return true;
    },
    setValue(newValue) {
      if (Object.is(newValue, value)) return;
      value = newValue;
      notify();
    },
    update(fn) {
      this.setValue(fn(value));
    },
  };
}

/** A cell that never changes. Useful for filling a slot in `derive`. */
export function constant(value) {
  return {
    onDirty() {
      return () => {};
    },
    getValue() {
      return value;
    },
    hasValue() {
      return true;
    },
  };
}

/**
 * Derives a cell from other cells (or plain values).
 *
 *     const total = derive([price, qty], (p, q) => p * q);
 *
 * The result is memoised while subscribed: `compute` runs on the first read
 * after an upstream invalidation and not again until the next one. If any
 * dependency has no value, the derived cell has none either and `compute` is
 * not called at all. `hasValue()` checks readiness without running `compute`.
 */
export function derive(dependencies, compute) {
  const deps = Array.isArray(dependencies) ? dependencies : [dependencies];
  const {listeners, notify} = notifier();
  let unsubscribes = null;
  let cached = NOTHING;

  const invalidate = () => {
    cached = NOTHING;
    notify();
  };

  const recompute = () => {
    const values = new Array(deps.length);
    for (let i = 0; i < deps.length; i++) {
      const value = pull(deps[i]);
      if (value === UNAVAILABLE) return UNAVAILABLE;
      values[i] = value;
    }
    return compute(...values);
  };

  return {
    onDirty(fn) {
      listeners.add(fn);
      if (listeners.size === 1) {
        cached = NOTHING;
        unsubscribes = deps.map(dep => (isCell(dep) ? dep.onDirty(invalidate) : null));
      }
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        listeners.delete(fn);
        if (listeners.size === 0 && unsubscribes) {
          for (const unsubscribe of unsubscribes) unsubscribe?.();
          unsubscribes = null;
          cached = NOTHING;
        }
      };
    },
    getValue() {
      // Without listeners there is nothing telling us when the cache went
      // stale, so an unsubscribed derived cell always recomputes.
      if (cached === NOTHING || !unsubscribes) {
        cached = recompute();
      }
      return cached === UNAVAILABLE ? undefined : cached;
    },
    hasValue() {
      return deps.every(hasCellValue);
    },
  };
}

/** Convenience for the single dependency case. */
export function mapCell(source, fn) {
  return derive([source], fn);
}

/**
 * Adapts an observer-style observable: `subscribe({next, error, complete})`,
 * as produced by RxJS, the TC39 proposal, and bones' own `Observable`.
 *
 * The cell has no value until the first emission unless `initial` is supplied
 * (even explicit undefined). Errors are thrown from reads and readiness checks.
 */
export function fromObservable(observable, options = {}) {
  return fromSource(observable, options, (source, handlers) =>
    source.subscribe({
      next: handlers.next,
      error: handlers.error,
      complete: handlers.complete,
    }),
  );
}

/**
 * Adapts a callback-style subscription: `subscribe(value => ...)` returning
 * either an unsubscribe function or `{unsubscribe}`. This covers Svelte stores,
 * preact signals' own `.subscribe`, and most hand-rolled stores.
 */
export function fromSubscribe(subscribable, options = {}) {
  return fromSource(subscribable, options, (source, handlers) => {
    const subscribe = typeof source === 'function' ? source : source.subscribe.bind(source);
    return subscribe(handlers.next);
  });
}

function fromSource(source, options, subscribe) {
  let value = options.initial;
  let received = Object.hasOwn(options, 'initial');
  let failure = NOTHING;

  const cellApi = connectable(
    notify => {
      const handlers = {
        next(newValue) {
          value = newValue;
          received = true;
          failure = NOTHING;
          notify();
        },
        error(err) {
          failure = err;
          notify();
        },
        complete() {},
      };
      return subscribe(source, handlers);
    },
    () => {
      if (failure !== NOTHING) throw failure;
      return value;
    },
    () => {
      if (failure !== NOTHING) throw failure;
      return received;
    },
  );

  return cellApi;
}

/**
 * Adapts a preact signal (`@preact/signals-core` and friends).
 *
 * Reads go through `signal.peek()`, so consuming a signal through a cell never
 * registers a tracking dependency on whatever effect happens to be running, and
 * the cell can never hand back a stale copy of the signal's value.
 *
 * Invalidation uses `signal.subscribe` when available; pass `{effect}` (the
 * library's own `effect` function) if you would rather drive it that way, or if
 * you are adapting a computed from a build that has no `subscribe`.
 */
export function fromSignal(signal, {effect} = {}) {
  if (signal == null || (typeof signal !== 'object' && typeof signal !== 'function')) {
    throw new TypeError('fromSignal expects a signal object');
  }
  const read = typeof signal.peek === 'function' ? () => signal.peek() : () => signal.value;

  return connectable(notify => {
    // Both `effect` and `signal.subscribe` invoke their callback once up front.
    // That first call carries no news — the consumer is about to pull anyway —
    // so it is swallowed to avoid an immediate redundant render.
    let primed = false;
    const onChange = () => {
      if (!primed) {
        primed = true;
        return;
      }
      notify();
    };

    if (typeof effect === 'function') {
      return effect(() => {
        signal.value; // establishes the dependency
        onChange();
      });
    }
    if (typeof signal.subscribe === 'function') {
      return signal.subscribe(onChange);
    }
    throw new TypeError('fromSignal needs either signal.subscribe or an {effect} option');
  }, read);
}

/**
 * Exposes a cell as a minimal observer-style observable, for handing dodo state
 * back to code that speaks that protocol.
 */
export function toObservable(source) {
  return {
    subscribe(observerOrNext) {
      const observer =
        typeof observerOrNext === 'function' ? {next: observerOrNext} : (observerOrNext ?? {});
      const emit = () => {
        let value;
        try {
          value = pull(source);
        } catch (err) {
          observer.error?.(err);
          return;
        }
        if (value !== UNAVAILABLE) observer.next?.(value);
      };
      const unsubscribe = isCell(source) ? source.onDirty(emit) : () => {};
      emit();
      return {unsubscribe};
    },
  };
}

/**
 * Runs `fn` with the cell's value now and again on every change. Returns a
 * dispose function. This is the escape hatch for reacting to state outside of
 * rendering (logging, persistence, imperative DOM work).
 */
export function effect(source, fn) {
  const run = () => {
    let value;
    try {
      value = pull(source);
    } catch (err) {
      console.error('Error reading cell in effect:', err);
      return;
    }
    if (value === UNAVAILABLE) return;
    fn(value);
  };
  const unsubscribe = isCell(source) ? source.onDirty(run) : () => {};
  run();
  return unsubscribe;
}

const WATCH_STATE = Symbol('dodo.reactive.watch');

/**
 * Builds the dodo-aware half of the module: the `watch` component.
 *
 *     const {watch} = reactive({dodo});
 *
 * Settings:
 *
 * | setting       | purpose                                                  |
 * | ------------- | -------------------------------------------------------- |
 * | `dodo`        | the instance to render into (required)                    |
 * | `schedule`    | how re-renders are deferred and coalesced                 |
 * | `renderError` | the fallback error view, when `watch` is given no `error` |
 *
 * Each call builds a new `watch`, and a `special` component's identity is its
 * descriptor object. Build one per application and pass it around — in
 * particular, hand it to `context` — rather than calling this per module.
 *
 * Cells themselves are instance-independent; only `watch` needs to know which
 * dodo it renders into.
 */
export default function reactiveFactory(userSettings) {
  const settings = resolveSettings(userSettings);
  const {dodo, schedule, renderError} = settings;
  const {special, reconcile} = dodo;
  const rawMapGet = settings.mapGet ?? ((m, k) => m[k]);
  // `options` is optional at every call site, and a custom `mapGet` is under no
  // obligation to tolerate a nullish map.
  const mapGet = (map, key) => (map == null ? undefined : rawMapGet(map, key));
  const shouldUpdate = settings.shouldUpdate ?? ((a, b) => a !== b);

  const watch = special({
    attach(element) {
      element[WATCH_STATE] = {
        source: NOTHING,
        builder: null,
        placeholder: undefined,
        errorBuilder: undefined,
        unsubscribe: null,
        abortController: null,
        renderScheduled: false,
        lastValue: NOTHING,
        lastBuilder: NOTHING,
      };
    },

    update(element, [source, builder, options]) {
      const state = element[WATCH_STATE];
      if (!state) return;

      state.builder = builder;
      state.placeholder = mapGet(options, 'placeholder');
      state.errorBuilder = mapGet(options, 'error');

      if (state.source !== source) {
        state.unsubscribe?.();
        state.unsubscribe = null;
        state.abortController?.abort();
        state.abortController = new AbortController();
        state.source = source;
        state.lastValue = NOTHING;
        if (isCell(source)) {
          try {
            // Subscribing can emit synchronously (a subject replaying its
            // current value), which schedules a render that the direct call
            // below then finds nothing left to do for.
            state.unsubscribe = source.onDirty(() => this.invalidate(element));
          } catch (err) {
            // Connecting is as much a part of reading the cell as getValue is —
            // an adapter with no observer to attach to fails here, not there.
            this.renderError(element, err);
            return;
          }
        }
      }

      this.render(element);
    },

    invalidate(element) {
      const state = element[WATCH_STATE];
      if (!state || state.renderScheduled) return;
      state.renderScheduled = true;
      schedule(() => this.render(element), {signal: state.abortController?.signal});
    },

    render(element) {
      const state = element[WATCH_STATE];
      if (!state) return;
      state.renderScheduled = false;

      let value;
      try {
        value = pull(state.source === NOTHING ? undefined : state.source);
      } catch (err) {
        this.renderError(element, err);
        return;
      }

      // Re-rendering identical output is the common case for a cell shared by
      // several watchers, so it is worth short-circuiting before the builder runs.
      if (
        state.builder === state.lastBuilder &&
        state.lastValue !== NOTHING &&
        !shouldUpdate(state.lastValue, value)
      ) {
        return;
      }
      state.lastValue = value;
      state.lastBuilder = state.builder;

      try {
        if (value === UNAVAILABLE) {
          reconcile(element, state.placeholder ? [state.placeholder()] : []);
        } else {
          reconcile(element, [state.builder(value)]);
        }
      } catch (err) {
        this.renderError(element, err);
      }
    },

    renderError(element, error) {
      const state = element[WATCH_STATE];
      if (!state) return;
      state.lastValue = NOTHING;
      state.lastBuilder = NOTHING;
      console.error('Error in watched cell:', error);
      try {
        reconcile(element, [(state.errorBuilder ?? renderError)(error)]);
      } catch (err) {
        console.error('Error rendering the error view:', err);
      }
    },

    detach(element) {
      const state = element[WATCH_STATE];
      if (!state) return;
      state.unsubscribe?.();
      state.abortController?.abort();
      delete element[WATCH_STATE];
      reconcile(element, null);
    },
  });

  return {watch};
}
