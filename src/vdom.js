const ELEMENT_NODE = Symbol('ELEMENT_NODE');
const ALIAS_NODE = Symbol('ALIAS_NODE');
const SPECIAL_NODE = Symbol('SPECIAL_NODE');
const OPAQUE_NODE = Symbol('OPAQUE_NODE');
const NODE_STATE = Symbol('NODE_STATE');
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

// Property names that must never be written through to a DOM node: assigning
// `__proto__` swaps the node's prototype, which corrupts the element for every
// later operation. Relevant whenever props are built from untrusted data.
const UNSAFE_PROP_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// HTML tag names come back from the DOM upper cased while SVG/MathML keep their
// authored case. A plain case-insensitive compare covers both, and unlike
// `localeCompare` it neither builds a collator nor depends on the host locale.
function sameTagName(nodeName, tag) {
  return typeof tag === 'string' && nodeName.toLowerCase() === tag.toLowerCase();
}

class VNode {
  constructor(type, tag, args) {
    this.type = type;
    this.tag = tag;
    this.args = args;
  }

  key(k) {
    this.k = k;
    return this;
  }

  on(hooks) {
    this.hooks = hooks;
    return this;
  }

  opaque() {
    if (this.type !== ELEMENT_NODE) {
      throw new Error('.opaque() can only be used on element nodes (h).');
    }
    this.type = OPAQUE_NODE;
    return this;
  }
}

function defaultShouldUpdate(a, b) {
  if (a === b) return false;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor) return true;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return true;
      for (let j = 0; j < a.length; j++) {
        if (a[j] !== b[j]) return true;
      }
      return false;
    }

    if (a.constructor === Object) {
      const keysA = Object.keys(a);
      if (keysA.length !== Object.keys(b).length) return true;
      for (const key of keysA) {
        if (!hasOwn(b, key) || a[key] !== b[key]) return true;
      }
      return false;
    }
  }
  return true;
}

function isIterable(x) {
  return (
    Array.isArray(x) ||
    (x != null && typeof x[Symbol.iterator] === 'function' && typeof x !== 'string')
  );
}

function alias(f) {
  return (...args) => new VNode(ALIAS_NODE, f, args);
}

function special(o) {
  return (...args) => new VNode(SPECIAL_NODE, o, args);
}

function newElementNamespace(parentNode, newNodeTag) {
  if (parentNode.namespaceURI === HTML_NAMESPACE) {
    switch (newNodeTag) {
      case 'svg':
        return 'http://www.w3.org/2000/svg';
      case 'math':
        return 'http://www.w3.org/1998/Math/MathML';
    }
  }
  return parentNode.namespaceURI ?? parentNode.host?.namespaceURI ?? HTML_NAMESPACE;
}

// `originalProps` is null-prototyped so that prop names like `__proto__` or
// `toString` are recorded as ordinary own keys rather than hitting Object.prototype.
function newNodeState(vdom) {
  return {originalProps: Object.create(null), newVdom: vdom};
}

function createElementNode(parentNode, tag, vdom) {
  const el = parentNode.ownerDocument.createElementNS(newElementNamespace(parentNode, tag), tag);
  el[NODE_STATE] = newNodeState(vdom);
  return el;
}

const documentToFocusWithinSet = new WeakMap();

function getPathFromElement(element) {
  const path = [];
  let current = element;
  while (current) {
    path.push(current);
    if (current.parentElement) {
      current = current.parentElement;
    } else {
      current = current.getRootNode()?.host;
    }
  }
  return path;
}

function addPathToFocusWithinSet(set, path) {
  for (const node of path) {
    set.add(node);
  }
}

// The realm's own `Node.prototype` is what we want, so that a node from an
// iframe or a detached document is moved by its own implementation. Falls back
// through the configured window and then the ambient one, either of which may
// be all that is available for a document with no `defaultView`.
function nodePrototypeFor(doc, settingsWindow) {
  const view = settingsWindow ?? doc?.defaultView ?? globalThis;
  return view.Node?.prototype ?? view.Element?.prototype;
}

function installFocusTrackingForDocument(doc) {
  const focusWithinSet = new Set();
  // The set is rebuilt on every focusin rather than accumulated. `focusin`
  // fires after `focusout`, and its composed path is the path of the element
  // that just gained focus, so this is always exactly the current focus path.
  // Accumulating instead would leave every previously focused element marked as
  // holding focus for the rest of the document's life.
  doc.addEventListener('focusin', event => {
    focusWithinSet.clear();
    addPathToFocusWithinSet(focusWithinSet, event.composedPath());
  });
  doc.addEventListener('focusout', event => {
    // A focusout with no relatedTarget means focus left the document entirely;
    // otherwise the focusin that follows will rebuild the set.
    if (!event.relatedTarget) focusWithinSet.clear();
  });
  addPathToFocusWithinSet(focusWithinSet, getPathFromElement(doc.activeElement));
  documentToFocusWithinSet.set(doc, focusWithinSet);
  return focusWithinSet;
}

export default userSettings => {
  const shouldUpdate = userSettings?.shouldUpdate ?? defaultShouldUpdate;
  const isMap = userSettings?.isMap ?? (x => x?.constructor === Object);
  const mapIter = userSettings?.mapIter ?? (m => Object.entries(m));
  const mapGet = userSettings?.mapGet ?? ((m, k) => m[k]);
  const mapMerge = userSettings?.mapMerge ?? ((...maps) => Object.assign({}, ...maps));
  const newMap = userSettings?.newMap ?? (obj => ({...obj}));
  const mapPut =
    userSettings?.mapPut ??
    ((m, k, v) => {
      m[k] = v;
      return m;
    });
  const isSeq = userSettings?.isSeq ?? isIterable;
  const seqIter = userSettings?.seqIter ?? (s => s);
  const convertName = userSettings?.convertName ?? (x => x);
  const convertTagName = userSettings?.convertTagName ?? convertName;
  const convertPropName = userSettings?.convertPropName ?? convertName;
  const convertStyleName = userSettings?.convertStyleName ?? convertName;
  const convertDataName = userSettings?.convertDataName ?? convertName;
  const convertClassName = userSettings?.convertClassName ?? convertName;
  const convertHookName = userSettings?.convertHookName ?? convertName;
  const listenerKey = userSettings?.listenerKey ?? 'listener';
  const captureKey = userSettings?.captureKey ?? 'capture';
  const passiveKey = userSettings?.passiveKey ?? 'passive';

  const EMPTY_MAP = newMap({});

  function toIterator(iterableOrIterator) {
    if (iterableOrIterator == null) return [][Symbol.iterator]();
    if (typeof iterableOrIterator[Symbol.iterator] === 'function') {
      return iterableOrIterator[Symbol.iterator]();
    }
    if (typeof iterableOrIterator.next === 'function') {
      return iterableOrIterator;
    }
    return [iterableOrIterator][Symbol.iterator]();
  }

  // Reconciling one element walks its props, styling, attrs, dataset and hooks,
  // so building an array of [name, value] pairs for each of those maps is the
  // single biggest source of garbage in an update. `mapEach` is the iteration
  // primitive the reconciler actually uses: it visits entries without
  // materialising them.
  //
  // Supply `mapEach` for a custom collection and it is as cheap as a plain
  // object — ClojureScript has `reduce-kv`, Immutable.js has `forEach`. Supply
  // only `mapIter` and it still works, by way of the pairs it yields; that is
  // the existing contract and it is unchanged.
  //
  // The extra `a`/`b`/`c` slots let call sites pass context to a hoisted
  // visitor, so iterating does not allocate a closure either.
  function defaultMapEach(map, visit, a, b, c) {
    if (map == null) return;
    const keys = Object.keys(map);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      visit(key, map[key], a, b, c);
    }
  }

  function mapEachViaIter(map, visit, a, b, c) {
    if (map == null) return;
    const iterator = toIterator(mapIter(map));
    let result;
    while (!(result = iterator.next()).done) {
      const entry = result.value;
      visit(entry[0], entry[1], a, b, c);
    }
  }

  // Only fall back to the plain-object walk when the user has told us nothing
  // about their maps. Overriding `mapIter` alone still routes through it.
  const mapEach =
    userSettings?.mapEach ?? (userSettings?.mapIter ? mapEachViaIter : defaultMapEach);

  // `null`, `undefined` and `false` are the "render nothing" values. Note the
  // checks are strict: `0` and `''` are legitimate text children.
  function isBlank(item) {
    return item === null || item === undefined || item === false;
  }

  function flattenSeqIntoArray(array, items, excludeFalsey) {
    const iterator = toIterator(seqIter(items));
    let result;
    while (!(result = iterator.next()).done) {
      const item = result.value;
      if (excludeFalsey && isBlank(item)) {
        continue;
      }

      if (!isSeq(item)) {
        array.push(item);
      } else {
        flattenSeqIntoArray(array, item, excludeFalsey);
      }
    }
  }

  function defaultFlattenSeq(items, excludeFalsey) {
    const array = [];
    flattenSeqIntoArray(array, items, excludeFalsey);
    return array;
  }

  const flattenSeq = userSettings?.flattenSeq ?? defaultFlattenSeq;

  function flattenVNodeChildren(children, startIndex) {
    const array = [];
    for (let i = startIndex; i < children.length; i++) {
      const item = children[i];
      if (isBlank(item)) continue;
      if (!isSeq(item)) {
        array.push(item);
      } else {
        flattenSeqIntoArray(array, item, true);
      }
    }
    return array;
  }

  // Blank children are filtered out before they reach here, but a custom
  // `flattenSeq` may not do that filtering, so never assume `.toString()` exists.
  function toText(value) {
    return isBlank(value) ? '' : String(value);
  }

  function h(tag, props, ...children) {
    if (!isMap(props)) {
      // An explicit nullish props slot means "no props", not "render nothing".
      if (props !== null && props !== undefined) children.unshift(props);
      props = EMPTY_MAP;
    }
    return new VNode(ELEMENT_NODE, convertTagName(tag), [props, ...children]);
  }

  // Visitors are hoisted to the factory closure rather than written inline, so
  // that iterating a map allocates neither entries nor a callback.
  function setStyleProperty(name, value, style) {
    style.setProperty(convertStyleName(name), value);
  }

  function removeStaleStyleProperty(name, _value, style, newStyling) {
    if (mapGet(newStyling, name) !== undefined) return;
    style.removeProperty(convertStyleName(name));
  }

  function reconcileElementStyling(target, oldStyling, newStyling) {
    const style = target.style;
    mapEach(newStyling, setStyleProperty, style);
    mapEach(oldStyling, removeStaleStyleProperty, style, newStyling);
  }

  function setAttribute(name, value, target) {
    target.setAttribute(convertPropName(name), value);
  }

  function removeStaleAttribute(name, _value, target, newAttrs) {
    if (mapGet(newAttrs, name) !== undefined) return;
    target.removeAttribute(convertPropName(name));
  }

  function reconcileElementAttributes(target, oldAttrs, newAttrs) {
    mapEach(newAttrs, setAttribute, target);
    mapEach(oldAttrs, removeStaleAttribute, target, newAttrs);
  }

  function setDataProperty(name, value, target) {
    target.dataset[convertDataName(name)] = value;
  }

  function removeStaleDataProperty(name, _value, target, newDataset) {
    if (mapGet(newDataset, name) !== undefined) return;
    delete target.dataset[convertDataName(name)];
  }

  function reconcileElementDataset(target, oldDataset, newDataset) {
    mapEach(newDataset, setDataProperty, target);
    mapEach(oldDataset, removeStaleDataProperty, target, newDataset);
  }

  function reconcileElementClasses(target, oldClasses, newClasses) {
    // Both sides are compared post-conversion, otherwise a non-identity
    // `convertClassName` would never match an old class against a new one.
    const classesToRemove = new Set();
    for (const c of flattenSeq(oldClasses, true)) {
      const className = convertClassName(c);
      if (className) classesToRemove.add(className);
    }
    for (const c of flattenSeq(newClasses, true)) {
      const className = convertClassName(c);
      // `classList.add('')` throws, and empty class names carry no meaning.
      if (!className) continue;
      classesToRemove.delete(className);
      target.classList.add(className);
    }
    for (const className of classesToRemove) {
      target.classList.remove(className);
    }
  }

  function setElementProp(target, nodeState, propName, newValue) {
    if (UNSAFE_PROP_NAMES.has(propName)) {
      console.error(`Refusing to assign unsafe prop name '${propName}' to a DOM node.`);
      return;
    }
    const originalProps = nodeState.originalProps;
    if (!(propName in originalProps)) {
      originalProps[propName] = target[propName];
    }
    target[propName] = newValue === undefined ? originalProps[propName] : newValue;
  }

  function restoreElementProp(target, nodeState, propName) {
    const originalProps = nodeState.originalProps;
    if (propName in originalProps) {
      target[propName] = originalProps[propName];
      delete originalProps[propName];
    }
  }

  function applyProp(name, newValue, target, oldProps, isHtml) {
    const propName = convertPropName(name);
    const oldValue = mapGet(oldProps, name);

    if (Object.is(newValue, oldValue)) return;

    switch (propName) {
      case '$styling': {
        if (!isMap(newValue)) throw new Error('invalid value for styling prop');
        reconcileElementStyling(target, oldValue ?? EMPTY_MAP, newValue ?? EMPTY_MAP);
        break;
      }
      case '$classes': {
        if (!isSeq(newValue)) throw new Error('invalid value for classes prop');
        reconcileElementClasses(target, oldValue ?? [], newValue ?? []);
        break;
      }
      case '$attrs': {
        if (!isMap(newValue)) throw new Error('invalid value for attrs prop');
        reconcileElementAttributes(target, oldValue ?? EMPTY_MAP, newValue ?? EMPTY_MAP);
        break;
      }
      case '$dataset': {
        if (!isMap(newValue)) throw new Error('invalid value for dataset prop');
        reconcileElementDataset(target, oldValue ?? EMPTY_MAP, newValue ?? EMPTY_MAP);
        break;
      }
      default: {
        if (isHtml) {
          setElementProp(target, target[NODE_STATE], propName, newValue);
        } else {
          if (newValue === undefined) {
            target.removeAttribute(propName);
          } else {
            target.setAttribute(propName, newValue);
          }
        }
        break;
      }
    }
  }

  function restoreRemovedProp(name, oldValue, target, props, isHtml) {
    if (mapGet(props, name) !== undefined) return; // it wasn't removed

    const propName = convertPropName(name);
    switch (propName) {
      case '$styling':
        reconcileElementStyling(target, oldValue ?? EMPTY_MAP, EMPTY_MAP);
        break;
      case '$classes':
        reconcileElementClasses(target, oldValue ?? [], []);
        break;
      case '$attrs':
        reconcileElementAttributes(target, oldValue ?? EMPTY_MAP, EMPTY_MAP);
        break;
      case '$dataset':
        reconcileElementDataset(target, oldValue ?? EMPTY_MAP, EMPTY_MAP);
        break;
      default: {
        if (isHtml) {
          restoreElementProp(target, target[NODE_STATE], propName);
        } else {
          target.removeAttribute(propName);
        }
        break;
      }
    }
  }

  function reconcileElementProps(target, props) {
    const nodeState = target[NODE_STATE];
    const isHtml = target.namespaceURI === HTML_NAMESPACE;
    const oldProps = nodeState.vdom?.args[0] ?? EMPTY_MAP;

    mapEach(props, applyProp, target, oldProps, isHtml);
    mapEach(oldProps, restoreRemovedProp, target, props, isHtml);
  }

  function addListener(target, hookName, listener) {
    if (typeof listener === 'function') {
      target.addEventListener(hookName, listener);
    } else if (listener != null) {
      target.addEventListener(hookName, mapGet(listener, listenerKey), {
        capture: !!mapGet(listener, captureKey),
        passive: !!mapGet(listener, passiveKey),
      });
    }
  }

  function removeListener(target, hookName, listener) {
    if (typeof listener === 'function') {
      target.removeEventListener(hookName, listener);
    } else if (listener != null) {
      target.removeEventListener(
        hookName,
        mapGet(listener, listenerKey),
        !!mapGet(listener, captureKey),
      );
    }
  }

  function addInitialListener(name, listener, target) {
    const hookName = convertHookName(name);
    if (hookName[0] === '$') return;
    addListener(target, hookName, listener);
  }

  function swapListener(name, listener, target, oldHooks) {
    const hookName = convertHookName(name);
    if (hookName[0] === '$') return;
    const oldListener = mapGet(oldHooks, name);
    if (listener === oldListener) return;
    removeListener(target, hookName, oldListener);
    addListener(target, hookName, listener);
  }

  function removeStaleListener(name, oldListener, target, newHooks) {
    const hookName = convertHookName(name);
    if (hookName[0] === '$' || mapGet(newHooks, name) !== undefined) return;
    removeListener(target, hookName, oldListener);
  }

  function reconcileListeners(target, hooks) {
    const state = target[NODE_STATE];
    const newHooks = hooks ?? EMPTY_MAP;

    if (!state.vdom) {
      mapEach(newHooks, addInitialListener, target);
      return;
    }

    const oldHooks = state.vdom.hooks ?? EMPTY_MAP;
    mapEach(newHooks, swapListener, target, oldHooks);
    mapEach(oldHooks, removeStaleListener, target, newHooks);
  }

  function reconcileNode(target) {
    const state = target[NODE_STATE];
    const newVdom = state.newVdom;
    const oldVdom = state.vdom;
    const args = newVdom.args;

    switch (newVdom.type) {
      case ELEMENT_NODE: {
        reconcileElementProps(target, args[0]);
        reconcileElementChildren(target, flattenVNodeChildren(args, 1));
        break;
      }
      case OPAQUE_NODE: {
        reconcileElementProps(target, args[0]);
        break;
      }
      case ALIAS_NODE: {
        const innerVdom = newVdom.tag.apply(target, newVdom.args);
        if (isBlank(innerVdom)) {
          reconcileElementChildren(target, []);
        } else if (isSeq(innerVdom)) {
          reconcileElementChildren(target, flattenSeq(innerVdom, true));
        } else {
          reconcileElementChildren(target, [innerVdom]);
        }
        break;
      }
      case SPECIAL_NODE: {
        try {
          newVdom.tag.update?.(target, newVdom.args, oldVdom?.args);
        } catch (err) {
          console.error(err);
        }
        break;
      }
    }

    if (newVdom.hooks || oldVdom?.hooks) {
      reconcileListeners(target, newVdom.hooks ?? EMPTY_MAP);
    }
    try {
      newVdom.hooks?.$update?.(target, newVdom, oldVdom);
    } catch (err) {
      console.error(err);
    }
    state.vdom = newVdom;
    delete state.newVdom;
  }

  function createNode(parentNode, vdom) {
    if (typeof vdom !== 'object' || vdom === null) {
      return parentNode.ownerDocument.createTextNode(toText(vdom));
    }

    let domNode;
    switch (vdom.type) {
      case ELEMENT_NODE:
      case OPAQUE_NODE:
        domNode = createElementNode(parentNode, vdom.tag, vdom);
        break;
      case ALIAS_NODE:
        domNode = createElementNode(parentNode, 'udom-alias', vdom);
        domNode.style.display = 'contents';
        break;
      case SPECIAL_NODE:
        domNode = createElementNode(parentNode, 'udom-special', vdom);
        domNode.style.display = 'contents';
        break;
      default:
        throw new Error('Invalid VDOM node');
    }
    return domNode;
  }

  function cleanupTargetChildren(target) {
    if (target.children) {
      for (const child of target.children) {
        cleanupTarget(child);
      }
    }
  }

  function cleanupTarget(target) {
    const state = target[NODE_STATE];
    if (!state) {
      return;
    }

    const {vdom} = state;
    if (!vdom) {
      // The node was created but never reconciled (a builder threw part way
      // through); there is nothing attached to tear down.
      delete target[NODE_STATE];
      return;
    }

    if (vdom.hooks) {
      reconcileListeners(target, EMPTY_MAP);
    }

    if (vdom.type === ELEMENT_NODE || vdom.type === OPAQUE_NODE) {
      reconcileElementProps(target, EMPTY_MAP);
    }

    if (vdom.type === ELEMENT_NODE || vdom.type === ALIAS_NODE) {
      cleanupTargetChildren(target);
    }

    delete target[NODE_STATE];

    try {
      if (vdom.type === SPECIAL_NODE) {
        vdom.tag.detach?.(target);
      }
      vdom.hooks?.$detach?.(target);
    } catch (err) {
      console.error(err);
    }
  }

  // A reused node only needs a second pass when its arguments or its hooks
  // changed; comparing hooks too means a node whose props are stable but whose
  // listeners are freshly bound each render still gets those listeners swapped.
  function claimExistingNode(domNode, newVdom) {
    const state = domNode[NODE_STATE];
    if (
      shouldUpdate(state.vdom.args, newVdom.args) ||
      shouldUpdate(state.vdom.hooks, newVdom.hooks)
    ) {
      state.newVdom = newVdom;
    }
    return domNode;
  }

  function collectOldChildren(target) {
    // Keyed by vdom tag; each bucket keeps a native Map of key -> nodes so that
    // user supplied keys such as 'constructor' or '__proto__' cannot collide
    // with Object.prototype. `cursor` replaces Array#shift, which would make
    // reconciling a long unkeyed list quadratic.
    const byTag = new Map();
    const textNodes = {nodes: [], cursor: 0};

    for (const oldChild of target.childNodes) {
      if (oldChild.nodeType === 3 /* TEXT_NODE */) {
        textNodes.nodes.push(oldChild);
        continue;
      }

      const oldChildState = oldChild[NODE_STATE];
      const vdom = oldChildState?.vdom;
      if (vdom === undefined) {
        if (oldChildState?.newVdom) {
          throw new Error(
            'Attempt to reconcile against a target while already working on a reconciliation against that same target, this is not allowed',
          );
        }
        continue;
      }

      let poolForTag = byTag.get(vdom.tag);
      if (!poolForTag) {
        poolForTag = {nodesForKey: null, nodesWithoutKey: {nodes: [], cursor: 0}};
        byTag.set(vdom.tag, poolForTag);
      }

      if (vdom.k !== undefined) {
        if (!poolForTag.nodesForKey) poolForTag.nodesForKey = new Map();
        const nodesForKey = poolForTag.nodesForKey.get(vdom.k);
        if (nodesForKey) {
          nodesForKey.nodes.push(oldChild);
        } else {
          poolForTag.nodesForKey.set(vdom.k, {nodes: [oldChild], cursor: 0});
        }
      } else {
        poolForTag.nodesWithoutKey.nodes.push(oldChild);
      }
    }

    return {byTag, textNodes};
  }

  function takeFromPool(pool) {
    if (!pool || pool.cursor >= pool.nodes.length) return undefined;
    return pool.nodes[pool.cursor++];
  }

  // Places children in order, walking the existing siblings alongside the
  // desired list so that only nodes that are genuinely out of position move.
  function placeChildren(target, newDomChildren, insertBefore, moveBefore) {
    let ref = target.firstChild;
    for (let i = 0; i < newDomChildren.length; i++) {
      const newChild = newDomChildren[i];
      if (newChild === ref) {
        ref = ref.nextSibling;
        continue;
      }
      const op = moveBefore && newChild.isConnected ? moveBefore : insertBefore;
      op.call(target, newChild, ref);
    }
  }

  // Same result, but reached without ever passing the focused child to
  // insertBefore. Detaching a focused node blurs it, so instead it is treated
  // as a fixed anchor and every other child is arranged around it: the children
  // that belong before it are placed immediately before it, and the rest are
  // walked into place after it. The anchor still ends up at its correct index,
  // because exactly the right number of children end up on either side.
  //
  // Only needed where `moveBefore` is unavailable — it relocates a node without
  // detaching it, so focus survives an ordinary move.
  function placeChildrenAroundAnchor(target, newDomChildren, insertBefore, anchorIndex) {
    const anchor = newDomChildren[anchorIndex];

    // Right to left, so each child lands directly before the one that follows it.
    let before = anchor;
    for (let i = anchorIndex - 1; i >= 0; i--) {
      const child = newDomChildren[i];
      if (child !== before.previousSibling) {
        insertBefore.call(target, child, before);
      }
      before = child;
    }

    // Left to right over whatever still follows the anchor. Children that were
    // stranded on the other side of it get pulled across here.
    let ref = anchor.nextSibling;
    for (let i = anchorIndex + 1; i < newDomChildren.length; i++) {
      const child = newDomChildren[i];
      if (child === ref) {
        ref = ref.nextSibling;
      } else {
        insertBefore.call(target, child, ref);
      }
    }
  }

  // At most one child of a given parent can be on the focus path, so there is
  // never more than one anchor to preserve.
  function findFocusedChildIndex(newDomChildren, focusWithin) {
    for (let i = 0; i < newDomChildren.length; i++) {
      if (focusWithin.has(newDomChildren[i])) return i;
    }
    return -1;
  }

  function attachAndReconcile(newChild) {
    const state = newChild[NODE_STATE];
    if (!state?.newVdom) return;
    if (!state.vdom) {
      try {
        state.newVdom.hooks?.$attach?.(newChild);
        if (state.newVdom.type === SPECIAL_NODE) {
          state.newVdom.tag.attach?.(newChild);
        }
      } catch (err) {
        console.error(err);
      }
    }
    reconcileNode(newChild);
  }

  function reconcileElementChildren(target, newChildren) {
    const oldNodesToRemove = target.firstChild ? new Set(target.childNodes) : null;
    const {byTag, textNodes} = collectOldChildren(target);

    const newDomChildren = [];
    for (const newVdom of newChildren) {
      let newDomNode;
      if (newVdom instanceof VNode) {
        const poolForTag = byTag.get(newVdom.tag);
        const reusable = poolForTag
          ? takeFromPool(
              newVdom.k !== undefined
                ? poolForTag.nodesForKey?.get(newVdom.k)
                : poolForTag.nodesWithoutKey,
            )
          : undefined;
        newDomNode = reusable ? claimExistingNode(reusable, newVdom) : createNode(target, newVdom);
      } else {
        const reusableText = takeFromPool(textNodes);
        const text = toText(newVdom);
        if (reusableText) {
          newDomNode = reusableText;
          if (newDomNode.nodeValue !== text) newDomNode.nodeValue = text;
        } else {
          newDomNode = target.ownerDocument.createTextNode(text);
        }
      }
      oldNodesToRemove?.delete(newDomNode);
      newDomChildren.push(newDomNode);
    }

    if (oldNodesToRemove) {
      for (const nodeToRemove of oldNodesToRemove) {
        cleanupTarget(nodeToRemove);
        target.removeChild(nodeToRemove);
      }
    }

    if (newDomChildren.length === 0) return;

    const doc = target.ownerDocument;
    const nodeProto = nodePrototypeFor(doc, userSettings?.window);
    const insertBefore = nodeProto.insertBefore;
    const moveBefore = typeof nodeProto.moveBefore === 'function' ? nodeProto.moveBefore : null;
    const connected = target.isConnected;

    let anchorIndex = -1;
    if (connected && !moveBefore) {
      const focusWithin = documentToFocusWithinSet.get(doc) ?? installFocusTrackingForDocument(doc);
      anchorIndex = findFocusedChildIndex(newDomChildren, focusWithin);
      // A focused child is always one we pooled from the existing children, so
      // it is already under this target. The guard is only here so that a
      // surprising focus set can never turn into a thrown insertBefore.
      if (anchorIndex !== -1 && newDomChildren[anchorIndex].parentNode !== target) {
        anchorIndex = -1;
      }
    }

    if (anchorIndex === -1) {
      placeChildren(target, newDomChildren, insertBefore, connected ? moveBefore : null);
    } else {
      placeChildrenAroundAnchor(target, newDomChildren, insertBefore, anchorIndex);
    }

    // Placement happens first so that lifecycle hooks and alias builders run
    // against a fully arranged sibling list rather than a half built one.
    for (let i = 0; i < newDomChildren.length; i++) {
      attachAndReconcile(newDomChildren[i]);
    }
  }

  function reconcile(target, vdom) {
    const state = target[NODE_STATE];
    if (vdom === null || vdom === undefined) {
      if (state) {
        cleanupTarget(target);
      } else {
        cleanupTargetChildren(target);
      }
      target.replaceChildren();
      return;
    }

    if (isSeq(vdom)) {
      reconcileElementChildren(target, flattenSeq(vdom, true));
      return;
    }

    if (vdom instanceof VNode) {
      if (state) {
        // The tag has to match as well as the type: swapping the alias function
        // or the special descriptor is a different component, and reusing the
        // state would skip the old one's detach and the new one's attach.
        if (state.vdom.type === vdom.type && state.vdom.tag === vdom.tag) {
          if (
            shouldUpdate(state.vdom.args, vdom.args) ||
            shouldUpdate(state.vdom.hooks, vdom.hooks)
          ) {
            state.newVdom = vdom;
            reconcileNode(target);
          }
          return;
        }
        cleanupTarget(target);
      }

      switch (vdom.type) {
        case ELEMENT_NODE:
        case OPAQUE_NODE:
          if (!sameTagName(target.nodeName, convertTagName(vdom.tag))) {
            throw new Error('incompatible target for vdom');
          }
          break;
      }

      target[NODE_STATE] = newNodeState(vdom);
      try {
        vdom.hooks?.$attach?.(target);
        if (vdom.type === SPECIAL_NODE) {
          vdom.tag.attach?.(target);
        }
      } catch (err) {
        console.error(err);
      }
      reconcileNode(target);
      return;
    }

    throw new Error('invalid vdom');
  }

  return {
    h,
    alias,
    special,
    reconcile,
    settings: {
      shouldUpdate,
      isMap,
      mapIter,
      mapEach,
      mapGet,
      mapMerge,
      newMap,
      mapPut,
      isSeq,
      flattenSeq,
      seqIter,
      convertTagName,
      convertPropName,
      convertStyleName,
      convertDataName,
      convertClassName,
      convertHookName,
      convertName,
      listenerKey,
      captureKey,
      passiveKey,
    },
  };
};
