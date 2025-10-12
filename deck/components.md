# Components: alias & special

Dodo provides two types of components for creating reusable and stateful logic: `alias` and `special`.

## `alias(renderFn)`

An `alias` is a lightweight, stateless component. It's a function that takes arguments and returns a VNode. Use it to break down your UI into smaller, reusable pieces.

<deck-demo id="dodo-alias-demo" src="/demos/alias-demo.js"></deck-demo>

### `alias` vs. Plain Functions

While a plain JavaScript function that returns a VNode can work, `alias` provides key optimizations and capabilities:

- **Memoization**: An `alias` component is memoized. It only re-renders if its arguments change. A plain function is re-executed on every render of its parent.
- **DOM Identity**: An `alias` is backed by a stable DOM element (`<udom-alias>`). This allows you to chain methods like `.key()` and `.on()` to the component itself, which is not possible if a function returns a raw array of VNodes.

```javascript
import * as d from '@3sln/dodo';

// A plain function - will re-run every time its parent renders.
const plainGreeting = (name, color) => 
  d.h1({ $styling: { color } }, `Hello, ${name}!`);

// An alias - will only re-render if `name` or `color` changes.
const aliasedGreeting = d.alias((name, color) =>
  d.h1({ $styling: { color } }, `Hello, ${name}!`)
);

// Because it has a stable node, you can do this:
const keyedGreeting = aliasedGreeting('World', 'blue').key('greeting-1');
```

## `special(config)`

A `special` component is for advanced use cases that require state, lifecycle hooks, and direct access to the underlying DOM element. The `config` object can have `attach`, `update`, and `detach` methods.

- `attach(element)`: Called when the component's host element is first created and attached to the DOM.
- `update(element, newArgs, oldArgs)`: Called on initial render and whenever the component's arguments change.
- `detach(element)`: Called when the component is removed from the DOM.

> **Important:** A `special` component is fully responsible for managing its own children and performing cleanup. If you use `d.reconcile()` inside the `update` hook to render children, you **must** call `d.reconcile(element, [])` inside the `detach` hook to clean them up.

<deck-demo id="dodo-special-demo" src="/demos/special-demo.js"></deck-demo>
