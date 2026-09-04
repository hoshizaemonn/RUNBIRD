/* スマホ用グローバルナビの開閉（WordPress化時もそのまま流用可） */
(function () {
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('global-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? '閉じる' : 'メニュー';
  });
})();
