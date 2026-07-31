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

## What the numbers say

Chrome 141, one machine, so treat the absolute figures as local. The shape holds.

**dodo is the fastest library here at not doing work.** Re-rendering 1,000
unchanged rows costs it nothing measurable, against 2.5–6.1ms for everything
else; selecting a single row costs 1.9ms against 2.3–6.2ms. That is what
comparing props, chained maps and alias arguments by contents rather than by
identity buys, and it is the case a real application hits constantly — a
re-render prompted by a change somewhere else.

**Swapping two rows costs 2 DOM mutations**, down from 997 before
`placeChildren` learned to close in from both ends. dodo now runs that case in
about the same time as snabbdom and preact. React still performs 997 mutations
for the same swap, for what that is worth.

**It is still the slowest at bulk work.** Creating, replacing and appending
1,000 rows run 15–40% behind, and clearing 1,000 rows takes three times as long
as anyone else for exactly the same 1,999 mutations — so that one is not the
DOM. It is the teardown walk: every node has its props restored, its listeners
removed and its state deleted.

**Allocation is high**, roughly 250 kB of garbage per update of 200 rows against
preact's 87 kB. The aliased variant allocates about 1.75x what the plain one
does, which is the wrapper vnodes and their DOM nodes.

## Two dodo columns

`dodo` uses `alias` for rows; `dodo (no alias)` uses a plain function. An alias
is backed by a real `<udom-alias>` element, so the aliased version puts 1,000
extra elements in the document that no other library here creates — and it is
the only one of the six that can then decline to re-render a row it knows has
not changed. The gap between the two columns is what that memoisation is worth:
16.3ms against nothing on an unchanged re-render, 15.3ms against 1.9ms on a
single selection.

Both call their components the ordinary way, with a props object built fresh on
every render. That works because `shouldUpdate` looks one level into the
arguments; while it compared them by identity alone, the wrapper never matched
and the first version of this benchmark measured dodo with its memoisation
silently disabled.
