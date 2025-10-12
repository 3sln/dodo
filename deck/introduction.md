# Welcome to the Dodo Deck!

A minimal, configurable virtual DOM library.

This deck provides live examples and documentation for Dodo's core concepts and APIs.

<deck-demo id="dodo-hello-world" src="/demos/hello-world.js"></deck-demo>

## Core Concepts

- **VDOM Factory:** The library exports a `vdom(settings)` factory to create custom instances. The default export is a pre-configured instance.
- **HTML Helpers:** Simple functions like `div()`, `p()`, `span()` are exported for convenience.
- **`$`-Prefixed Props:** Special props that Dodo intercepts are prefixed with a `$` to avoid conflicts with standard properties (e.g., `$classes`, `$styling`, `$attrs`, `$dataset`).
- **`.key()`:** Chain `.key('unique-id')` to any VNode in a list to enable efficient, keyed reconciliation.
- **`.on()`:** Chain `.on({ event: handler })` to any VNode to attach event listeners or lifecycle hooks (`$attach`, `$detach`, `$update`).
- **`.opaque()`**: Marks an element node as opaque, meaning Dodo will manage its props but not its children.