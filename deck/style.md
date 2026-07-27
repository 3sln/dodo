# Scoped Styling

`@3sln/dodo/style` is an **optional** module. It renders a subtree into a shadow
root with constructable stylesheets adopted, so its CSS is genuinely scoped:
rules inside cannot leak out, and page rules cannot leak in.

This is the one thing the platform does properly and no naming convention can
match. It needs no reactive API — nothing here re-renders on its own.

## `css`

A tagged template producing a `CSSStyleSheet`:

```javascript
import {css, scoped} from '@3sln/dodo/style';

const styles = css`
  p { color: rebeccapurple; margin: 0; }
  :host { display: block; }
`;
```

Memoised per call site. A tagged template hands the same frozen `strings` array
to every evaluation of that literal, so the cache is keyed on it: a `css` inside
a render function returns the identical sheet each render unless an interpolated
value actually changed. Without that, every render would build a fresh sheet,
and reassigning `adoptedStyleSheets` would force a style recalculation each
time.

Interpolation treats only `null` and `undefined` as empty — `${0}` is a value,
not a blank.

`css.in(view)` builds in another realm, for an iframe or a test environment
whose DOM is not installed globally.

## `scoped(props?, ...children)`

```javascript
scoped({styleSheets: [styles]},
  p('scoped, and unreachable from the page'),
)
```

The children are reconciled into the shadow root, and updated in place on later
renders like any other subtree. The stylesheet list is only reassigned when it
actually changes — including when it becomes empty, which is how you remove one.

<deck-demo id="dodo-style-demo" src="/demos/style-demo.js"></deck-demo>

## Detaching

A shadow root cannot be removed once attached, so detaching tears its contents
down instead: `$detach` hooks fire, listeners come off, and the adopted
stylesheets are dropped. This is worth stating because it is easy to get wrong —
leaving the shadow content in place looks harmless and quietly leaks every
listener under it.

## Imperative use

`reconcileShadow(host, children, styleSheets?)` mounts a dodo tree into a shadow
root you own rather than one `scoped` created, and `detachShadow(host)` reverses
it:

```javascript
import {reconcileShadow, detachShadow} from '@3sln/dodo/style';

class MyWidget extends HTMLElement {
  connectedCallback() {
    reconcileShadow(this, [p('hello')], [styles]);
  }
  disconnectedCallback() {
    detachShadow(this);
  }
}
```

## Context and shadow boundaries

Shadow roots are a real boundary for [context](/context.md) too.
`withContext` crosses them; `withEncapsulatedContext` stops at them. Pair
`scoped` with `withEncapsulatedContext` when a component's internals should stay
genuinely internal.

## Baking your own

```javascript
import style from '@3sln/dodo/src/style.js';

const {scoped} = style({dodo: myDodo});
```
