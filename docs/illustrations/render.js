// Renders integration widget contents the way the Gladys front does
// (front/src/components/boxs/external-widget, ExternalWidgetBox +
// WidgetComponents, and the line chart of boxs/chart), in plain DOM, with the
// same class names and the same ApexCharts options. Query: ?lang=fr&cards=balanced,alert
/* global ApexCharts, DATA */
const params = new URLSearchParams(location.search);
const LANG = params.get('lang') || 'en';
const CARDS = (params.get('cards') || 'balanced').split(',');

// The "now" of the contents: the chart axis matches it.
const realNow = Date.now;
Date.now = () => DATA.now;

const text = (value) =>
  value && typeof value === 'object' ? (value[LANG] ?? value.en ?? '') : (value ?? '');
const formatNumber = (value) =>
  typeof value === 'number'
    ? new Intl.NumberFormat(LANG, { maximumFractionDigits: 2 }).format(value)
    : (value ?? '');
const COLOR = {
  neutral: 'colorNeutral',
  primary: 'colorPrimary',
  success: 'colorSuccess',
  warning: 'colorWarning',
  danger: 'colorDanger',
  info: 'colorInfo',
};
const el = (tag, cls, children = []) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const icon = (name, cls = '') => el('i', `fe fe-${name} ${cls}`);

function splitIntoSlots(components) {
  const slots = { header: [], tiles: [], focal: null, body: null, status: null, buttons: [] };
  for (const c of components) {
    if (c.type === 'text') c.variant === 'body' ? (slots.body = c) : slots.header.push(c);
    else if (c.type === 'value' || c.type === 'gauge') slots.tiles.push(c);
    else if (['chart', 'card-list', 'image'].includes(c.type)) slots.focal = c;
    else if (c.type === 'status') slots.status = c;
    else if (c.type === 'button') slots.buttons.push(c);
  }
  return slots;
}

const header = (components) =>
  el(
    'div',
    'header',
    components.map((c) => el('div', c.variant === 'heading' ? 'heading' : 'caption', text(c.text))),
  );

function tiles(components) {
  return el(
    'div',
    'tilesBox',
    el(
      'div',
      `tiles tilesCount${Math.min(components.length, 6)}`,
      components.map((c) =>
        el('div', 'tile', [
          c.icon ? icon(c.icon, `tileIcon ${COLOR[c.color] || ''}`) : null,
          el('span', `tileValue ${COLOR[c.color] || ''}`, [
            formatNumber(c.value),
            c.unit ? el('span', 'tileUnit', text(c.unit)) : null,
          ]),
          c.label ? el('span', 'tileLabel', text(c.label)) : null,
        ]),
      ),
    ),
  );
}

// yAxisFormatter of front/src/components/boxs/chart.
const yAxisFormatter = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return value;
  if (value === 0) return '0';
  const rounded = parseFloat(value.toPrecision(4));
  if (Math.abs(rounded) < 0.001 || Math.abs(rounded) >= 1e9) return rounded.toExponential(2);
  return value.toFixed(2);
};

// getApexChartLineOptions of front/src/components/boxs/chart, display_axes on,
// height 200, the default colors of the chart box.
function chart(component) {
  const box = el('div', null, [
    component.title ? el('div', 'caption mb-1', text(component.title)) : null,
  ]);
  const target = el('div');
  box.append(target);
  const series = component.series.map((s, i) => ({
    name: text(s.name) || `${i + 1}`,
    data: s.points.map((p) => [new Date(p.t).getTime(), p.v]),
  }));
  const options = {
    chart: {
      locales: window.APEX_LOCALES,
      defaultLocale: LANG,
      type: 'line',
      fontFamily: 'inherit',
      height: 200,
      parentHeightOffset: 0,
      sparkline: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: false },
    },
    dataLabels: { enabled: false },
    fill: { opacity: 1 },
    stroke: { width: 2, lineCap: 'round', curve: 'smooth' },
    series,
    grid: { strokeDashArray: 4, padding: { left: -4 } },
    xaxis: {
      labels: { padding: 0, datetimeUTC: false },
      tooltip: { enabled: false },
      axisBorder: { show: false },
      type: 'datetime',
    },
    yaxis: { labels: { padding: 4, formatter: yAxisFormatter } },
    colors: ['#316cbe', '#d63031', '#00b894', '#fdcb6e', '#6c5ce7'],
    legend: { show: true, position: 'bottom' },
  };
  requestAnimationFrame(() => {
    window.PENDING_CHARTS += 1;
    new ApexCharts(target, options).render().then(() => {
      window.PENDING_CHARTS -= 1;
    });
  });
  return box;
}

function statusList(component) {
  return el(
    'ul',
    'statusList',
    component.items.map((item) =>
      el('li', 'statusRow', [
        item.icon
          ? icon(item.icon, `statusIcon ${COLOR[item.color || 'neutral']}`)
          : el('span', `statusDot ${COLOR[item.color || 'neutral']}`),
        el('span', 'statusLabel', text(item.label)),
        el('span', 'statusValue', formatNumber(text(item.value))),
      ]),
    ),
  );
}

function card(name) {
  const content = DATA.contents[LANG][name];
  const slots = splitIntoSlots(content.components);
  return el('div', 'card', [
    el(
      'div',
      'card-header',
      el('h3', 'card-title', [icon(DATA.card.icon), el('span', 'm-1', text(DATA.card.label))]),
    ),
    el(
      'div',
      'card-body',
      el('div', 'slots', [
        slots.header.length ? header(slots.header) : null,
        slots.tiles.length ? tiles(slots.tiles) : null,
        slots.focal && slots.focal.type === 'chart' ? chart(slots.focal) : null,
        slots.body ? el('p', 'body', text(slots.body.text)) : null,
        slots.status ? statusList(slots.status) : null,
      ]),
    ),
  ]);
}

window.PENDING_CHARTS = 0;
const row = document.getElementById('row');
for (const name of CARDS) {
  row.append(el('div', 'col', card(name)));
}
setTimeout(() => {
  const wait = () => {
    if (window.PENDING_CHARTS === 0) {
      document.body.dataset.ready = '1';
      Date.now = realNow;
    } else setTimeout(wait, 50);
  };
  wait();
}, 100);
