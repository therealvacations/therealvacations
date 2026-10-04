import { supabase } from './supabase-client.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast=(msg,error=false)=>{const box=$('#adminMessage');if(!box)return;box.textContent=msg;box.className='admin-message '+(error?'error':'success');setTimeout(()=>box.className='admin-message',4000);};

let suppliers=[];

function resetSupplier(){
  $('#supplierForm')?.reset();
  if($('#supplierId')) $('#supplierId').value='';
  if($('#supplierStatus')) $('#supplierStatus').value='active';
  if($('#supplierConnectionMode')) $('#supplierConnectionMode').value='admin_managed';
  if($('#supplierFormTitle')) $('#supplierFormTitle').textContent='Add Supplier / Vendor';
}

function editSupplier(id){
  const s=suppliers.find(x=>x.supplier_id===id); if(!s)return;
  $('#supplierFormTitle').textContent='Edit Supplier / Vendor';
  $('#supplierId').value=s.supplier_id;
  $('#supplierCompany').value=s.company_name||'';
  $('#supplierDisplay').value=s.display_name||'';
  $('#supplierType').value=s.supplier_type||'';
  $('#supplierConnectionMode').value=s.connection_mode||'admin_managed';
  $('#supplierContactName').value=s.contact_name||'';
  $('#supplierEmail').value=s.contact_email||s.invite_email||'';
  $('#supplierPhone').value=s.contact_phone||'';
  $('#supplierWebsite').value=s.website_url||'';
  $('#supplierPortal').value=s.booking_portal_url||'';
  $('#supplierAccount').value=s.account_number||'';
  $('#supplierCommission').value=s.commission_notes||'';
  $('#supplierPayment').value=s.payment_notes||'';
  $('#supplierBookingInstructions').value=s.booking_instructions||'';
  $('#supplierTravelerRequirements').value=s.required_traveler_information||'';
  $('#supplierNotes').value=s.internal_notes||'';
  $('#supplierStatus').value=s.status||'active';
  $('#supplierForm').scrollIntoView({behavior:'smooth',block:'start'});
}

async function inviteSupplier(id){
  const s=suppliers.find(x=>x.supplier_id===id); if(!s)return;
  if((s.connection_mode||'admin_managed')!=='portal_account'){toast('This supplier is Admin Managed and does not need a TRV login invite.',true);return;}
  const email=s.contact_email||s.invite_email;
  if(!email){toast('Add a supplier email before sending an invite.',true);return;}
  if(!confirm('Send a TRV supplier account invite to '+email+'?')) return;
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token){toast('Admin session expired. Sign in again.',true);return;}
  const response=await fetch('/api/admin-invite-supplier',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
    body:JSON.stringify({supplier_id:id})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok){toast(data.error||'Supplier invite could not be sent.',true);return;}
  toast('Supplier invite sent.');
  await loadSuppliers();
}

function render(){
  const list=$('#supplierList'); if(!list)return;
  list.innerHTML=suppliers.map(s=>{
    const email=s.contact_email||s.invite_email||'No email yet';
    const portalMode=(s.connection_mode||'admin_managed')==='portal_account';
    const connected=portalMode?(s.auth_user_id?'Connected to TRV account':s.status==='invited'?'Invite sent':'Portal account not connected'):'Admin Managed · no supplier login required';
    const portalLink=s.booking_portal_url?'<a class="secondary-button" href="'+esc(s.booking_portal_url)+'" target="_blank" rel="noopener" style="text-decoration:none">Open Supplier Site ↗</a>':'';
    const inviteButton=portalMode?'<button class="primary-button invite-supplier" data-id="'+s.supplier_id+'" type="button">'+(s.auth_user_id?'Resend Account Invite':'Send TRV Account Invite')+'</button>':'';
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(s.display_name||s.company_name)+'</h3><p>'+esc(s.supplier_type||'Supplier')+' · '+esc(email)+'</p></div><span class="status-badge '+(s.status==='active'||s.status==='connected'?'active':s.status==='invited'?'draft':'archived')+'">'+esc(s.status)+'</span></div><p class="record-summary">'+esc(connected)+(s.account_number?'<br>Account #: '+esc(s.account_number):'')+(s.contact_phone?'<br>'+esc(s.contact_phone):'')+(s.required_traveler_information?'<br><strong>Traveler info:</strong> '+esc(s.required_traveler_information):'')+'</p><div class="record-actions"><button class="secondary-button edit-supplier" data-id="'+s.supplier_id+'" type="button">Edit</button>'+portalLink+inviteButton+'</div></div>';
  }).join('')||'<div class="empty-state">No suppliers yet.</div>';
  document.querySelectorAll('.edit-supplier').forEach(b=>b.onclick=()=>editSupplier(b.dataset.id));
  document.querySelectorAll('.invite-supplier').forEach(b=>b.onclick=()=>inviteSupplier(b.dataset.id));
}

async function loadSuppliers(){
  if(!$('#supplierList')) return;
  const {data,error}=await supabase.from('suppliers').select('*').order('company_name');
  if(error){toast(error.message,true);return;}
  suppliers=data||[];
  render();
}

$('#supplierForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('#supplierId').value;
  const payload={
    company_name:$('#supplierCompany').value.trim(),
    display_name:$('#supplierDisplay').value.trim()||null,
    supplier_type:$('#supplierType').value||null,
    connection_mode:$('#supplierConnectionMode').value||'admin_managed',
    contact_name:$('#supplierContactName').value.trim()||null,
    contact_email:$('#supplierEmail').value.trim().toLowerCase()||null,
    contact_phone:$('#supplierPhone').value.trim()||null,
    website_url:$('#supplierWebsite').value.trim()||null,
    booking_portal_url:$('#supplierPortal').value.trim()||null,
    account_number:$('#supplierAccount').value.trim()||null,
    commission_notes:$('#supplierCommission').value.trim()||null,
    payment_notes:$('#supplierPayment').value.trim()||null,
    booking_instructions:$('#supplierBookingInstructions').value.trim()||null,
    required_traveler_information:$('#supplierTravelerRequirements').value.trim()||null,
    internal_notes:$('#supplierNotes').value.trim()||null,
    status:$('#supplierStatus').value,
    updated_at:new Date().toISOString()
  };
  if(!payload.company_name){toast('Company name is required.',true);return;}
  if(payload.connection_mode==='portal_account'&&!payload.contact_email){toast('Portal Account suppliers need a contact email for the invite.',true);return;}
  const q=id?supabase.from('suppliers').update(payload).eq('supplier_id',id):supabase.from('suppliers').insert(payload);
  const {error}=await q;
  if(error){toast(error.message,true);return;}
  toast(id?'Supplier updated.':'Supplier added.');
  resetSupplier(); await loadSuppliers();
});
$('#supplierReset')?.addEventListener('click',resetSupplier);
document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.tab==='suppliers')loadSuppliers();}));
if(new URLSearchParams(location.search).get('tab')==='suppliers') loadSuppliers();
