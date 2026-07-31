# Element Creation

Dodo provides two primary ways to create element VNodes: the low-level `h()` function and a set of convenient HTML helper functions.

## The `h(tag, props, ...children)` function

The `h()` function is the core of element creation.

- `tag` (string): The HTML tag name (e.g., 'div', 'p').
- `props` (object, optional): A plain object of properties, written straight onto the element.
- `...children`: A list of child VNodes, strings, or numbers.

```javascript
import * as d from '@3sln/dodo';

const vnode = d.h('div', { id: 'my-div' },
  d.h('p', null, 'Hello, World!').classes('greeting')
);
```

## HTML Helpers

For convenience, Dodo exports helper functions for all standard HTML tags. These are simply wrappers around the `h()` function.

```javascript
import * as d from '@3sln/dodo';

const vnode = d.div({ id: 'my-div' },
  d.p('Hello, World!').classes('greeting')
);
```

## Chained setters

Anything that is not a plain element property is chained onto the vnode rather
than passed in the props object. Every setter returns the vnode, so they
compose in any order:

```javascript
d.div({ id: 'card' }, 'content')
  .style({ 'background-color': 'white', padding: '1em' })
  .classes('card', isActive && 'active')
  .attrs({ role: 'group', 'aria-label': 'Card' })
  .data({ cardId: id })
  .key(id)
  .on({ click: onClick });
```

| setter          | applies to                                                       |
| --------------- | ---------------------------------------------------------------- |
| `.style(map)`   | inline styles, via `style.setProperty` — names are CSS-cased      |
| `.classes(...)` | class names; nested lists are flattened, blanks are skipped       |
| `.attrs(map)`   | attributes, via `setAttribute`                                    |
| `.data(map)`    | `dataset` entries                                                 |
| `.key(k)`       | the identity used when reconciling a list                         |
| `.on(map)`      | event listeners and the `$attach` / `$update` / `$detach` hooks   |
| `.opaque()`     | marks the element's children as none of Dodo's business          |

`.style()`, `.classes()`, `.attrs()` and `.data()` only apply to element nodes,
and each replaces rather than merges: calling one twice leaves the second value.

> [!NOTE]
> The `$styling`, `$classes`, `$attrs` and `$dataset` props these replace are
> deprecated. They still work, and warn once per prop name, but they will be
> removed.

<deck-demo id="dodo-elements-demo" src="/demos/elements-demo.js"></deck-demo>
