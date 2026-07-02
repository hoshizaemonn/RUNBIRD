/* ===== BuzzPlus LP - FAQ アコーディオン + フォーム送信ハンドラ ===== */

document.addEventListener("DOMContentLoaded", () => {
  // FAQ アコーディオン
  document.querySelectorAll(".faq-item").forEach((item) => {
    const btn = item.querySelector(".faq-q");
    btn.addEventListener("click", () => {
      item.classList.toggle("open");
    });
  });

  // フォーム仮送信ハンドラ (実際の送信先は別途設定)
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      console.log("送信データ:", data);
      alert(
        "お申し込みありがとうございます。\n\n本日中に担当者よりご連絡いたします。\n\n（※このフォームは現在テスト中です。実際の送信先設定は別途行います。）"
      );
    });
  }
});
