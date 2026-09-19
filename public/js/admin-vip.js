import { supabase } from './supabase-client.js';

const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmt=v=>v?new Date(v).toLocaleDateString():'—';
const show=(msg,error=false)=>{const box=document.getElementById('adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',3500);};

async function loadVipMembers(){
  const list=document.getElementById('vipMemberList'); if(!list) return;
  const {data,error}=await supabase.from('vip_memberships')
    .select('user_id,status,billing_plan,trial_started_at,trial_ends_at,paid_through,welcome_gift_status,welcome_gift_size,welcome_gift_shipping,welcome_gift_note,welcome_gift_sent_at,created_at')
    .order('created_at',{ascending:false});
  if(error){list.innerHTML='<p>VIP members could not be loaded.</p>';return;}
  if(!data?.length){list.innerHTML='<div class="empty-state">No VIP memberships yet.</div>';return;}
  list.innerHTML=data.map(m=>{
    const ship=m.welcome_gift_shipping||{};
    const address=[ship.name,ship.address1,ship.address2,[ship.city,ship.state,ship.postal_code].filter(Boolean).join(', '),ship.country].filter(Boolean).join('<br>');
    const plan=m.billing_plan?m.billing_plan:'trial';
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(plan==='annual'?'Annual VIP':plan==='monthly'?'Monthly VIP':'VIP Trial')+'</h3><p>User ID: '+esc(m.user_id)+'</p></div><span class="status-badge '+esc(m.status)+'">'+esc(m.status)+'</span></div><div class="record-summary"><strong>Paid through:</strong> '+esc(fmt(m.paid_through))+'<br><strong>Gift status:</strong> '+esc(m.welcome_gift_status)+'<br>'+(m.welcome_gift_size?'<strong>Size:</strong> '+esc(m.welcome_gift_size)+'<br>':'')+(address?'<strong>Ship to:</strong><br>'+address+'<br>':'')+(m.welcome_gift_note?'<strong>Note:</strong> '+esc(m.welcome_gift_note)+'<br>':'')+(m.welcome_gift_sent_at?'<strong>Sent:</strong> '+esc(fmt(m.welcome_gift_sent_at)):'')+'</div><div class="record-actions">'+(m.welcome_gift_status!=='sent'&&m.stripe_subscription_id!==null?'<button class="primary-button mark-gift-sent" data-user="'+esc(m.user_id)+'">Mark Gift Sent</button>':'')+'</div></div>';
  }).join('');
  document.querySelectorAll('.mark-gift-sent').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const {error}=await supabase.from('vip_memberships').update({welcome_gift_status:'sent',welcome_gift_sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('user_id',btn.dataset.user);if(error){show(error.message,true);btn.disabled=false;return}show('VIP welcome item marked sent.');await loadVipMembers();}));
}
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='vip')loadVipMembers();}));
