import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dt=v=>v?new Date(v).toLocaleString():'';
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',4500);};

let entries=[];

function resetReview(){
  $('#triviaReviewForm')?.reset();
  if($('#triviaEntryId')) $('#triviaEntryId').value='';
  if($('#triviaEntrant')) $('#triviaEntrant').value='';
  if($('#triviaScores')) $('#triviaScores').value='';
  if($('#triviaReviewStatus')) $('#triviaReviewStatus').value='submitted';
}

function render(){
  const list=$('#triviaEntryList'), summary=$('#triviaSummary');
  if(!list||!summary)return;
  const counts=entries.reduce((acc,e)=>{acc[e.status]=(acc[e.status]||0)+1;return acc;},{});
  summary.innerHTML='<h3>'+entries.length+' official entr'+(entries.length===1?'y':'ies')+'</h3><p class="record-summary">'+
    ['submitted','eligible','ineligible','winner','disqualified'].map(s=>esc(s.replaceAll('_',' '))+': '+(counts[s]||0)).join(' · ')+'</p>';

  list.innerHTML=entries.map(e=>{
    const certs=[
      e.age_eligible?'18+':'age not certified',
      e.residency_eligible?'eligible residency':'residency not certified',
      e.completed_consecutively?'3 quizzes consecutive':'sequence not certified',
      e.certification_ack?'certified':'certification missing'
    ].join(' · ');
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(e.full_name)+'</h3><p>'+esc(e.email)+' · '+esc(e.state_or_dc)+'</p></div><span class="status-badge '+(e.status==='eligible'||e.status==='winner'?'active':e.status==='ineligible'||e.status==='disqualified'?'archived':'draft')+'">'+esc(e.status)+'</span></div>'+
      '<p class="record-summary"><strong>Scores:</strong> '+e.quiz_1_score+'% · '+e.quiz_2_score+'% · '+e.quiz_3_score+'%<br>'+esc(certs)+'<br><span class="hint">Submitted '+esc(dt(e.submitted_at))+(e.reviewed_at?' · Reviewed '+esc(dt(e.reviewed_at)):'')+'</span>'+
      (e.admin_notes?'<br><br><strong>Admin notes:</strong> '+esc(e.admin_notes):'')+'</p>'+
      '<div class="record-actions"><button class="secondary-button edit-trivia-entry" data-id="'+e.entry_id+'" type="button">Review Entry</button></div></div>';
  }).join('')||'<div class="empty-state">No Travel Trivia entries yet.</div>';

  document.querySelectorAll('.edit-trivia-entry').forEach(btn=>btn.onclick=()=>{
    const e=entries.find(x=>x.entry_id===btn.dataset.id);if(!e)return;
    $('#triviaEntryId').value=e.entry_id;
    $('#triviaEntrant').value=e.full_name+' · '+e.email+' · '+e.state_or_dc;
    $('#triviaScores').value=e.quiz_1_score+'% · '+e.quiz_2_score+'% · '+e.quiz_3_score+'%';
    $('#triviaReviewStatus').value=e.status||'submitted';
    $('#triviaAdminNotes').value=e.admin_notes||'';
    $('#triviaReviewForm').scrollIntoView({behavior:'smooth',block:'start'});
  });
}

async function load(){
  if(!$('#triviaEntryList'))return;
  const {data,error}=await supabase.from('travel_trivia_entries').select('*').order('submitted_at',{ascending:false});
  if(error){$('#triviaEntryList').innerHTML='<p>'+esc(error.message)+'</p>';return;}
  entries=data||[];
  render();
}

$('#triviaReviewForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('#triviaEntryId').value;
  if(!id)return toast('Choose a Travel Trivia entry first.',true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return toast('Admin session expired. Sign in again.',true);
  const status=$('#triviaReviewStatus').value;
  const payload={
    status,
    admin_notes:$('#triviaAdminNotes').value.trim()||null,
    reviewed_at:new Date().toISOString(),
    reviewed_by:user.id
  };
  const {error}=await supabase.from('travel_trivia_entries').update(payload).eq('entry_id',id);
  if(error)return toast(error.message,true);
  toast('Travel Trivia entry review saved.');
  resetReview();
  await load();
});

$('#triviaReviewReset')?.addEventListener('click',resetReview);
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='trivia')load();}));
if(new URLSearchParams(location.search).get('tab')==='trivia')load();
