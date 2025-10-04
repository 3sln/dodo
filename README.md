# dodo
A minimal, configurable virtual DOM library.

## Quick Start

```javascript
import { reconcile, h1, p, div } from '@3sln/dodo';

const container = document.getElementById('root');

// Use helper functions like h1(), p(), etc. for standard elements.
// The props object is optional.
const myVdom = div({ id: 'app' },
  h1('Hello, dodo!'),
  p({ $classes: ['text-lg'] }, 'This is a paragraph.')
);

// Reconcile the virtual DOM with the real DOM.
reconcile(container, [myVdom]);
```

## Core Concepts

- **VDOM Factory:** The library exports a `vdom(settings)` factory to create custom instances. The default export is a pre-configured instance.
- **HTML Helpers:** Simple functions like `div()`, `p()`, `span()` are exported for convenience.
- **`$`-Prefixed Props:** Special props that `dodo` intercepts are prefixed with a `$` to avoid conflicts with standard properties (e.g., `$classes`, `$styling`, `$attrs`, `$dataset`).
- **`.key()`:** Chain `.key('unique-id')` to any VNode in a list to enable efficient, keyed reconciliation.
- **`.on()`:** Chain `.on({ event: handler })` to any VNode to attach event listeners or lifecycle hooks (`$attach`, `$detach`, `$update`).
- **`.opaque()`**: Marks an element node as opaque, meaning `dodo` will manage its props but not its children.

## Keys for List Reconciliation

When rendering lists of elements, always use the `.key()` method to ensure efficient updates and reordering.

```javascript
import { reconcile, div } from '@3sln/dodo';

const data = [{id: 1, text: 'A'}, {id: 2, text: 'B'}, {id: 3, text: 'C'}];
const container = document.getElementById('list');

// Chain .key() to the VNode returned by the helper function.
reconcile(container, data.map(item => div(item.text).key(item.id)));
```

## Event Listeners and Lifecycle Hooks

Use the `.on()` method to attach event listeners and lifecycle hooks.

```javascript
import { reconcile, button } from '@3sln/dodo';

const myButton = button('Hover over me').on({
  // Simple function handler
  mouseover: () => console.log('Mouse entered!'),
  
  // Object handler for more options
  mouseleave: {
    listener: () => console.log('Mouse left!'),
    capture: true
  },

  // Lifecycle hooks
  $attach: (domNode) => console.log('Button node was created.'),
  $detach: (domNode) => console.log('Button has been removed.')
});

const container = document.getElementById('event-container');
reconcile(container, myButton);
reconcile(container, null); // Triggers $detach
```

## Understanding `reconcile()`

The `reconcile` function has two distinct modes of operation:

-   **`reconcile(target, vnode)` (Onto):** Modifies the `target` element itself to match the `vnode`. This requires the `target`'s tag name to be compatible with the `vnode`'s tag (unless the `vnode` is an `alias` or `special`).

-   **`reconcile(target, [vnodes...])` (Into):** Modifies the *children* of the `target` element to match the array of `vnodes`. The `target` element's own properties are not changed.

-   **`reconcile(target, null)` (Cleanup):** Detaches `dodo` from the `target` and its descendants, running all necessary cleanup logic.

## Advanced: Web Components with `special`

The `special` component is a powerful tool for integrating with other libraries or, as shown here, for providing the rendering logic for a standard Web Component.

```javascript
import { reconcile, special, p, h, alias } from '@3sln/dodo';

// 1. Create a special component to manage a shadow root.
const shadowComponent = special({
  attach: (domNode) => {
    // Create a shadow root on the host element once.
    domNode.attachShadow({ mode: 'open' });
  },
  update: (domNode, newContent) => {
    // Reconcile the provided content into the shadow root.
    reconcile(domNode.shadowRoot, newContent);
  }
});

// 2. Define a standard Web Component class.
class MyComponent extends HTMLElement {
  connectedCallback() {
    // When the element is added to the DOM, render the special component ONTO it.
    // Pass some initial content into the special component's `update` hook.
    reconcile(this, shadowComponent(p('Hello from inside a web component!')));
  }

  disconnectedCallback() {
    // When the element is removed, clean up the dodo instance.
    reconcile(this, null);
  }
  
  // You can add attributeChangedCallback, properties, etc.
  // to re-reconcile with new content.
}

// 3. Register the custom element.
customElements.define('my-component', MyComponent);

// 4. Use your new custom element with dodo!
const container = document.getElementById('my-component-container');
reconcile(container, h('my-component'));
```