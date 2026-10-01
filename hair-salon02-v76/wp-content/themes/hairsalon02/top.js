
  // メニュータブ切替
  document.querySelectorAll('.menu-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.menu-tab').forEach(function(t){ t.classList.remove('active'); t.setAttribute('aria-pressed','false'); });
      document.querySelectorAll('.menu-panel').forEach(function(p){ p.classList.remove('active'); });
      tab.classList.add('active'); tab.setAttribute('aria-pressed','true');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });

  // ヘッダーの透明⇄白帯 スクロール連動
  (function(){
    var header = document.getElementById('site-header');
    var threshold = 40;
    function onScroll(){
      if (window.scrollY > threshold) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();
