import * as d from '@3sln/dodo';
import {fromObservable, watch} from '@3sln/dodo/reactive';
import {useContext, withContext} from '@3sln/dodo/context';

export default driver => {
  driver.panel('Demo', (container, signal) => {
    const color$ = driver.property('Color', {defaultValue: '#7b2ff7', type: 'color'});
    const label$ = driver.property('Label', {defaultValue: 'ambient'});

    // Two levels of nesting between the provider and the consumers: neither the
    // section nor the paragraph passes anything down.
    const card = () =>
      d.section(
        {$styling: {border: '1px solid #ccc', padding: '1em', 'border-radius': '4px'}},
        d.p('Nothing on this path passes props. The values come from context.'),
        useContext(['color', 'label'], ({color, label}) =>
          d.p({$styling: {color, 'font-weight': 'bold'}}, `consumed: ${label}`),
        ),
        // A consumer that asks only for `color` is not re-rendered when `label`
        // changes.
        useContext(['color'], ({color}) =>
          d.div({$styling: {'background-color': color, height: '2em', 'border-radius': '4px'}}),
        ),
      );

    const state = fromObservable(
      {
        subscribe(observer) {
          let color, label;
          const emit = () => observer.next?.({color, label});
          const a = color$.subscribe(v => {
            color = v;
            emit();
          });
          const b = label$.subscribe(v => {
            label = v;
            emit();
          });
          return {
            unsubscribe() {
              a.unsubscribe();
              b.unsubscribe();
            },
          };
        },
      },
      {initial: {color: '#7b2ff7', label: 'ambient'}},
    );

    d.reconcile(container, [watch(state, data => withContext(data, card()))]);

    signal.addEventListener('abort', () => {
      d.reconcile(container, null);
    });
  });
};
