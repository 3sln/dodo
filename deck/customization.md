# Customization

Dodo is designed to be configurable. You can create your own instance of the Dodo API by calling the `dodo` factory with a settings object. This is particularly useful when integrating with other languages or frameworks that have their own data structures, like ClojureScript's persistent maps and vectors.

## ClojureScript Example

This demo shows how to configure Dodo to work with ClojureScript. The demo runs the *compiled* JavaScript output, but displays the original `.cljs` source code in the "Source" panel, thanks to the `canonical-src` attribute.

<deck-demo id="cljs-demo" src="/demos/custom-dodo/custom-dodo.js" canonical-src="/demos/custom-dodo/custom-dodo.cljs"></deck-demo>

## Describing your maps

Dodo needs to read a map, and to walk its entries. Reading is `mapGet`. Walking
comes in two shapes, and you may supply either:

| setting                            | shape                                                     |
| ---------------------------------- | --------------------------------------------------------- |
| `mapIter(map)`                      | returns an iterable or iterator of `[name, value]` pairs   |
| `mapEach(map, visit, a, b, c)`      | calls `visit(name, value, a, b, c)` for each entry         |

`mapIter` is the simpler one and is enough. `mapEach` exists because
reconciling a single element walks its props, styling, attrs, dataset and
hooks — and building an array of pairs for each of those, on every update, is
the largest single source of garbage in a render.

`mapEach` never materialises the pairs, so a custom collection can be exactly as
cheap as a plain object. ClojureScript has `reduce-kv`, Immutable.js has
`forEach`, and most persistent structures have something similar:

```javascript
dodo({
  isMap: x => x instanceof MyMap,
  mapGet: (m, k) => m.get(k),
  mapEach: (m, visit, a, b, c) => m.forEach((v, k) => visit(k, v, a, b, c)),
  // ...
});
```

The `a`/`b`/`c` slots carry the reconciler's context through to its visitor, so
that iterating does not allocate a closure either. Pass them straight through
and otherwise ignore them.

Supply both and `mapEach` is used. Supply neither and dodo assumes plain
objects — which is also what `isMap`, `mapGet` and the rest default to, so a
custom collection was always a matter of describing it fully.

> [!NOTE]
> If you override `isMap` and `mapGet` for a custom collection, you must also
> override `mapIter` or `mapEach`. Without one of them dodo will walk your maps
> as if they were plain objects and find nothing.