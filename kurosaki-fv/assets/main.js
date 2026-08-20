/* ============================================================
   共通スクリプト（全ページで読み込む）
   ============================================================ */

/* 屋号は 2026-08-20 のディレクションで【確定】しました。
   ★「中文堂」ではなく「中文道（ちゅうぶんどう）」です。8/19 の仮置き表記は誤りでした。
   ドメイン第一候補は chubundo.net。
   ※ 教室名の直書きは禁止。表示箇所は data-shop-name 属性で参照する。 */
var SHOP_NAME = "中文道";  /* 2026-08-20 確定 */

/* 確認用: ?shop=〇〇 のようにURLパラメータを付けると、その表記で見た目を確認できる。
   ★屋号を確定させるものではない。確定時は上の SHOP_NAME を書き換えること。 */
try {
  var _q = new URLSearchParams(location.search).get("shop");
  if (_q) { SHOP_NAME = _q; }
} catch (e) {}

(function () {
  "use strict";

  /* --- 教室名の流し込み --- */
  document.querySelectorAll("[data-shop-name]").forEach(function (el) {
    el.textContent = SHOP_NAME;
  });

  /* 表のSP縦積み時のラベルにも教室名を流し込む（直書きを避けるため） */
  document.querySelectorAll("[data-shop-label]").forEach(function (el) {
    el.setAttribute("data-label", SHOP_NAME);
  });

  var pageTitle = document.documentElement.getAttribute("data-page-title");
  document.title = pageTitle
    ? SHOP_NAME + "｜" + pageTitle
    : SHOP_NAME + "｜さいたま市岩槻のマンツーマン中国語教室";

  /* --- ハンバーガー開閉 --- */
  var btn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("global-nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", function () {
    var open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    document.body.classList.toggle("is-nav-open", !open);
  });

  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) {
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("is-nav-open");
    }
  });
})();
