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

const homeScroll = document.querySelector('.page-index .scroll');
if (homeScroll) {
  const header = document.querySelector('header');
  const updateHeader = () => header.classList.toggle('on-paper', homeScroll.scrollTop > 0);
  homeScroll.addEventListener('scroll', updateHeader, {passive:true});
  updateHeader();
}
