const masthead = document.querySelector('.mast');
function positionMasthead() {
  masthead.classList.toggle('floating', window.scrollY > 150);
}
positionMasthead();
window.addEventListener('scroll', positionMasthead, {passive: true});
window.addEventListener('pageshow', positionMasthead);
