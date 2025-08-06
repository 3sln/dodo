const ELEMENT_NODE = Symbol('ELEMENT_NODE');
const ALIAS_NODE = Symbol('ALIAS_NODE');
const SPECIAL_NODE = Symbol('SPECIAL_NODE');
const OPAQUE_NODE = Symbol('OPAQUE_NODE');
const NODE_STATE = Symbol('NODE_STATE');

const EMPTY_OBJECT = Object.freeze({});
const EMPTY_ARRAY = Object.freeze([]);

export const settings = {};


function shouldConsiderArgValuesAsDifferent(a, b) {
  if (a === b) {
    return false;
  }

  const typeA = typeof a;
  const typeB = typeof b;

  if (typeA != 'object' || typeB != 'object') {
    return true;
  }

  if (a === null || b === null) {
    return a !== b;
  }

  const iteratorFuncA = a[Symbol.iterator];
  const iteratorFuncB = b[Symbol.iterator];
  const isAIterable = typeof iteratorFuncA === 'function';
  const isBIterable = typeof iteratorFuncB === 'function';
  const constructor = a.constructor;
  const sameConstructor = constructor === b.constructor;

  if (!sameConstructor) {
    return true;
  }

  if (isAIterable && isBIterable) {
    const sizeA = a.length ?? a.size;
    const sizeB = b.length ?? b.size;
    
    if (sizeA === undefined || sizeB === undefined || sizeA !== sizeB || sizeA > 16) {
      return true;
    }
    
    const iteratorA = iteratorFuncA.call(a);
    const iteratorB = iteratorFuncB.call(b);
    let resultA, resultB;

    do {
      resultA = iteratorA.next();
      resultB = iteratorB.next();

      if (resultA.done !== resultB.done) {
        return true;
      }
      if (resultA.done) {
        return false;
      }
      if (resultA.value !== resultB.value) {
        return true;
      }
    } while (!resultA.done);
  }
  
  if (isAIterable !== isBIterable) {
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length || keysA.length > 16) {
    return true;
  }

  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return true;
    }
  }
  return false;
}

export function shouldConsiderArgListsAsDifferent(argsA, argsB) {
  if (argsA.length !== argsB.length || argsA.length > 16) {
    return true;
  }

  for (let i = 0 ; i < argsA.length ; i++) {
    if (shouldConsiderArgValuesAsDifferent(argsA[i], argsB[i])) {
      return true;
    }
  }
  return false;
}

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
}

export function alias(f) {
  return (...args) => new VNode(ALIAS_NODE, f, args);
}

export function special(o) {
  return (...args) => new VNode(SPECIAL_NODE, o, args);
}

export function h(tag, props, ...children) {
  return new VNode(ELEMENT_NODE, tag, [props ?? EMPTY_OBJECT, ...children]);
}

export function o(tag, props) {
  return new VNode(OPAQUE_NODE, tag, [props ?? EMPTY_OBJECT]);
}

function flattenInto(array, items) {
  for (const item of items) {
    if (item === null || item === undefined) {
      continue;
    }
    if (typeof item !== 'object' || typeof item[Symbol.iterator] !== 'function') {
      array.push(item);
      continue;
    }
    flattenInto(array, item);
  }
}

function flatten(items) {
  const array = [];
  flattenInto(array, items);
  return array;
}

function reconcileElementStyling(target, oldStyling, newStyling) {
  const style = target.style;
  for (const name in newStyling) {
    style.setProperty(name, newStyling[name]);
  }
  for (const name in oldStyling) {
    if (name in newStyling) {
      continue;
    }
    style.removeProperty(name);
  }
}

function reconcileElementAttributes(target, oldAttrs, newAttrs) {
  for (const name in newAttrs) {
    target.setAttribute(name, newAttrs[name]);
  }
  for (const name in oldAttrs) {
    if (name in newAttrs) {
      continue;
    }
    target.removeAttribute(name);
  }
}

function reconcileElementDataset(target, oldDataset, newDataset) {
  for (const name in newDataset) {
    target.dataset[name] = newDataset[name];
  }
  for (const name in oldDataset) {
    if (name in newDataset) {
      continue;
    }
    delete target.dataset[name];
  }
}

function reconcileElementClasses(target, oldClasses, newClasses) {
  const classesToRemove = new Set(flatten(oldClasses));
  for (const c of flatten(newClasses)) {
    classesToRemove.delete(c);
    target.classList.add(c);
  }

  for (const c of classesToRemove) {
    target.classList.remove(c);
  }
}

function reconcileElementProps(target, props) {
  const nodeState = target[NODE_STATE];
  const currentProps = nodeState?.vdom.args[0] ?? EMPTY_OBJECT;
  const originalProps = nodeState?.originalProps;

  if (nodeState.fresh) {
    for (const name in props) {
      const newValue = props[name];

      switch(name) {
        case 'styling':
          if (typeof value !== 'object') {
            throw new Error('invalid value for styling prop');
          }
          reconcileElementStyling(target, EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
          break;
        case 'classes':
          if (typeof newValue !== 'object' || typeof newValue?.[Symbol.iterator] !== 'function') {
            throw new Error('invalid value for classes prop');
          }
          {
            reconcileElementClasses(target, EMPTY_ARRAY, newValue ?? EMPTY_ARRAY);
          }
          break;
        case 'attrs':
          if (typeof newValue !== 'object') {
            throw new Error('invalid value for attrs prop');
          }
          reconcileElementAttributes(target, EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
          break;
        case 'dataset':
          if (typeof newValue !== 'object') {
            throw new Error('invalid value for dataset prop');
          }
          reconcileElementDataset(target, EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
          break;
        default:
          if (newValue === undefined) {
            if (name in originalProps) {
              target[name] = originalProps[name];
            }
            break;
          }

          if (!(name in originalProps)) {
            originalProps[name] = target[name];
          }
          target[name] = newValue;
          break;
      }
    }
  } else {
    for (const name in props) {
      const newValue = props[name];
      const oldValue = currentProps[name];

      if (newValue === oldValue) {
        continue;
      }

      switch(name) {
        case 'styling':
          if (typeof value !== 'object') {
            throw new Error('invalid value for styling prop');
          }
          reconcileElementStyling(target, oldValue ?? EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
          break;
        case 'classes':
          if (typeof newValue !== 'object' || typeof newValue?.[Symbol.iterator] !== 'function') {
            throw new Error('invalid value for classes prop');
          }
          {
            reconcileElementClasses(target, oldValue ?? EMPTY_ARRAY, newValue ?? EMPTY_ARRAY);
          }
          break;
        case 'attrs':
          if (typeof newValue !== 'object') {
            throw new Error('invalid value for attrs prop');
          }
          reconcileElementAttributes(target, oldValue ?? EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
          break;
        case 'dataset':
          if (typeof newValue !== 'object') {
            throw new Error('invalid value for dataset prop');
          }
          reconcileElementDataset(target, oldValue ?? EMPTY_OBJECT, newValue ?? EMPTY_OBJECT);
          break;
        default:
          if (newValue === undefined) {
            if (name in originalProps) {
              target[name] = originalProps[name];
            }
            break;
          }

          if (!(name in originalProps)) {
            originalProps[name] = target[name];
          }
          target[name] = newValue;
          break;
      }
    }
  }


  for (const name in originalProps) {
    if (name in props) {
      continue;
    }

    target[name] = originalProps[name];
    delete originalProps[name];
  }
}

function reconcileListeners(target, hooks) {
  const oldHooks = target[NODE_STATE].vdom.hooks;

  for (const name in hooks) {
    if (name[0] === '$') {
      continue;
    }

    const listener = hooks[name];
    const oldListener = oldHooks[name];
    if (listener === oldListener) {
      continue;
    }

    switch(typeof oldListener) {
      case 'function':
        target.removeEventListener(name, oldListener);
        break;
      case 'object':
        target.removeEventListener(name, oldListener.listener, !!oldListener.capture);
        break;
    }

    switch(typeof listener) {
      case 'function':
        target.addEventListener(name, listener);
        break;
      case 'object':
        target.addEventListener(name, listener.listener, {
          capture: listener.capture,
          passive: listener.passive,
        });
        break;
    }
  }

  for (const name in oldHooks) {
    if (name[0] === '$' || name in hooks) {
      continue;
    }

    const oldListener = oldHooks[name];

    switch(typeof oldListener) {
      case 'function':
        target.removeEventListener(name, oldListener);
        break;
      case 'object':
        target.removeEventListener(name, oldListener.listener, !!oldListener.capture);
        break;
    }
  }
}

function newElementNamespace(parentNode, newNodeTag) {
  if (parentNode.namespaceURI === 'http://www.w3.org/1999/xhtml') {
    switch (newNodeTag) {
      case 'svg': return 'http://www.w3.org/2000/svg';
      case 'math': return 'http://www.w3.org/1998/Math/MathML';
    }
  }
  return parentNode.namespaceURI;
}

function reconcileNode(target, vdom) {
  const state = target[NODE_STATE];
  if (state.vdom.tag !== vdom.tag || state.vdom.key !== vdom.key) {
    throw new Error('incompatible vdom');
  }

  const args = vdom.args;
  switch(vdom.type) {
    case ELEMENT_NODE:
      reconcileElementProps(target, args[0]);
      reconcileElementChildren(target, args.slice(1));
      break;
    case OPAQUE_NODE:
      reconcileElementProps(target, args[0]);
      break;
    case ALIAS_NODE:
      if (state.fresh || shouldConsiderArgListsAsDifferent(state.vdom.args, vdom.args)) {
        const innerVdom = vdom.tag.apply(undefined, vdom.args);
        if (innerVdom === undefined || innerVdom === null) {
          break;
        }

        if (innerVdom instanceof VNode) {
          reconcileElementChildren(target, [innerVdom]);
          break;
        }

        if (typeof innerVdom === 'object' && typeof innerVdom[Symbol.iterator] === 'function') {
          reconcileElementChildren(target, innerVdom);
          break;
        }

        reconcileElementChildren(target, [innerVdom.toString()]);
        break;
      }
    case SPECIAL_NODE:
      if (state.fresh) {
        vdom.tag.update?.(target, vdom.args, undefined);
      } else if (shouldConsiderArgListsAsDifferent(state.vdom.args, vdom.args)) {
        vdom.tag.update?.(target, vdom.args, state.vdom.args);
      }
      break;
  }

  vdom.hooks && reconcileListeners(target, vdom.hooks);

  state.vdom = vdom;
  state.fresh = false;
}

function createElementNode(parentNode, tag, vdom) {
  const el = parentNode.ownerDocument.createElementNS(
    newElementNamespace(parentNode, tag),
    tag
  );
  el[NODE_STATE] = {
    originalProps: {},
    vdom: vdom,
    fresh: true,
  };

  return el;
}

function createNode(parentNode, vdom) {
  if (typeof vdom !== 'object') {
    return parentNode.ownerDocument.createTextNode(vdom.toString());
  }

  let domNode;
  switch(vdom.type) {
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
      vdom.tag.attach?.(domNode);
      break;
    default:
      throw new Error();
  }

  reconcileNode(domNode, vdom, true);
  return domNode;
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

function reconcileElementChildren(target, childrenIterable) {
  const newChildren = flatten(childrenIterable);
  
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
      oldNodesPoolForTag = {nodesForKey: new Map(), nodesWithoutKey: []};
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
            reconcileNode(newDomNode, newVdom);
          } else {
            newDomNode = createNode(target, newVdom);
          }
        } else {
          const unkeyedOldNode = oldNodesPoolForTag.nodesWithoutKey.shift();
          if (unkeyedOldNode) {
            newDomNode = unkeyedOldNode;
            reconcileNode(newDomNode, newVdom);
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
    const nodeToRemoveState = nodeToRemove[NODE_STATE];
    if (nodeToRemoveState.vdom.type === SPECIAL_NODE) {
      nodeToRemoveState.vdom.tag.detach?.(nodeToRemove);
    }
    target.removeChild(nodeToRemove);
    delete nodeToRemove[NODE_STATE];
  }

  const moveBefore = window.Element.prototype.moveBefore;
  if (typeof moveBefore === 'function') {
    for (let i = 0; i < newDomChildren.length; i++) {
      const newChild = newDomChildren[i];
      const existingChildAtPosition = target.childNodes[i];
      
      if (newChild !== existingChildAtPosition) {
        moveBefore.call(target, newChild, existingChildAtPosition);
      }
    }
  } else {
    const insertBefore = window.Element.prototype.insertBefore;
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
    }
  }
}

export function reconcile(target, vdom) {
  if (typeof vdom !== 'object') {
    throw new Error('invalid vdom');
  }

  if (vdom === null || vdom === undefined) {
    const state = target[NODE_STATE];
    if (!state) {
      return;
    }

    switch (state.vdom.type) {
      case ELEMENT_NODE:
      case OPAQUE_NODE:
        reconcileElementProps(target, {});
        reconcileElementChildren(target, []);
        delete target[NODE_STATE];
        break;
      case SPECIAL_NODE:
        state.vdom.tag.detach?.(target);
      case ALIAS_NODE:
        reconcileElementChildren(target, []);
        break;
      default:
        throw Error();
    }
    return;
  }
  
  const iterator = vdom[Symbol.iterator]; 
  if (typeof iterator === 'function') {
    reconcileElementChildren(target, iterator.call(vdom));
    return;
  }

  if (vdom instanceof VNode) {
    if (target[NODE_STATE]) {
      reconcileNode(target, vdom);
    } else {
      switch (vdom.type) {
        case ELEMENT_NODE:
        case OPAQUE_NODE:
          if (0 === target.nodeName.localeCompare(vdom.tag, undefined, {sensitivity: 'base'})) {
            target[NODE_STATE] = {
              originalProps: {},
              vdom: vdom,
              fresh: true,
            };
            reconcileNode(target, vdom);
          } else {
            throw new Error('incompatible target for vdom');
          }
          break;
        case ALIAS_NODE:
          target[NODE_STATE] = {
            vdom: vdom,
            fresh: true,
          };
          reconcileNode(target, vdom, true);
          break;
        case SPECIAL_NODE:
          target[NODE_STATE] = {
            vdom: vdom,
            fresh: true,
          };
          vdom.tag.attach?.(target);
          reconcileNode(target, vdom, true);
          break;
        default:
          throw Error();
      }
    }
    return;
  }

  throw new Error('invalid vdom');

}
