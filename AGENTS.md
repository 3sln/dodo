# Dodo Agent Guidelines

This document outlines guidelines for LLM agents interacting with the `dodo` project.

## 1. Architecture Overview

- **Releasing:** Bumping `version` in `package.json` on `main` opens a draft release (`.github/workflows/draft-release.yml`). Publishing that draft creates the tag and publishes to npm (`.github/workflows/publish.yml`), after re-running the tests and checking the tag matches `package.json`. Nothing is tagged or published by a version bump alone. Requires an `NPM_TOKEN` repository secret.
- **VDOM Factory:** The main export of the library is a factory function, `vdom(userSettings)`, located in `src/vdom.js`. This function creates a closure containing a complete, configured VDOM API.
- **Optional Modules:** `src/reactive.js`, `src/context.js`, `src/observe.js`, `src/animate.js` and `src/style.js` are opt-in extras exposed as `@3sln/dodo/{reactive,context,observe,animate,style}`. The core must never import them; they only consume the public dodo API they are handed. Keep it that way. `src/dom.js` holds the realm helpers they share.
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
- **Chained Specials:** Styling, classes, attributes and dataset entries are chained onto the vnode (`.style()`, `.classes()`, `.attrs()`, `.data()`) rather than passed as props, and are held in a single `$` object on the `VNode`. One container rather than four fields: a vnode is allocated per element per render, so every optional field is another shape for the engine to track, and it makes "did any of these change" a single identity check for the majority of nodes that chain none of them. The `$`-prefixed props they replace (`$styling`, `$classes`, `$attrs`, `$dataset`) are deprecated — still handled in `applyProp`, warning once per prop name per instance, and to be deleted wholesale. Keep that path isolated so the deletion stays a clean subtraction, and do not mix the two forms for the same facet on one element.
- **Comparing Specials:** `vnodeChanged` compares args, hooks and the specials facet by facet. Comparing the `$` container itself would be worse than useless — its values are rebuilt per render, so it would always report a change; comparing `styling` against `styling` lets `shouldUpdate`'s shallow map compare do its job, and a `.style()` map with unchanged contents costs no second pass at all.
- **Immutability:** The reconciliation process relies on comparing VNode objects. Do not mutate VNodes after creation.
- **Performance:** The default `shouldUpdate` function performs a shallow comparison on arrays and plain objects to avoid unnecessary reconciliations. Be mindful of the performance implications of any changes.
- **Hot Path Allocation:** Reconciling one element walks its props, styling, attrs, dataset and hooks. Materialising a `[name, value]` pair per entry for each of those maps, on every update, is the largest single source of garbage in a render: 200 rows of five props over 400 updates grows the heap 77 MB that way versus 14 MB through `mapEach(map, visit, a, b, c)`, which never materialises entries. Visitors are hoisted to the factory closure and take their context through the `a`/`b`/`c` slots, so iterating allocates neither entries nor a closure. Keep new visitors hoisted.
- **The Default Walk Is `for...in`:** Guarded by the hoisted `hasOwn`, which enumerates exactly the keys `Object.keys` would while allocating no key array — ~3.5x faster in isolation. Do not "clean it up" to `Object.keys`, and do not swap the guard for `Object.hasOwn`, which reads better but costs about as much as building the key array and so gives the whole thing back.
- **Why Not A Tuple-Reusing `mapIter`:** The obvious alternative to `mapEach` is a default `mapIter` returning an iterator that reuses its entry tuple, keeping one settings key instead of two. It was built and measured, and it loses. An iterator has to be resumable, so it cannot use `for...in` and must materialise `Object.keys` up front — and a bare cursor over that key array, with no result object at all, already costs as much as `Object.entries` (206ms vs 223ms over 2M iterations of a five entry map). Tuple reuse cannot recover what the key array spends. On top of that V8 inlines the *built-in* array iterator but not a user-defined `next()`, so the hand-rolled version lands at 349ms against 71ms for `mapEach`. The asymmetry is push versus pull: pull-to-push is free, push-to-pull needs buffering, and custom collections are push-native (`reduce-kv`, `forEach`). It would also make the public `settings.mapIter` hand out a tuple that must not be retained.
- **The Seq Path Is Already Optimal:** `flattenSeqIntoArray` iterating plain arrays through `toIterator` beats both `for..of` and a hand-written `Array.isArray` index loop, at 10, 200 and 2000 elements. V8 fully inlines the built-in array iterator. The lesson from `mapEach` does not transfer here — iterators were never the problem, materialising pairs was. Leave it alone.
- **Custom Collections:** `mapEach` is a settings key, so a ClojureScript or Immutable.js map can be exactly as cheap as a plain object (`reduce-kv`, `forEach`). A user supplying only `mapIter` still works — it is adapted via `mapEachViaIter` — and that contract is unchanged. The plain-object walk is used only when the user supplied neither. Never gate the fast path on an identity check against an internal default; gate it on what the user actually declared.
- **Untrusted Props:** Props may be built from server data. Property names are written straight onto DOM nodes, so `UNSAFE_PROP_NAMES` (`__proto__` and friends) are refused, and per-node bookkeeping objects are null-prototyped.
- **Blank Values:** `null`, `undefined` and `false` render nothing; `0` and `''` are real text children. Use the `isBlank` helper rather than a loose falsey check.
- **Focus During Reordering:** Detaching a focused node blurs it. Where `Node.prototype.moveBefore` exists it relocates without detaching and children are simply placed in order. Where it does not, `placeChildrenAroundAnchor` treats the focused child as a fixed anchor and arranges every other child around it — the anchor still lands at its correct index because the right number of children end up on each side. Never "skip" placing a node: that leaves the DOM order diverging from the vdom.

### Optional Modules

- **Factory Pattern:** Module factories take a `userSettings` object carrying a `dodo` instance — `reactive({dodo})`, `context({dodo, reactive})` — matching the shape used across the project. `src/settings.js` resolves defaults. Factories are not memoised and must not become so: dependencies between modules are injected explicitly instead.
- **Mandatory Injection:** `context` renders through a `watch` and *requires* `reactive` to be supplied; it must not fall back to building its own. A private fallback would produce a `watch` that is a different component from the application's, and since a `special`'s identity is its descriptor object and the reconciler uses that identity for node reuse, the two would silently never reuse each other's nodes. The bundled `context.js` entry point imports `watch` from `reactive.js` and injects it.
- **Module Scope:** `context` exports context components only. It does not re-export `watch` — that belongs to the reactive module.
- **Settings:** `dodo` (required), `schedule`, `renderError`, and `reactive` (required by `context`). Map handling and change detection are not overridable — they always come from `dodo.settings`, because a module must agree with its renderer about what a map is.
- **The Cell Protocol:** `{onDirty(fn) -> unsubscribe, getValue() -> any}`. This, not the observable protocol, is what the reactive module depends on. Adapters (`fromObservable`, `fromSubscribe`, `fromSignal`) bridge external libraries. `PENDING` means "no value yet"; errors are reported by throwing from `getValue()`.
- **Lazy Connection:** Adapted cells subscribe upstream on their first listener and unsubscribe on their last. Preserve that — it is what stops a detached `watch` from leaking a subscription.
- **Context Is DOM-Scoped:** Providers live on their own DOM node and consumers walk up to find them. Nothing is registered globally.
- **Observation Targets:** `alias` and `special` wrappers are `display: contents`, and neither observer reports anything useful for a boxless element. `withElementSize` walks up via `nearestLaidOutElement` (you want the container's size); `withVisibility` gives its own node a box instead (you want *this* content's visibility, not an ancestor's). Do not "fix" one to match the other — the difference is the point.
- **Observer Realms:** Observer constructors and `getComputedStyle` come from `element.ownerDocument.defaultView`, never from globals, so iframes and non-global test DOMs work. A missing constructor throws at connect time, which `watch` renders as its error view.
- **Never Wait On `transitionend`:** A transition that never starts, a property that did not change, an interrupted transition, and a multi-property transition all break event-based waiting — you hang forever, or resolve too early, with a listener still attached. `animate` reads the declared duration from computed style instead and registers no listener at all. Do not "improve" this back into events.
- **Interruption Is Abort:** Every animation runs under an `AbortSignal`. Aborting clears timers, cancels the `Element.animate` player, removes applied classes *synchronously* (so a reversal's classes never overlap), and makes the completion a no-op so a stale phase cannot land after a newer one.
- **`frame` Is Not `schedule`:** `runAnimation` must reach a genuinely later frame before applying styles, or a just-created element is never painted at its start state and the transition has nothing to run from. Dodo's scheduler cannot serve: `runQueue` drains everything queued while draining, so work queued from inside a render lands in the same frame — and every reactive render is itself deferred through it. They are separate settings; do not merge them.
- **A Phase's Styles Are Its Resting State:** They persist on completion and are swapped out in the same frame the opposite phase's go on. Removing them on completion snaps the element back to its start. An *aborted* phase does undo itself. `runAnimation` alone defaults to `restore: true`, which is right for a standalone animation and wrong for a transition between states.
- **`data-presence`:** `withPresence` mirrors its phase onto its node, because the node is created by the reconciler and CSS has no other selector for it.
- **Fresh Spec Objects:** `readSpec` builds a new object per call. Bones reused one shared result object, so every element from a factory ended up with the most recently attached element's config.
- **`css` Is Memoised Per Call Site:** Keyed on the tagged template's frozen `strings` array, which is stable per source location. That is what makes `css` safe to write inline in a render function. Interpolation must treat only nullish as blank — `${0}` is a value.
- **Shadow Roots Need Explicit Teardown:** A shadow root cannot be detached, so `detachShadow` reconciles its contents away and drops the adopted sheets. Skipping this looks harmless and leaks every listener underneath.
- **Values Must Compare Cheaply:** Cells feeding `watch` should yield plain objects. `defaultShouldUpdate` reports any object that is neither an array nor a plain object as always changed, so returning a `DOMRect` would re-render on every observer callback.

---

## 4. For Users (Agents Using `dodo` to Build UIs)

This section applies when you are using `dodo` to build an application or UI.

### API Best Practices

- **Use HTML Helpers:** Prefer using the simple HTML helper functions (`div`, `p`, `span`, etc.) for creating VNodes.
- **Props Are Plain Properties:** The props object holds standard element properties only (`id`, `className`, `value`, etc.), written straight onto the element. Everything else is chained.
- **Chained Methods:** Each returns the VNode, so they compose in any order.
    - **`.style({ ... })`**: Inline styles. Element nodes only.
    - **`.classes(...names)`**: Class names. Nested lists are flattened and blank names are skipped, so `.classes('card', isActive && 'active')` needs no filtering. Element nodes only.
    - **`.attrs({ ... })`**: Attributes, set with `setAttribute`. Element nodes only.
    - **`.data({ ... })`**: `dataset` entries. Element nodes only.
    - **`.key(id)`**: Adds a key for list reconciliation. Can be chained onto any VNode.
    - **`.on({ evt: fn })`**: Attaches event listeners or lifecycle hooks. Can be chained onto any VNode.
    - **`.opaque()`**: Marks an element node as opaque, meaning `dodo` will manage its props but not its children. Can only be chained onto element nodes (`h` or helpers).
    - Each of `.style()`, `.classes()`, `.attrs()` and `.data()` replaces rather than merges, exactly like `.key()` and `.on()`: calling one twice leaves only the second value.
    ```javascript
    dd.div({ id: 'card' }, 'content')
      .style({ 'background-color': 'white' })
      .classes('card', isActive && 'active')
      .data({ cardId: id })
      .key(id);
    ```
- **Deprecated `$`-Prefixed Props:** `$styling`, `$classes`, `$attrs` and `$dataset` are the old form of the four setters above. They still work and warn once per prop name, but they will be removed — use the chained setters instead.

### Syntax Clarifications

This section covers common points of confusion in the `dodo` API.

#### 1. Passing Children

Child VNodes are **always** passed as arguments to the helper function, *after* the optional props object. There is no `.children()` method.

-   **Correct:** `div({ id: 'parent' }, h1('Title'), p('Content'))`
-   **Incorrect:** `div({ id: 'parent' }).children(h1('Title'), ...)`

#### 2. Styling Properties

When using `.style()`, all CSS property names **must** be kebab-cased, as they are in standard CSS. CamelCase will not work.

-   **Correct:** `div().style({ 'margin-bottom': '1em', 'font-size': '16px' })`
-   **Incorrect:** `div().style({ marginBottom: '1em', fontSize: '16px' })`

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