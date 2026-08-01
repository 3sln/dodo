/**
 * Test support for a real browser.
 *
 * Tests run under @web/test-runner in headless Chromium. Two things are needed
 * that the browser does not hand over by itself:
 *
 *   - a fresh realm per test, so one test's DOM, focus and stubs cannot reach
 *     the next. `createRealm()` gives one out of an iframe: a real document
 *     with real layout, real observers and a real `Node.prototype`.
 *   - the small assertion vocabulary the suite already speaks. It is nine
 *     matchers wide and delegates to chai, so failure messages stay useful.
 *     Keeping the dialect meant the move to a browser could be read as what it
 *     is — a change of environment — rather than as a rewrite of every
 *     assertion in the project.
 */

import {expect as chaiExpect} from 'chai';

export const describe = globalThis.describe;
export const test = globalThis.it;
export const beforeEach = globalThis.beforeEach;
export const afterEach = globalThis.afterEach;

// --- Realms ---------------------------------------------------------------

const realms = new Set();

/**
 * A fresh browsing context, standing in for what a DOM emulator's `new Window()`
 * used to provide. The iframe is left in the document and given a box, because
 * a detached or hidden one has no layout — and layout is exactly what several
 * of these tests are about.
 */
export function createRealm() {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'width:300px;height:300px;border:0;position:absolute;top:0;left:0';
  document.body.appendChild(frame);
  realms.add(frame);
  const realm = {window: frame.contentWindow, document: frame.contentDocument};
  realm.document.body.style.margin = '0';
  return realm;
}

export function destroyRealms() {
  for (const frame of realms) frame.remove();
  realms.clear();
}

// Realms are torn down after every test whether or not the test made one, so no
// file has to remember to.
globalThis.afterEach(destroyRealms);

// --- Spies ----------------------------------------------------------------

export function mock(implementation) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return implementation?.(...args);
  };
  fn.mock = {calls};
  return fn;
}

// --- Assertions -----------------------------------------------------------

function callCountOf(spy) {
  if (!spy?.mock) throw new Error('expected a mock() function');
  return spy.mock.calls.length;
}

function matchers(actual, negated) {
  const assert = negated ? chaiExpect(actual).to.not : chaiExpect(actual).to;
  const count = () =>
    negated ? chaiExpect(callCountOf(actual)).to.not : chaiExpect(callCountOf(actual)).to;

  return {
    toBe: expected => assert.equal(expected),
    toEqual: expected => assert.eql(expected),
    toBeUndefined: () => assert.equal(undefined),
    toBeTruthy: () =>
      negated ? chaiExpect(!!actual).to.be.false : chaiExpect(!!actual).to.be.true,
    toBeInstanceOf: expected => assert.be.instanceOf(expected),
    toContain: expected => assert.contain(expected),
    toThrow: expected => (expected === undefined ? assert.throw() : assert.throw(expected)),
    toHaveBeenCalled: () => count().be.greaterThan(0),
    toHaveBeenCalledTimes: times => count().equal(times),
  };
}

export function expect(actual) {
  return {...matchers(actual, false), not: matchers(actual, true)};
}
