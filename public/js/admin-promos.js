import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let trips=[], promos=[];

function toast(msg,error=false){
  const box=$('#adminMessage'); if(!box) return;
  box.textContent=msg; box.className='admin-message '+(error?'error':'success');
  setTimeout(()=>box.className='admin-message',4000);
}
function resetForm(){
  $('#promoForm')?.reset();
  if($('#promoId')) $('#promoId').value='';
  if($('#promoFormTitle')) $('#promoFormTitle').textContent='Create Promo Code';
  if($('#promoType')) $('#promoType').value='fixed';
}
function amountLabel(p){
  if(p.discount_type==='percent') return Number(p.discount_amount||0)+'% off';
  if(p.discount_type==='fixed') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(p.discount_amount||0)/100)+' off';
  return 'Wheel prize';
}
function render(){
  const list=$('#promoList'); if(!list) return;
  list.innerHTML=(promos||[]).map(p=>{
    const trip=trips.find(t=>t.trip_id===p.trip_id);
    const expired=p.expires_at && new Date(p.expires_at)<=new Date();
    const exhausted=p.max_uses!=null && Number(p.used_count||0)>=Number(p.max_uses);
    const state=expired?'Expired':exhausted?'Used up':'Active';
    const klass=state==='Active'?'active':'archived';
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(p.code)+'</h3><p>'+esc(amountLabel(p))+' · '+esc(trip?.title||'All trips')+'</p></div><span class="status-badge '+klass+'">'+state+'</span></div>'+
      '<p class="record-summary">Uses: '+Number(p.used_count||0)+(p.max_uses==null?' / unlimited':' / '+Number(p.max_uses))+
      (p.expires_at?'<br>Expires: '+new Date(p.expires_at).toLocaleString():'<br>No expiration')+'</p>'+
      (p.discount_type==='wheel_prize'?'':'<div class="record-actions"><button class="secondary-button edit-promo" data-id="'+p.code_id+'" type="button">Edit</button><button class="danger-button delete-promo" data-id="'+p.code_id+'" data-code="'+esc(p.code)+'" type="button">Delete</button></div>')+
      '</div>';
  }).join('')||'<div class="empty-state">No promo codes yet.</div>';

  document.querySelectorAll('.edit-promo').forEach(btn=>btn.onclick=()=>{
    const p=promos.find(x=>x.code_id===btn.dataset.id); if(!p) return;
    $('#promoId').value=p.code_id;
    $('#promoFormTitle').textContent='Edit Promo Code';
    $('#promoCodeValue').value=p.code||'';
    $('#promoType').value=p.discount_type||'fixed';
    $('#promoAmount').value=p.discount_type==='fixed'?(Number(p.discount_amount||0)/100).toFixed(2):Number(p.discount_amount||0);
    $('#promoTrip').value=p.trip_id||'';
    $('#promoExpires').value=p.expires_at?new Date(p.expires_at).toISOString().slice(0,16):'';
    $('#promoMaxUses').value=p.max_uses??'';
    $('#promoForm').scrollIntoView({behavior:'smooth',block:'start'});
  });
  document.querySelectorAll('.delete-promo').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Delete promo code “'+btn.dataset.code+'”?')) return;
    const {error}=await supabase.from('discount_codes').delete().eq('code_id',btn.dataset.id);
    if(error) return toast(error.message,true);
    toast('Promo code deleted.'); await load();
  });
}
async function load(){
  if(!$('#promoList')) return;
  const [tr,res]=await Promise.all([
    supabase.from('trips').select('trip_id,title,status').order('dates_start',{ascending:false}),
    supabase.from('discount_codes').select('*').order('created_at',{ascending:false})
  ]);
  if(tr.error||res.error) return toast(tr.error?.message||res.error?.message||'Unable to load promo codes.',true);
  trips=tr.data||[]; promos=res.data||[];
  const select=$('#promoTrip');
  const current=select.value;
  select.innerHTML='<option value="">All active trips</option>'+trips.filter(t=>t.status==='active').map(t=>'<option value="'+t.trip_id+'">'+esc(t.title)+'</option>').join('');
  select.value=current||'';
  render();
}
$('#promoForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const code=$('#promoCodeValue').value.trim().toUpperCase();
  const type=$('#promoType').value;
  const amountInput=Number($('#promoAmount').value);
  if(!/^[A-Z0-9][A-Z0-9-]{2,30}$/.test(code)) return toast('Use 3–30 letters, numbers, or hyphens for the code.',true);
  if(!(amountInput>0)) return toast('Enter a discount greater than zero.',true);
  if(type==='percent' && amountInput>100) return toast('Percentage discount cannot exceed 100%.',true);
  const payload={
    code,
    discount_type:type,
    discount_amount:type==='fixed'?Math.round(amountInput*100):Math.round(amountInput),
    trip_id:$('#promoTrip').value||null,
    expires_at:$('#promoExpires').value?new Date($('#promoExpires').value).toISOString():null,
    max_uses:$('#promoMaxUses').value?Number($('#promoMaxUses').value):null
  };
  const id=$('#promoId').value;
  const query=id
    ? supabase.from('discount_codes').update(payload).eq('code_id',id)
    : supabase.from('discount_codes').insert({...payload,used_count:0});
  const {error}=await query;
  if(error) return toast(error.message,true);
  toast(id?'Promo code updated.':'Promo code created.');
  resetForm(); await load();
});
$('#promoReset')?.addEventListener('click',resetForm);
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='promos') load();}));
load();
