import * as d from '@3sln/dodo';

export default driver => {
  const {button, div, p, h, alias} = d;

  const myAlias = alias(text => p({$styling: {color: 'blue'}}, `(This is an alias) ${text}`));

  driver.panel('Demo', (container, signal) => {
    // 1. Create the DOM elements we want to target manually.
    const divTarget = document.createElement('div');
    divTarget.style.border = '2px solid #ccc';
    divTarget.style.padding = '1em';
    divTarget.style.minHeight = '50px';
    divTarget.style.marginTop = '0.5em';

    const spanTarget = document.createElement('span');
    spanTarget.style.border = '2px solid #ccc';
    spanTarget.style.padding = '1em';
    spanTarget.style.minHeight = '50px';
    spanTarget.style.marginTop = '0.5em';
    spanTarget.style.display = 'block';

    const controls = div(
      {
        $styling: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5em',
          paddingBottom: '1em',
          borderBottom: '1px solid #eee',
        },
      },
      button('reconcile(div, [p]) (Into)').on({
        click: () => d.reconcile(divTarget, [p('Rendered into the div.')]),
      }),
      button("reconcile(div, h('div')) (Onto)").on({
        click: () =>
          d.reconcile(
            divTarget,
            div({$styling: {backgroundColor: '#aeffae'}}, 'Rendered onto the div.'),
          ),
      }),
      button('reconcile(div, myAlias) (Onto)').on({
        click: () => d.reconcile(divTarget, myAlias('Rendered onto the div.')),
      }),
      button("reconcile(span, h('div')) (Error)").on({
        click: () => {
          try {
            d.reconcile(spanTarget, h('div', 'fails'));
          } catch (e) {
            alert(e.message);
          }
        },
      }),
      button('reconcile(span, myAlias) (Onto)').on({
        click: () => d.reconcile(spanTarget, myAlias('Rendered onto the span.')),
      }),
      button('Clear All').on({
        click: () => {
          d.reconcile(divTarget, []);
          d.reconcile(spanTarget, []);
        },
      }),
    );

    // 2. Create opaque placeholder VNodes and use $attach to append the manual elements.
    const demoArea = div(
      p('Target DIV:'),
      div()
        .opaque()
        .on({$attach: el => el.appendChild(divTarget)}),
      p({$styling: {marginTop: '1.5em'}}, 'Target SPAN:'),
      div()
        .opaque()
        .on({$attach: el => el.appendChild(spanTarget)}),
    );

    d.reconcile(container, [controls, demoArea]);

    signal.addEventListener('abort', () => {
      d.reconcile(container, []);
    });
  });
};
