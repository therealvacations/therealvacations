import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',4000);};
const dt=v=>v?new Date(v).toLocaleString():'—';

let subscribers=[], offers=[], campaigns=[], wheel=null;

function buildWheelFields(){
  const wrap=$('#wheelPrizeFields'); if(!wrap) return;
  wrap.innerHTML=Array.from({length:8},(_,i)=>{
    const n=i+1;
    return '<div class="field"><label for="wheelPrize'+n+'">Prize '+n+'</label><div style="display:flex;gap:8px"><input id="wheelPrize'+n+'" placeholder="Leave blank to remove this slice"/><button class="danger-button clear-wheel-prize" data-slot="'+n+'" type="button">Remove</button></div></div>';
  }).join('');
  document.querySelectorAll('.clear-wheel-prize').forEach(btn=>btn.onclick=()=>{const el=$('#wheelPrize'+btn.dataset.slot);if(el)el.value='';});
}

async function loadWheel(){
  if(!$('#wheelForm')) return;
  const {data,error}=await supabase.from('wheel_settings').select('*').order('id').limit(1).maybeSingle();
  if(error) return toast(error.message,true);
  wheel=data||{};
  $('#wheelActive').checked=wheel.is_active!==false;
  for(let i=1;i<=8;i++) $('#wheelPrize'+i).value=wheel['prize_'+i]||'';
  $('#wheelColor1').value=wheel.wheel_color_1||'#7c3aed';
  $('#wheelColor2').value=wheel.wheel_color_2||'#c084fc';
  $('#wheelColor3').value=wheel.wheel_color_3||'#a855f7';
  renderWheelPreview();
}
function renderWheelPreview(){
  const active=[]; for(let i=1;i<=8;i++){const v=$('#wheelPrize'+i)?.value.trim(); if(v)active.push(v);}
  const box=$('#wheelPreview'); if(!box)return;
  box.innerHTML='<div class="admin-record"><h3>'+(($('#wheelActive')?.checked)?'Wheel is active':'Wheel is OFF')+'</h3><p class="record-summary">'+(active.length?active.map((v,i)=>(i+1)+'. '+esc(v)).join('<br>'):'No active prize slices.')+'</p><p>'+active.length+' active prize'+(active.length===1?'':'s')+'</p></div>';
}
$('#wheelForm')?.addEventListener('input',renderWheelPreview);
$('#wheelForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const payload={is_active:$('#wheelActive').checked,wheel_color_1:$('#wheelColor1').value,wheel_color_2:$('#wheelColor2').value,wheel_color_3:$('#wheelColor3').value,updated_at:new Date().toISOString()};
  for(let i=1;i<=8;i++) payload['prize_'+i]=$('#wheelPrize'+i).value.trim()||null;
  const id=wheel?.id||1;
  const {error}=await supabase.from('wheel_settings').upsert({id,...payload},{onConflict:'id'});
  if(error)return toast(error.message,true);
  toast('Prize wheel updated.'); await loadWheel();
});

function resetSubscriber(){
  $('#subscriberForm')?.reset(); if($('#subscriberId'))$('#subscriberId').value=''; if($('#subscriberOptedIn'))$('#subscriberOptedIn').checked=true; if($('#subscriberFormTitle'))$('#subscriberFormTitle').textContent='Add Subscriber';
}
async function loadSubscribers(){
  if(!$('#subscriberList')) return;
  const {data,error}=await supabase.from('subscribers').select('*').order('created_at',{ascending:false});
  if(error)return toast(error.message,true);
  subscribers=data||[];
  $('#subscriberList').innerHTML=subscribers.map(s=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(s.name||s.email)+'</h3><p>'+esc(s.email)+'</p></div><span class="status-badge '+(s.opted_in?'active':'archived')+'">'+(s.opted_in?'Opted In':'Opted Out')+'</span></div><p class="record-summary">Source: '+esc(s.source||'—')+(s.trip_interest?'<br>Interest: '+esc(s.trip_interest):'')+(s.spin_prize?'<br>Wheel: '+esc(s.spin_prize)+(s.spin_code?' · '+esc(s.spin_code):''):'')+'</p><div class="record-actions"><button class="secondary-button edit-subscriber" data-id="'+s.subscriber_id+'" type="button">Edit</button><button class="secondary-button toggle-subscriber" data-id="'+s.subscriber_id+'" data-next="'+(!s.opted_in)+'" type="button">'+(s.opted_in?'Opt Out':'Reactivate')+'</button><button class="danger-button delete-subscriber" data-id="'+s.subscriber_id+'" type="button">Remove</button></div></div>').join('')||'<div class="empty-state">No subscribers yet.</div>';
  document.querySelectorAll('.edit-subscriber').forEach(b=>b.onclick=()=>editSubscriber(b.dataset.id));
  document.querySelectorAll('.toggle-subscriber').forEach(b=>b.onclick=()=>toggleSubscriber(b.dataset.id,b.dataset.next==='true'));
  document.querySelectorAll('.delete-subscriber').forEach(b=>b.onclick=()=>deleteSubscriber(b.dataset.id));
}
function editSubscriber(id){
  const s=subscribers.find(x=>x.subscriber_id===id); if(!s)return;
  $('#subscriberFormTitle').textContent='Edit Subscriber'; $('#subscriberId').value=s.subscriber_id; $('#subscriberName').value=s.name||''; $('#subscriberEmail').value=s.email||''; $('#subscriberPhone').value=s.phone||''; $('#subscriberSource').value=s.source||''; $('#subscriberTrip').value=s.trip_interest||''; $('#subscriberOptedIn').checked=!!s.opted_in; $('#subscriberForm').scrollIntoView({behavior:'smooth',block:'start'});
}
async function toggleSubscriber(id,next){const {error}=await supabase.from('subscribers').update({opted_in:next}).eq('subscriber_id',id);if(error)return toast(error.message,true);toast(next?'Subscriber reactivated.':'Subscriber opted out.');await loadSubscribers();}
async function deleteSubscriber(id){if(!confirm('Remove this subscriber record?'))return;const {error}=await supabase.from('subscribers').delete().eq('subscriber_id',id);if(error)return toast(error.message,true);toast('Subscriber removed.');await loadSubscribers();}
$('#subscriberForm')?.addEventListener('submit',async e=>{
  e.preventDefault(); const id=$('#subscriberId').value; const payload={name:$('#subscriberName').value.trim()||null,email:$('#subscriberEmail').value.trim().toLowerCase(),phone:$('#subscriberPhone').value.trim()||null,source:$('#subscriberSource').value.trim()||'admin',trip_interest:$('#subscriberTrip').value.trim()||null,opted_in:$('#subscriberOptedIn').checked};
  const q=id?supabase.from('subscribers').update(payload).eq('subscriber_id',id):supabase.from('subscribers').insert(payload);
  const {error}=await q;if(error)return toast(error.message,true);toast(id?'Subscriber updated.':'Subscriber added.');resetSubscriber();await loadSubscribers();
});
$('#subscriberReset')?.addEventListener('click',resetSubscriber);

function resetOffer(){ $('#vipOfferForm')?.reset(); if($('#vipOfferId'))$('#vipOfferId').value=''; if($('#vipOfferActive'))$('#vipOfferActive').checked=true; if($('#vipOfferSort'))$('#vipOfferSort').value='0'; if($('#vipOfferFormTitle'))$('#vipOfferFormTitle').textContent='Add VIP Offer'; }
async function loadOffers(){
  if(!$('#vipOfferList'))return;
  const {data,error}=await supabase.from('vip_offers').select('*').order('sort_order').order('created_at',{ascending:false});
  if(error)return toast(error.message,true);
  offers=data||[];
  $('#vipOfferList').innerHTML=offers.map(o=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(o.title)+'</h3><p>'+esc(o.category)+(o.display_price?' · '+esc(o.display_price):'')+'</p></div><span class="status-badge '+(o.is_active?'active':'archived')+'">'+(o.is_active?'Active':'Hidden')+'</span></div><p class="record-summary">'+esc(o.description||'')+(o.starts_at?'<br>Starts: '+esc(dt(o.starts_at)):'')+(o.ends_at?'<br>Ends: '+esc(dt(o.ends_at)):'')+'</p><div class="record-actions"><button class="secondary-button edit-offer" data-id="'+o.offer_id+'" type="button">Edit</button><button class="danger-button delete-offer" data-id="'+o.offer_id+'" type="button">Delete</button></div></div>').join('')||'<div class="empty-state">No VIP offers yet.</div>';
  document.querySelectorAll('.edit-offer').forEach(b=>b.onclick=()=>editOffer(b.dataset.id));
  document.querySelectorAll('.delete-offer').forEach(b=>b.onclick=()=>deleteOffer(b.dataset.id));
}
function localInput(v){return v?new Date(v).toISOString().slice(0,16):'';}
function editOffer(id){const o=offers.find(x=>x.offer_id===id);if(!o)return;$('#vipOfferFormTitle').textContent='Edit VIP Offer';$('#vipOfferId').value=o.offer_id;$('#vipOfferTitle').value=o.title||'';$('#vipOfferCategory').value=o.category||'other';$('#vipOfferDescription').value=o.description||'';$('#vipOfferPrice').value=o.display_price||'';$('#vipOfferImage').value=o.image_url||'';$('#vipOfferUrl').value=o.target_url||'';$('#vipOfferStart').value=localInput(o.starts_at);$('#vipOfferEnd').value=localInput(o.ends_at);$('#vipOfferSort').value=o.sort_order||0;$('#vipOfferActive').checked=!!o.is_active;$('#vipOfferForm').scrollIntoView({behavior:'smooth',block:'start'});}
async function deleteOffer(id){if(!confirm('Delete this VIP offer?'))return;const {error}=await supabase.from('vip_offers').delete().eq('offer_id',id);if(error)return toast(error.message,true);toast('VIP offer deleted.');await loadOffers();}
$('#vipOfferForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const id=$('#vipOfferId').value;const payload={title:$('#vipOfferTitle').value.trim(),category:$('#vipOfferCategory').value,description:$('#vipOfferDescription').value.trim()||null,display_price:$('#vipOfferPrice').value.trim()||null,image_url:$('#vipOfferImage').value.trim()||null,target_url:$('#vipOfferUrl').value.trim(),starts_at:$('#vipOfferStart').value?new Date($('#vipOfferStart').value).toISOString():null,ends_at:$('#vipOfferEnd').value?new Date($('#vipOfferEnd').value).toISOString():null,is_active:$('#vipOfferActive').checked,sort_order:Number($('#vipOfferSort').value)||0,updated_at:new Date().toISOString()};
 const q=id?supabase.from('vip_offers').update(payload).eq('offer_id',id):supabase.from('vip_offers').insert(payload);const {error}=await q;if(error)return toast(error.message,true);toast(id?'VIP offer updated.':'VIP offer added.');resetOffer();await loadOffers();
});
$('#vipOfferReset')?.addEventListener('click',resetOffer);

function resetCampaign(){ $('#marketingForm')?.reset(); if($('#campaignId'))$('#campaignId').value=''; if($('#campaignAudience'))$('#campaignAudience').value='subscribers'; }
async function saveCampaign(){
  const id=$('#campaignId').value;
  const payload={name:$('#campaignName').value.trim(),audience:$('#campaignAudience').value,subject:$('#campaignSubject').value.trim(),preview_text:$('#campaignPreview').value.trim()||null,body_text:$('#campaignBody').value.trim(),cta_label:$('#campaignCtaLabel').value.trim()||null,cta_url:$('#campaignCtaUrl').value.trim()||null,updated_at:new Date().toISOString()};
  if(!payload.name||!payload.subject||!payload.body_text)throw new Error('Campaign name, subject, and message are required.');
  if((payload.cta_label&&!payload.cta_url)||(!payload.cta_label&&payload.cta_url))throw new Error('Use both a button label and URL, or leave both blank.');
  if(id){const {error}=await supabase.from('marketing_campaigns').update(payload).eq('campaign_id',id);if(error)throw error;return id;}
  const {data,error}=await supabase.from('marketing_campaigns').insert({...payload,created_by:(await supabase.auth.getUser()).data.user.id}).select('campaign_id').single();if(error)throw error;$('#campaignId').value=data.campaign_id;return data.campaign_id;
}
$('#marketingForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await saveCampaign();toast('Campaign draft saved.');await loadMarketing();}catch(err){toast(err.message||'Could not save campaign.',true);}});
$('#sendCampaignButton')?.addEventListener('click',async()=>{try{const id=await saveCampaign();if(!confirm('Send this campaign now to the selected opted-in audience?'))return;const btn=$('#sendCampaignButton');btn.disabled=true;btn.textContent='Sending…';const {data,error}=await supabase.functions.invoke('send-marketing-campaign',{body:{campaign_id:id}});btn.disabled=false;btn.textContent='Send Campaign Now';if(error||!data?.ok)return toast(data?.error||error?.message||'Campaign failed.',true);toast('Campaign sent: '+data.sent_count+' sent, '+data.failed_count+' failed.');await loadMarketing();}catch(err){const btn=$('#sendCampaignButton');if(btn){btn.disabled=false;btn.textContent='Send Campaign Now'}toast(err.message||'Campaign failed.',true);}});
$('#campaignReset')?.addEventListener('click',resetCampaign);

async function loadMarketing(){
  if(!$('#campaignList'))return;
  const [cr,dr]=await Promise.all([
    supabase.from('marketing_campaigns').select('*').order('created_at',{ascending:false}).limit(30),
    supabase.from('email_deliveries').select('delivery_id,template_type,recipient_email,subject,status,sent_at,created_at,last_error').order('created_at',{ascending:false}).limit(30)
  ]);
  if(cr.error||dr.error)return toast(cr.error?.message||dr.error?.message||'Could not load email data.',true);
  campaigns=cr.data||[];
  $('#campaignList').innerHTML=campaigns.map(c=>'<div class="admin-record"><div class="record-heading"><div><h3>'+esc(c.name)+'</h3><p>'+esc(c.subject)+' · '+esc(c.audience)+'</p></div><span class="status-badge '+(c.status==='sent'?'active':c.status==='draft'?'draft':'archived')+'">'+esc(c.status)+'</span></div><p class="record-summary">Recipients: '+c.recipient_count+' · Sent: '+c.sent_count+' · Failed: '+c.failed_count+(c.sent_at?'<br>Sent: '+esc(dt(c.sent_at)):'')+'</p><div class="record-actions">'+(c.status==='draft'?'<button class="secondary-button edit-campaign" data-id="'+c.campaign_id+'" type="button">Edit</button>':'')+'</div></div>').join('')||'<div class="empty-state">No campaigns yet.</div>';
  document.querySelectorAll('.edit-campaign').forEach(b=>b.onclick=()=>{const c=campaigns.find(x=>x.campaign_id===b.dataset.id);if(!c)return;$('#campaignId').value=c.campaign_id;$('#campaignName').value=c.name||'';$('#campaignAudience').value=c.audience||'subscribers';$('#campaignSubject').value=c.subject||'';$('#campaignPreview').value=c.preview_text||'';$('#campaignBody').value=c.body_text||'';$('#campaignCtaLabel').value=c.cta_label||'';$('#campaignCtaUrl').value=c.cta_url||'';$('#marketingForm').scrollIntoView({behavior:'smooth',block:'start'});});
  $('#marketingDeliveryList').innerHTML=(dr.data||[]).map(d=>'<div class="admin-record compact"><div><h3>'+esc(d.recipient_email)+'</h3><p>'+esc(d.template_type)+' · '+esc(d.status)+(d.last_error?' · '+esc(d.last_error):'')+'</p></div></div>').join('')||'<div class="empty-state">No email deliveries yet.</div>';
}

document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.dataset.tab==='wheel')loadWheel();
  if(btn.dataset.tab==='subscribers')loadSubscribers();
  if(btn.dataset.tab==='vipoffers')loadOffers();
  if(btn.dataset.tab==='marketing')loadMarketing();
}));

buildWheelFields();
