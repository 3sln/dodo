# Context

`@3sln/dodo/context` is an **optional** module, built on top of
[the reactive module](/reactive.md). It passes data down the tree without
threading it through every intermediate component.

Context here is scoped to the **DOM**, not to a module-level registry: a
provider stashes its data on its own DOM node, and a consumer walks up the DOM
to find it. Two independent widgets on the same page never see each other's
context, and nothing is global.

## `withContext(data, ...children)`

Provides `data` to everything rendered beneath it.

```javascript
import {withContext, useContext} from '@3sln/dodo/context';
import {reconcile, div, p} from '@3sln/dodo';

reconcile(container, [
  withContext({theme: 'dark'},
    div(
      useContext(['theme'], ({theme}) => p(`theme is ${theme}`)),
    ),
  ),
]);
```

## `useContext(keys, builder)`

Consumes context. `keys` names the entries you care about; `builder` receives a
map of just those entries and returns a vnode.

Naming your keys is not bookkeeping — it is what makes the consumer cheap. A
provider updating a key you did not ask for produces an equal selection, and the
re-render is skipped entirely.

## Nesting

Providers nest, and the merged view is what a consumer sees. The **nearest**
provider wins for any given key:

```javascript
withContext({theme: 'dark', locale: 'en'},
  withContext({theme: 'light'},
    // sees {theme: 'light', locale: 'en'}
    useContext(['theme', 'locale'], render),
  ),
)
```

Updating any provider above a consumer — not just the closest one — updates that
consumer.

## Shadow DOM

Shadow roots are a real boundary, and you choose which side of it your data
belongs on:

- **`withContext`** crosses shadow roots. Use it for genuinely ambient
  application state: theme, locale, the current user.
- **`withEncapsulatedContext`** stops at the shadow root it lives in. Use it for
  a component's own internals, so that a consumer inside some unrelated
  component's shadow tree cannot accidentally pick it up.

Both kinds merge together for a consumer that can see them, ordered by depth.

<deck-demo id="dodo-context-demo" src="/demos/context-demo.js"></deck-demo>

## Imperative API

The components are the interesting part, but the underlying pieces are exported
for when you are integrating with something that is not dodo:

| function                                     | purpose                                     |
| -------------------------------------------- | ------------------------------------------- |
| `attachContext(node, data, encapsulated?)`   | makes `node` a provider                     |
| `updateContext(node, data, encapsulated?)`   | replaces a provider's data                  |
| `detachContext(node, encapsulated?)`         | removes a provider                          |
| `readContext(node, keys)`                    | reads the context visible from `node`, once |
| `contextCell(node, keys)`                    | the same, as a Cell you can `watch`         |

## Baking your own

As with the reactive module, the exports of `@3sln/dodo/context` are built
against the default dodo instance. Bake your own if you use a custom one, and
hand the **same settings object** to both factories so they share one `watch`:

```javascript
import reactive from '@3sln/dodo/src/reactive.js';
import context from '@3sln/dodo/src/context.js';

const userSettings = {dodo: myDodo};

const {watch} = reactive(userSettings);
const {withContext, useContext} = context(userSettings);
```

`context` re-exports `watch`, so one call will usually do:

```javascript
const {withContext, useContext, watch} = context({dodo: myDodo});
```

Settings are the reactive module's settings — `dodo`, `schedule` and
`renderError`; see the <a href="?c=%2Freactive.md"><strong>Reactivity</strong></a>
card.

## A note on movement

A consumer resolves its provider chain when it renders and whenever it is
updated. Physically relocating a mounted consumer to a different part of the
tree — without re-rendering it — will not re-resolve the chain on its own.
