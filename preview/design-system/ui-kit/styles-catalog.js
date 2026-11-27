/* Styles page: inspect the same live UI Kit specimens without duplicating their markup.
   The component index remains the single source of specimen links and labels. */
(() => {
  'use strict';
  const host = document.getElementById('ds-measurement-samples');
  const status = document.getElementById('ds-type-catalog-status');

  function updateNavigation() {
    const current = location.hash === '#text-styles' || location.hash === '#type'
      || location.hash === '#ds-type-catalog' ? 'text-styles' : 'tokens';
    document.getElementById('tokens').hidden = current !== 'tokens';
    document.getElementById('text-styles').hidden = current !== 'text-styles';
    document.querySelectorAll('.kit-page-link[data-section]').forEach(link => {
      if (link.dataset.section === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', () => {
    updateNavigation();
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.dispatchEvent(new Event('resize'));
  });
  updateNavigation();

  function loadInspector() {
    const script = document.createElement('script');
    script.src = '../showcase/typography.js';
    script.onerror = () => {
      if (status) status.textContent = 'Не удалось загрузить инспектор типографики.';
    };
    document.body.appendChild(script);
  }

  async function init() {
    const response = await fetch('./index.html', { cache: 'no-store' });
    if (!response.ok) throw new Error('UI Kit response: ' + response.status);
    const source = new DOMParser().parseFromString(await response.text(), 'text/html');
    let count = 0;

    for (const original of source.querySelectorAll('article.cmp')) {
      if (!original.id || original.id === 'type') continue;
      const lightFrames = original.querySelectorAll('figure.v:not(.d) iframe');
      const frames = lightFrames.length
        ? Array.from(lightFrames)
        : Array.from(original.querySelectorAll('figure.v iframe'));
      if (!frames.length) continue;

      const card = document.createElement('article');
      card.id = original.id;
      card.className = 'cmp';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const heading = document.createElement('h3');
      heading.textContent = original.querySelector('.meta h3, .ds-type-dual-title')?.textContent?.trim()
        || original.id;
      meta.appendChild(heading);
      card.appendChild(meta);

      for (const originalFrame of frames) {
        const src = originalFrame.getAttribute('src');
        if (!src) continue;
        const figure = document.createElement('figure');
        figure.className = 'v';
        const frame = document.createElement('iframe');
        frame.src = src;
        frame.title = originalFrame.title || heading.textContent;
        frame.loading = 'eager';
        figure.appendChild(frame);
        card.appendChild(figure);
      }
      host.appendChild(card);
      count++;
    }

    if (!count) throw new Error('No component specimens found');
    loadInspector();
  }

  init().catch(error => {
    console.error('Typography specimens:', error);
    if (status) status.textContent = 'Не удалось загрузить образцы компонентов.';
    // The two foundation tables can still render independently.
    loadInspector();
  });
})();
