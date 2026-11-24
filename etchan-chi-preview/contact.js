const form = document.querySelector('#dm-form');
const draftBox = document.querySelector('#draft-box');
const draft = document.querySelector('#draft');
const statusMessage = document.querySelector('#copy-status');
form.hidden = false;
form.addEventListener('input', () => {
  draftBox.hidden = true;
  statusMessage.textContent = '';
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const guest = form.querySelector('#guest');
  const note = form.querySelector('#note');
  for (const field of [guest, note]) {
    if (!field.value.trim()) {
      field.value = '';
      field.reportValidity();
      return;
    }
  }
  draft.value = [form.querySelector('#topic').value, guest.value.trim() + 'です。', '', note.value.trim()].join('\n');
  draftBox.hidden = false;
  draft.focus();
});
document.querySelector('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
    statusMessage.textContent = 'コピーしました。InstagramのDMに貼り付けてください。';
  } catch {
    draft.focus();
    draft.select();
    statusMessage.textContent = '選択した文章をコピーして、DMに貼り付けてください。';
  }
});
