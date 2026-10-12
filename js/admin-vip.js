import { supabase } from './supabase-client.js';

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=v=>v?new Date(v).toLocaleDateString():'—';
const show=(msg,error=false)=>{const box=document.getElementById('adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',3500);};

async function loadVipMembers(){
  const list=document.getElementById('vipMemberList'); if(!list) return;
  const {data,error}=await supabase.from('vip_memberships')
    .select('user_id,status,billing_plan,trial_started_at,trial_ends_at,paid_through,stripe_subscription_id,qualifying_booking_id,welcome_gift_status,welcome_gift_size,welcome_gift_shipping,welcome_gift_note,welcome_gift_sent_at,created_at,users(first_name,last_name)')
    .order('created_at',{ascending:false});
  if(error){list.innerHTML='<p>VIP members could not be loaded.</p>';return;}
  if(!data?.length){list.innerHTML='<div class="empty-state">No VIP memberships yet.</div>';return;}
  list.innerHTML=data.map(m=>{
    const ship=m.welcome_gift_shipping||{};
    const address=[ship.name,ship.address1,ship.address2,[ship.city,ship.state,ship.postal_code].filter(Boolean).join(', '),ship.country].filter(Boolean).join('<br>');
    const plan=m.billing_plan?m.billing_plan:'trial';
    const person=Array.isArray(m.users)?m.users[0]:(m.users||{});
    const memberName=[person.first_name,person.last_name].filter(Boolean).join(' ')||'VIP Member';
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(memberName)+' · '+esc(plan==='annual'?'Annual VIP':plan==='monthly'?'Monthly VIP':'VIP Trial')+'</h3><p>User ID: '+esc(m.user_id)+(m.qualifying_booking_id?' · Group benefit booking: '+esc(m.qualifying_booking_id):'')+'</p></div><span class="status-badge '+esc(m.status)+'">'+esc(m.status)+'</span></div><div class="record-summary"><strong>Paid through:</strong> '+esc(fmt(m.paid_through))+'<br><strong>Gift status:</strong> '+esc(m.welcome_gift_status)+'<br>'+(m.welcome_gift_size?'<strong>Size:</strong> '+esc(m.welcome_gift_size)+'<br>':'')+(address?'<strong>Ship to:</strong><br>'+address+'<br>':'')+(m.welcome_gift_note?'<strong>Note:</strong> '+esc(m.welcome_gift_note)+'<br>':'')+(m.welcome_gift_sent_at?'<strong>Sent:</strong> '+esc(fmt(m.welcome_gift_sent_at)):'')+'</div><div class="record-actions">'+(m.welcome_gift_status!=='sent'&&m.stripe_subscription_id!==null?'<button class="primary-button mark-gift-sent" data-user="'+esc(m.user_id)+'">Mark Gift Sent</button>':'')+'</div></div>';
  }).join('');
  document.querySelectorAll('.mark-gift-sent').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const {error}=await supabase.from('vip_memberships').update({welcome_gift_status:'sent',welcome_gift_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('user_id',btn.dataset.user);if(error){show(error.message,true);btn.disabled=false;return}show('VIP welcome item marked sent.');await loadVipMembers();}));
}
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='vip')loadVipMembers();}));


let vipOffers=[];

function resetVipOfferForm(){
  document.getElementById('vipOfferForm')?.reset();
  if(document.getElementById('vipOfferId')) document.getElementById('vipOfferId').value='';
  if(document.getElementById('vipOfferFormTitle')) document.getElementById('vipOfferFormTitle').textContent='Add VIP Offer';
  if(document.getElementById('vipOfferSort')) document.getElementById('vipOfferSort').value='0';
  if(document.getElementById('vipOfferActive')) document.getElementById('vipOfferActive').checked=true;
}

function renderVipOffers(){
  const list=document.getElementById('vipOfferList');
  if(!list) return;
  list.innerHTML=vipOffers.map(o=>{
    const windowText=[
      o.starts_at?'Starts '+new Date(o.starts_at).toLocaleString():null,
      o.ends_at?'Ends '+new Date(o.ends_at).toLocaleString():null
    ].filter(Boolean).join(' · ');
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(o.title)+'</h3><p>'+esc(o.category||'other')+(o.display_price?' · '+esc(o.display_price):'')+'</p></div><span class="status-badge '+(o.is_active?'active':'archived')+'">'+(o.is_active?'Active':'Inactive')+'</span></div><p class="record-summary">'+esc(o.description||'')+(windowText?'<br>'+esc(windowText):'')+'</p><div class="record-actions"><button class="secondary-button edit-vip-offer" data-id="'+o.offer_id+'" type="button">Edit</button><button class="danger-button delete-vip-offer" data-id="'+o.offer_id+'" type="button">Delete</button></div></div>';
  }).join('')||'<div class="empty-state">No VIP offers yet.</div>';

  document.querySelectorAll('.edit-vip-offer').forEach(btn=>btn.addEventListener('click',()=>{
    const o=vipOffers.find(x=>x.offer_id===btn.dataset.id); if(!o) return;
    document.getElementById('vipOfferId').value=o.offer_id;
    document.getElementById('vipOfferFormTitle').textContent='Edit VIP Offer';
    document.getElementById('vipOfferTitle').value=o.title||'';
    document.getElementById('vipOfferCategory').value=o.category||'other';
    document.getElementById('vipOfferDescription').value=o.description||'';
    document.getElementById('vipOfferPrice').value=o.display_price||'';
    document.getElementById('vipOfferImage').value=o.image_url||'';
    document.getElementById('vipOfferUrl').value=o.target_url||'';
    document.getElementById('vipOfferStart').value=o.starts_at?new Date(o.starts_at).toISOString().slice(0,16):'';
    document.getElementById('vipOfferEnd').value=o.ends_at?new Date(o.ends_at).toISOString().slice(0,16):'';
    document.getElementById('vipOfferSort').value=Number(o.sort_order||0);
    document.getElementById('vipOfferActive').checked=!!o.is_active;
    document.getElementById('vipOfferForm').scrollIntoView({behavior:'smooth',block:'start'});
  }));

  document.querySelectorAll('.delete-vip-offer').forEach(btn=>btn.addEventListener('click',async()=>{
    const o=vipOffers.find(x=>x.offer_id===btn.dataset.id); if(!o) return;
    if(!confirm('Delete VIP offer “'+o.title+'”?')) return;
    const {error}=await supabase.from('vip_offers').delete().eq('offer_id',o.offer_id);
    if(error) return show(error.message,true);
    show('VIP offer deleted.');
    await loadVipOffers();
  }));
}

async function loadVipOffers(){
  const list=document.getElementById('vipOfferList'); if(!list) return;
  const {data,error}=await supabase.from('vip_offers').select('*').order('sort_order').order('created_at',{ascending:false});
  if(error){list.innerHTML='<p>VIP offers could not be loaded.</p>';return;}
  vipOffers=data||[];
  renderVipOffers();
}

document.getElementById('vipOfferForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const title=document.getElementById('vipOfferTitle').value.trim();
  const targetUrl=document.getElementById('vipOfferUrl').value.trim();
  if(!title||!targetUrl) return show('Add an offer title and destination URL.',true);

  const startsRaw=document.getElementById('vipOfferStart').value;
  const endsRaw=document.getElementById('vipOfferEnd').value;
  const startsAt=startsRaw?new Date(startsRaw).toISOString():null;
  const endsAt=endsRaw?new Date(endsRaw).toISOString():null;
  if(startsAt&&endsAt&&new Date(endsAt)<=new Date(startsAt)) return show('VIP offer end time must be after its start time.',true);

  const payload={
    title,
    category:document.getElementById('vipOfferCategory').value||'other',
    description:document.getElementById('vipOfferDescription').value.trim()||null,
    display_price:document.getElementById('vipOfferPrice').value.trim()||null,
    image_url:document.getElementById('vipOfferImage').value.trim()||null,
    target_url:targetUrl,
    starts_at:startsAt,
    ends_at:endsAt,
    sort_order:Number(document.getElementById('vipOfferSort').value||0),
    is_active:document.getElementById('vipOfferActive').checked,
    updated_at:new Date().toISOString()
  };
  const id=document.getElementById('vipOfferId').value;
  const query=id
    ? supabase.from('vip_offers').update(payload).eq('offer_id',id)
    : supabase.from('vip_offers').insert(payload);
  const {error}=await query;
  if(error) return show(error.message,true);
  show(id?'VIP offer updated.':'VIP offer created.');
  resetVipOfferForm();
  await loadVipOffers();
});

document.getElementById('vipOfferReset')?.addEventListener('click',resetVipOfferForm);
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='vip'){loadVipMembers();loadVipOffers();}}));
loadVipOffers();
