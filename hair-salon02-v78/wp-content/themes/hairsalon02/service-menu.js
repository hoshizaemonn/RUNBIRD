(() => {
  const nav = document.querySelector('.service-menu-tabs');
  if (!nav) return;
  const tabs = [...nav.querySelectorAll('a')];
  const panels = tabs.map(tab => document.querySelector(tab.hash));
  if (panels.some(panel => !panel)) return;
  const fromHash = () => {
    const target = document.getElementById(location.hash.slice(1));
    const index = panels.findIndex(panel => panel === target || panel.contains(target));
    return index < 0 ? 0 : index;
  };
  const select = (index, focus = false) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) tabs[index].focus();
  };
  nav.setAttribute('role', 'tablist');
  tabs.forEach((tab, i) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panels[i].id);
    panels[i].setAttribute('role', 'tabpanel');
    panels[i].setAttribute('aria-labelledby', tab.id);
    panels[i].tabIndex = 0;
    tab.addEventListener('click', event => {
      event.preventDefault();
      select(i);
      history.replaceState(null, '', tab.hash);
    });
    tab.addEventListener('keydown', event => {
      if (event.key === ' ') { event.preventDefault(); select(i); history.replaceState(null, '', tab.hash); return; }
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (i + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
      history.replaceState(null, '', tabs[next].hash);
    });
  });
  select(fromHash());
  window.addEventListener('hashchange', () => select(fromHash()));
})();
