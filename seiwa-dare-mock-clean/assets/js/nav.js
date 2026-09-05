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

  /* ファーストビューのスライドショー（外部ライブラリ不使用）
     ・4枚をフェードで自動切り替え
     ・prefers-reduced-motion: reduce の環境では自動切り替えをしない（1枚目を静止表示）
     ・タブが非表示の間は止める（無駄な描画をしない） */
  var slideBox = document.getElementById('hero-slides');
  var dotBox = document.getElementById('hero-dots');
  if (slideBox) {
    var slides = [].slice.call(slideBox.querySelectorAll('.hero-bg'));
    if (slides.length > 1) {
      var index = 0;
      var timer = null;
      var INTERVAL = 6000;
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

      var show = function (i) {
        index = (i + slides.length) % slides.length;
        slides.forEach(function (el, n) { el.classList.toggle('is-active', n === index); });
        if (dotBox) {
          [].slice.call(dotBox.children).forEach(function (b, n) {
            b.setAttribute('aria-current', n === index ? 'true' : 'false');
          });
        }
      };

      /* 手動で切り替えるための丸ボタン（動きを止めている人も操作できる） */
      if (dotBox) {
        slides.forEach(function (el, n) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', (n + 1) + '枚目の写真を表示');
          b.setAttribute('aria-current', n === 0 ? 'true' : 'false');
          b.addEventListener('click', function () { show(n); restart(); });
          /* キーボードの左右キーでも切り替えられるようにする */
          b.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') { show(index + 1); restart(); dotBox.children[index].focus(); }
            if (e.key === 'ArrowLeft') { show(index - 1); restart(); dotBox.children[index].focus(); }
          });
          dotBox.appendChild(b);
        });
      }

      var start = function () {
        if (reduce && reduce.matches) return;   /* 動きを減らす設定なら自動切り替えしない */
        if (timer) return;
        timer = setInterval(function () { show(index + 1); }, INTERVAL);
      };
      var stop = function () { clearInterval(timer); timer = null; };
      var restart = function () { stop(); start(); };

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { stop(); } else { start(); }
      });
      if (reduce && reduce.addEventListener) {
        reduce.addEventListener('change', function () { reduce.matches ? stop() : start(); });
      }
      start();
    }
  }

  /* 写真スライダー（手動送り・サムネイル・キーボード対応） */
  document.querySelectorAll('[data-slider]').forEach(function (root) {
    var slides = [].slice.call(root.querySelectorAll('.slider-stage img'));
    var thumbs = [].slice.call(root.querySelectorAll('.slider-thumbs button'));
    if (slides.length < 2) return;
    var index = 0;

    var show = function (i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (el, n) { el.classList.toggle('is-active', n === index); });
      thumbs.forEach(function (b, n) { b.setAttribute('aria-current', n === index ? 'true' : 'false'); });
    };

    thumbs.forEach(function (b, n) { b.addEventListener('click', function () { show(n); }); });

    var prev = root.querySelector('.slider-prev');
    var next = root.querySelector('.slider-next');
    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });

    /* キーボードの左右キーでも送れるようにする */
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { show(index + 1); }
      if (e.key === 'ArrowLeft') { show(index - 1); }
    });

    show(0);
  });

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
