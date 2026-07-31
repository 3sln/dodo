// Every library is handed the same rows, built from a seeded generator, so a
// difference in a timing is a difference in the library rather than in the data
// it happened to draw.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ADJECTIVES = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
  'clean',
  'elegant',
  'easy',
  'angry',
  'crazy',
  'helpful',
  'mushy',
  'odd',
  'unsightly',
  'adorable',
  'important',
  'inexpensive',
  'cheap',
  'expensive',
  'fancy',
];

const COLOURS = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'white',
  'black',
  'orange',
];

const NOUNS = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
  'pizza',
  'mouse',
  'keyboard',
];

export function dataSource(seed) {
  const random = mulberry32(seed);
  const pick = list => list[Math.floor(random() * list.length)];
  let nextId = 1;

  return {
    random,
    build(count) {
      const rows = new Array(count);
      for (let i = 0; i < count; i++) {
        rows[i] = {
          id: nextId++,
          label: `${pick(ADJECTIVES)} ${pick(COLOURS)} ${pick(NOUNS)}`,
          selected: false,
        };
      }
      return rows;
    },
  };
}
