# The `reconcile` function

The `reconcile` function is the heart of Dodo. It's responsible for applying your virtual DOM (VNode) changes to the actual DOM. It has a few distinct modes of operation.

## `reconcile(target, [vnodes...])` (Into)

When you pass an array of VNodes as the second argument, Dodo renders them **into** the `target` element, managing its children.

## `reconcile(target, vnode)` (Onto)

When you pass a single VNode, Dodo renders it **onto** the `target` element, taking control of the element itself. This has some important rules:

- If the VNode is a plain element (created with `h()` or a helper), its tag must match the `target` element's tag.
- If the VNode is an `alias` or `special` component, it can be rendered onto *any* element. It effectively takes over that element.

## `reconcile(target, null | [])` (Cleanup)

- `reconcile(target, [])` clears all children from a Dodo-managed element.
- `reconcile(target, null)` detaches Dodo entirely from the `target` element and all its descendants, running all necessary cleanup logic.

<deck-demo id="dodo-reconcile-demo" src="/demos/reconcile-demo.js"></deck-demo>
