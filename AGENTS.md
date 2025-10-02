# Agent Guidelines

This document outlines guidelines for LLM agents interacting with the `dodo` project.

## 1. General Principles (For All Agents)

- **Adhere to Conventions:** Before making changes, analyze existing code, tests, and documentation to understand and follow established patterns. Use standard JavaScript naming conventions (`camelCase` for functions/components).
- **Verify and Validate:** Do not assume libraries or frameworks are available. Check `package.json` and observe existing imports.
- **Mimic Style:** Match the existing coding style, including formatting, naming, and architectural patterns.
- **Test Your Changes:** All modifications to the library must be accompanied by tests. All changes should pass existing tests.

---

## 2. For Contributors (Agents Modifying `dodo`)

This section applies when you are modifying the `dodo` library itself.

### Core Concepts
- **Node Types:** Understand the distinct purpose of each node type:
    - `ELEMENT_NODE`: Standard virtual elements.
    - `OPAQUE_NODE`: Elements where props are managed, but children are ignored.
    - `ALIAS_NODE`: Wrappers for pure functions that return VNodes, enabling component-like abstractions.
    - `SPECIAL_NODE`: For components requiring direct DOM access and custom lifecycle logic (`attach`, `detach`, `update`).
- **Immutability:** The reconciliation process relies on comparing VNode objects. Do not mutate VNodes after creation.
- **Performance:** Be mindful of performance implications in the reconciliation algorithm. Avoid unnecessary work or allocations in hot paths.

---

## 3. For Users (Agents Using `dodo` to Build UIs)

This section applies when you are using `dodo` to build an application or UI.

### API Best Practices

- **`h()` for Structure:** Use `h()` to define the structure of your UI with virtual elements and their children.
- **`o()` for Opaque Content:** Use `o()` when you need `dodo` to manage an element's properties (`className`, `dataset`, etc.) but want to control its `innerHTML` or children through other means.
- **Universal Chaining:** The `.key(theKey)` and `.on({ event: handler })` methods can be chained onto **any** VNode (`h`, `o`, `alias`, or `special`).
    - **Keys are Essential for Lists:** When rendering a list of elements, always provide a unique `.key()` to each VNode in the list for efficient reconciliation.
    - **`.on()` for All Events:** Use `.on()` to attach listeners for standard DOM events (e.g., `click`) or custom events dispatched by components.
- **Props vs. Special Props:**
    - Most properties in the props object (e.g., `id`, `className`, `disabled`) are set directly as JavaScript properties on the DOM node.
    - Use the special props for specific use cases: `styling` (for inline styles), `classes` (for an iterable of class names), `dataset` (for `data-*` attributes), and `attrs` (for general HTML attributes).

### Component Patterns

- **Event Handling:** Components created with `alias` or `special` should **not** accept callback functions as props (e.g., `onSomething`). Instead, they should dispatch standard DOM `CustomEvent`s. The consumer of the component will then listen for these events using the `.on()` method chain. This creates a clean, decoupled architecture aligned with web standards.
- **`alias()` for Reusable Views:** Use `alias()` to create reusable, stateless UI functions. They take props and return a VNode tree.
- **`special()` for Advanced Logic:** Reserve `special()` for stateful components that require direct, imperative DOM manipulation.
    - State should be stored on the DOM node itself, preferably using a `Symbol` as the key to avoid collisions. This state should be cleaned up in the `detach` hook.
    - `special()` is the ideal tool for providing the implementation logic for a standard Web Component (custom element). This is done by reconciling the `special` VNode *onto* the custom element instance from within its lifecycle callbacks (`connectedCallback`, etc.).

### Understanding `reconcile()`

The `reconcile` function has two distinct modes of operation:

- **`reconcile(target, vnode)` (Onto):** This modifies the `target` element itself to match the `vnode`. It requires the `target`'s tag name to be compatible with the `vnode`'s tag (unless the `vnode` is an `alias` or `special`).
- **`reconcile(target, [vnodes...])` (Into):** This modifies the *children* of the `target` element to match the array of `vnodes`. The `target` element's own properties are not changed.
- **`reconcile(target, null)` (Cleanup):** This detaches `dodo` from the `target` and its descendants, running all necessary cleanup logic (`detach` hooks, removing listeners, etc.).