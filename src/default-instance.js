/**
 * The settings object the bundled `@3sln/dodo/reactive` and
 * `@3sln/dodo/context` entry points are built from.
 *
 * It is a single shared object on purpose: the module factories memoise against
 * it, so both entry points resolve to one reactive API and therefore one
 * `watch` component. Two separately built `watch` components would be distinct
 * `special` descriptors, and the reconciler treats a descriptor as a node's
 * identity — they would never reuse each other's DOM nodes.
 */
import * as dodo from '../index.js';

export const defaultSettings = {dodo};
