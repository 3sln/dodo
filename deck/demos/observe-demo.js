import * as d from '@3sln/dodo';
import {withElementSize, withVisibility} from '@3sln/dodo/observe';

const box = (label, ...children) =>
  d.div(d.strong(label), ...children).style({
    border: '1px solid #ccc',
    'border-radius': '4px',
    padding: '0.75em',
    'margin-bottom': '0.75em',
  });

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
    d
      .div(
        d.div(d.p('Scroll down…')).style({height: '10em'}),
        withVisibility(
          visible =>
            d.p(visible ? 'on screen' : 'off screen').style({color: visible ? 'green' : '#999'}),
          {root: '.observe-scroller', placeholder: () => d.p('…').style({color: '#999'})},
        ),
        d.div().style({height: '10em'}),
      )
      .style({
        height: '8em',
        overflow: 'auto',
        border: '1px solid #ccc',
        'border-radius': '4px',
        padding: '0.5em',
      })
      .classes('observe-scroller'),
  );

export default driver => {
  driver.panel('Demo', (container, signal) => {
    const width$ = driver.property('Panel width %', {defaultValue: '60'});

    const sub = width$.subscribe(width => {
      d.reconcile(container, [
        d.div(measured(), tracked()).style({width: `${Number(width) || 60}%`, 'min-width': '12em'}),
      ]);
    });

    signal.addEventListener('abort', () => {
      sub.unsubscribe();
      d.reconcile(container, null);
    });
  });
};
