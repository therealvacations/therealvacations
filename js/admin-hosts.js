import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(v)||0)/100);
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',4500);};

let apps=[],members=[],profiles=[],proposals=[],referrals=[],earnings=[],trips=[];

const hostName=userId=>{
  const p=profiles.find(x=>x.user_id===userId);
  const a=apps.find(x=>x.user_id===userId);
  return p?.display_name||a?.display_name||userId;
};
const tripName=tripId=>trips.find(t=>t.trip_id===tripId)?.title||'Unlinked';

function resetProfile(){
  $('#hostProfileForm')?.reset();
  if($('#hostProfileUserId')) $('#hostProfileUserId').value='';
  if($('#hostProfileTier')) $('#hostProfileTier').value='host';
  if($('#hostProfileVerified')) $('#hostProfileVerified').value='true';
  if($('#hostProfilePublic')) $('#hostProfilePublic').value='true';
}
function editProfile(userId){
  const p=profiles.find(x=>x.user_id===userId);
  if(!p) return toast('Host profile has not been created yet.',true);
  $('#hostProfileUserId').value=p.user_id;
  $('#hostProfileName').value=p.display_name||'';
  $('#hostProfileSlug').value=p.slug||'';
  $('#hostProfileCity').value=p.city||'';
  $('#hostProfileBio').value=p.bio||'';
  $('#hostProfileTravelStyle').value=p.travel_style||'';
  $('#hostProfileDestinations').value=p.destination_specialties||'';
  $('#hostProfileAvatar').value=p.avatar_url||'';
  $('#hostProfileTier').value=p.tier||'host';
  $('#hostProfileVerified').value=String(p.verified!==false);
  $('#hostProfilePublic').value=String(p.public_profile!==false);
  $('#hostProfileForm').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderHosts(){
  const box=$('#hostAdminList'); if(!box)return;
  box.innerHTML=apps.map(a=>{
    const membership=members.find(m=>m.user_id===a.user_id);
    const profile=profiles.find(p=>p.user_id===a.user_id);
    const ownProposals=proposals.filter(p=>p.user_id===a.user_id);
    const publicLink=profile?.slug?'<a class="secondary-button" href="/hosts/'+encodeURIComponent(profile.slug)+'" target="_blank" rel="noopener" style="text-decoration:none">Public Profile ↗</a>':'';
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(a.display_name||'Host Applicant')+'</h3><p>'+esc(a.city||'')+' · '+esc(a.prior_platform||'New TRV host')+'</p></div><span class="status-badge '+(a.status==='approved'?'active':a.status==='declined'?'archived':'draft')+'">'+esc(a.status)+'</span></div>'+
      '<p class="record-summary">'+esc(a.bio||'')+
      '<br><strong>Membership:</strong> '+esc(membership?.status||'not active')+
      ' · <strong>Profile:</strong> '+(profile?(profile.public_profile?'published':'hidden'):'not created')+
      ' · <strong>Concepts:</strong> '+ownProposals.length+
      (profile?'<br><strong>Referral link:</strong> '+esc(location.origin+'/trips?host='+profile.slug):'')+'</p>'+
      '<div class="record-actions">'+
      (a.status!=='approved'?'<button class="primary-button host-review" data-id="'+a.application_id+'" data-status="approved" type="button">Approve</button>':'')+
      (a.status!=='declined'?'<button class="danger-button host-review" data-id="'+a.application_id+'" data-status="declined" type="button">Decline</button>':'')+
      (profile?'<button class="secondary-button edit-host-profile" data-user="'+a.user_id+'" type="button">Edit Profile</button>':'')+
      publicLink+'</div></div>';
  }).join('')||'<div class="empty-state">No Host applications yet.</div>';

  document.querySelectorAll('.host-review').forEach(button=>button.onclick=async()=>{
    button.disabled=true;
    const notes=button.dataset.status==='declined'?prompt('Optional decline/review note:',''):null;
    const {error}=await supabase.rpc('review_host_application',{
      p_application_id:button.dataset.id,
      p_status:button.dataset.status,
      p_admin_notes:notes||null
    });
    if(error) toast(error.message,true); else toast(button.dataset.status==='approved'?'Host approved and public profile created.':'Host application declined.');
    await loadHosts();
  });
  document.querySelectorAll('.edit-host-profile').forEach(b=>b.onclick=()=>editProfile(b.dataset.user));
}

function renderProposals(){
  const box=$('#hostProposalList');if(!box)return;
  box.innerHTML=proposals.map(p=>{
    const tripOptions='<option value="">Not linked to a live trip</option>'+trips.map(t=>'<option value="'+t.trip_id+'" '+(p.linked_trip_id===t.trip_id?'selected':'')+'>'+esc(t.title)+'</option>').join('');
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(p.title)+'</h3><p>'+esc(hostName(p.user_id))+' · '+esc(p.destination||'')+'</p></div><span class="status-badge '+(p.status==='published'||p.status==='approved'?'active':p.status==='declined'||p.status==='archived'?'archived':'draft')+'">'+esc(p.status)+'</span></div>'+
      '<p class="record-summary">'+esc(p.theme||'')+(p.expected_travelers?'<br>Expected travelers: '+esc(p.expected_travelers):'')+(p.activities?'<br>'+esc(p.activities):'')+(p.notes?'<br><strong>Host note:</strong> '+esc(p.notes):'')+(p.admin_notes?'<br><strong>Admin note:</strong> '+esc(p.admin_notes):'')+'</p>'+
      '<div class="field-grid"><div class="field"><label>Status</label><select class="host-proposal-status" data-id="'+p.proposal_id+'">'+['submitted','reviewing','approved','declined','published','archived'].map(s=>'<option value="'+s+'" '+(p.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>Linked TRV trip</label><select class="host-proposal-trip" data-id="'+p.proposal_id+'">'+tripOptions+'</select></div></div>'+
      '<div class="field"><label>Admin notes</label><textarea class="host-proposal-note" data-id="'+p.proposal_id+'">'+esc(p.admin_notes||'')+'</textarea></div>'+
      '<div class="record-actions"><button class="primary-button save-host-proposal" data-id="'+p.proposal_id+'" type="button">Save Concept Review</button></div></div>';
  }).join('')||'<div class="empty-state">No Host trip concepts yet.</div>';

  document.querySelectorAll('.save-host-proposal').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.id;
    const status=document.querySelector('.host-proposal-status[data-id="'+id+'"]').value;
    const linked=document.querySelector('.host-proposal-trip[data-id="'+id+'"]').value||null;
    const note=document.querySelector('.host-proposal-note[data-id="'+id+'"]').value.trim()||null;
    if(status==='published'&&!linked) return toast('Link the Host concept to a real TRV trip before marking it Published.',true);
    const {error}=await supabase.from('host_trip_proposals').update({status,linked_trip_id:linked,admin_notes:note,updated_at:new Date().toISOString()}).eq('proposal_id',id);
    if(error)return toast(error.message,true);
    toast('Host trip concept updated.');
    await loadHosts();
  });
}

function renderReferrals(){
  const box=$('#hostReferralList');if(!box)return;
  box.innerHTML=referrals.map(r=>{
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(hostName(r.host_user_id))+'</h3><p>'+esc(r.referred_email||'Traveler')+' · '+esc(tripName(r.trip_id))+'</p></div><span class="status-badge '+(r.status==='booked'||r.status==='travelled'?'active':r.status==='cancelled'?'archived':'draft')+'">'+esc(r.status)+'</span></div>'+
      '<p class="record-summary">Code: '+esc(r.referral_code)+(r.booking_id?'<br>Booking: '+esc(r.booking_id):'')+(r.converted_at?'<br>Converted: '+esc(new Date(r.converted_at).toLocaleString()):'')+'</p>'+
      '<div class="field"><label>Status</label><select class="host-referral-status" data-id="'+r.referral_id+'">'+['clicked','signed_up','applied','booked','travelled','cancelled'].map(s=>'<option value="'+s+'" '+(r.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></div>'+
      '<button class="secondary-button save-host-referral" data-id="'+r.referral_id+'" type="button">Save Referral Status</button></div>';
  }).join('')||'<div class="empty-state">No Host referrals yet.</div>';
  document.querySelectorAll('.save-host-referral').forEach(b=>b.onclick=async()=>{
    const status=document.querySelector('.host-referral-status[data-id="'+b.dataset.id+'"]').value;
    const {error}=await supabase.from('host_referrals').update({status,converted_at:['booked','travelled'].includes(status)?new Date().toISOString():null}).eq('referral_id',b.dataset.id);
    if(error)return toast(error.message,true);
    toast('Host referral updated.');await loadHosts();
  });
}

function resetEarning(){
  $('#hostEarningForm')?.reset();
  $('#hostEarningId').value='';
  $('#hostEarningStatus').value='pending';
}
function editEarning(id){
  const e=earnings.find(x=>x.earning_id===id);if(!e)return;
  $('#hostEarningId').value=e.earning_id;
  $('#hostEarningHost').value=e.host_user_id||'';
  $('#hostEarningTrip').value=e.trip_id||'';
  $('#hostEarningBooking').value=e.booking_id||'';
  $('#hostEarningAmount').value=(Number(e.amount_cents||0)/100).toFixed(2);
  $('#hostEarningStatus').value=e.status||'pending';
  $('#hostEarningReason').value=e.reason||'';
  $('#hostEarningForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderEarnings(){
  const box=$('#hostEarningList');if(!box)return;
  box.innerHTML=earnings.map(e=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(hostName(e.host_user_id))+' · '+money(e.amount_cents)+'</h3><p>'+esc(tripName(e.trip_id))+(e.booking_id?' · booking '+esc(e.booking_id):'')+'</p></div><span class="status-badge '+(e.status==='paid'?'active':e.status==='reversed'?'archived':'draft')+'">'+esc(e.status)+'</span></div><p class="record-summary">'+esc(e.reason||'No calculation note')+(e.paid_at?'<br>Paid: '+esc(new Date(e.paid_at).toLocaleString()):'')+'</p><button class="secondary-button edit-host-earning" data-id="'+e.earning_id+'" type="button">Edit Earning</button></div>').join('')||'<div class="empty-state">No Host earnings recorded yet.</div>';
  document.querySelectorAll('.edit-host-earning').forEach(b=>b.onclick=()=>editEarning(b.dataset.id));
}

function fillHostSelectors(){
  const hostSelect=$('#hostEarningHost'),tripSelect=$('#hostEarningTrip');
  if(hostSelect){const current=hostSelect.value;hostSelect.innerHTML='<option value="">Choose host</option>'+profiles.map(p=>'<option value="'+p.user_id+'">'+esc(p.display_name)+'</option>').join('');hostSelect.value=current||'';}
  if(tripSelect){const current=tripSelect.value;tripSelect.innerHTML='<option value="">No linked trip</option>'+trips.map(t=>'<option value="'+t.trip_id+'">'+esc(t.title)+'</option>').join('');tripSelect.value=current||'';}
}

async function loadHosts(){
  const box=$('#hostAdminList');if(!box)return;
  const results=await Promise.all([
    supabase.from('host_applications').select('*').order('submitted_at',{ascending:false}),
    supabase.from('host_memberships').select('*'),
    supabase.from('host_profiles').select('*').order('display_name'),
    supabase.from('host_trip_proposals').select('*').order('created_at',{ascending:false}),
    supabase.from('host_referrals').select('*').order('created_at',{ascending:false}),
    supabase.from('host_earnings').select('*').order('created_at',{ascending:false}),
    supabase.from('trips').select('trip_id,title,status,dates_start').order('dates_start',{ascending:false})
  ]);
  const err=results.find(r=>r.error)?.error;
  if(err){box.innerHTML='<p>'+esc(err.message)+'</p>';return;}
  [apps,members,profiles,proposals,referrals,earnings,trips]=results.map(r=>r.data||[]);
  renderHosts();renderProposals();renderReferrals();renderEarnings();fillHostSelectors();
}

$('#hostProfileForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const userId=$('#hostProfileUserId').value;if(!userId)return toast('Choose a Host profile first.',true);
  const slug=$('#hostProfileSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
  if(slug.length<3)return toast('Host public page address must be at least 3 characters.',true);
  const payload={
    display_name:$('#hostProfileName').value.trim(),
    slug,
    city:$('#hostProfileCity').value.trim()||null,
    bio:$('#hostProfileBio').value.trim()||null,
    travel_style:$('#hostProfileTravelStyle').value.trim()||null,
    destination_specialties:$('#hostProfileDestinations').value.trim()||null,
    avatar_url:$('#hostProfileAvatar').value.trim()||null,
    tier:$('#hostProfileTier').value,
    verified:$('#hostProfileVerified').value==='true',
    public_profile:$('#hostProfilePublic').value==='true',
    updated_at:new Date().toISOString()
  };
  const {error}=await supabase.from('host_profiles').update(payload).eq('user_id',userId);
  if(error)return toast(error.message,true);
  toast('Host profile updated.');resetProfile();await loadHosts();
});
$('#hostProfileReset')?.addEventListener('click',resetProfile);

$('#hostEarningForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const host=$('#hostEarningHost').value, amount=Math.round(Number($('#hostEarningAmount').value||0)*100), status=$('#hostEarningStatus').value;
  if(!host||amount<0)return toast('Choose a Host and enter a valid earning amount.',true);
  const payload={
    host_user_id:host,
    trip_id:$('#hostEarningTrip').value||null,
    booking_id:$('#hostEarningBooking').value.trim()||null,
    amount_cents:amount,
    status,
    reason:$('#hostEarningReason').value.trim()||null,
    eligible_at:['eligible','approved','paid'].includes(status)?new Date().toISOString():null,
    paid_at:status==='paid'?new Date().toISOString():null
  };
  const id=$('#hostEarningId').value;
  const q=id?supabase.from('host_earnings').update(payload).eq('earning_id',id):supabase.from('host_earnings').insert(payload);
  const {error}=await q;if(error)return toast(error.message,true);
  toast(id?'Host earning updated.':'Host earning recorded.');resetEarning();await loadHosts();
});
$('#hostEarningReset')?.addEventListener('click',resetEarning);

document.querySelectorAll('.admin-tab').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.tab==='hosts')loadHosts();}));
if(new URLSearchParams(location.search).get('tab')==='hosts')loadHosts();
