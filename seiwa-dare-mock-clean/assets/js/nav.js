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

  /* --------------------------------------------------------------------------
     お問い合わせページ：窓口カードで表示するフォームを切り替える（タブ）
     ・HTMLは「3フォームが全部表示されている」状態が既定。ここで初めて切り替えUIを有効にする
       （＝JavaScriptが動かない環境では従来どおり3フォームが並び、アンカーで飛べる）
     ・contact.html#dogrun / #oyatsu / #guesthouse で来たら、そのフォームを開いた状態にする
     ・キーボード：Tabでタブ列に入り、←→（↑↓）で移動、Home/Endで端、Enter/Spaceで確定
     -------------------------------------------------------------------------- */
  var tabWrap = document.querySelector('.contact-choice');
  var panelWrap = document.getElementById('contact-panels');

  if (tabWrap && panelWrap) {
    var tabs = [].slice.call(tabWrap.querySelectorAll('[data-contact-tab]'));
    var panels = [].slice.call(panelWrap.querySelectorAll('[data-contact-panel]'));
    var emptyBox = document.getElementById('contact-empty');
    var header = document.querySelector('.site-header');

    if (tabs.length && panels.length) {
      var keyOf = function (el) {
        return el.getAttribute('data-contact-tab') || el.getAttribute('data-contact-panel');
      };
      var panelOf = function (key) {
        for (var i = 0; i < panels.length; i++) {
          if (keyOf(panels[i]) === key) return panels[i];
        }
        return null;
      };
      var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* タブとしての役割を後付けする（JSが動いた環境だけこの意味になる） */
      tabWrap.setAttribute('role', 'tablist');
      tabWrap.setAttribute('aria-label', 'お問い合わせ窓口の選択');
      tabWrap.setAttribute('aria-owns', tabs.map(function (t) {
        return 'tab-' + keyOf(t);
      }).join(' '));

      tabs.forEach(function (tab) {
        var key = keyOf(tab);
        tab.id = 'tab-' + key;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', key);
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('tabindex', '-1');
      });
      tabs[0].setAttribute('tabindex', '0');   /* 未選択でもキーボードでタブ列に入れるようにする */

      panels.forEach(function (panel) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', 'tab-' + keyOf(panel));
        panel.setAttribute('tabindex', '0');   /* 長いパネルをキーボードでスクロールできるように */
        panel.hidden = true;                   /* 既定は「未選択」＝どのフォームも開かない */
      });
      if (emptyBox) emptyBox.hidden = false;   /* 代わりに案内文を出す */

      /* 押した直後にフォームが視界に入るようにスクロールする（固定ヘッダー分だけ上に余白） */
      var scrollToPanel = function (panel, smooth) {
        var offset = (header ? header.offsetHeight : 0) + 12;
        var top = window.pageYOffset + panel.getBoundingClientRect().top - offset;
        if (top < 0) top = 0;
        if (smooth && !reduceMotion && 'scrollBehavior' in document.documentElement.style) {
          window.scrollTo({ top: top, behavior: 'smooth' });
        } else {
          window.scrollTo(0, top);
        }
      };

      var select = function (key, opts) {
        var target = panelOf(key);
        if (!target) return false;
        opts = opts || {};

        panels.forEach(function (panel) { panel.hidden = (panel !== target); });
        if (emptyBox) emptyBox.hidden = true;

        tabs.forEach(function (tab) {
          var on = keyOf(tab) === key;
          tab.setAttribute('aria-selected', on ? 'true' : 'false');
          tab.setAttribute('tabindex', on ? '0' : '-1');
          var card = tab.closest ? tab.closest('.contact-card') : tab.parentNode;
          if (card) card.classList.toggle('is-selected', on);
        });

        /* URLを共有できるよう残す。location.hash を書き換えると画面が飛ぶのでreplaceStateを使う */
        if (opts.updateHash !== false && window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '#' + key);
        }
        if (opts.scroll !== false) scrollToPanel(target, opts.smooth !== false);
        return true;
      };

      tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function (e) {
          e.preventDefault();
          select(keyOf(tab));
        });
        tab.addEventListener('keydown', function (e) {
          var move = 0;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move = 1;
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move = -1;
          else if (e.key === 'Home') move = -Infinity;
          else if (e.key === 'End') move = Infinity;
          else if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();            /* Enterはリンクの既定動作＝clickで拾える */
            select(keyOf(tab));
            return;
          } else {
            return;
          }
          e.preventDefault();
          var n = move === -Infinity ? 0
                : move === Infinity ? tabs.length - 1
                : (i + move + tabs.length) % tabs.length;
          tabs[n].focus();
          select(keyOf(tabs[n]), { scroll: false });   /* 移動中は画面を飛ばさない */
        });
      });

      /* 他ページから contact.html#guesthouse などで来たときに、そのフォームを開く */
      var openFromHash = function (isInitial) {
        var key = (window.location.hash || '').replace('#', '');
        if (!key) return false;
        return select(key, { updateHash: false, smooth: !isInitial });
      };
      if (openFromHash(true)) {
        /* 画像の読み込みで高さが変わると位置がずれるので、読み込み完了後にもう一度合わせる */
        window.addEventListener('load', function () {
          var key = (window.location.hash || '').replace('#', '');
          var panel = panelOf(key);
          if (panel && !panel.hidden) scrollToPanel(panel, false);
        });
      }
      window.addEventListener('hashchange', function () { openFromHash(false); });
    }
  }

  /* 客室スペックの開閉：広い画面では最初から開いておく（狭い画面は畳んだまま） */
  var roomMore = document.querySelectorAll('.room-more');
  if (roomMore.length && window.matchMedia('(min-width: 821px)').matches) {
    roomMore.forEach(function (d) { d.open = true; });
  }
})();
