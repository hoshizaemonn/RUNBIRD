const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu(){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','メニューを開く');nav.classList.remove('open');}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'メニューを閉じる':'メニューを開く');nav.classList.toggle('open',open);});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab){tabs.forEach(t=>{const selected=t===tab;t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!selected;});}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',e=>{let index;if(e.key==='ArrowRight')index=(i+1)%tabs.length;else if(e.key==='ArrowLeft')index=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=tabs.length-1;else return;e.preventDefault();selectTab(tabs[index]);tabs[index].focus();});});

// Photo carousel (access.html gallery)
document.querySelectorAll('[data-carousel]').forEach(root=>{
  const track=root.querySelector('[data-carousel-track]');
  const slides=[...root.querySelectorAll('[data-carousel-slide]')];
  const dotsWrap=root.querySelector('[data-carousel-dots]');
  const prevBtn=root.querySelector('[data-carousel-prev]');
  const nextBtn=root.querySelector('[data-carousel-next]');
  if(!track||!slides.length) return;
  let index=0;
  const dots=slides.map((_,i)=>{
    const b=document.createElement('button');
    b.type='button';b.className='carousel-dot'+(i===0?' is-active':'');
    b.setAttribute('role','tab');b.setAttribute('aria-selected',i===0?'true':'false');
    b.setAttribute('aria-label',(i+1)+'枚目');
    b.addEventListener('click',()=>go(i,true));
    dotsWrap.appendChild(b);
    return b;
  });
  function step(){
    const s=slides[0];
    if(!s) return 0;
    const w=s.getBoundingClientRect().width;
    const mr=parseFloat(getComputedStyle(s).marginRight)||0;
    return w+mr;
  }
  function render(){
    track.style.transform='translateX(-'+(index*step())+'px)';
    dots.forEach((d,i)=>{const a=i===index;d.classList.toggle('is-active',a);d.setAttribute('aria-selected',a?'true':'false');});
  }
  window.addEventListener('resize',render);
  function go(i,manual){
    index=(i+slides.length)%slides.length;
    render();
    if(manual) resetAuto();
  }
  prevBtn&&prevBtn.addEventListener('click',()=>go(index-1,true));
  nextBtn&&nextBtn.addEventListener('click',()=>go(index+1,true));
  let auto=setInterval(()=>go(index+1,false),6000);
  function resetAuto(){clearInterval(auto);auto=setInterval(()=>go(index+1,false),6000);}
  render();
});
