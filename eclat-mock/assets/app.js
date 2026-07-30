// header border
const hd=document.getElementById('hd');
addEventListener('scroll',()=>hd.classList.toggle('scrolled',scrollY>10));
// burger
const bg=document.getElementById('burger'),gn=document.getElementById('gnav');
bg.addEventListener('click',()=>gn.classList.toggle('open'));
gn.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>gn.classList.remove('open')));
// flow tabs
document.querySelectorAll('.flow-tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.flow-tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.flow-panel').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('panel-'+t.dataset.tab).classList.add('active');
  });
});
// reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

// 社内メモ表示（?internal=1 のときだけ）
if(new URLSearchParams(location.search).get('internal')==='1')document.body.classList.add('internal-on');
