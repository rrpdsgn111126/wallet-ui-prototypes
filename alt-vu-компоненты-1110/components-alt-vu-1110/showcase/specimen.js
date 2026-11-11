/* Витрина: страница компонента сообщает витрине свою высоту, чтобы окно
   показа было ровно по содержимому. Ссылки и кнопки внутри никуда не ведут. */
(function () {
  var id = document.body.getAttribute('data-ds');
  function theme() { return location.hash === '#dark' ? 'dark' : 'light'; }
  function send() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    try { parent.postMessage({ ds: id, theme: theme(), h: h }, '*'); } catch (e) { /* открыта сама по себе */ }
  }
  addEventListener('load', send);
  addEventListener('hashchange', function () {
    document.documentElement.classList.toggle('dark', theme() === 'dark');
    send();
  });
  if (window.ResizeObserver) new ResizeObserver(send).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(send);
  document.addEventListener('click', function (e) {
    if (e.target.closest('a,button,[data-go],[data-act]')) e.preventDefault();
  }, true);
})();
