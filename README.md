# dodo
A minimal virtual DOM engine.

## Quick Start

```javascript
import { h, o, alias, special, reconcile } from '3sln/dodo';

const container = document.getElementById('root');

// Use h() for standard virtual element nodes.
// Arguments: tag, props, then children.
const myVdom = h('div', { id: 'app' },
  h('h1', null, 'Hello, dodo!'),
  h('p', { class: ['text-lg'] }, 'This is a paragraph.')
);
reconcile(container, [myVdom]);

// Use o() for "opaque" nodes. Updates props but ignores children and inner HTML.
const opaqueVdom = o('div', { id: 'opaque-app', 'data-status': 'ready' });
reconcile(container, [opaqueVdom]);

// Use alias() to create reusable components from pure functions.
const myComponent = alias((props) => h('p', null, `Hello, ${props.name}!`));
reconcile(container, [myComponent({ name: 'World' })]);

// Use special() for components with custom lifecycle hooks.
const mySpecialComponent = special({
  attach: (domNode) => console.log('Node attached:', domNode),
  detach: (domNode) => console.log('Node detached:', domNode),
  update: (domNode, newArgs, oldArgs) => console.log('Node updated with new args:', newArgs),
});

// Using a special component.
reconcile(container, [mySpecialComponent('initial state')]);
reconcile(container, [mySpecialComponent('updated state')]);
reconcile(container, null); // Calls the detach hook.
```

## Keys for List Reconciliation

When reconciling a list of children, use **keys** to track and update elements
efficiently. This avoids recreating DOM nodes when their order changes.

```javascript
import { h, reconcile } from 'udom';

const data = [{id: 1, text: 'A'}, {id: 2, text: 'B'}, {id: 3, text: 'C'}];
const container = document.getElementById('list');

// Initial render
reconcile(container, data.map(item => h('div', null, item.text).key(item.id)));
// Output: <div>A</div><div>B</div><div>C</div>

// Reorder the data
const newData = [{id: 3, text: 'C'}, {id: 1, text: 'A'}, {id: 2, text: 'B'}];
reconcile(container, newData.map(item => h('div', null, item.text).key(item.id)));
// DOM nodes for A, B, and C are moved, not recreated.
// Output: <div>C</div><div>A</div><div>B</div>
```

## Event Listeners and Lifecycle Hooks

You can add event listeners to VNodes using the **`.on()`** method. Pass it an
object where keys are event names (e.g., `click`). Values can be functions or
objects for more control.

  * **Function handlers** are installed with default options (listening on the
    bubbling phase).
  * **Object handlers** let you specify advanced options. The **`listener`**
    field is the function that gets installed as the handler, while the
    **`capture`** and **`passive`** fields are passed directly to
    `addEventListener` as options.

The `.on()` method also supports the following special **lifecycle hooks**:

  * **`$create(domNode)`**: Runs immediately after the underlying DOM node is
    created.
  * **`$remove(domNode)`**: Runs when the node is removed.
  * **`$reconcile(domNode)`**: Runs after every successful reconciliation of
    the node.

```javascript
import { h, reconcile } from 'udom';

const button = h('button', null, 'Hover over me').on({
  mouseover: () => console.log('Mouse entered!'),
  $create: () => console.log('Button node was created.'),
  $reconcile: () => console.log('Button node was reconciled.'),
  $remove: () => console.log('Button has been removed.')
});

const container = document.getElementById('event-container');
reconcile(container, button); // This will trigger $create and $reconcile.
reconcile(container, h('button', null, 'Updated text').on({ $reconcile: () => console.log('Updated button was reconciled.') })); // This will trigger $reconcile.
reconcile(container, null); // This will trigger the $remove hook.
```

## Special Components

The `special` function is a low-level tool. Use it when `alias`
components—which are for pure markup—just won't cut it. `special` components
are for building primitives that need direct DOM control and custom lifecycle
management.

A `special` component is defined by an object with `attach`, `detach`, and
`update` hooks.

  * **`attach(domNode)`**: Invoked when the DOM node is created and inserted.
    Use it for one-time setup. It only gets the DOM node.
  * **`detach(domNode)`**: Called when the DOM node is removed. Use it for
    cleanup. It only gets the DOM node.
  * **`update(domNode, newArgs, oldArgs)`**: Runs after `attach` and on every
    subsequent change to the component's arguments. The first call has
    `oldArgs` as `undefined`. Use this to update the component's state
    imperatively.

```javascript
import { h, special, reconcile } from 'udom';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`p { color: blue; }`);

const MySpecialComponent = special({
  attach: (domNode) => {
    const shadow = domNode.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  },
  update: (domNode, newMessage) => {
    reconcile(domNode.shadowRoot, h('p', null, newMessage));
  },
  detach: (domNode) => {
    console.log('Special component removed.');
  }
});

class MyWebComponent extends HTMLElement {
  static observedAttributes = ['message'];
  #message = '';

  get message() {
    return this.#message;
  }

  set message(value) {
    this.#message = value;
    reconcile(this, MySpecialComponent(value));
  }

  connectedCallback() {
    this.#message = this.getAttribute('message') || '';
    reconcile(this, MySpecialComponent(this.#message));
  }

  disconnectedCallback() {
    reconcile(this, null);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'message' && oldValue !== newValue) {
      this.message = newValue;
    }
  }
}

customElements.define('my-web-component', MyWebComponent);

const container = document.getElementById('web-component-container');
reconcile(container, [h('my-web-component', { message: 'Hello from a web component!' })]);

// A later reconciliation with a new message will update the component.
setTimeout(() => {
  reconcile(container, [h('my-web-component', { message: 'Updated message!' })]);
}, 1000);
```
