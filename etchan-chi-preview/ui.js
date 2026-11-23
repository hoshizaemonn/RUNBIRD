document.addEventListener('keydown', event => {
  const menu = document.querySelector('.mobile');
  if (event.key === 'Escape' && menu.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});
document.querySelector('[data-map]')?.addEventListener('click', event => {
  const frame = document.createElement('iframe');
  frame.title = 'プラザ桜木町の地図';
  frame.referrerPolicy = 'no-referrer-when-downgrade';
  frame.src = event.currentTarget.dataset.map;
  event.currentTarget.replaceWith(frame);
});
