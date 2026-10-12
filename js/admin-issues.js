import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dt=v=>v?new Date(v).toLocaleString():'—';
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',4500);};

let issues=[];

function resetIssueForm(){
  $('#issueAdminForm')?.reset();
  if($('#issueAdminId')) $('#issueAdminId').value='';
  if($('#issueAdminSummary')) $('#issueAdminSummary').value='';
  if($('#issueAdminStatus')) $('#issueAdminStatus').value='new';
  if($('#issueAdminPriority')) $('#issueAdminPriority').value='normal';
}

function contextLine(issue){
  const context=issue.related_context||{};
  return Object.entries(context).map(([k,v])=>k+': '+String(v)).join(' · ');
}

function renderIssueSummary(){
  const box=$('#issueAdminSummaryCards'); if(!box)return;
  const counts=issues.reduce((m,i)=>{m[i.status]=(m[i.status]||0)+1;return m;},{});
  box.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:16px">'+
    [['new','New'],['investigating','Investigating'],['fix_applied','Fix Applied'],['verified','Verified'],['closed','Closed']].map(([key,label])=>
      '<div class="admin-record" style="padding:12px"><strong style="font-size:22px">'+Number(counts[key]||0)+'</strong><br><span class="hint">'+label+'</span></div>'
    ).join('')+
    '</div>';
}

function renderIssues(){
  renderIssueSummary();
  const list=$('#issueAdminList'); if(!list)return;
  list.innerHTML=issues.map(issue=>{
    const browser=issue.browser_context||{};
    const related=contextLine(issue);
    const statusClass=issue.status==='closed'||issue.status==='verified'?'active':issue.status==='new'?'draft':issue.status==='fix_applied'?'active':'draft';
    return '<div class="admin-record">'+
      '<div class="record-heading"><div><h3>'+esc(issue.title)+'</h3><p>'+esc(issue.reporter_role||'member')+' · '+esc(issue.reporter_email||'signed-in user')+' · '+esc(dt(issue.created_at))+'</p></div><span class="status-badge '+statusClass+'">'+esc(String(issue.status||'new').replaceAll('_',' '))+'</span></div>'+
      '<p class="record-summary" style="white-space:pre-wrap">'+esc(issue.description)+
      (issue.page_path?'<br><br><strong>Page:</strong> '+esc(issue.page_path):'')+
      (related?'<br><strong>Related:</strong> '+esc(related):'')+
      (browser.last_client_error?.message?'<br><strong>Captured error:</strong> '+esc(browser.last_client_error.message):'')+
      (issue.admin_notes?'<br><br><strong>Investigation:</strong> '+esc(issue.admin_notes):'')+
      (issue.resolution?'<br><strong>Resolution:</strong> '+esc(issue.resolution):'')+
      '<br><span class="hint">Priority: '+esc(issue.priority||'normal')+
      (issue.fixed_at?' · Fix applied '+esc(dt(issue.fixed_at)):'')+
      (issue.verified_at?' · Verified '+esc(dt(issue.verified_at)):'')+
      (issue.closed_at?' · Closed '+esc(dt(issue.closed_at)):'')+
      '</span></p>'+
      '<div class="record-actions"><button class="secondary-button edit-issue" data-id="'+issue.issue_id+'" type="button">Work Issue</button>'+
      (issue.page_url?'<a class="secondary-button" href="'+esc(issue.page_url)+'" target="_blank" rel="noopener" style="text-decoration:none">Open Reported Page ↗</a>':'')+
      '</div></div>';
  }).join('')||'<div class="empty-state">No TRV issues have been reported.</div>';

  document.querySelectorAll('.edit-issue').forEach(btn=>btn.addEventListener('click',()=>{
    const issue=issues.find(i=>i.issue_id===btn.dataset.id); if(!issue)return;
    $('#issueAdminId').value=issue.issue_id;
    $('#issueAdminSummary').value=issue.title+' · '+(issue.reporter_email||issue.reporter_role||'reporter');
    $('#issueAdminStatus').value=issue.status||'new';
    $('#issueAdminPriority').value=issue.priority||'normal';
    $('#issueAdminNotes').value=issue.admin_notes||'';
    $('#issueAdminResolution').value=issue.resolution||'';
    $('#issueAdminForm').scrollIntoView({behavior:'smooth',block:'start'});
  }));
}

async function loadIssues(){
  const list=$('#issueAdminList'); if(!list)return;
  const {data,error}=await supabase.from('system_issue_reports').select('*').order('created_at',{ascending:false}).limit(300);
  if(error){list.innerHTML='<p>'+esc(error.message)+'</p>';return;}
  issues=data||[];
  renderIssues();
}

$('#issueAdminForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('#issueAdminId').value;
  if(!id)return toast('Choose an issue from the queue first.',true);
  const existing=issues.find(i=>i.issue_id===id);
  const status=$('#issueAdminStatus').value;
  const priority=$('#issueAdminPriority').value;
  const notes=$('#issueAdminNotes').value.trim()||null;
  const resolution=$('#issueAdminResolution').value.trim()||null;

  if(status==='verified'&&!resolution)return toast('Add the applied fix/resolution before verifying the issue.',true);
  if(status==='closed'&&existing?.status!=='verified'&&!existing?.verified_at)return toast('Verify the issue before closing it.',true);

  const {data:{user}}=await supabase.auth.getUser();
  const payload={
    status,
    priority,
    admin_notes:notes,
    resolution,
    assigned_to:user?.id||existing?.assigned_to||null
  };
  const {error}=await supabase.from('system_issue_reports').update(payload).eq('issue_id',id);
  if(error)return toast(error.message,true);
  toast(status==='closed'?'Issue closed after verification.':'Issue updated.');
  resetIssueForm();
  await loadIssues();
});
$('#issueAdminReset')?.addEventListener('click',resetIssueForm);

document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='issues')loadIssues();}));
if(new URLSearchParams(location.search).get('tab')==='issues')loadIssues();
