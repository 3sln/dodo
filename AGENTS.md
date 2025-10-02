# Agent Guidelines

This document outlines guidelines for LLM agents interacting with the `dodo` project.

## 1. Architecture Overview

The library follows a factory pattern with a standard `src` directory layout.

- **`index.js`**: The main public entry point for the package. It creates and exports a default, pre-configured API by calling the `vdom` factory.
- **`src/vdom.js`**: Exports a factory function, `vdom(settings)`, which creates a full VDOM API closure. This is the core of the library.
- **`src/html.js`**: Contains simple helper functions for creating VNodes for standard HTML tags.
- **Settings Object**: The `vdom` factory accepts a settings object to allow for deep customization of its internal operations (e.g., type checking, iteration), enabling interoperability with libraries like Immutable.js or environments like ClojureScript.
- **ClojureScript Detection**: The root `index.js` automatically detects a ClojureScript environment and provides a compatible settings object to the default API instance.

## 2. General Principles (For All Agents)

- **Adhere to Conventions:** Before making changes, analyze existing code, tests, and documentation to understand and follow established patterns.
- **Mimic Style:** Match the existing coding style, including formatting, naming, and architectural patterns.
- **Test Your Changes:** All modifications to the library must be accompanied by tests. All changes should pass existing tests.

---

## 3. For Contributors (Agents Modifying `dodo`)

This section applies when you are modifying the `dodo` library itself.

### Core Concepts
- **Factory Pattern:** The core logic resides in `src/vdom.js`. Be aware of which functions are inside the factory closure (and depend on settings) and which are static helpers outside of it.
- **`$`-Prefixed Props:** Special props that are intercepted by the `reconcile` function for specific behaviors (like `$classes` or `$styling`) are prefixed with a `$` to avoid collision with standard element properties.
- **Immutability:** The reconciliation process relies on comparing VNode objects. Do not mutate VNodes after creation.
- **Performance:** The default `shouldUpdate` function now performs a shallow array comparison to avoid unnecessary reconciliations. Be mindful of the performance implications of any changes.

---

## 4. For Users (Agents Using `dodo` to Build UIs)

This section applies when you are using `dodo` to build an application or UI.

### API Best Practices

- **Use HTML Helpers:** Prefer using the simple HTML helper functions (`div`, `p`, `span`, etc.) for creating VNodes.
- **`$`-Prefixed Props:** When you need `dodo` to perform special handling for properties, use the `$` prefix. For all other standard element properties (`id`, `className`, `value`, etc.), pass them directly.
    - `dd.div({ $classes: ['a', 'b'] })`
    - `dd.p({ $styling: { color: 'blue' } })`
    - `dd.div({ $attrs: { 'aria-label': 'foo' } })`
    - `dd.div({ $dataset: { userId: 123 } })`
- **Universal Chaining:** The `.key(theKey)` and `.on({ event: handler })` methods can be chained onto **any** VNode (`h`, `o`, `alias`, or `special`).
    - **Keys are Essential for Lists:** When rendering a list of elements, always provide a unique `.key()` to each VNode in the list for efficient reconciliation.
    - **`.on()` for Events & Hooks:** Use `.on()` to attach event listeners and lifecycle hooks (`$attach`, `$detach`, `$update`). The value for an event can be a function or an object:
        - **Function:** A standard callback, e.g., `{ click: () => console.log('Clicked!') }`.
        - **Object:** For more control, provide an object with the shape `{ listener, capture, passive }`. The `listener` is your callback, and `capture`/`passive` are passed directly to `addEventListener`.

### Component Patterns

- **Event Handling:** Components created with `alias` or `special` should **not** accept callback functions as props (e.g., `onSomething`). Instead, they should dispatch standard DOM `CustomEvent`s. The consumer of the component will then listen for these events using the `.on()` method chain.
- **`alias()` for Reusable Views:** Use `alias()` to create reusable, stateless UI functions. They take props and return a VNode tree.
- **`special()` for Advanced Logic:** Reserve `special()` for stateful components that require direct, imperative DOM manipulation. It is the ideal tool for providing the implementation logic for a standard Web Component.

### Understanding `reconcile()`

The `reconcile` function has two distinct modes of operation:

- **`reconcile(target, vnode)` (Onto):** This modifies the `target` element itself to match the `vnode`. It requires the `target`'s tag name to be compatible with the `vnode`'s tag (unless the `vnode` is an `alias` or `special`).
- **`reconcile(target, [vnodes...])` (Into):** This modifies the *children* of the `target` element to match the array of `vnodes`. The `target` element's own properties are not changed.
- **`reconcile(target, null)` (Cleanup):** This detaches `dodo` from the `target` and its descendants, running all necessary cleanup logic.
