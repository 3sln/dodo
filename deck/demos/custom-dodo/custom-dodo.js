import * as cherry_core from 'cherry-cljs/cljs.core.js';
import * as dodo_core from '@3sln/dodo';
var dodo_settings = {
  passiveKey: cherry_core.keyword('passive'),
  captureKey: cherry_core.keyword('capture'),
  mapMerge: (() => {
    const f1 = function (var_args) {
      const args21 = cherry_core.array.call(null);
      const len__22355__auto__2 = cherry_core.alength.call(null, arguments);
      let i33 = 0;
      while (true) {
        if (i33 < len__22355__auto__2) {
          args21.push(arguments[i33]);
          let G__4 = i33 + 1;
          i33 = G__4;
          continue;
        }
        break;
      }
      const argseq__22544__auto__5 =
        0 < cherry_core.alength.call(null, args21)
          ? new cherry_core.IndexedSeq(args21.slice(0), 0, null)
          : null;
      return f1.cljs$core$IFn$_invoke$arity$variadic(argseq__22544__auto__5);
    };
    f1.cljs$core$IFn$_invoke$arity$variadic = function (maps) {
      return cherry_core.apply.call(null, cherry_core.merge, maps);
    };
    f1.cljs$lang$maxFixedArity = 0;
    f1.cljs$lang$applyTo = function (seq4) {
      const self__22376__auto__6 = this;
      return self__22376__auto__6.cljs$core$IFn$_invoke$arity$variadic(
        cherry_core.seq.call(null, seq4),
      );
    };
    return f1;
  })(),
  listenerKey: cherry_core.keyword('listener'),
  mapPut: function (m, k, v) {
    if (cherry_core.truth_.call(null, cherry_core.map_QMARK_.call(null, m))) {
      return cherry_core.assoc.call(null, m, k, v);
    } else {
      cherry_core.aset.call(null, m, k, v);
      return m;
    }
  },
  newMap: function (obj) {
    if (cherry_core.truth_.call(null, cherry_core.map_QMARK_.call(null, obj))) {
      return obj;
    } else {
      return cherry_core.js__GT_clj.call(null, obj, cherry_core.keyword('keywordize-keys'), true);
    }
  },
  convertName: cherry_core.name,
  isSeq: function (x) {
    const or__23296__auto__7 = (() => {
      const and__23329__auto__8 = cherry_core.seqable_QMARK_.call(null, x);
      if (cherry_core.truth_.call(null, and__23329__auto__8)) {
        return cherry_core.not.call(null, cherry_core.string_QMARK_.call(null, x));
      } else {
        return and__23329__auto__8;
      }
    })();
    if (cherry_core.truth_.call(null, or__23296__auto__7)) {
      return or__23296__auto__7;
    } else {
      return Array.isArray(x);
    }
  },
  shouldUpdate: function (a, b) {
    return a !== b;
  },
  mapIter: function (m) {
    if (cherry_core.truth_.call(null, cherry_core.map_QMARK_.call(null, m))) {
      return cherry_core.es6_iterator.call(
        null,
        cherry_core.map.call(
          null,
          function (_PERCENT_1) {
            return cherry_core.into_array.call(null, _PERCENT_1);
          },
          cherry_core.seq.call(null, m),
        ),
      );
    } else {
      return Object.entries(m);
    }
  },
  mapGet: function (m, k) {
    if (cherry_core.truth_.call(null, cherry_core.map_QMARK_.call(null, m))) {
      if (cherry_core.truth_.call(null, cherry_core.string_QMARK_.call(null, k))) {
        const or__23296__auto__9 = cherry_core.get.call(null, m, k);
        if (cherry_core.truth_.call(null, or__23296__auto__9)) {
          return or__23296__auto__9;
        } else {
          return cherry_core.get.call(null, m, cherry_core.keyword.call(null, k));
        }
      } else {
        return cherry_core.get.call(null, m, k);
      }
    } else {
      return m[k];
    }
  },
  isMap: function (x) {
    const or__23296__auto__10 = cherry_core.map_QMARK_.call(null, x);
    if (cherry_core.truth_.call(null, or__23296__auto__10)) {
      return or__23296__auto__10;
    } else {
      const and__23329__auto__11 = cherry_core.object_QMARK_.call(null, x);
      if (cherry_core.truth_.call(null, and__23329__auto__11)) {
        return cherry_core._EQ_.call(null, x.constructor, Object);
      } else {
        return and__23329__auto__11;
      }
    }
  },
  seqIter: function (s) {
    if (cherry_core.truth_.call(null, cherry_core.seqable_QMARK_.call(null, s))) {
      return cherry_core.es6_iterator.call(null, s);
    } else {
      return s;
    }
  },
};
var d = dodo_core.dodo.call(null, dodo_settings);
var my_component = d.alias.call(null, function (text) {
  return d.div.call(
    null,
    d.h1.call(null, 'Hello from ClojureScript!'),
    d.p.call(null, 'The text is: ', text),
  );
});
var default$ = function (driver) {
  const text$1 = driver.property('Text', {defaultValue: 'dynamic text'});
  return driver.panel('Demo', function (container, signal) {
    const sub2 = text$1.subscribe(function (text) {
      return d.reconcile.call(null, container, cherry_core.vector(my_component.call(null, text)));
    });
    return signal.addEventListener('abort', function () {
      return sub2.unsubscribe();
    });
  });
};

export {dodo_settings, d, my_component};
export default default$;
