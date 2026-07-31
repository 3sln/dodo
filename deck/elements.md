# Element Creation

Dodo provides two primary ways to create element VNodes: the low-level `h()` function and a set of convenient HTML helper functions.

## The `h(tag, ...children)` function

The `h()` function is the core of element creation.

- `tag` (string): The HTML tag name (e.g., 'div', 'p').
- `...children`: A list of child VNodes, strings, or numbers.

Everything else about an element — its properties, styling, classes, attributes
and dataset — is chained onto the vnode it returns.

```javascript
import * as d from '@3sln/dodo';

const vnode = d.h('div',
  d.h('p', 'Hello, World!').classes('greeting')
).props({ id: 'my-div' });
```

## HTML Helpers

For convenience, Dodo exports helper functions for all standard HTML tags. These are simply wrappers around the `h()` function.

```javascript
import * as d from '@3sln/dodo';

const vnode = d.div(
  d.p('Hello, World!').classes('greeting')
).props({ id: 'my-div' });
```

The void elements — `img`, `input`, `link`, `meta`, `area`, `track`, `embed`,
`param`, `source` and `col` — take no arguments at all, since they can have no
children:

```javascript
d.img().props({ src: '/logo.png', alt: 'Logo' })
```

## Chained setters

Every setter returns the vnode, so they compose in any order:

```javascript
d.div('content')
  .props({ id: 'card' })
  .style({ 'background-color': 'white', padding: '1em' })
  .classes('card', isActive && 'active')
  .attrs({ role: 'group', 'aria-label': 'Card' })
  .data({ cardId: id })
  .key(id)
  .on({ click: onClick });
```

| setter          | applies to                                                       |
| --------------- | ---------------------------------------------------------------- |
| `.props(map)`   | properties written straight onto the element (`id`, `value`, …)   |
| `.style(map)`   | inline styles, via `style.setProperty` — names are CSS-cased      |
| `.classes(...)` | class names; nested lists are flattened, blanks are skipped       |
| `.attrs(map)`   | attributes, via `setAttribute`                                    |
| `.data(map)`    | `dataset` entries                                                 |
| `.key(k)`       | the identity used when reconciling a list                         |
| `.on(map)`      | event listeners and the `$attach` / `$update` / `$detach` hooks   |
| `.opaque()`     | marks the element's children as none of Dodo's business          |

Every setter replaces rather than merges: calling one twice leaves the second
value. All but `.key()` and `.on()` apply to element nodes only.

Because each map is compared in its own right rather than by identity, an object
literal rebuilt on every render — `.props({id})`, `.style({color})` — compares
equal when its contents have not changed, and costs no reconciliation pass.

> [!NOTE]
> Props used to be an optional first argument, and styling, classes, attributes
> and dataset used to be `$`-prefixed props. Both forms are gone; see
> [MIGRATION.md](https://github.com/3sln/dodo/blob/main/MIGRATION.md).

<deck-demo id="dodo-elements-demo" src="/demos/elements-demo.js"></deck-demo>
