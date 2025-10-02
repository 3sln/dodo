import vdom from './src/vdom.js';

// --- ClojureScript Interop Settings ---

const c = globalThis.cljs?.core;

// A few helpers to make the hybrid functions cleaner
const isJsObject = (x) => x?.constructor === Object;
const isJsArray = (x) => Array.isArray(x);

const cljsSettings = c ? {
  isMap: (x) => isJsObject(x) || !!c.map_QMARK___(x),
  isSeq: (x) => isJsArray(x) || (x != null && !c.string_QMARK___(x) && !!c.seq(x)),
  
  mapIter: function* (m) {
    if (!c.map_QMARK___(m)) {
      yield* Object.entries(m);
      return;
    }
    const kv = [null, null];
    let s = c.seq(m);
    while (s) {
      const entry = c.first(s);
      kv[0] = c.key(entry);
      kv[1] = c.val(entry);
      yield kv;
      s = c.next(s);
    }
  },

  mapGet: (m, k) => (c.map_QMARK___(m) ? c.get(m, k) : m[k]),

  seqIter: function* (s) {
    if (!isJsArray(s) && !c.sequential_QMARK___(s)) {
        yield s;
        return;
    }
    if (isJsArray(s)) {
        yield* s;
        return;
    }
    let a = c.seq(s);
    while (a) {
      yield c.first(a);
      a = c.next(a);
    }
  },

  convertTagName: (t) => (c.keyword_QMARK___(t) ? c.name(t) : t),
  convertPropName: (p) => (c.keyword_QMARK___(p) ? c.name(p) : p),
  convertStyleName: (s) => (c.keyword_QMARK___(s) ? c.name(s) : s),
  convertDataName: (d) => (c.keyword_QMARK___(d) ? c.name(d) : d),
  convertClassName: (c) => (c.keyword_QMARK___(c) ? c.name(c) : c.toString()),

} : {};

// --- API Creation ---

const { h, o, alias, special, reconcile } = vdom(cljsSettings);

export { vdom, h, o, alias, special, reconcile };

export * from './src/html.js';