import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',4000);};
let deals=[];

function reset(){
  $('#dealForm')?.reset();
  if($('#dealId')) $('#dealId').value='';
  if($('#dealFormTitle')) $('#dealFormTitle').textContent='Add Deal';
  if($('#dealIcon')) $('#dealIcon').value='✈️';
  if($('#dealLabel')) $('#dealLabel').value='View Deal →';
  if($('#dealSort')) $('#dealSort').value='0';
  if($('#dealActive')) $('#dealActive').value='true';
}

function render(){
  const list=$('#dealList');if(!list)return;
  list.innerHTML=deals.map(d=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc((d.icon||'')+' '+d.title)+'</h3><p>'+esc(d.category||'other')+'</p></div><span class="status-badge '+(d.is_active?'active':'archived')+'">'+(d.is_active?'Active':'Hidden')+'</span></div><p class="record-summary">'+esc(d.description||'')+(d.link_url?'<br>'+esc(d.link_url):'')+'</p><div class="record-actions"><button class="secondary-button edit-deal" data-id="'+d.deal_id+'" type="button">Edit</button><button class="danger-button delete-deal" data-id="'+d.deal_id+'" type="button">Delete</button></div></div>').join('')||'<div class="empty-state">No deals yet.</div>';
  document.querySelectorAll('.edit-deal').forEach(b=>b.onclick=()=>{
    const d=deals.find(x=>x.deal_id===b.dataset.id);if(!d)return;
    $('#dealId').value=d.deal_id;$('#dealFormTitle').textContent='Edit Deal';$('#dealTitle').value=d.title||'';$('#dealDescription').value=d.description||'';$('#dealCategory').value=d.category||'other';$('#dealIcon').value=d.icon||'';$('#dealUrl').value=d.link_url||'';$('#dealLabel').value=d.link_label||'View Deal →';$('#dealSort').value=Number(d.sort_order||0);$('#dealActive').value=String(d.is_active!==false);$('#dealForm').scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.querySelectorAll('.delete-deal').forEach(b=>b.onclick=async()=>{
    const d=deals.find(x=>x.deal_id===b.dataset.id);if(!d||!confirm('Delete deal “'+d.title+'”?'))return;
    const {error}=await supabase.from('deals').delete().eq('deal_id',d.deal_id);
    if(error)return toast(error.message,true);toast('Deal deleted.');await load();
  });
}
async function load(){
  if(!$('#dealList'))return;
  const {data,error}=await supabase.from('deals').select('*').order('sort_order').order('created_at',{ascending:false});
  if(error){$('#dealList').innerHTML='<p>'+esc(error.message)+'</p>';return;}
  deals=data||[];render();
}
$('#dealForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const payload={title:$('#dealTitle').value.trim(),description:$('#dealDescription').value.trim()||null,category:$('#dealCategory').value,icon:$('#dealIcon').value.trim()||'✈️',link_url:$('#dealUrl').value.trim()||null,link_label:$('#dealLabel').value.trim()||'View Deal →',sort_order:Number($('#dealSort').value||0),is_active:$('#dealActive').value==='true'};
  if(!payload.title)return toast('Deal title is required.',true);
  const id=$('#dealId').value;
  const q=id?supabase.from('deals').update(payload).eq('deal_id',id):supabase.from('deals').insert(payload);
  const {error}=await q;if(error)return toast(error.message,true);
  toast(id?'Deal updated.':'Deal created.');reset();await load();
});
$('#dealReset')?.addEventListener('click',reset);
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='deals')load();}));
if(new URLSearchParams(location.search).get('tab')==='deals')load();
