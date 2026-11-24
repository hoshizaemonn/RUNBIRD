// Keep all four stories readable when JavaScript is unavailable.
const choices = Array.from(document.querySelectorAll('[data-point]'));
const stories = Array.from(document.querySelectorAll('.point'));

function showPoint(index) {
  stories.forEach((story, i) => { story.hidden = i !== index; });
  choices.forEach((choice, i) => {
    if (i === index) choice.setAttribute('aria-current', 'true');
    else choice.removeAttribute('aria-current');
  });
}

function syncPoint() {
  const index = choices.findIndex(choice => choice.hash === location.hash);
  if (index >= 0) showPoint(index);
}

choices.forEach((choice, index) => {
  choice.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showPoint(index);
    history.replaceState(null, '', choice.hash);
  });
});
showPoint(0);
syncPoint();
window.addEventListener('hashchange', syncPoint);
