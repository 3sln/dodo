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
  spawn: {classes: ['fade-in']},
  despawn: {classes: ['fade-out']},
  mode: 'remove',
})
```

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

Whatever a spec applies is removed again when the phase finishes or is
interrupted, so the reverse transition starts from a clean slate.

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

Set `duration` explicitly to override it. `computedAnimationDuration(element)`
is exported if you want the same measurement yourself.

## `runAnimation(element, spec, options?)`

The primitive underneath, with no dependency on dodo:

```javascript
import {runAnimation} from '@3sln/dodo/animate';

await runAnimation(element, {classes: ['shake'], duration: 400}, {signal});
```

| option     | meaning                                             |
| ---------- | ---------------------------------------------------- |
| `signal`   | an `AbortSignal` that cancels and cleans up           |
| `schedule` | how the next frame is reached, defaults to `rAF`      |
| `window`   | override the realm                                    |

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
