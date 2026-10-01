(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;
  const targets = [...document.querySelectorAll('[data-reveal]')];
  let observer;
  const show = el => {
    el.classList.remove('reveal-pending');
    if (observer) observer.unobserve(el);
  };
  try {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) show(entry.target); });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Never obscure content already on screen, including deep-linked content.
      if (rect.top < window.innerHeight * 0.85 && rect.bottom > 0) return;
      el.classList.add('reveal-ready', 'reveal-pending');
      observer.observe(el);
    });
    const showAll = () => { targets.forEach(show); observer.disconnect(); };
    motion.addEventListener('change', event => { if (event.matches) showAll(); });
    // Keyboard navigation must never focus an invisible element.
    document.addEventListener('focusin', event => {
      const parent = event.target.closest('[data-reveal]');
      if (parent) show(parent);
    });
    window.addEventListener('pageshow', event => { if (event.persisted) showAll(); });
  } catch (_) { targets.forEach(show); }
})();
