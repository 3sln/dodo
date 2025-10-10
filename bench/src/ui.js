import * as dd from '@3sln/dodo';

const benchmarkApp = dd.alias(props => {
  const {state, runSuite} = props;

  const libraries = state.libraries || [];
  const benchmarks = state.benchmarks || [];
  const results = state.results || {};

  const renderResult = result => {
    if (!result) return '';
    if (result.running) return 'Running...';
    if (result.error) return `Error: ${result.error}`;
    if (result.mean) {
      return dd.div(
        dd.strong(`${result.mean.toFixed(3)} ms`),
        dd.small({$styling: {display: 'block', color: '#666'}}, `(±${result.stdDev.toFixed(3)})`),
      );
    }
    return '';
  };

  return dd.div(
    {$styling: {fontFamily: 'sans-serif', padding: '1em'}},
    dd.h1('Dodo Benchmark Suite'),
    dd.p('Click a "Run" button to execute the full, stateful benchmark sequence for that library.'),
    dd.div(
      {$styling: {marginBottom: '1em'}},
      ...libraries.map(lib =>
        dd.button({$styling: {marginRight: '1em'}}, `Run ${lib}`).on({click: () => runSuite(lib)}),
      ),
    ),
    dd.h2('Results'),
    dd.table(
      {$styling: {borderCollapse: 'collapse', width: '100%'}},
      dd.thead(
        dd.tr(
          dd.th(
            {$styling: {border: '1px solid #ccc', padding: '8px', textAlign: 'left'}},
            'Benchmark Step',
          ),
          ...libraries.map(lib =>
            dd.th({$styling: {border: '1px solid #ccc', padding: '8px', textAlign: 'left'}}, lib),
          ),
        ),
      ),
      dd.tbody(
        ...[...benchmarks, 'total'].map(benchName =>
          dd.tr(
            dd.td(
              {
                $styling: {
                  border: '1px solid #ccc',
                  padding: '8px',
                  fontWeight: benchName === 'total' ? 'bold' : 'normal',
                },
              },
              benchName,
            ),
            ...libraries.map(lib => {
              const result = results[lib]?.[benchName];
              const style = result?.running ? {backgroundColor: '#eee'} : {};
              return dd.td(
                {
                  $styling: {
                    border: '1px solid #ccc',
                    padding: '8px',
                    ...style,
                    verticalAlign: 'top',
                  },
                },
                renderResult(result),
              );
            }),
          ),
        ),
      ),
    ),
  );
});

export default benchmarkApp;
