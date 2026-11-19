/* UI Kit: inspect real component iframes and display their computed typography.
   Values are measured in the rendered component, never copied into this file. */
(function () {
  'use strict';

  const cards = Array.from(document.querySelectorAll('article.cmp'));
  if (!cards.length) return;

  const rootUrl = '../tokens/tokens.json';
  let roles = [];
  let foundations = [];
  const waiting = new WeakSet();
  const dependencyByElement = new WeakMap();
  const measurementsByCard = new Map();
  let catalogPending = false;
  const ignored = '.ds-lab, .ds-focus, script, style, svg, noscript, [aria-hidden="true"], .ds-type-table-head, .ds-type-style-details, .ds-type-style-metric, .ds-type-loading';
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
    const foundation = foundationFor(data);
    if (foundation) return foundation.name;
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
  // A selector match is just a candidate; a reversible variable probe below
  // proves an actual CSS dependency even through @import, inheritance or media rules.
  function candidateRoles(el, style) {
    const direct = [], inherited = [], metricOnly = [];
    for (const role of roles) {
      const metricsMatch = formatPx(style.fontSize) === formatPx(role.size) &&
        style.fontWeight === String(role.weight) &&
        (!role.line || formatPx(style.lineHeight) === formatPx(role.line));
      if (!metricsMatch) continue;
      try {
        if (el.matches(role.selector)) direct.push(role);
        else if (el.closest(role.selector)) inherited.push(role);
        else metricOnly.push(role);
      } catch (e) { metricOnly.push(role); }
    }
    // Direct alias wins over an inherited parent alias (e.g. .cbal .cnt).
    return direct.concat(inherited, metricOnly);
  }
  // A synchronous, reversible CSS-variable probe proves that the rendered element
  // actually depends on the alias. It also rejects shadowed/overridden CSS rules.
  function dependsOn(el, token, style) {
    let cache = dependencyByElement.get(el);
    if (!cache) { cache = new Map(); dependencyByElement.set(el, cache); }
    const baseline = {size:style.fontSize, weight:style.fontWeight, line:style.lineHeight};
    const signature = token + '|' + baseline.size + '|' + baseline.weight + '|' + baseline.line;
    if (cache.has(signature)) return cache.get(signature);
    const scope = el.closest('.phone') || el.ownerDocument.documentElement;
    const oldValue = scope.style.getPropertyValue(token);
    const oldPriority = scope.style.getPropertyPriority(token);
    let changed = false;
    try {
      scope.style.setProperty(token, 'normal 71px/82px Inter,system-ui,sans-serif', 'important');
      const test = el.ownerDocument.defaultView.getComputedStyle(el);
      changed = test.fontSize !== baseline.size || test.fontWeight !== baseline.weight ||
        test.lineHeight !== baseline.line;
    } finally {
      if (oldValue) scope.style.setProperty(token, oldValue, oldPriority);
      else scope.style.removeProperty(token);
    }
    cache.set(signature, changed);
    return changed;
  }
  function linkedStyle(el, style) {
    for (const role of candidateRoles(el, style)) {
      if (dependsOn(el, '--ds-type-' + role.key, style))
        return {role, directFoundation:null};
    }
    // A direct --ds-text-* dependency also qualifies even without a named role.
    // Merely matching size/weight/line without reacting to the token does not.
    const foundation = foundationFor({
      role:null, directFoundation:null, size:style.fontSize, line:style.lineHeight,
      weight:style.fontWeight, family:style.fontFamily, fontStyle:style.fontStyle
    });
    if (foundation && dependsOn(el, foundation.token, style))
      return {role:null, directFoundation:foundation};
    return {role:null, directFoundation:null};
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
      const link = linkedStyle(el, c);
      const role = link.role;
      const selector = role && role.selector.startsWith('.') ? role.selector : pathFor(el);
      const key = [selector, c.fontSize, c.fontWeight, c.lineHeight, c.fontFamily,
        c.letterSpacing, c.fontStyle, role?.key || '', link.directFoundation?.key || ''].join('|');
      let data = rows.get(key);
      if (!data) {
        data = {selector, size:c.fontSize, line:c.lineHeight, weight:c.fontWeight,
          family:c.fontFamily, tracking:c.letterSpacing, fontStyle:c.fontStyle,
          role, directFoundation:link.directFoundation, el, samples:[], states:[]};
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
  // Metrics identify a visual style; role aliases identify a confirmed CSS dependency.
  // A local match is labelled as such, never misreported as a token reference.
  function normalizedTracking(value) {
    return value === 'normal' || value === '0px' ? '0' : formatPx(value);
  }
  function foundationFor(item) {
    const roleBase = item.role && foundations.find(f => f.key === item.role.base);
    if (roleBase && formatPx(roleBase.size) === formatPx(item.size) &&
        String(roleBase.weight) === String(item.weight) &&
        (!roleBase.line || formatPx(roleBase.line) === formatPx(item.line))) return roleBase;
    if (item.directFoundation) return item.directFoundation;
    if (!/Inter/i.test(item.family) || item.fontStyle !== 'normal') return null;
    return foundations.find(f => formatPx(f.size) === formatPx(item.size) &&
      String(f.weight) === String(item.weight) &&
      (f.line ? formatPx(f.line) === formatPx(item.line) : item.line === 'normal')) || null;
  }
  function renderCatalog() {
    const body = document.getElementById('ds-type-catalog-body');
    const status = document.getElementById('ds-type-catalog-status');
    if (!body || !status) return;
    const groups = new Map();
    for (const [cardId, source] of measurementsByCard) {
      for (const item of source.rows) {
        const key = [item.size, item.line, item.weight, item.family,
          normalizedTracking(item.tracking), item.fontStyle].join('|');
        let group = groups.get(key);
        if (!group) {
          group = {size:item.size, line:item.line, weight:item.weight,
            family:item.family, tracking:item.tracking, fontStyle:item.fontStyle,
            title:titleFor(item), foundation:null, example:item.samples[0] || '',
            aliases:new Set(), selectors:new Set(), components:new Map(), linkedCount:0, matchCount:0, localCount:0};
          groups.set(key, group);
        }
        const foundation = foundationFor(item);
        if (foundation && !group.foundation) group.foundation = foundation;
        if (item.role) group.aliases.add('--ds-type-' + item.role.key);
        if (item.role || item.directFoundation) group.linkedCount++;
        else if (foundation) group.matchCount++;
        else group.localCount++;
        group.selectors.add(item.selector);
        group.components.set(cardId, source.name);
      }
    }
    const all = Array.from(groups.values());
    const order = new Map(foundations.map((f, index) => [f.key, index]));
    const linked = all.filter(x => x.foundation).sort((a,b) =>
      (order.get(a.foundation.key) ?? 999) - (order.get(b.foundation.key) ?? 999) ||
      Number.parseFloat(a.size) - Number.parseFloat(b.size));
    const local = all.filter(x => !x.foundation).sort((a,b) =>
      Number.parseFloat(b.size) - Number.parseFloat(a.size) ||
      a.weight.localeCompare(b.weight) || a.title.localeCompare(b.title));
    body.replaceChildren();
    function section(name, entries) {
      if (!entries.length) return;
      const header = elem('tr', 'ds-type-catalog-group');
      const cell = elem('td', '', name + ' · ' + entries.length);
      cell.colSpan = 6;
      header.appendChild(cell);
      body.appendChild(header);
      for (const item of entries) {
        const tr = elem('tr', 'ds-type-catalog-row');
        const label = elem('td');
        label.appendChild(elem('span', 'ds-type-catalog-role',
          item.foundation ? item.foundation.name : 'Локальный стиль'));
        if (item.example) label.appendChild(elem('span', 'ds-type-catalog-example',
          '«' + item.example + '»'));
        tr.appendChild(label);
        const usage = elem('td');
        if (item.foundation) usage.appendChild(elem('code', 'ds-type-catalog-foundation',
          item.foundation.token));
        usage.appendChild(elem('span', 'ds-type-catalog-binding',
          item.linkedCount ? 'Использует токен · ' + item.linkedCount :
          item.matchCount ? 'Совпадение, без привязки' : 'Локальный стиль'));
        if (item.linkedCount && item.matchCount) usage.appendChild(elem('span', 'ds-type-catalog-unlinked',
          'Совпадение, без привязки · ' + item.matchCount));
        if (item.aliases.size) {
          usage.appendChild(elem('span', 'ds-type-catalog-aliases',
            'Алиасы: ' + Array.from(item.aliases).join(', ')));
        }
        const selectors = Array.from(item.selectors);
        usage.appendChild(elem('span', 'ds-type-catalog-selectors',
          'Селекторы: ' + selectors.slice(0, 3).join(', ') +
          (selectors.length > 3 ? ' +' + (selectors.length - 3) : '')));
        if (item.localCount) usage.appendChild(elem('span', 'ds-type-catalog-unlinked',
          'Локальные элементы: ' + item.localCount));
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
    section('Общие типографические стили', linked);
    section('Локальные комбинации без общего стиля', local);
    if (!all.length) {
      const row = elem('tr');
      const cell = elem('td', '', 'Образцы пока не загружены.');
      cell.colSpan = 6;
      row.appendChild(cell);
      body.appendChild(row);
    }
    const ready = cards.filter(c => c.id === 'type'
      ? c.dataset.typographyReady === '1'
      : c.querySelector('.ds-typography')?.dataset.ready === '1').length;
    status.textContent = 'Уникальные комбинации размера, строки, веса, шрифта и трекинга: ' +
      all.length + ' · общие: ' + linked.length + ', локальные: ' + local.length +
      ' · ' + ready + ' из ' + cards.length + ' образцов загружены.' +
      (ready < cards.length ? ' Таблица дополняется по мере загрузки.' : '');
  }

  function render(card) {
    const area = card.querySelector('.ds-typography');
    if (!area && card.id !== 'type') return;
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
    const heading = area?.querySelector('.ds-typo-heading');
    const list = area?.querySelector('.ds-typo-list');
    if (list) list.replaceChildren();
    if (!loaded) {
      if (area) {
        heading.textContent = 'Текстовые стили';
        list.appendChild(elem('p', 'ds-typo-empty', 'Ожидание образца…'));
        area.dataset.ready = '0';
      } else card.dataset.typographyReady = '0';
      measurementsByCard.delete(card.id);
      scheduleCatalog();
      return;
    }
    const all = Array.from(rows.values());
    measurementsByCard.set(card.id, {
      name: normalize(card.querySelector('.meta h3, .ds-type-dual-title')?.textContent) || card.id,
      rows: all
    });
    if (!area) {
      card.dataset.typographyReady = waitingForNested ? '0' : '1';
      scheduleCatalog();
      return;
    }
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
      const foundation = foundationFor(item);
      if (item.role || item.directFoundation) {
        usage.appendChild(elem('span', 'ds-typo-status ds-typo-linked', 'Использует токен'));
        if (item.role) usage.appendChild(elem('code', 'ds-typo-token', '--ds-type-' + item.role.key));
        if (foundation) usage.appendChild(elem('code', 'ds-typo-token', foundation.token));
      } else if (foundation) {
        usage.appendChild(elem('code', 'ds-typo-match-token', foundation.token));
        usage.appendChild(elem('span', 'ds-typo-status ds-typo-match', 'Совпадение, без привязки'));
      } else {
        usage.appendChild(elem('span', 'ds-typo-status ds-typo-local', 'Локальный стиль'));
      }
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
    if (!meta && card.id !== 'type') continue;
    if (meta) {
      const area = elem('section', 'ds-typography');
      area.setAttribute('aria-label', 'Текстовые стили компонента');
      area.dataset.ready = '0';
      area.appendChild(elem('h4', 'ds-typo-heading', 'Текстовые стили'));
      area.appendChild(elem('p', 'ds-typo-note',
        'Где используется · размер / line-height · насыщенность. Значения из образца.'));
      area.appendChild(elem('div', 'ds-typo-list'));
      const before = meta.querySelector('.src') || meta.querySelector('.open');
      meta.insertBefore(area, before || null);
    }
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
  window.addEventListener('message', event => {
    const type = document.getElementById('type');
    if (!type || !event.data?.dsTypeTableReady) return;
    if (![...type.querySelectorAll('iframe')].some(frame => frame.contentWindow === event.source)) return;
    schedule(type);
  });
  fetch(rootUrl).then(r => {
    if (!r.ok) throw new Error('Tokens response ' + r.status);
    return r.json();
  }).then(data => {
    roles = (data.type || []).filter(r => r.key && r.base);
    foundations = data.text_styles || [];
    cards.forEach(schedule);
  }).catch(() => {
    // On file:// previews the fetch can be blocked. Computed values still work
    // with a local HTTP server (README); roles are optional, measured values are not.
    cards.forEach(schedule);
  });
})();