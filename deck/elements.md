# Element Creation

Dodo provides two primary ways to create element VNodes: the low-level `h()` function and a set of convenient HTML helper functions.

## The `h(tag, props, ...children)` function

The `h()` function is the core of element creation.

- `tag` (string): The HTML tag name (e.g., 'div', 'p').
- `props` (object, optional): A plain object of properties, attributes, and special `$`-prefixed directives.
- `...children`: A list of child VNodes, strings, or numbers.

```javascript
import * as d from '@3sln/dodo';

const vnode = d.h('div', { id: 'my-div' },
  d.h('p', { $classes: ['greeting'] }, 'Hello, World!')
);
```

## HTML Helpers

For convenience, Dodo exports helper functions for all standard HTML tags. These are simply wrappers around the `h()` function.

```javascript
import * as d from '@3sln/dodo';

const vnode = d.div({ id: 'my-div' },
  d.p({ $classes: ['greeting'] }, 'Hello, World!')
);
```

<deck-demo id="dodo-elements-demo" src="/demos/elements-demo.js"></deck-demo>
