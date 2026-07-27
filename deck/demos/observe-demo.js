import * as d from '@3sln/dodo';
import {withElementSize, withVisibility} from '@3sln/dodo/observe';

const box = (label, ...children) =>
  d.div(
    {
      $styling: {
        border: '1px solid #ccc',
        'border-radius': '4px',
        padding: '0.75em',
        'margin-bottom': '0.75em',
      },
    },
    d.strong(label),
    ...children,
  );

// The size reported is the container's, not the wrapper's: the component's own
// node is display:contents, so it measures the nearest laid out ancestor.
const measured = () =>
  box(
    'Container size',
    withElementSize(size => d.p(`${Math.round(size.width)} x ${Math.round(size.height)} px`)),
  );

// Scroll the inner panel to bring the tracked block in and out of view.
const tracked = () =>
  box(
    'Visibility',
    d.div(
      {
        $styling: {
          height: '8em',
          overflow: 'auto',
          border: '1px solid #ccc',
          'border-radius': '4px',
          padding: '0.5em',
        },
        $classes: ['observe-scroller'],
      },
      d.div({$styling: {height: '10em'}}, d.p('Scroll down…')),
      withVisibility(
        visible =>
          d.p(
            {$styling: {color: visible ? 'green' : '#999'}},
            visible ? 'on screen' : 'off screen',
          ),
        {root: '.observe-scroller', placeholder: () => d.p({$styling: {color: '#999'}}, '…')},
      ),
      d.div({$styling: {height: '10em'}}),
    ),
  );

export default driver => {
  driver.panel('Demo', (container, signal) => {
    const width$ = driver.property('Panel width %', {defaultValue: '60'});

    const sub = width$.subscribe(width => {
      d.reconcile(container, [
        d.div(
          {$styling: {width: `${Number(width) || 60}%`, 'min-width': '12em'}},
          measured(),
          tracked(),
        ),
      ]);
    });

    signal.addEventListener('abort', () => {
      sub.unsubscribe();
      d.reconcile(container, null);
    });
  });
};
