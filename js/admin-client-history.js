import { supabase } from './supabase-client.js';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let activeRequest = null;

function setStatus(message, error=false){
  const el=$('#clientHistoryStatus');
  if(!el) return;
  el.textContent=message||'';
  el.style.color=error?'#9f1239':'';
}

function formatType(value){
  return String(value||'note').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
}

async function resolveUser(request){
  if(request?.user_id) return request.user_id;
  if(!request?.request_id) return null;
  const {data,error}=await supabase.from('travel_requests').select('user_id').eq('request_id',request.request_id).maybeSingle();
  if(error) throw error;
  return data?.user_id||null;
}

async function loadHistory(request=activeRequest){
  const list=$('#clientHistoryList');
  const addButton=$('#addClientHistoryButton');
  if(!list) return;
  activeRequest=request||null;
  const userId=await resolveUser(activeRequest).catch(error=>{
    setStatus(error.message||'Unable to resolve client account.',true);
    return null;
  });
  if(!userId){
    list.innerHTML='<div class="empty-state">This request is not linked to a TRV member account yet, so a permanent person-level history cannot be attached.</div>';
    if(addButton) addButton.disabled=true;
    setStatus('Link the request to the client account before adding permanent case history.',true);
    return;
  }
  if(addButton) addButton.disabled=false;
  setStatus('Permanent Admin-only account history. Entries are append-only and are not deleted with quotes.');
  const {data,error}=await supabase.from('admin_client_history')
    .select('history_id,user_id,request_id,quote_id,entry_type,note,metadata,occurred_at,created_at,created_by')
    .eq('user_id',userId)
    .order('occurred_at',{ascending:false})
    .order('created_at',{ascending:false});
  if(error){
    list.innerHTML='<p class="hint">Client history could not be loaded.</p>';
    setStatus(error.message||'Client history could not be loaded.',true);
    return;
  }
  list.innerHTML=(data||[]).map(row=>{
    const when=new Date(row.occurred_at||row.created_at).toLocaleString();
    const context=[
      row.metadata?.label,
      row.metadata?.version,
      row.request_id?'request linked':null,
      row.quote_id?'quote linked':null
    ].filter(Boolean).join(' · ');
    return '<div class="admin-record" style="border-left:4px solid #6b3fa0">'+
      '<div class="record-heading"><div><h3>'+esc(formatType(row.entry_type))+'</h3><p>'+esc(when)+(context?' · '+esc(context):'')+'</p></div></div>'+
      '<p class="record-summary" style="white-space:pre-wrap">'+esc(row.note)+'</p>'+
      '</div>';
  }).join('')||'<div class="empty-state">No permanent Admin history entries yet.</div>';
}

async function addHistory(){
  if(!activeRequest?.request_id) return setStatus('Open a client request first.',true);
  const note=$('#clientHistoryNote')?.value.trim();
  if(!note) return setStatus('Enter the case-history note first.',true);
  const userId=await resolveUser(activeRequest).catch(error=>{
    setStatus(error.message||'Unable to resolve client account.',true);
    return null;
  });
  if(!userId) return setStatus('This request must be linked to a client account first.',true);

  const type=$('#clientHistoryType')?.value||'note';
  const occurredInput=$('#clientHistoryOccurredAt')?.value||'';
  const quoteId=$('#quoteId')?.value||null;
  const button=$('#addClientHistoryButton');
  if(button){button.disabled=true;button.textContent='Adding…';}
  try{
    const payload={
      user_id:userId,
      request_id:activeRequest.request_id,
      quote_id:quoteId,
      entry_type:type,
      note,
      metadata:{
        label:$('#quoteClient')?.value||null,
        quote_title:$('#quoteTitle')?.value||null
      }
    };
    if(occurredInput) payload.occurred_at=new Date(occurredInput).toISOString();
    const {error}=await supabase.from('admin_client_history').insert(payload);
    if(error) throw error;
    $('#clientHistoryNote').value='';
    if($('#clientHistoryOccurredAt')) $('#clientHistoryOccurredAt').value='';
    setStatus('Permanent history entry added.');
    await loadHistory(activeRequest);
  }catch(error){
    setStatus(error.message||'Unable to add client history entry.',true);
  }finally{
    if(button){button.disabled=false;button.textContent='Add Permanent History Entry';}
  }
}

$('#addClientHistoryButton')?.addEventListener('click',addHistory);

window.addEventListener('trv:request-opened',event=>{
  activeRequest=event.detail||null;
  loadHistory(activeRequest);
});

window.addEventListener('trv:request-cleared',()=>{
  activeRequest=null;
  if($('#clientHistoryList')) $('#clientHistoryList').innerHTML='<div class="empty-state">Select a client request to view permanent Admin history.</div>';
  if($('#addClientHistoryButton')) $('#addClientHistoryButton').disabled=true;
  setStatus('Select a client request.');
});
