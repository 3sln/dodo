import { h } from '../index.js';

// Document metadata
export const title = (...args) => h('title', ...args);
export const meta = (props) => h('meta', props);
export const link = (props) => h('link', props);
export const style = (...args) => h('style', ...args);
export const script = (...args) => h('script', ...args);
export const noscript = (...args) => h('noscript', ...args);

// Content sectioning
export const address = (...args) => h('address', ...args);
export const article = (...args) => h('article', ...args);
export const aside = (...args) => h('aside', ...args);
export const footer = (...args) => h('footer', ...args);
export const header = (...args) => h('header', ...args);
export const h1 = (...args) => h('h1', ...args);
export const h2 = (...args) => h('h2', ...args);
export const h3 = (...args) => h('h3', ...args);
export const h4 = (...args) => h('h4', ...args);
export const h5 = (...args) => h('h5', ...args);
export const h6 = (...args) => h('h6', ...args);
export const main = (...args) => h('main', ...args);
export const nav = (...args) => h('nav', ...args);
export const section = (...args) => h('section', ...args);

// Text content
export const blockquote = (...args) => h('blockquote', ...args);
export const dd = (...args) => h('dd', ...args);
export const div = (...args) => h('div', ...args);
export const dl = (...args) => h('dl', ...args);
export const dt = (...args) => h('dt', ...args);
export const figcaption = (...args) => h('figcaption', ...args);
export const figure = (...args) => h('figure', ...args);
export const hr = () => h('hr');
export const li = (...args) => h('li', ...args);
export const ol = (...args) => h('ol', ...args);
export const p = (...args) => h('p', ...args);
export const pre = (...args) => h('pre', ...args);
export const ul = (...args) => h('ul', ...args);

// Inline text semantics
export const a = (...args) => h('a', ...args);
export const abbr = (...args) => h('abbr', ...args);
export const b = (...args) => h('b', ...args);
export const br = () => h('br');
export const cite = (...args) => h('cite', ...args);
export const code = (...args) => h('code', ...args);
export const data = (...args) => h('data', ...args);
export const del = (...args) => h('del', ...args);
export const dfn = (...args) => h('dfn', ...args);
export const em = (...args) => h('em', ...args);
export const i = (...args) => h('i', ...args);
export const ins = (...args) => h('ins', ...args);
export const kbd = (...args) => h('kbd', ...args);
export const mark = (...args) => h('mark', ...args);
export const q = (...args) => h('q', ...args);
export const s = (...args) => h('s', ...args);
export const samp = (...args) => h('samp', ...args);
export const small = (...args) => h('small', ...args);
export const span = (...args) => h('span', ...args);
export const strong = (...args) => h('strong', ...args);
export const sub = (...args) => h('sub', ...args);
export const sup = (...args) => h('sup', ...args);
export const time = (...args) => h('time', ...args);
export const u = (...args) => h('u', ...args);
export const wbr = () => h('wbr');

// Image and multimedia
export const area = (props) => h('area', props);
export const audio = (...args) => h('audio', ...args);
export const img = (props) => h('img', props);
export const map = (...args) => h('map', ...args);
export const track = (props) => h('track', props);
export const video = (...args) => h('video', ...args);

// Embedded content
export const embed = (props) => h('embed', props);
export const iframe = (...args) => h('iframe', ...args);
export const object = (...args) => h('object', ...args);
export const param = (props) => h('param', props);
export const picture = (...args) => h('picture', ...args);
export const portal = (...args) => h('portal', ...args);
export const source = (props) => h('source', props);

// SVG and MathML
export const svg = (...args) => h('svg', ...args);
export const math = (...args) => h('math', ...args);

// Scripting
export const canvas = (...args) => h('canvas', ...args);

// Table content
export const caption = (...args) => h('caption', ...args);
export const col = (props) => h('col', props);
export const colgroup = (...args) => h('colgroup', ...args);
export const table = (...args) => h('table', ...args);
export const tbody = (...args) => h('tbody', ...args);
export const td = (...args) => h('td', ...args);
export const tfoot = (...args) => h('tfoot', ...args);
export const th = (...args) => h('th', ...args);
export const thead = (...args) => h('thead', ...args);
export const tr = (...args) => h('tr', ...args);

// Forms
export const button = (...args) => h('button', ...args);
export const datalist = (...args) => h('datalist', ...args);
export const fieldset = (...args) => h('fieldset', ...args);
export const form = (...args) => h('form', ...args);
export const input = (props) => h('input', props);
export const label = (...args) => h('label', ...args);
export const legend = (...args) => h('legend', ...args);
export const meter = (...args) => h('meter', ...args);
export const optgroup = (...args) => h('optgroup', ...args);
export const option = (...args) => h('option', ...args);
export const output = (...args) => h('output', ...args);
export const progress = (...args) => h('progress', ...args);
export const select = (...args) => h('select', ...args);
export const textarea = (...args) => h('textarea', ...args);

// Interactive elements
export const details = (...args) => h('details', ...args);
export const dialog = (...args) => h('dialog', ...args);
export const summary = (...args) => h('summary', ...args);

// Web Components
export const slot = (...args) => h('slot', ...args);
export const template = (...args) => h('template', ...args);
