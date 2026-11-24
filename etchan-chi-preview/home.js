const features = document.querySelector('.features');
const stage = features.querySelector('.feature-stage');
const header = document.querySelector('header');
const panels = [...features.querySelectorAll('.point')];
const links = [...features.querySelectorAll('.point-nav a')];
const markers = panels.map(panel => {
  const marker = document.createElement('span');
  marker.className = 'point-marker';
  marker.setAttribute('aria-hidden', 'true');
  features.append(marker);
  return { marker, id: panel.id };
});

let pinned = false;
let stride = 0;
let current = -1;
let queued = false;

function select(index) {
  if (index === current) return;
  current = index;
  panels.forEach((panel, i) => {
    panel.classList.toggle('current', i === index);
    panel.inert = pinned && i !== index;
    if (i === index) links[i].setAttribute('aria-current', 'step');
    else links[i].removeAttribute('aria-current');
  });
}

function sync() {
  queued = false;
  let index = 0;
  if (pinned) {
    const distance = header.offsetHeight - features.getBoundingClientRect().top;
    index = Math.max(0, Math.min(panels.length - 1, Math.floor(distance / stride + 0.28)));
  } else {
    panels.forEach((panel, i) => {
      if (panel.getBoundingClientRect().top < window.innerHeight * 0.55) index = i;
    });
  }
  select(index);
}

function layout() {
  const head = header.offsetHeight;
  document.documentElement.style.setProperty('--feature-head', head + 'px');
  // Measure the tallest panel, including after text zoom or a viewport rotation.
  features.classList.add('pinned');
  pinned = stage.offsetHeight <= window.innerHeight - head;
  features.classList.toggle('pinned', pinned);
  stride = Math.round(window.innerHeight * 0.72);
  features.style.height = pinned ? (stage.offsetHeight + stride * (panels.length - 1)) + 'px' : '';
  markers.forEach(({ marker, id }, i) => {
    if (pinned) {
      panels[i].removeAttribute('id');
      marker.id = id;
      marker.style.top = (stride * i) + 'px';
    } else {
      marker.removeAttribute('id');
      panels[i].id = id;
    }
  });
  current = -1;
  sync();
}

function updateOnScroll() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(sync);
  }
}
layout();
window.addEventListener('scroll', updateOnScroll, {passive: true});
window.addEventListener('resize', layout);
document.fonts.ready.then(layout);
const sizeObserver = new ResizeObserver(layout);
panels.forEach(panel => sizeObserver.observe(panel));
sizeObserver.observe(header);
