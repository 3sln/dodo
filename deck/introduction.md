# Introduction to Dodo

Dodo is a minimal, highly configurable virtual DOM library. It is not a framework. Instead, it provides the core tools to efficiently create, update, and manage DOM elements based on a virtual representation, giving you full control over your application's rendering process and data model.

## Core Primitives

Everything in Dodo revolves around a few key functions:

- **`h(tag, props, ...children)`**: The core function for creating a virtual element node.
- **`alias(fn)`**: A wrapper for creating memoized, pure-function components.
- **`special(config)`**: A powerful tool for creating components with lifecycle hooks (`attach`, `update`, `detach`), perfect for integrating with third-party libraries or browser APIs.

For convenience, Dodo also provides helper functions that look like HTML tags (`div`, `p`, `h1`, etc.). You build a tree of these virtual nodes and then use the `reconcile(domNode, vdomTree)` function to make the real DOM match your virtual tree.

<deck-demo id="dodo-hello-world" src="/demos/hello-world.js"></deck-demo>

## Customization

Dodo's real power lies in its configurability. The default export is a pre-configured instance that works with standard JavaScript objects and arrays. 

However, by using the `dodo(settings)` factory, you can replace the underlying data structure handlers. This allows Dodo to work seamlessly with other programming paradigms or languages—like ClojureScript—that use different data structures.

See the <a href="?c=%2Fcustomization.md"><strong>Customization</strong></a> card for a live example of this in action.