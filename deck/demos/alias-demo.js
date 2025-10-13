import * as d from '@3sln/dodo';

export default driver => {
  const coloredBox = d.alias(props => {
    const {color, count} = props;
    return d.div(
      {
        $styling: {
          'background-color': color,
          padding: '1em',
          color: 'white',
          borderRadius: '4px',
          textAlign: 'center',
        },
      },
      d.h3('Aliased Component'),
      d.p(`Render count: ${count}`),
    );
  });

  driver.panel('Demo', (container, signal) => {
    const color$ = driver.property('Color', {defaultValue: '#007aff', type: 'color'});
    let renderCount = 0;

    const sub = color$.subscribe(color => {
      renderCount++;
      d.reconcile(container, [coloredBox({color, count: renderCount})]);
    });

    signal.addEventListener('abort', () => {
      sub.unsubscribe();
      d.reconcile(container, []);
    });
  });
};
