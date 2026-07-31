# Migration

## Unreleased — everything is chained

Element configuration no longer travels in a props object passed to `h()`. The
tag is followed by children and nothing else; properties, styling, classes,
attributes and dataset entries are each chained onto the vnode with a setter
that returns the vnode.

```javascript
// before
div({id: 'card', className: 'card', $styling: {padding: '1em'}, $dataset: {cardId: id}},
  'content',
)

// after
div('content')
  .props({id: 'card'})
  .classes('card')
  .style({padding: '1em'})
  .data({cardId: id})
```

Nothing is deprecated — the old forms are gone. `h()` throws if it finds a map
where props used to sit, so a missed call site fails loudly rather than
rendering `[object Object]`.

### What moved where

| before                             | after                        |
| ---------------------------------- | ---------------------------- |
| `h('div', {id: 'x'})`              | `h('div').props({id: 'x'})`  |
| `{$styling: {color: 'red'}}`       | `.style({color: 'red'})`     |
| `{$classes: ['a', 'b']}`           | `.classes('a', 'b')`         |
| `{$attrs: {role: 'main'}}`         | `.attrs({role: 'main'})`     |
| `{$dataset: {foo: 'bar'}}`         | `.data({foo: 'bar'})`        |

`.key()`, `.on()` and `.opaque()` are unchanged.

### Mechanical rules

1. **A props object becomes `.props()`.** It moves out of the argument list and
   onto the end of the call, wherever the other setters go.

   ```javascript
   h('input', {type: 'checkbox', checked}) // before
   h('input').props({type: 'checkbox', checked}) // after
   ```

2. **`className` is usually better as `.classes()`.** It still works as a plain
   property, but the setter flattens nested lists and skips blank names, so
   conditionals need no filtering:

   ```javascript
   .classes('todo', completed && 'completed', editing && 'editing')
   ```

3. **A `null` props slot can simply go.** `h('p', null, 'text')` still renders
   `<p>text</p>` — `null` is a blank child and blank children render nothing —
   but `h('p', 'text')` says it better.

4. **Void element helpers take no arguments.** `img`, `input`, `link`, `meta`,
   `area`, `track`, `embed`, `param`, `source` and `col` used to take a props
   object and nothing else; now they take nothing, and are configured by
   chaining:

   ```javascript
   img({src, alt}) // before
   img().props({src, alt}) // after
   ```

5. **Component arguments are untouched.** `alias` and `special` components take
   whatever arguments you gave them, and an object first argument is still an
   ordinary argument there:

   ```javascript
   todoItem({todo, isEditing}) // unchanged
   scoped({styleSheets: [sheet]}, children) // unchanged
   ```

   The setters are element-only and throw on an `alias` or `special` vnode —
   except `.key()` and `.on()`, which apply to any vnode as before.

### Why

Props in the argument list meant a vnode's configuration was compared by
identity as a member of the `args` array. An object literal rebuilt each render
— which is every object literal in a render function — always looked changed,
so the reconciler took a second pass over every element on every render and
discovered there was nothing to do.

Chained values are compared as maps in their own right, through the same
`shouldUpdate` that compares everything else. `.props({id})` rebuilt with the
same contents now compares equal, and the second pass does not happen at all.

It also unwedges the two things that fought over one namespace: an element's
DOM properties and Dodo's directives. The `$` prefix existed only to keep
`$classes` from colliding with a real property named `classes`. With the
directives on the vnode and the properties in `.props()`, nothing collides and
nothing needs a prefix.
