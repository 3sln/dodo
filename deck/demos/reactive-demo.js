import * as d from '@3sln/dodo';
import {cell, derive, fromObservable, watch} from '@3sln/dodo/reactive';

export default driver => {
  driver.panel('Demo', (container, signal) => {
    // A plain writable cell, driven by the buttons below.
    const qty = cell(1);

    // The deck driver hands out observables, which adapt to the Cell protocol.
    const price$ = driver.property('Price', {defaultValue: '10'});
    const price = fromObservable(price$, {initial: '10'});

    // Derived cells recompute only when a dependency actually changes.
    const total = derive([price, qty], (p, n) => (Number(p) || 0) * n);

    const button = (label, onClick) =>
      d.button({$styling: {'margin-right': '0.5em', padding: '0.25em 0.75em'}}, label).on({
        click: onClick,
      });

    d.reconcile(container, [
      d.div(
        d.p(
          button('-', () => qty.update(n => Math.max(0, n - 1))),
          button('+', () => qty.update(n => n + 1)),
          watch(qty, n => d.span(`quantity: ${n}`)),
        ),
        watch(total, value =>
          d.p({$styling: {'font-weight': 'bold'}}, `total: ${value.toFixed(2)}`),
        ),
      ),
    ]);

    signal.addEventListener('abort', () => {
      d.reconcile(container, null);
    });
  });
};
