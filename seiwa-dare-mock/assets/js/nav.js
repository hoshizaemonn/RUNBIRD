/* スマホ用グローバルナビの開閉＋FV上での透過ヘッダー切り替え
   （WordPress化時もそのまま流用可） */
(function () {
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('global-nav');
  var header = document.querySelector('.site-header');

  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '閉じる' : 'メニュー';
    });
  }

  /* 最上部では写真の上に透過で重ね、少しでもスクロールしたら白背景にする
     （参考サイト：ゆるり奥日光・TOKIWAN と同じ挙動） */
  /* 下層ページ（.header-fixed-solid）は常に白ヘッダーなので切り替えない */
  if (header && !header.classList.contains('header-fixed-solid')) {
    var sync = function () {
      header.classList.toggle('is-solid', window.scrollY > 40);
    };
    sync();
    window.addEventListener('scroll', sync, { passive: true });
  }
})();
