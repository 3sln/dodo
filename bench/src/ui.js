import * as dd from '@3sln/dodo';

const HEADER_CELL = {border: '1px solid #ccc', padding: '8px', textAlign: 'left'};

const benchmarkApp = dd.alias(props => {
  const {state, runSuite} = props;

  const libraries = state.libraries || [];
  const benchmarks = state.benchmarks || [];
  const results = state.results || {};

  const renderResult = result => {
    if (!result) return '';
    if (result.running) return 'Running...';
    if (result.error) return `Error: ${result.error}`;
    if (result.median !== undefined) {
      return dd.div(
        dd.strong(`${result.median.toFixed(2)} ms`),
        dd.small(`best ${result.best.toFixed(2)}`).style({display: 'block', color: '#666'}),
      );
    }
    return '';
  };

  return dd
    .div(
      dd.h1('Dodo Benchmark Suite'),
      dd.p(
        'Click a "Run" button to execute the full, stateful benchmark sequence for that library.',
      ),
      dd
        .div(
          ...libraries.map(lib =>
            dd
              .button(`Run ${lib}`)
              .style({marginRight: '1em'})
              .on({click: () => runSuite(lib)}),
          ),
        )
        .style({marginBottom: '1em'}),
      dd.h2('Results'),
      dd
        .table(
          dd.thead(
            dd.tr(
              dd.th('Benchmark Step').style(HEADER_CELL),
              ...libraries.map(lib => dd.th(lib).style(HEADER_CELL)),
            ),
          ),
          dd.tbody(
            ...[...benchmarks, 'total'].map(benchName =>
              dd.tr(
                dd.td(benchName).style({
                  border: '1px solid #ccc',
                  padding: '8px',
                  fontWeight: benchName === 'total' ? 'bold' : 'normal',
                }),
                ...libraries.map(lib => {
                  const result = results[lib]?.[benchName];
                  const style = result?.running ? {backgroundColor: '#eee'} : {};
                  return dd.td(renderResult(result)).style({
                    border: '1px solid #ccc',
                    padding: '8px',
                    ...style,
                    verticalAlign: 'top',
                  });
                }),
              ),
            ),
          ),
        )
        .style({borderCollapse: 'collapse', width: '100%'}),
    )
    .style({fontFamily: 'sans-serif', padding: '1em'});
});

export default benchmarkApp;
