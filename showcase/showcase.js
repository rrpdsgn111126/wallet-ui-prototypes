/* Витрина: высота окон показа — по сообщению страницы компонента. */
(function () {
  var frames = document.querySelectorAll('iframe');
  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.ds || !d.h) return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        frames[i].style.height = d.h + 'px';
        frames[i].setAttribute('data-ready', '1');
      }
    }
  });
})();
