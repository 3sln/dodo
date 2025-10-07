# Dodo Agent Guidelines

This document outlines guidelines for LLM agents interacting with the `dodo` project.

## 1. Architecture Overview

- **VDOM Factory:** The main export of the library is a factory function, `vdom(userSettings)`, located in `src/vdom.js`. This function creates a closure containing a complete, configured VDOM API.
- **Configurability:** The factory accepts a `userSettings` object. This object allows the user to override default behaviors for data structure handling (`isMap`, `mapIter`, `mapMerge`, etc.) and naming conventions (`convertTagName`, etc.). This is the key to interoperability with environments like ClojureScript.
- **Default Instance:** The root `index.js` creates and exports a default, pre-configured instance of the API for standard JavaScript usage. It also exports the `vdom` factory itself for users who need custom instances.
- **Stateless VNodes:** `VNode` objects are simple, transient data structures. They should not hold state or direct references to DOM elements.

## 2. General Principles (For All Agents)

- **Adhere to Conventions:** Before making changes, analyze existing code, tests, and documentation to understand and follow established patterns.
- **Mimic Style:** Match the existing coding style, including formatting, naming, and architectural patterns (vertical growth, explicit blocks).
- **Test Your Changes:** All modifications to the library must be accompanied by tests.

---

## 3. For Contributors (Agents Modifying `dodo`)

This section applies when you are modifying the `dodo` library itself.

### Core Concepts
- **Factory Pattern:** The core logic resides in `src/vdom.js`. Be aware of which functions are inside the factory closure (and depend on settings) and which are static helpers outside of it.
- **`$`-Prefixed Props:** Special props that are intercepted by the `reconcile` function for specific behaviors (like `$classes` or `$styling`) are prefixed with a `$` to avoid collision with standard element properties.
- **Immutability:** The reconciliation process relies on comparing VNode objects. Do not mutate VNodes after creation.
- **Performance:** The default `shouldUpdate` function performs a shallow comparison on arrays and plain objects to avoid unnecessary reconciliations. Be mindful of the performance implications of any changes.

---

## 4. For Users (Agents Using `dodo` to Build UIs)

This section applies when you are using `dodo` to build an application or UI.

### API Best Practices

- **Use HTML Helpers:** Prefer using the simple HTML helper functions (`div`, `p`, `span`, etc.) for creating VNodes.
- **`$`-Prefixed Props:** When you need `dodo` to perform special handling for properties, use the `$` prefix. For all other standard element properties (`id`, `className`, `value`, etc.), pass them directly.
    - `dd.div({ $classes: ['a', 'b'] })`
    - `dd.p({ $styling: { color: 'blue' } })`
- **Chained Methods:**
    - **`.key(id)`**: Adds a key for list reconciliation. Can be chained onto any VNode.
    - **`.on({ evt: fn })`**: Attaches event listeners or lifecycle hooks. Can be chained onto any VNode.
    - **`.opaque()`**: Marks an element node as opaque, meaning `dodo` will manage its props but not its children. Can only be chained onto element nodes (`h` or helpers).

### Syntax Clarifications

This section covers common points of confusion in the `dodo` API.

#### 1. Passing Children

Child VNodes are **always** passed as arguments to the helper function, *after* the optional props object. There is no `.children()` method.

-   **Correct:** `div({ id: 'parent' }, h1('Title'), p('Content'))`
-   **Incorrect:** `div({ id: 'parent' }).children(h1('Title'), ...)`

#### 2. Styling Properties

When using the `$styling` prop, all CSS property names **must** be snake-cased, as they are in standard CSS. CamelCase will not work.

-   **Correct:** `div({ $styling: { 'margin-bottom': '1em', 'font-size': '16px' } })`
-   **Incorrect:** `div({ $styling: { marginBottom: '1em', fontSize: '16px' } })`

#### 3. Chaining Event Handlers

The `.on()` method is chained to the VNode created by a helper function. The children are passed to the helper function itself, not to the `.on()` call.

-   **Correct:**
    ```javascript
    div({ id: 'clickable' },
        'Click me'
    ).on({
        click: () => console.log('Clicked!')
    })
    ```
-   **Incorrect:**
    ```javascript
    // Don't pass children after .on()
    div({ id: 'clickable' })
        .on({ click: () => console.log('Clicked!') },
            'Click me'
        )
    ```

### Event Listeners and Lifecycle Hooks

Use the `.on()` method to attach event listeners and lifecycle hooks (`$attach`, `$detach`, `$update`). The value for an event can be a function or an object:
- **Function:** A standard callback, e.g., `{ click: () => console.log('Clicked!') }`.
- **Object:** For more control, provide an object with the shape `{ listener, capture, passive }`. The keys for this object are configurable via `dodo` settings.

### Component Patterns

- **Event Handling:** Components created with `alias` or `special` should dispatch standard DOM `CustomEvent`s rather than accepting callback props.
- **`alias()` for Reusable Views:** Use `alias()` to create reusable, stateless UI functions.
- **`special()` for Advanced Logic:** Reserve `special()` for stateful components that require direct, imperative DOM manipulation.

### Understanding `reconcile()`

The `reconcile` function has two distinct modes of operation:

- **`reconcile(target, vnode)` (Onto):** Modifies the `target` element itself to match the `vnode`. Requires compatible tag names.
- **`reconcile(target, [vnodes...])` (Into):** Modifies the *children* of the `target` element or fragment to match the array of `vnodes`.
- **`reconcile(target, null)` (Cleanup):** Detaches `dodo` from the `target` and its descendants.