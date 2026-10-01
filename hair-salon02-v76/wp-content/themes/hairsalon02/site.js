const toggle=document.querySelector('.menu-toggle');
const menu=document.querySelector('.mobile-nav');
if(toggle&&menu){
  const close=()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','メニューを開く');};
  toggle.addEventListener('click',()=>{const opening=menu.hidden;menu.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));toggle.setAttribute('aria-label',opening?'メニューを閉じる':'メニューを開く');});
  menu.addEventListener('click',e=>{if(e.target.closest('a'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();toggle.focus();}});
  document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!toggle.contains(e.target))close();});
  matchMedia('(min-width:901px)').addEventListener('change',e=>{if(e.matches)close();});
}
const form=document.querySelector('#contact-form');
if(form){form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity())return;
  const data=new FormData(form);
  const body=`お名前：${data.get('name')}\nメール：${data.get('email')}\n電話番号：${data.get('phone')||'未記入'}\n\nお問い合わせ内容：\n${data.get('message')}`;
  const url=`mailto:${form.dataset.email}?subject=${encodeURIComponent('HAIR SALON 02へのお問い合わせ')}&body=${encodeURIComponent(body)}`;
  document.querySelector('#form-status').textContent='メールアプリで内容を確認し、送信してください。この画面からは送信されません。メールアプリが開かない場合は、お電話でお問い合わせください。';
  window.location.href=url;
});}
