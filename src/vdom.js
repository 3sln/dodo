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
    this.key = k;
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
  return Array.isArray(x) || (x != null && typeof x[Symbol.iterator] === 'function' && typeof x !== 'string');
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
      case 'svg': return 'http://www.w3.org/2000/svg';
      case 'math': return 'http://www.w3.org/1998/Math/MathML';
    }
  }
  return parentNode.namespaceURI ?? parentNode.host?.namespaceURI ?? 'http://www.w3.org/1999/xhtml';
}

function createElementNode(parentNode, tag, vdom) {
  const el = parentNode.ownerDocument.createElementNS(newElementNamespace(parentNode, tag), tag);
  el[NODE_STATE] = { originalProps: {}, newVdom: vdom };
  return el;
}

const documentToFocusWithinSet = new WeakMap();

function getPathFromElement(element) {
  const path = [];
  let current = element;
  while (current) {
    path.push(current);
    if (current.shadowRoot) {
      current = current.shadowRoot.host;
    } else {
      current = current.parentNode;
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
  doc.addEventListener('focusin', (event) => {
    addPathToFocusWithinSet(focusWithinSet, event.composedPath());
  });
  doc.addEventListener('focusout', (event) => {
    const newPath = event.relatedTarget ? event.composedPath() : [];
    removePathFromFocusWithinSet(focusWithinSet, newPath);
  });
  addPathToFocusWithinSet(focusWithinSet, getPathFromElement(doc.activeElement));
  documentToFocusWithinSet.set(doc, focusWithinSet);
  return focusWithinSet;
}

export default (userSettings) => {
  const shouldUpdate = userSettings?.shouldUpdate ?? defaultShouldUpdate;
  const isMap = userSettings?.isMap ?? ((x) => x?.constructor === Object);
  const mapIter = userSettings?.mapIter ?? ((m) => Object.entries(m));
  const mapGet = userSettings?.mapGet ?? ((m, k) => m[k]);
  const mapMerge = userSettings?.mapMerge ?? ((...maps) => Object.assign({}, ...maps));
  const newMap = userSettings?.newMap ?? ((obj) => ({...obj}));
  const mapPut = userSettings?.mapPut ?? ((m, k, v) => { m[k] = v; return m; });
  const isSeq = userSettings?.isSeq ?? isIterable;
  const seqIter = userSettings?.seqIter ?? ((s) => s);
  const convertTagName = userSettings?.convertTagName ?? ((t) => t);
  const convertPropName = userSettings?.convertPropName ?? ((p) => p);
  const convertStyleName = userSettings?.convertStyleName ?? ((s) => s);
  const convertDataName = userSettings?.convertDataName ?? ((d) => d);
  const convertClassName = userSettings?.convertClassName ?? ((c) => c);
  const listenerKey = userSettings?.listenerKey ?? 'listener';
  const captureKey = userSettings?.captureKey ?? 'capture';
  const passiveKey = userSettings?.passiveKey ?? 'passive';

  function flattenSeqIntoArray(array, items, excludeFalsey) {
    for (const item of seqIter(items)) {
      if (excludeFalsey && (item == null || item == false)) {
        continue;
      }

      if (!isSeq(item)) {
        array.push(item);
      } else {
        flattenSeqIntoArray(array, item);
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
        flattenVNodeChildrenIntoArray(array, seqIter(item));
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
      props = EMPTY_OBJECT;
    }
    return new VNode(ELEMENT_NODE, convertTagName(tag), [props ?? EMPTY_OBJECT, ...children]);
  }

  function reconcileElementStyling(target, oldStyling, newStyling) {
    const style = target.style;
    for (const [name, value] of mapIter(newStyling)) {
      style.setProperty(convertStyleName(name), value);
    }
    for (const [name] of mapIter(oldStyling)) {
      if (mapGet(newStyling, name) !== undefined) continue;
      style.removeProperty(convertStyleName(name));
    }
  }

  function reconcileElementAttributes(target, oldAttrs, newAttrs) {
    for (const [name, value] of mapIter(newAttrs)) {
      target.setAttribute(convertPropName(name), value);
    }
    for (const [name] of mapIter(oldAttrs)) {
      if (mapGet(newAttrs, name) !== undefined) continue;
      target.removeAttribute(convertPropName(name));
    }
  }

  function reconcileElementDataset(target, oldDataset, newDataset) {
    for (const [name, value] of mapIter(newDataset)) {
      target.dataset[convertDataName(name)] = value;
    }
    for (const [name] of mapIter(oldDataset)) {
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
    const oldProps = nodeState.vdom?.args[0] ?? EMPTY_OBJECT;

    // Handle new and changed props
    for (const [name, newValue] of mapIter(props)) {
        const propName = convertPropName(name);
        const oldValue = mapGet(oldProps, name);

        if (Object.is(newValue, oldValue)) continue;

        switch (propName) {
            case '$styling': {
                if (!isMap(newValue)) throw new Error('invalid value for styling prop');
                reconcileElementStyling(target, oldValue ?? EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
                break;
            }
            case '$classes': {
                if (!isSeq(newValue)) throw new Error('invalid value for classes prop');
                reconcileElementClasses(target, oldValue ?? [], newValue ?? []);
                break;
            }
            case '$attrs': {
                if (!isMap(newValue)) throw new Error('invalid value for attrs prop');
                reconcileElementAttributes(target, oldValue ?? EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
                break;
            }
            case '$dataset': {
                if (!isMap(newValue)) throw new Error('invalid value for dataset prop');
                reconcileElementDataset(target, oldValue ?? EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
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
    for (const [name, oldValue] of mapIter(oldProps)) {
        if (mapGet(props, name) !== undefined) continue; // it wasn't removed

        const propName = convertPropName(name);
        switch (propName) {
            case '$styling':
                reconcileElementStyling(target, oldValue ?? EMPTY_OBJECT, EMPTY_OBJECT);
                break;
            case '$classes':
                reconcileElementClasses(target, oldValue ?? [], []);
                break;
            case '$attrs':
                reconcileElementAttributes(target, oldValue ?? EMPTY_OBJECT, EMPTY_OBJECT);
                break;
            case '$dataset':
                reconcileElementDataset(target, oldValue ?? EMPTY_OBJECT, EMPTY_OBJECT);
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
      for (const [name, listener] of mapIter(hooks)) {
        if (name[0] === '$') continue;
        if (typeof listener === 'function') {
          target.addEventListener(name, listener);
        } else if (listener != null) {
          target.addEventListener(name, mapGet(listener, listenerKey), { 
            capture: !!mapGet(listener, captureKey), 
            passive: !!mapGet(listener, passiveKey) 
          });
        }
      }
    } else {
      const oldHooks = state.vdom.hooks ?? EMPTY_OBJECT;
      for (const [name, listener] of mapIter(hooks)) {
        if (name[0] === '$') continue;
        const oldListener = mapGet(oldHooks, name);
        if (listener === oldListener) continue;

        if (typeof oldListener === 'function') {
          target.removeEventListener(name, oldListener);
        } else if (oldListener != null) {
          target.removeEventListener(name, mapGet(oldListener, listenerKey), !!mapGet(oldListener, captureKey));
        }
        
        if (typeof listener === 'function') {
          target.addEventListener(name, listener);
        } else if (listener != null) {
          target.addEventListener(name, mapGet(listener, listenerKey), { 
            capture: !!mapGet(listener, captureKey), 
            passive: !!mapGet(listener, passiveKey) 
          });
        }
      }
      for (const [name] of mapIter(oldHooks)) {
        if (name[0] === '$' || mapGet(hooks, name) !== undefined) continue;
        const oldListener = mapGet(oldHooks, name);
        if (typeof oldListener === 'function') {
          target.removeEventListener(name, oldListener);
        } else if (oldListener != null) {
          target.removeEventListener(name, mapGet(oldListener, listenerKey), !!mapGet(oldListener, captureKey));
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
        reconcileElementChildren(target, args.slice(1));
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
          reconcileElementChildren(target, innerVdom);
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
      reconcileListeners(target, newVdom.hooks ?? EMPTY_OBJECT);
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
    if (state) {

      switch (state.vdom.type) {
        case ELEMENT_NODE:
          reconcileElementProps(target, {});
          cleanupTargetChildren(target);
          delete target[NODE_STATE];
          break;
        case OPAQUE_NODE:
          reconcileElementProps(target, {});
          delete target[NODE_STATE];
          break;
        case ALIAS_NODE:
          cleanupTargetChildren(target);
          delete target[NODE_STATE];
          break;
        case SPECIAL_NODE:
          delete target[NODE_STATE];
          try {
            state.vdom.tag.detach?.(target);
          } catch (err) {
            console.error(err);
          }
          break;
      }
      try {
        state.vdom.hooks?.$detach?.(target);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function reconcileElementChildren(target, childrenIterable) {
    const newChildren = flattenVNodeChildren(childrenIterable);
    const oldNodesToRemove = new Set(target.childNodes);
    const oldVNodeNodesPool = new Map();
    const oldTextNodesPool = [];

    for (const oldChild of target.childNodes) {
      if (oldChild.nodeType === 3 /* TEXT_NODE */) {
        oldTextNodesPool.push(oldChild);
        continue;
      }
      const vdom = oldChild[NODE_STATE]?.vdom;
      if (vdom === undefined) {
        continue;
      }

      let oldNodesPoolForTag = oldVNodeNodesPool.get(vdom.tag);
      if (!oldNodesPoolForTag) {
        oldNodesPoolForTag = { nodesForKey: new Map(), nodesWithoutKey: [] };
        oldVNodeNodesPool.set(vdom.tag, oldNodesPoolForTag);
      }

      if (vdom.key !== undefined) {
        let oldNodesPoolForKey = oldNodesPoolForTag.nodesForKey.get(vdom.key);
        if (oldNodesPoolForKey === undefined) {
          oldNodesPoolForKey = [];
          oldNodesPoolForTag.nodesForKey.set(vdom.key, oldNodesPoolForKey);
        }
        oldNodesPoolForKey.push(oldChild);
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
          const key = newVdom.key;
          if (key !== undefined) {
            const pool = oldNodesPoolForTag.nodesForKey.get(key);
            if (pool && pool.length > 0) {
              newDomNode = pool.shift();
              const state = newDomNode[NODE_STATE];
              if (shouldUpdate(state.vdom.args, newVdom.args)) {
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

    const moveBefore = window.Element.prototype.moveBefore;
    const insertBefore = window.Element.prototype.insertBefore;
    if (target.isConnected && typeof moveBefore === 'function') {
      for (let i = 0; i < newDomChildren.length; i++) {
        const newChild = newDomChildren[i];
        const existingChildAtPosition = target.childNodes[i];
        if (newChild !== existingChildAtPosition) {
          (newChild.isConnected ? moveBefore : insertBefore).call(target, newChild, existingChildAtPosition);
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
      reconcileElementChildren(target, seqIter(vdom));
      return;
    }

    if (vdom instanceof VNode) {
      if (state) {
        if (state.vdom.type === vdom.type) {
          if (shouldUpdate(state.vdom.args, vdom.args)) {
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
          if (0 !== target.nodeName.localeCompare(convertTagName(vdom.tag), undefined, { sensitivity: 'base' })) {
            throw new Error('incompatible target for vdom');
          }
          break;
      }

      target[NODE_STATE] = { originalProps: {}, newVdom: vdom };
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

  return { h, alias, special, reconcile, settings: {
    shouldUpdate, isMap, mapIter, mapGet, mapMerge, newMap, mapPut, isSeq, flattenSeq, seqIter,
    convertTagName, convertPropName, convertStyleName, convertDataName, convertClassName,
    listenerKey, captureKey, passiveKey
  } };
}
