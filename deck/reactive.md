# Reactivity

`@3sln/dodo/reactive` is an **optional** module. Dodo's core does not import it,
does not know it exists, and works exactly the same whether or not you use it.
Bring your own reactivity if you already have one — this module is here so that
you do not have to, and so that whatever you do bring plugs in cleanly.

## The Cell protocol

Everything in this module is built on one small interface:

```javascript
{
  onDirty(fn) -> unsubscribe,  // fn is called when the value may have changed
  getValue()  -> any           // the current value
}
```

That is the whole contract. It is deliberately *push to invalidate, pull to
read*: a source announces that something changed, and dodo decides when to
actually read it. That split is what lets a burst of updates collapse into a
single render.

Dodo does not depend on the observable protocol, on signals, or on any other
library. It depends on this. Adapters bridge the rest.

Two values carry special meaning:

- `PENDING` — no value yet. `watch` renders its placeholder instead of calling
  your builder.
- An error is reported by **throwing from `getValue()`**. `watch` catches it and
  renders its error view.

## Sources

### `cell(initialValue)`

A writable cell. Enough on its own for most applications.

```javascript
import {cell} from '@3sln/dodo/reactive';

const count = cell(0);

count.getValue();       // 0
count.setValue(5);
count.update(n => n + 1);
```

### `derive(dependencies, compute)`

A read-only cell computed from other cells (plain values are allowed too). The
result is memoised while something is subscribed, so `compute` runs once per
upstream change rather than once per read. If any dependency is `PENDING` the
derived cell is `PENDING` and `compute` is not called at all.

```javascript
const price = cell(10);
const qty = cell(3);
const total = derive([price, qty], (p, q) => p * q);
```

`mapCell(source, fn)` is the single dependency shorthand, and `constant(value)`
is a cell that never changes.

## Rendering with `watch`

```javascript
import {cell, watch} from '@3sln/dodo/reactive';
import {reconcile, p} from '@3sln/dodo';

const name = cell('world');

reconcile(container, [watch(name, value => p(`hello ${value}`))]);

name.setValue('dodo'); // re-renders on the next frame
```

`watch(source, builder, options?)` takes any cell — or a plain value, which it
renders once. Options:

| option        | meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `placeholder` | `() => vnode` rendered while the source is `PENDING`            |
| `error`       | `(error) => vnode` rendered when `getValue` or `builder` throws |

Renders are scheduled through dodo's scheduler, so several changes in the same
tick produce one render. A change that leaves the value equal (by the instance's
`shouldUpdate`) does not re-render at all.

<deck-demo id="dodo-reactive-demo" src="/demos/reactive-demo.js"></deck-demo>

## Adapters

The protocol is small enough that most libraries adapt in a few lines. Three
adapters cover the usual shapes, and each one connects to its source lazily —
on the first listener — and disconnects on the last, so a detached `watch`
never leaves a subscription behind.

### `fromObservable(observable, {initial})`

For `subscribe({next, error, complete})` sources: RxJS, the TC39 proposal,
bones' `Observable`.

```javascript
import {fromObservable, watch} from '@3sln/dodo/reactive';

const user = fromObservable(user$);

watch(user, u => p(u.name), {placeholder: () => p('loading…')});
```

### `fromSubscribe(subscribable, {initial})`

For `subscribe(value => ...)` sources returning an unsubscribe function: Svelte
stores, and most hand-rolled stores.

### `fromSignal(signal, {effect})`

For preact signals. Reads go through `signal.peek()`, so consuming a signal as a
cell never registers a tracking dependency on some unrelated effect that happens
to be running. Invalidation uses `signal.subscribe` when it exists; pass the
library's own `effect` function if you would rather drive it that way.

```javascript
import {signal} from '@preact/signals-core';
import {fromSignal, watch} from '@3sln/dodo/reactive';

const count = signal(0);
watch(fromSignal(count), n => p(String(n)));
```

### Writing your own

If your source does not fit, write the object literal. That is all a cell is:

```javascript
function fromMediaQuery(query) {
  const list = window.matchMedia(query);
  return {
    onDirty(fn) {
      list.addEventListener('change', fn);
      return () => list.removeEventListener('change', fn);
    },
    getValue: () => list.matches,
  };
}
```

`notifier()` is exported for cases where you need to fan out to several
listeners yourself.

## Going the other way

- `toObservable(cell)` exposes a cell to code that expects `subscribe`.
- `effect(cell, fn)` runs `fn` with the value now and on every change, returning
  a dispose function. Use it for work that is not rendering — persistence,
  logging, imperative DOM.
- `readCell(x)` reads a cell and passes plain values straight through.
- `isCell(x)` duck-types the protocol.

## Baking your own

The bindings exported from `@3sln/dodo/reactive` are built against dodo's
default instance. If you build your own dodo with `dodo(userSettings)`, or you
want to change how renders are scheduled, bake your own copy with the same
factory pattern the rest of the project uses:

```javascript
import reactive from '@3sln/dodo/src/reactive.js';
import context from '@3sln/dodo/src/context.js';

const {watch} = reactive({dodo: myDodo});
const {withContext, useContext} = context({dodo: myDodo, reactive: {watch}});
```

Build `watch` **once** and inject it where it is needed. Every call to
`reactive` produces a new one, and a `special` component's identity *is* its
descriptor object — the reconciler uses that identity to decide whether a DOM
node can be reused, so two separately built `watch` components would never reuse
each other's nodes.

If you would rather not wire it up, `context` returns the `watch` it uses, so
one factory call is enough:

```javascript
const {withContext, useContext, watch} = context({dodo: myDodo});
```

| setting       | default                                     |
| ------------- | ------------------------------------------- |
| `dodo`        | required                                     |
| `schedule`    | the instance's `schedule`                    |
| `renderError` | a `<pre>` with the message and stack         |
| `reactive`    | (`context` only) a private one is built      |

Map handling and change detection are not settings here — they always come from
the dodo instance, since a module that disagreed with its renderer about what a
map is would be worse than useless.

Cells themselves are instance-independent. Only `watch` needs to know which dodo
it is rendering into.

## Scheduling

By default `watch` defers renders through the dodo instance's `schedule`, so a
burst of changes in one tick collapses into a single render on the next frame.
Replace `schedule` to change that:

```javascript
// Render synchronously — handy in tests.
reactive({dodo, schedule: fn => fn()});

// Render when the browser is idle.
reactive({dodo, schedule: (fn, {signal} = {}) => {
  const id = requestIdleCallback(() => fn());
  signal?.addEventListener('abort', () => cancelIdleCallback(id));
}});
```

A `schedule` implementation receives `(fn, {signal})` and should not run `fn`
once `signal` has aborted — that is how `watch` cancels a pending render when it
is detached.

The whole scheduler is replaceable at the dodo level too, which the modules then
inherit:

```javascript
import {dodo} from '@3sln/dodo';

const myDodo = dodo({scheduler: {schedule, flush, clear}});
```
