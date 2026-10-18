import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function loadRecordLog(){
  const list=$('#recordLogList'); if(!list) return;
  list.innerHTML='<p>Loading TRV records…</p>';
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){list.innerHTML='<p>Admin session required.</p>';return;}
  const q=$('#recordLogSearch')?.value.trim()||'';
  const table=$('#recordLogTable')?.value||'';
  const url='/api/admin-record-log?'+new URLSearchParams({q,table}).toString();
  const response=await fetch(url,{headers:{authorization:'Bearer '+session.access_token}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){list.innerHTML='<p>'+esc(data.error||'Could not load record log.')+'</p>';return;}
  const rows=data.records||[];
  list.innerHTML=rows.map(r=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(r.record_id)+'</h3><p>'+esc(r.table_name)+' · '+esc(r.operation)+'</p></div><span class="status-badge active">'+esc(new Date(r.occurred_at).toLocaleString())+'</span></div><p class="record-summary">'+(r.source_record_id?'<strong>Source record:</strong> '+esc(r.source_record_id)+'<br>':'')+(r.actor_user_id?'<strong>Actor:</strong> '+esc(r.actor_user_id)+'<br>':'')+'<strong>Fields:</strong> '+esc((r.changed_fields||[]).join(', ')||'n/a')+'</p></div>').join('')||'<div class="empty-state">No matching TRV records.</div>';
}

$('#recordLogSearchButton')?.addEventListener('click',loadRecordLog);
$('#recordLogSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadRecordLog();}});
document.querySelectorAll('.admin-tab').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.tab==='records')loadRecordLog();}));
if(new URLSearchParams(location.search).get('tab')==='records')loadRecordLog();
