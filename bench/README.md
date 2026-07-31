# Benchmarks

Runs dodo against four other vdom libraries — React, preact, snabbdom and
superfine — in headless Chromium.

```shell
bun install
bun run bench             # timings
bun run bench:ops         # timings and DOM mutation counts
bun run bench:memory      # timings, mutations and allocation
bun run bench:interactive # the same suite in a page, run by hand
```

`--rounds=N` sets how many rounds to run (default 12).

## How it measures

**In a real browser.** These benchmarks used to run against a DOM emulator,
which measured the emulator far more than it measured any library: a vdom
library's entire job is talking to a real DOM, and an emulator's `insertBefore`
has nothing to do with a browser's.

**One definition of the work.** The operations live in `src/suite.js`, not in
each library's adapter, so every library provably does the same thing to the
same rows. When each adapter owned its own copy, one of them did two renders for
"select a row" and another mutated its data in place and never re-rendered at
all — and the results looked perfectly plausible.

**Rows are replaced, not mutated.** A mutated row is the same object, so a
library that compares by identity is entitled to skip it and would be measured
doing nothing.

**Layout is forced inside the timed region**, so the browser's share of the work
counts against whichever operation caused it. Without that, a library that only
queues DOM mutations looks faster than one that performs them.

**Median of 12 rounds, first two discarded.** Library order rotates each round,
so a slow patch of wall clock is shared out rather than landing on whichever
library happened to be running. Data comes from a seeded generator, so every
library gets identical rows.

**React is built for production** (`NODE_ENV=production`) and rendered through
`flushSync`. Its development build carries warnings nobody ships, and without
`flushSync` React decides for itself when to do the work — a benchmark that stops
timing before the work happens measures nothing.

Two dodo columns: `dodo` uses `alias` for rows, `dodo (no alias)` uses a plain
function. An alias is backed by a real `<udom-alias>` element, so the aliased
version puts 1,000 extra elements in the document that no other library creates
— but it is also the only one of the six that can decline to re-render a row.

## What the numbers say

Chrome 141, one machine, so treat the absolute figures as local. The shape holds.

**dodo is the fastest library here at not doing work.** Re-rendering 1,000
unchanged rows costs it nothing measurable, against 2.2–5.5ms for everything
else; selecting a single row costs 1.7ms against 2.5–6.0ms. That is what the
per-facet comparison of props and chained maps buys, and it is the case a real
application hits constantly — a re-render prompted by a change somewhere else.

**It is the slowest at doing work in bulk.** Creating, replacing and appending
1,000 rows run 10–35% behind, and two operations are much worse than that.

**Swapping two rows costs 997 DOM mutations where preact, snabbdom and superfine
spend 2.** `placeChildren` walks the desired order against the current siblings
and relocates anything that does not match, so moving one row past another
cascades into moving everything between them. The mutation count is
deterministic — it is not a measurement artefact. React does the same thing, for
what that is worth.

**Clearing 1,000 rows takes three times as long as anyone else** for exactly the
same 1,999 mutations, so the cost is not in the DOM. It is the teardown walk:
every node has its props restored, its listeners removed and its state deleted.

**Allocation is high.** 256 kB of garbage per update of 200 rows against
preact's 87 kB. The alias variant allocates 1.75x what the plain one does, which
is the wrapper vnodes and their DOM nodes.

## A trap worth knowing about

`alias` memoises on its arguments, and `shouldUpdate` compares those arguments
**by identity**. So the documented idiom —

```javascript
const todoItem = dd.alias(props => { ... });
todoItem({todo, isEditing});           // fresh object every call
```

— never memoises, because the props object is rebuilt on every render and never
equals the last one. Passing arguments positionally does memoise:

```javascript
const todoItem = dd.alias((todo, isEditing) => { ... });
todoItem(todo, isEditing);
```

This is not a small difference. It is the whole of the `re-render unchanged`
column (0.00ms against 15.5ms) and most of `select one row` (1.7ms against
15.1ms). The first version of this benchmark used the object form and made dodo
look uniformly slower than everything it was measured against.
