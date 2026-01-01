const ELEMENT_NODE = Symbol('ELEMENT_NODE');
const ALIAS_NODE = Symbol('ALIAS_NODE');
const SPECIAL_NODE = Symbol('SPECIAL_NODE');
const OPAQUE_NODE = Symbol('OPAQUE_NODE');
const NODE_STATE = Symbol('NODE_STATE');
const EMPTY_OBJECT = Object.freeze({});

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
        if (!b.hasOwnProperty(key) || a[key] !== b[key]) return true;
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
  if (parentNode.namespaceURI === 'http://www.w3.org/1999/xhtml') {
    switch (newNodeTag) {
      case 'svg':
        return 'http://www.w3.org/2000/svg';
      case 'math':
        return 'http://www.w3.org/1998/Math/MathML';
    }
  }
  return parentNode.namespaceURI ?? parentNode.host?.namespaceURI ?? 'http://www.w3.org/1999/xhtml';
}

function createElementNode(parentNode, tag, vdom) {
  const el = parentNode.ownerDocument.createElementNS(newElementNamespace(parentNode, tag), tag);
  el[NODE_STATE] = {originalProps: {}, newVdom: vdom};
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

function removePathFromFocusWithinSet(set, newPath) {
  const newPathSet = new Set(newPath);
  for (const node of [...set]) {
    if (!newPathSet.has(node)) {
      set.delete(node);
    }
  }
}

function installFocusTrackingForDocument(doc) {
  const focusWithinSet = new Set();
  doc.addEventListener('focusin', event => {
    addPathToFocusWithinSet(focusWithinSet, event.composedPath());
  });
  doc.addEventListener('focusout', event => {
    const newPath = event.relatedTarget ? event.composedPath() : [];
    removePathFromFocusWithinSet(focusWithinSet, newPath);
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

  function flattenSeqIntoArray(array, items, excludeFalsey) {
    const iterator = toIterator(seqIter(items));
    let result;
    while (!(result = iterator.next()).done) {
      const item = result.value;
      if (excludeFalsey && (item == null || item == false)) {
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

  function flattenVNodeChildrenIntoArray(array, children) {
    for (const item of children) {
      if (item === null || item === undefined || item === false) continue;
      if (!isSeq(item)) {
        array.push(item);
      } else {
        flattenSeqIntoArray(array, seqIter(item));
      }
    }
  }
  function flattenVNodeChildren(children) {
    const array = [];
    flattenVNodeChildrenIntoArray(array, children);
    return array;
  }

  function h(tag, props, ...children) {
    if (!isMap(props)) {
      children.unshift(props);
      props = EMPTY_MAP;
    }
    return new VNode(ELEMENT_NODE, convertTagName(tag), [props ?? EMPTY_MAP, ...children]);
  }

  function reconcileElementStyling(target, oldStyling, newStyling) {
    const style = target.style;
    const newStylingIterator = toIterator(mapIter(newStyling));
    let result;
    while (!(result = newStylingIterator.next()).done) {
      const [name, value] = result.value;
      style.setProperty(convertStyleName(name), value);
    }
    const oldStylingIterator = toIterator(mapIter(oldStyling));
    while (!(result = oldStylingIterator.next()).done) {
      const [name] = result.value;
      if (mapGet(newStyling, name) !== undefined) continue;
      style.removeProperty(convertStyleName(name));
    }
  }

  function reconcileElementAttributes(target, oldAttrs, newAttrs) {
    const newAttrsIterator = toIterator(mapIter(newAttrs));
    let result;
    while (!(result = newAttrsIterator.next()).done) {
      const [name, value] = result.value;
      target.setAttribute(convertPropName(name), value);
    }
    const oldAttrsIterator = toIterator(mapIter(oldAttrs));
    while (!(result = oldAttrsIterator.next()).done) {
      const [name] = result.value;
      if (mapGet(newAttrs, name) !== undefined) continue;
      target.removeAttribute(convertPropName(name));
    }
  }

  function reconcileElementDataset(target, oldDataset, newDataset) {
    const newDatasetIterator = toIterator(mapIter(newDataset));
    let result;
    while (!(result = newDatasetIterator.next()).done) {
      const [name, value] = result.value;
      target.dataset[convertDataName(name)] = value;
    }
    const oldDatasetIterator = toIterator(mapIter(oldDataset));
    while (!(result = oldDatasetIterator.next()).done) {
      const [name] = result.value;
      if (mapGet(newDataset, name) !== undefined) continue;
      delete target.dataset[convertDataName(name)];
    }
  }

  function reconcileElementClasses(target, oldClasses, newClasses) {
    const classesToRemove = new Set(flattenSeq(oldClasses, true));
    for (const c of flattenSeq(newClasses, true)) {
      const className = convertClassName(c);
      classesToRemove.delete(className);
      target.classList.add(className);
    }
    for (const c of classesToRemove) {
      target.classList.remove(convertClassName(c));
    }
  }

  function reconcileElementProps(target, props) {
    const nodeState = target[NODE_STATE];
    const isHtml = target.namespaceURI === 'http://www.w3.org/1999/xhtml';
    const oldProps = nodeState.vdom?.args[0] ?? EMPTY_MAP;

    // Handle new and changed props
    const propsIterator = toIterator(mapIter(props));
    let result;
    while (!(result = propsIterator.next()).done) {
      const [name, newValue] = result.value;
      const propName = convertPropName(name);
      const oldValue = mapGet(oldProps, name);

      if (Object.is(newValue, oldValue)) continue;

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
            const originalProps = nodeState.originalProps;
            if (!(propName in originalProps)) {
              originalProps[propName] = target[propName];
            }
            if (newValue === undefined) {
              target[propName] = originalProps[propName];
            } else {
              target[propName] = newValue;
            }
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

    // Handle removed props
    const oldPropsIterator = toIterator(mapIter(oldProps));
    while (!(result = oldPropsIterator.next()).done) {
      const [name, oldValue] = result.value;
      if (mapGet(props, name) !== undefined) continue; // it wasn't removed

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
            const originalProps = nodeState.originalProps;
            if (propName in originalProps) {
              target[propName] = originalProps[propName];
              delete originalProps[propName];
            }
          } else {
            target.removeAttribute(propName);
          }
          break;
        }
      }
    }
  }

  function reconcileListeners(target, hooks) {
    const state = target[NODE_STATE];
    if (!state.vdom) {
      const hooksIterator = toIterator(mapIter(hooks));
      let result;
      while (!(result = hooksIterator.next()).done) {
        const [name, listener] = result.value;
        const hookName = convertHookName(name);
        if (hookName[0] === '$') continue;
        if (typeof listener === 'function') {
          target.addEventListener(hookName, listener);
        } else if (listener != null) {
          target.addEventListener(hookName, mapGet(listener, listenerKey), {
            capture: !!mapGet(listener, captureKey),
            passive: !!mapGet(listener, passiveKey),
          });
        }
      }
    } else {
      const oldHooks = state.vdom.hooks ?? EMPTY_MAP;
      const newHooks = hooks ?? EMPTY_MAP;
      const hooksIterator = toIterator(mapIter(newHooks));
      let result;
      while (!(result = hooksIterator.next()).done) {
        const [name, listener] = result.value;
        const hookName = convertHookName(name);
        if (hookName[0] === '$') continue;
        const oldListener = mapGet(oldHooks, name);
        if (listener === oldListener) continue;

        if (typeof oldListener === 'function') {
          target.removeEventListener(hookName, oldListener);
        } else if (oldListener != null) {
          target.removeEventListener(
            hookName,
            mapGet(oldListener, listenerKey),
            !!mapGet(oldListener, captureKey),
          );
        }

        if (typeof listener === 'function') {
          target.addEventListener(hookName, listener);
        } else if (listener != null) {
          target.addEventListener(hookName, mapGet(listener, listenerKey), {
            capture: !!mapGet(listener, captureKey),
            passive: !!mapGet(listener, passiveKey),
          });
        }
      }
      const oldHooksIterator = toIterator(mapIter(oldHooks));
      while (!(result = oldHooksIterator.next()).done) {
        const [name] = result.value;
        const hookName = convertHookName(name);
        if (hookName[0] === '$' || mapGet(newHooks, name) !== undefined) continue;
        const oldListener = mapGet(oldHooks, name);
        if (typeof oldListener === 'function') {
          target.removeEventListener(hookName, oldListener);
        } else if (oldListener != null) {
          target.removeEventListener(
            hookName,
            mapGet(oldListener, listenerKey),
            !!mapGet(oldListener, captureKey),
          );
        }
      }
    }
  }

  function reconcileNode(target) {
    const state = target[NODE_STATE];
    const newVdom = state.newVdom;
    const oldVdom = state.vdom;
    const args = newVdom.args;

    switch (newVdom.type) {
      case ELEMENT_NODE: {
        reconcileElementProps(target, args[0]);
        reconcileElementChildren(target, flattenVNodeChildren(args.slice(1)));
        break;
      }
      case OPAQUE_NODE: {
        reconcileElementProps(target, args[0]);
        break;
      }
      case ALIAS_NODE: {
        const innerVdom = newVdom.tag.apply(undefined, newVdom.args);
        if (innerVdom === undefined || innerVdom === null) break;
        if (isSeq(innerVdom)) {
          reconcileElementChildren(target, flattenSeq(innerVdom, true));
        } else {
          reconcileElementChildren(target, flattenVNodeChildren([innerVdom]));
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
      return parentNode.ownerDocument.createTextNode(vdom.toString());
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

  function reconcileElementChildren(target, newChildren) {
    const oldNodesToRemove = new Set(target.childNodes);
    const oldVNodeNodesPool = new Map();
    const oldTextNodesPool = [];

    for (const oldChild of target.childNodes) {
      if (oldChild.nodeType === 3 /* TEXT_NODE */) {
        oldTextNodesPool.push(oldChild);
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

      let oldNodesPoolForTag = oldVNodeNodesPool.get(vdom.tag);
      if (!oldNodesPoolForTag) {
        oldNodesPoolForTag = {nodesForKey: newMap({}), nodesWithoutKey: []};
        oldVNodeNodesPool.set(vdom.tag, oldNodesPoolForTag);
      }

      if (vdom.k !== undefined) {
        let oldNodesPoolForKey = mapGet(oldNodesPoolForTag.nodesForKey, vdom.k);
        if (oldNodesPoolForKey === undefined) {
          oldNodesPoolForKey = [];
        }
        oldNodesPoolForKey.push(oldChild);
        oldNodesPoolForTag.nodesForKey = mapPut(oldNodesPoolForTag.nodesForKey, vdom.k, oldNodesPoolForKey);
      } else {
        oldNodesPoolForTag.nodesWithoutKey.push(oldChild);
      }
    }

    const newDomChildren = [];
    for (const newVdom of newChildren) {
      let newDomNode;
      if (newVdom instanceof VNode) {
        const oldNodesPoolForTag = oldVNodeNodesPool.get(newVdom.tag);
        if (!oldNodesPoolForTag) {
          newDomNode = createNode(target, newVdom);
        } else {
          const key = newVdom.k;
          if (key !== undefined) {
            const pool = mapGet(oldNodesPoolForTag.nodesForKey, key);
            if (pool && pool.length > 0) {
              newDomNode = pool.shift();
              const state = newDomNode[NODE_STATE];
              if (shouldUpdate(state.vdom.args, newVdom.args)) {
                if (state.vdom.hooks || newVdom.hooks) {
                  reconcileListeners(newDomNode, newVdom.hooks);
                }
                state.newVdom = newVdom;
              }
            } else {
              newDomNode = createNode(target, newVdom);
            }
          } else {
            const unkeyedOldNode = oldNodesPoolForTag.nodesWithoutKey.shift();
            if (unkeyedOldNode) {
              newDomNode = unkeyedOldNode;
              const state = newDomNode[NODE_STATE];
              if (shouldUpdate(state.vdom.args, newVdom.args)) {
                if (state.vdom.hooks || newVdom.hooks) {
                  reconcileListeners(newDomNode, newVdom.hooks);
                }
                state.newVdom = newVdom;
              }
            } else {
              newDomNode = createNode(target, newVdom);
            }
          }
        }
      } else {
        if (oldTextNodesPool.length > 0) {
          newDomNode = oldTextNodesPool.shift();
          newDomNode.nodeValue = newVdom?.toString();
        } else {
          newDomNode = target.ownerDocument.createTextNode(newVdom?.toString());
        }
      }
      oldNodesToRemove.delete(newDomNode);
      newDomChildren.push(newDomNode);
    }

    for (const nodeToRemove of oldNodesToRemove) {
      cleanupTarget(nodeToRemove);
      target.removeChild(nodeToRemove);
    }

    const window = userSettings?.window ?? target.ownerDocument.defaultView;
    const moveBefore = window.Element.prototype.moveBefore;
    const insertBefore = window.Element.prototype.insertBefore;
    if (target.isConnected) {
      if (typeof moveBefore === 'function') {
        for (let i = 0; i < newDomChildren.length; i++) {
          const newChild = newDomChildren[i];
          const existingChildAtPosition = target.childNodes[i];
          if (newChild !== existingChildAtPosition) {
            (newChild.isConnected ? moveBefore : insertBefore).call(
              target,
              newChild,
              existingChildAtPosition,
            );
          }
          const state = newChild[NODE_STATE];
          if (state?.newVdom) {
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
        }
      } else {
        const doc = target.ownerDocument;
        let focusWithin = documentToFocusWithinSet.get(doc);
        if (!focusWithin) {
          focusWithin = installFocusTrackingForDocument(doc);
        }
        for (let i = 0; i < newDomChildren.length; i++) {
          const newChild = newDomChildren[i];
          const existingChildAtPosition = target.childNodes[i];
          if (newChild !== existingChildAtPosition) {
            if (!focusWithin.has(newChild)) {
              insertBefore.call(target, newChild, existingChildAtPosition);
            }
          }
          const state = newChild[NODE_STATE];
          if (state?.newVdom) {
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
        }
      }
    } else {
      for (let i = 0; i < newDomChildren.length; i++) {
        const newChild = newDomChildren[i];
        const existingChildAtPosition = target.childNodes[i];
        if (newChild !== existingChildAtPosition) {
          insertBefore.call(target, newChild, existingChildAtPosition);
        }
        const state = newChild[NODE_STATE];
        if (state?.newVdom) {
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
      }
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
        if (state.vdom.type === vdom.type) {
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
          if (
            0 !==
            target.nodeName.localeCompare(convertTagName(vdom.tag), undefined, {
              sensitivity: 'base',
            })
          ) {
            throw new Error('incompatible target for vdom');
          }
          break;
      }

      target[NODE_STATE] = {originalProps: {}, newVdom: vdom};
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
