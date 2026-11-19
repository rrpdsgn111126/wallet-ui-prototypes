/* UI Kit: inspect real component iframes and display their computed typography.
   Values are measured in the rendered component, never copied into this file. */
(function () {
  'use strict';

  const cards = Array.from(document.querySelectorAll('article.cmp'));
  if (!cards.length) return;

  const rootUrl = '../tokens/tokens.json';
  let roles = [];
  const waiting = new WeakSet();
  const measurementsByCard = new Map();
  let catalogPending = false;
  const ignored = '.ds-lab, .ds-focus, script, style, svg, noscript, [aria-hidden="true"]';
  const textNodes = 'h1,h2,h3,h4,h5,h6,p,span,b,strong,em,i,small,label,a,button,input,textarea,select,div,li,td,th,code';
  const normalize = s => String(s || '').replace(/\s+/g, ' ').trim();

  function formatPx(n) {
    const value = Number.parseFloat(n);
    return Number.isFinite(value) ? Number(value.toFixed(2)) + ' px' : (n || '—');
  }
  function isAvailable(el, win) {
    const style = win.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      style.opacity !== '0' && el.getClientRects().length > 0;
  }
  function directText(el) {
    if (el.matches('input,textarea,select')) {
      const text = normalize(el.value || el.getAttribute('placeholder') || el.getAttribute('aria-label'));
      return text ? text.slice(0, 50) : (el.tagName.toLowerCase() === 'input' ? 'Поле ввода' : 'Поле');
    }
    const text = normalize(Array.from(el.childNodes)
      .filter(n => n.nodeType === 3)
      .map(n => n.nodeValue).join(' '));
    if (text) return text.slice(0, 50);
    // An input is often wrapped by the semantic value node (.fl b).
    if (el.matches('b,strong,label') && el.querySelector('input,textarea')) {
      const input = el.querySelector('input,textarea');
      return normalize(input.value || input.placeholder || 'Поле ввода').slice(0, 50);
    }
    return '';
  }
  function pathFor(el) {
    const parts = [];
    let node = el;
    while (node && parts.length < 3 && node.nodeType === 1 &&
           !node.classList.contains('ds-st') && !node.classList.contains('ds-ph')) {
      const classes = Array.from(node.classList || []).filter(c =>
        !c.startsWith('ds-') && !['on','g','w','n','off','err','active','tf-phone','phone'].includes(c));
      const part = classes.length ? '.' + classes.slice(0, 2).join('.') : node.tagName.toLowerCase();
      parts.unshift(part);
      if (classes.length && (node.classList.contains('fld') || node.classList.contains('row'))) break;
      node = node.parentElement;
    }
    return parts.join(' ');
  }
  function titleFor(data) {
    if (data.role) return data.role.name;
    if (data.el.matches('h1,h2,h3,h4,h5,h6')) return 'Заголовок';
    if (data.el.matches('input,textarea,select')) return 'Ввод текста';
    if (data.el.matches('button')) return 'Кнопка';
    const n = Number.parseFloat(data.size);
    if (n === 10) return 'Служебный текст';
    if (n === 12) return 'Подпись';
    if (n === 14) return 'Вторичный текст';
    if (n === 16) return 'Основной текст';
    if (n === 18) return 'Крупный текст';
    return 'Локальный текстовый стиль';
  }
  function matchingRole(el, style) {
    for (const r of roles) {
      try {
        // The label may inherit the token from its container (e.g. .bnv-i span).
        if (!el.matches(r.selector) && !el.closest(r.selector)) continue;
        if (formatPx(style.fontSize) !== formatPx(r.size)) continue;
        if (String(style.fontWeight) !== String(r.weight)) continue;
        if (r.line && formatPx(style.lineHeight) !== formatPx(r.line)) continue;
        return r;
      } catch (e) { /* A role describes a bank context rather than a selector. */ }
    }
    return null;
  }
  function collectDocument(doc, rows, state, visited, depth) {
    if (!doc || !doc.defaultView || visited.has(doc) || depth > 2) return;
    visited.add(doc);
    const win = doc.defaultView;
    const root = doc.querySelector('.ds-ph') || doc.querySelector('.phone') || doc.body;
    if (!root) return;
    for (const el of root.querySelectorAll(textNodes)) {
      if (el.closest(ignored)) continue;
      if (el.closest('.bank-field-note,.recipient-help,.ds-cn')) continue;
      const text = directText(el);
      if (!text || !isAvailable(el, win)) continue;
      const c = win.getComputedStyle(el);
      if (c.fontSize === '0px') continue;
      const role = matchingRole(el, c);
      const selector = role ? role.selector : pathFor(el);
      const key = [selector, c.fontSize, c.fontWeight, c.lineHeight, c.fontFamily].join('|');
      let data = rows.get(key);
      if (!data) {
        data = {selector, size:c.fontSize, line:c.lineHeight, weight:c.fontWeight,
          family:c.fontFamily, role, el, samples:[], states:[]};
        rows.set(key, data);
      }
      if (!data.samples.includes(text) && data.samples.length < 2) data.samples.push(text);
      if (state && !data.states.includes(state) && data.states.length < 2) data.states.push(state);
    }
    // Bank specimens embed the real SEPA/SWIFT screen in a second, same-origin iframe.
    for (const child of root.querySelectorAll('iframe')) {
      try {
        const nested = child.contentDocument;
        if (nested && nested.readyState !== 'loading') collectDocument(nested, rows, state, visited, depth + 1);
      } catch (e) { /* Unavailable cross-origin source is not treated as measured. */ }
    }
  }
  function elem(name, className, value) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }
  // The summary and the per-component panels share the exact same measured rows.
  // No font sizes, weights, component lists or selectors are duplicated in HTML.
  function scheduleCatalog() {
    if (catalogPending) return;
    catalogPending = true;
    requestAnimationFrame(() => {
      catalogPending = false;
      renderCatalog();
    });
  }
  function renderCatalog() {
    const body = document.getElementById('ds-type-catalog-body');
    const status = document.getElementById('ds-type-catalog-status');
    if (!body || !status) return;
    const groups = new Map();
    for (const [cardId, source] of measurementsByCard) {
      for (const item of source.rows) {
        const roleKey = item.role ? item.role.key : null;
        const key = roleKey ? 'token|' + roleKey :
          ['local', item.selector, item.size, item.line, item.weight, item.family].join('|');
        let group = groups.get(key);
        if (!group) {
          group = {role:item.role, title:titleFor(item), selector:item.selector,
            size:item.size, line:item.line, weight:item.weight,
            sample:item.samples[0] || '', components:new Map()};
          groups.set(key, group);
        }
        group.components.set(cardId, source.name);
      }
    }
    const items = Array.from(groups.values());
    const order = new Map(roles.map((role, index) => [role.key, index]));
    const tokenItems = items.filter(x => x.role).sort((a, b) =>
      (order.get(a.role.key) ?? 999) - (order.get(b.role.key) ?? 999));
    const localItems = items.filter(x => !x.role).sort((a, b) =>
      Number.parseFloat(b.size) - Number.parseFloat(a.size) ||
      a.selector.localeCompare(b.selector) || a.weight.localeCompare(b.weight));
    body.replaceChildren();

    function section(name, entries) {
      if (!entries.length) return;
      const heading = elem('tr', 'ds-type-catalog-group');
      const cell = elem('td', '', name + ' · ' + entries.length);
      cell.colSpan = 6;
      heading.appendChild(cell);
      body.appendChild(heading);
      for (const item of entries) {
        const tr = elem('tr', 'ds-type-catalog-row');
        const label = elem('td');
        label.appendChild(elem('span', 'ds-type-catalog-role',
          item.role ? item.role.name : 'Локальный · ' + item.title));
        if (item.sample) label.appendChild(elem('span', 'ds-type-catalog-example', '«' + item.sample + '»'));
        tr.appendChild(label);
        const usage = elem('td');
        usage.appendChild(elem('code', '', item.selector));
        if (item.role) usage.appendChild(elem('code', 'ds-type-catalog-token', '--ds-type-' + item.role.key));
        tr.appendChild(usage);
        tr.appendChild(elem('td', '', formatPx(item.size)));
        tr.appendChild(elem('td', '', formatPx(item.line)));
        tr.appendChild(elem('td', '', item.weight));
        const locations = elem('td', 'ds-type-catalog-components');
        const components = Array.from(item.components.entries());
        for (const [id, name] of components.slice(0, 6)) {
          const link = elem('a', '', name);
          link.href = '#' + id;
          locations.appendChild(link);
        }
        if (components.length > 6) locations.appendChild(elem('span', '', ' +' + (components.length - 6)));
        tr.appendChild(locations);
        body.appendChild(tr);
      }
    }
    section('Стили с токенами', tokenItems);
    section('Стили без совпадающего токена', localItems);
    if (!items.length) {
      const row = elem('tr');
      const cell = elem('td', '', 'Образцы пока не загружены.');
      cell.colSpan = 6;
      row.appendChild(cell);
      body.appendChild(row);
    }
    const ready = cards.filter(c => c.querySelector('.ds-typography')?.dataset.ready === '1').length;
    status.textContent = 'Фактические computed styles из компонентов · ' +
      ready + ' из ' + cards.length + ' образцов загружены · ' +
      tokenItems.length + ' стилей с токенами, ' + localItems.length +
      ' локальных. Несовпадения с токенами показаны отдельно.' +
      (ready < cards.length ? ' Таблица дополняется по мере загрузки.' : '');
  }

  function render(card) {
    const area = card.querySelector('.ds-typography');
    if (!area) return;
    const frames = Array.from(card.querySelectorAll('figure.v:not(.d) iframe'));
    if (!frames.length) frames.push(...card.querySelectorAll('figure.v iframe'));
    const rows = new Map();
    let loaded = 0;
    let waitingForNested = false;
    for (const frame of frames) {
      try {
        const doc = frame.contentDocument;
        if (!doc || doc.readyState === 'loading' || !doc.body || !doc.querySelector('.phone, .ds-ph')) continue;
        loaded++;
        for (const child of doc.querySelectorAll('.ds-ph iframe')) {
          try {
            const inner = child.contentDocument;
            if (!inner || inner.readyState === 'loading' || !inner.querySelector('.phone')) waitingForNested = true;
          } catch (e) { waitingForNested = true; }
        }
        const state = new URL(frame.src, location.href).searchParams.get('mode') || '';
        collectDocument(doc, rows, state.toUpperCase(), new Set(), 0);
      } catch (e) { /* Same-origin assumption can be false in a standalone file:// view. */ }
    }
    const heading = area.querySelector('.ds-typo-heading');
    const list = area.querySelector('.ds-typo-list');
    list.replaceChildren();
    if (!loaded) {
      heading.textContent = 'Текстовые стили';
      list.appendChild(elem('p', 'ds-typo-empty', 'Ожидание образца…'));
      area.dataset.ready = '0';
      measurementsByCard.delete(card.id);
      scheduleCatalog();
      return;
    }
    const all = Array.from(rows.values());
    measurementsByCard.set(card.id, {
      name: normalize(card.querySelector('.meta h3')?.textContent) || card.id,
      rows: all
    });
    heading.textContent = 'Текстовые стили · ' + all.length;
    if (!all.length) {
      list.appendChild(elem('p', 'ds-typo-empty', 'В образце нет текстовых элементов.'));
    }
    for (const item of all) {
      const line = elem('div', 'ds-typo-item');
      const header = elem('div', 'ds-typo-item-head');
      header.appendChild(elem('span', 'ds-typo-role', titleFor(item)));
      header.appendChild(elem('code', 'ds-typo-value',
        formatPx(item.size) + ' / ' + formatPx(item.line) + ' · ' + item.weight));
      line.appendChild(header);
      const usage = elem('div', 'ds-typo-usage');
      usage.appendChild(elem('span', '', '«' + item.samples.join('», «') + '»'));
      usage.appendChild(elem('code', 'ds-typo-selector', item.selector));
      if (item.role) usage.appendChild(elem('code', 'ds-typo-token', '--ds-type-' + item.role.key));
      if (item.states.length) usage.appendChild(elem('span', 'ds-typo-state', item.states.join(' / ')));
      if (/mono/i.test(item.family) && !/Inter/i.test(item.family))
        usage.appendChild(elem('span', 'ds-typo-state', 'моноширинный'));
      line.appendChild(usage);
      list.appendChild(line);
    }
    area.dataset.ready = waitingForNested ? '0' : '1';
    scheduleCatalog();
  }
  function schedule(card) {
    if (waiting.has(card)) return;
    waiting.add(card);
    requestAnimationFrame(() => {
      waiting.delete(card);
      render(card);
    });
  }
  for (const card of cards) {
    const meta = card.querySelector('.meta');
    if (!meta) continue;
    const area = elem('section', 'ds-typography');
    area.setAttribute('aria-label', 'Текстовые стили компонента');
    area.dataset.ready = '0';
    area.appendChild(elem('h4', 'ds-typo-heading', 'Текстовые стили'));
    area.appendChild(elem('p', 'ds-typo-note',
      'Где используется · размер / line-height · насыщенность. Значения из образца.'));
    area.appendChild(elem('div', 'ds-typo-list'));
    const before = meta.querySelector('.src') || meta.querySelector('.open');
    meta.insertBefore(area, before || null);
    card.querySelectorAll('figure.v iframe').forEach(frame => {
      frame.addEventListener('load', () => {
        try {
          const inner = frame.contentDocument;
          if (inner) {
            inner.querySelectorAll('iframe').forEach(child => {
              child.addEventListener('load', () => schedule(card));
              if (child.loading === 'lazy') child.loading = 'eager';
            });
            if (inner.fonts && inner.fonts.ready) inner.fonts.ready.then(() => schedule(card));
          }
        } catch (e) { /* A failed iframe is handled as a missing sample. */ }
        schedule(card);
      });
      try { if (frame.contentDocument && frame.contentDocument.readyState === 'complete') schedule(card); }
      catch (e) { /* Cross-origin preview is not a valid computed-style source. */ }
      // The top-of-page catalog should not depend on scrolling to lazy specimens.
      if (frame.matches('figure.v:not(.d) iframe') && frame.loading === 'lazy') frame.loading = 'eager';
    });
    schedule(card);
  }
  fetch(rootUrl).then(r => {
    if (!r.ok) throw new Error('Tokens response ' + r.status);
    return r.json();
  }).then(data => {
    roles = (data.type || []).filter(r => r.selector && r.selector.trim().startsWith('.'));
    cards.forEach(schedule);
  }).catch(() => {
    // On file:// previews the fetch can be blocked. Computed values still work
    // with a local HTTP server (README); roles are optional, measured values are not.
    cards.forEach(schedule);
  });
})();