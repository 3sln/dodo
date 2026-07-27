# Observing Elements

`@3sln/dodo/observe` is an **optional** module, built on
[the reactive module](/reactive.md). It turns `ResizeObserver` and
`IntersectionObserver` into Cells, so element measurements compose with
everything else reactive.

It comes in two layers, and you can use either.

## Cells

`elementSize`, `elementVisibility` and `elementIntersection` are plain functions
of an element. They have no dependency on dodo at all — read them, test them,
feed them into `derive`, ignore the components entirely.

```javascript
import {elementSize} from '@3sln/dodo/observe';

const size = elementSize(myElement);
size.getValue();               // {width, height}, measured now
const stop = size.onDirty(render);
```

Cleanup is structural: the observer is connected on the first listener and
disconnected on the last. There is no teardown step to forget, and a detached
`watch` takes its observer with it.

### `elementSize(element, options?)`

Reports a plain `{width, height}`.

Plain on purpose. Dodo's change detection treats any object that is neither an
array nor a plain object as *always changed*, so handing back a
`DOMRectReadOnly` would re-render on every observer callback. A plain object is
shallow compared, so a resize that does not change the box renders nothing.

Never `PENDING` — with no observation to hand it measures directly, so there is
no "not known yet" case to write code for.

| option   | meaning                                                            |
| -------- | ------------------------------------------------------------------ |
| `box`    | `content-box` (default), `border-box`, `device-pixel-content-box`   |
| `window` | override the realm the observer is taken from                       |

### `elementVisibility(element, options?)`

Reports a boolean, and is `PENDING` until the observer's first entry arrives.

That entry is asynchronous and there is no synchronous way to know beforehand.
Reporting `false` would be a guess, and a wrong guess shows the wrong branch for
a frame — so the honest answer is `PENDING`, paired with `watch`'s
`placeholder`. Pass `{initial: false}` if you would rather take the guess.

| option       | meaning                                                  |
| ------------ | -------------------------------------------------------- |
| `root`       | a selector resolved with `closest`, an element, or null   |
| `rootMargin` | passed through to `IntersectionObserver`                  |
| `threshold`  | passed through to `IntersectionObserver`                  |
| `initial`    | value before the first entry, `PENDING` by default        |
| `window`     | override the realm the observer is taken from             |

`elementIntersection` is the same but reports `{visible, ratio}`.

## Components

```javascript
import {withElementSize, withVisibility} from '@3sln/dodo/observe';

withElementSize(size => canvas({width: size.width, height: size.height}))

withVisibility(visible => (visible ? chart() : skeleton()), {
  root: '.scroller',
  rootMargin: '200px',
  placeholder: () => skeleton(),
})
```

Each is a thin wrapper: build the cell from the component's own DOM node, then
render `watch(cell, builder)`. Options are shallow compared, so an inline
options literal does not tear down and rebuild the observer on every render;
changing an option does rebuild it.

`placeholder` and `error` pass straight through to `watch`.

<deck-demo id="dodo-observe-demo" src="/demos/observe-demo.js"></deck-demo>

## What actually gets observed

This is the part worth understanding, because the two components deliberately
differ.

Dodo gives every `alias` and `special` wrapper `display: contents`, and neither
observer reports anything useful for an element with no box.

- **`withElementSize` walks up** to the nearest ancestor that is laid out. You
  are almost always asking "how much room do I have?", and the answer comes from
  the container, not from a wrapper with no geometry. `nearestLaidOutElement` is
  exported if you need the same walk yourself; it crosses shadow boundaries.
- **`withVisibility` gives its own node a box** — `display: block` by default —
  and observes that. Here you are asking "is *this* content on screen", and an
  ancestor's visibility would be the wrong answer for, say, one row of a long
  list. Pass a different `display` if `block` disturbs your layout, or `null` to
  walk up like `withElementSize` does.

## Feedback loops

Content whose size depends on its container's size will oscillate. Renders are
deferred through the scheduler, so you will not see the browser's
`ResizeObserver loop limit exceeded` error — which means the loop shows up as a
smooth endless animation instead of an exception, and is harder to spot. If a
`withElementSize` subtree never settles, look for a size that feeds back into
itself.

## Environments without observers

Constructors are taken from the element's own realm — `ownerDocument.defaultView`
— not from globals. An element inside an iframe is observed by that iframe's
implementation, and a test environment whose DOM is not installed globally works
without extra wiring.

Where a constructor is genuinely missing, the cell throws when it connects,
which `watch` turns into its error view rather than an exploded render. Server
rendering a tree containing these components will hit that: give them an `error`
builder, or keep them out of the server-rendered path.

## Baking your own

Same shape as the other modules — the reactive API is a required injection:

```javascript
import reactive from '@3sln/dodo/src/reactive.js';
import observe from '@3sln/dodo/src/observe.js';

const userSettings = {dodo: myDodo};

const {withElementSize, withVisibility} = observe({
  ...userSettings,
  reactive: reactive(userSettings),
});
```
