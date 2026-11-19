/* The two themed typography tables use one set of actual design tokens.
   No separate numbers or font shorthands are stored in the showcase. */
(function () {
  'use strict';

  const list = document.querySelector('[data-ds-type-list]');
  const count = document.querySelector('[data-ds-type-count]');
  if (!list || !count) return;

  const examples = {
    'display-balance': '1 284',
    'display-amount': '1 284,60 $',
    'display-cents': '.60 $',
    'heading-m': 'Заголовок экрана',
    'heading-status': 'Перевод выполнен',
    'heading-prominent': 'Крупный заголовок',
    'heading-accent': 'Акцентный заголовок',
    'button-m': 'Продолжить',
    'body-m': 'Основной текст интерфейса',
    'body-m-strong': 'Выделенный основной текст',
    'body-s': 'Вторичный текст',
    'link-s': 'Подробнее',
    'label-strong': 'Выделенная подпись',
    'caption': 'Подпись быстрого действия',
    'caption-relaxed': 'Компактная подпись',
    'caption-strong': 'Акцентная подпись',
    'bank-prompt': 'Служебная надпись'
  };

  function add(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content != null) el.textContent = content;
    return el;
  }

  function measure() {
    for (const row of list.querySelectorAll('[data-ds-type-style]')) {
      const sample = row.querySelector('[data-ds-type-sample]');
      const metric = row.querySelector('[data-ds-type-metric]');
      if (!sample || !metric) continue;
      const c = getComputedStyle(sample);
      const px = value => {
        const n = parseFloat(value);
        return Number.isFinite(n) ? Number(n.toFixed(2)) + ' px' : value;
      };
      metric.textContent = px(c.fontSize) + ' / ' + px(c.lineHeight) + ' · ' + c.fontWeight;
      row.dataset.metricsReady = '1';
    }
  }

  fetch('../tokens/tokens.json', {cache:'no-store'})
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(tokens => {
      const styles = tokens.text_styles;
      if (!Array.isArray(styles) || !styles.length) throw new Error('No shared typography styles');
      const roles = tokens.type || [];
      const sorted = [...styles].sort((a,b) =>
        parseFloat(b.size) - parseFloat(a.size) ||
        parseFloat(b.weight) - parseFloat(a.weight) ||
        a.name.localeCompare(b.name, 'ru'));

      const fragment = document.createDocumentFragment();
      for (const style of sorted) {
        const aliases = roles.filter(role => role.base === style.key);
        const row = add('div', 'ds-type-style-row');
        row.dataset.dsTypeStyle = style.key;
        const body = add('div', 'ds-type-style-body');
        const sample = add('span', 'ds-type-style-sample', examples[style.key] || style.name);
        sample.dataset.dsTypeSample = '';
        sample.style.font = 'var(' + style.token + ')';
        if (style.key === 'link-s') sample.style.color = 'var(--brand-600)';
        else if (['body-s','caption','caption-relaxed'].includes(style.key))
          sample.style.color = 'var(--n500)';
        body.appendChild(sample);

        const details = add('div', 'ds-type-style-details');
        details.appendChild(add('code', 'ds-type-style-token', style.token));
        if (aliases.length) {
          details.appendChild(add('span', 'ds-type-style-usage',
            aliases.map(role => role.name).join(' · ')));
        }
        body.appendChild(details);
        row.appendChild(body);
        const metric = add('output', 'ds-type-style-metric');
        metric.dataset.dsTypeMetric = '';
        metric.setAttribute('aria-label', 'Размер, высота строки и насыщенность');
        row.appendChild(metric);
        fragment.appendChild(row);
      }
      list.replaceChildren(fragment);
      count.textContent = sorted.length + ' общих стилей';
      function notifyParent() {
        try { parent.postMessage({dsTypeTableReady:true}, location.origin); }
        catch (error) { /* Standalone component remains usable. */ }
      }
      measure();
      notifyParent();
      if (document.fonts && document.fonts.ready)
        document.fonts.ready.then(() => { measure(); notifyParent(); });
      window.addEventListener('resize', measure);
    })
    .catch(error => {
      list.replaceChildren(add('p', 'ds-type-loading',
        'Не удалось загрузить типографические токены: ' + error.message));
      count.textContent = 'Ошибка загрузки';
    });
})();
