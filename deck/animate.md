# Enter and Exit Animation

`@3sln/dodo/animate` is an **optional** module, built on
[the reactive module](/reactive.md). It holds an element on screen long enough
to animate out, and reports which phase of appearing or disappearing it is in.

## `withPresence(isPresent, builder, config?)`

`builder` receives the current phase:

```
despawned → spawning → spawned → despawning → despawned
```

```javascript
import {withPresence} from '@3sln/dodo/animate';

withPresence(isOpen, phase => dialog({open: phase !== 'despawned'}, body()), {
  spawn: {styling: {opacity: '1'}},
  despawn: {styling: {opacity: '0'}},
  mode: 'remove',
})
```

The component also mirrors its phase onto its own node as `data-presence`, which
is the hook to write CSS against — the node is created by the reconciler, so
there is otherwise no selector for it:

```css
[data-presence] { opacity: 0; transition: opacity 400ms ease; }
```

That base rule is the state the element animates **from**. The spawn spec's
styles are applied one frame later and become the state it rests **at**.

| config    | meaning                                                          |
| --------- | ---------------------------------------------------------------- |
| `spawn`   | the animation spec for entering                                   |
| `despawn` | the animation spec for leaving                                    |
| `mode`    | `'remove'` renders nothing once despawned                         |
| `display` | the display the node is given while present, `block` by default   |

An element that starts absent starts hidden, without animating. An element that
starts present animates in — that is usually the point.

<deck-demo id="dodo-animate-demo" src="/demos/animate-demo.js"></deck-demo>

## Animation specs

A spec says how one direction animates. Everything in it is optional, and
whatever you give runs concurrently — the phase advances when all of it is done.

| field       | meaning                                                       |
| ----------- | -------------------------------------------------------------- |
| `classes`   | class names added for the duration, then removed                |
| `styling`   | CSS properties (kebab-case) applied, then removed               |
| `animation` | `{keyframes, options}` handed to `Element.animate`               |
| `fn`        | `(element, {signal}) => Promise` for anything else               |
| `duration`  | overrides the duration read from computed style, in ms           |

Classes and styling are applied on the **next frame**, not immediately. An
element inserted during this frame has no previously rendered style to
transition *from*, so applying in the same tick produces a jump rather than an
animation.

"Next frame" here means a real `requestAnimationFrame`, deliberately *not*
dodo's scheduler. The scheduler drains everything queued while it is draining,
so work queued from inside a render lands in that same frame — and since every
reactive render is itself deferred through the scheduler, the element would be
created and styled without ever being painted at its starting state. The `frame`
setting overrides how a later frame is reached, for tests.

## Where a phase's styles end up

A spec's styles are the state the element animates **to**, and they stay put
when the phase completes — that state is the element's new resting state, and
removing it would snap the element back to where it started. When the opposite
phase begins, its styles go on in the same frame the previous phase's come off,
so there is never a frame showing neither.

An **interrupted** phase is different: it undoes itself immediately, because its
styles describe a state the element is no longer heading towards.

`runAnimation` on its own defaults to the opposite — `restore: true` — since a
standalone animation like a shake should leave no trace.

## Interruption

Toggling presence mid-animation aborts the animation in flight: its timers are
cleared, its `Element.animate` player is cancelled, its classes come off
immediately, and — the part that matters — its completion becomes a no-op, so it
cannot land a moment later and overwrite the newer phase. Detaching aborts it
the same way, and tears the subtree down properly.

If you supply `fn`, it is handed the same `AbortSignal` so it can bail out too.

## How long a transition takes

Waiting on `transitionend` is the obvious approach and it is a trap: a
transition that never starts, a property that did not actually change, or a
transition that was interrupted all leave you waiting forever, with a listener
still attached and the phase stuck.

So no listener is registered. After the classes are applied, the element's
computed `transition-duration`, `transition-delay`, `animation-duration` and
`animation-delay` are read, and the longest of them is how long the phase takes.
That is knowable, bounded, and correct even when nothing animates — in which
case it is zero and the phase advances immediately.

The element's direct children are measured too. A presence wrapper very often
has its transition declared on the content inside it rather than on itself, and
measuring only the wrapper would report zero and skip the animation entirely — a
silent no-op is a far worse failure than an overestimate.

Set `duration` explicitly to override it. `computedAnimationDuration(element)`
is exported if you want the same measurement yourself.

## `runAnimation(element, spec, options?)`

The primitive underneath, with no dependency on dodo:

```javascript
import {runAnimation} from '@3sln/dodo/animate';

await runAnimation(element, {classes: ['shake'], duration: 400}, {signal});
```

| option    | meaning                                                        |
| --------- | --------------------------------------------------------------- |
| `signal`  | an `AbortSignal` that cancels and cleans up                      |
| `frame`   | how a genuinely later frame is reached, defaults to `rAF`        |
| `restore` | remove the applied styles on completion, `true` by default       |
| `replace` | a previous spec whose styles come off as these go on             |
| `window`  | override the realm                                               |

## Baking your own

Same shape as the other modules — the reactive API is a required injection:

```javascript
import reactive from '@3sln/dodo/src/reactive.js';
import animate from '@3sln/dodo/src/animate.js';

const userSettings = {dodo: myDodo};

const {withPresence} = animate({
  ...userSettings,
  reactive: reactive(userSettings),
});
```
