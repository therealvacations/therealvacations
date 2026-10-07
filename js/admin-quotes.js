import { supabase } from './supabase-client.js';

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(n)||0)/100);
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let currentRequest=null, currentQuote=null, supplierCache=[], currentItemAttachments=[];

async function loadSupplierChoices(){
  const {data,error}=await supabase.from('suppliers').select('supplier_id,company_name,display_name,supplier_code,connection_mode,website_url,booking_portal_url,account_number,booking_instructions,required_traveler_information,status').neq('status','inactive').order('company_name');
  if(error) return;
  supplierCache=data||[];
  const options='<option value="">No supplier assigned</option>'+supplierCache.map(s=>'<option value="'+esc(s.supplier_id)+'">'+esc(s.display_name||s.company_name)+'</option>').join('');
  if($('#quoteItemSupplier')) $('#quoteItemSupplier').innerHTML=options;
  if($('#fulfillmentSupplierId')) $('#fulfillmentSupplierId').innerHTML=options.replace('No supplier assigned','Select supplier');
}
function selectedSupplier(id){
  return supplierCache.find(s=>s.supplier_id===id)||null;
}
function supplierNoteLine(id){
  const s=selectedSupplier(id);
  if(!s) return '';
  const name=s.display_name||s.company_name||'Supplier';
  const url=s.booking_portal_url||s.website_url||'';
  return '[Supplier] '+name+(url?' | '+url:'');
}
function mergeSupplierIntoAdminNotes(notes,id){
  const cleaned=String(notes||'').replace(/^\[Supplier\][^\n]*(?:\n|$)/i,'').trim();
  const line=supplierNoteLine(id);
  return line+(cleaned?'\n'+cleaned:'');
}
function isInternalFeeItem(category,title){
  return String(category||'').toLowerCase()==='processing_fee' || /processing convenience fee/i.test(String(title||''));
}
function renderFulfillmentSupplierActions(){
  const id=$('#fulfillmentSupplierId')?.value||'';
  const s=selectedSupplier(id), box=$('#fulfillmentSupplierActions');
  if(!box) return;
  if(!s){box.innerHTML='Select the supplier that will fulfill this request.';return;}
  const mode=s.connection_mode==='portal_account'?'Supplier Portal Account':'Admin Managed';
  const link=s.booking_portal_url?'<a href="'+esc(s.booking_portal_url)+'" target="_blank" rel="noopener">Open supplier booking/payment site ↗</a>':'No booking/payment URL saved.';
  const req=s.required_traveler_information?'<br><strong>Required traveler info:</strong> '+esc(s.required_traveler_information):'';
  box.innerHTML='<strong>'+mode+'</strong> · '+link+req;
}
$('#fulfillmentSupplierId')?.addEventListener('change',renderFulfillmentSupplierActions);

function toast(msg, error=false){
  const box=$('#adminMessage'); if(!box) return;
  box.textContent=msg; box.className='admin-message '+(error?'error':'success');
  setTimeout(()=>box.className='admin-message',3500);
}

function parseItemDetails(){
  const out={};
  ($('#quoteItemDetails')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(line=>{
    const i=line.indexOf('|');
    if(i>0) out[line.slice(0,i).trim()]=line.slice(i+1).trim();
    else out['Note '+(Object.keys(out).length+1)]=line;
  });
  return out;
}
function parseItemVariants(){
  const lines=($('#quoteItemVariants')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  return lines.map((line,index)=>{
    const parts=line.split('|').map(x=>x.trim());
    const [label,clientPrice,supplierCost,supplierKey,...descParts]=parts;
    if(!label||clientPrice==='') throw new Error('Each variant needs a choice name and client price.');
    const amount=Math.round(Number(clientPrice)*100);
    if(!Number.isFinite(amount)||amount<0) throw new Error('Variant client price must be a valid amount.');
    const base=supplierCost===''||supplierCost==null?null:Math.round(Number(supplierCost)*100);
    if(base!=null&&(!Number.isFinite(base)||base<0)) throw new Error('Variant supplier cost must be a valid amount.');
    const key=String(supplierKey||'').trim().toLowerCase();
    const supplier=key?supplierCache.find(s=>String(s.supplier_code||'').toLowerCase()===key||String(s.display_name||'').toLowerCase()===key||String(s.company_name||'').toLowerCase()===key):null;
    if(key&&!supplier) throw new Error('Variant supplier "'+supplierKey+'" was not found in Suppliers.');
    return {
      label,
      description:descParts.join(' | ')||null,
      amount,
      sort_order:index,
      is_default:index===0,
      supplier_id:supplier?.supplier_id||null,
      supplier_cost:base,
      booking_url:supplier?.booking_portal_url||supplier?.website_url||null
    };
  });
}
function formatItemVariants(rows){
  return (rows||[]).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)).map(v=>{
    const adm=Array.isArray(v.travel_quote_item_variant_admin)?v.travel_quote_item_variant_admin[0]:v.travel_quote_item_variant_admin;
    const s=selectedSupplier(adm?.supplier_id);
    const supplier=s?.supplier_code||s?.display_name||s?.company_name||'';
    const base=adm?.supplier_cost==null?'':(adm.supplier_cost/100).toFixed(2);
    return [v.label,(v.amount/100).toFixed(2),base,supplier,v.description||''].join(' | ');
  }).join('\n');
}
async function syncItemVariants(itemId,variants){
  const {data:existing,error:existingError}=await supabase.from('travel_quote_item_variants').select('variant_id').eq('item_id',itemId);
  if(existingError) throw existingError;
  const ids=(existing||[]).map(v=>v.variant_id);
  if(ids.length){
    const {error}=await supabase.from('travel_quote_item_variants').delete().in('variant_id',ids);
    if(error) throw error;
  }
  if(!variants.length) return;
  const publicRows=variants.map(v=>({item_id:itemId,label:v.label,description:v.description,amount:v.amount,sort_order:v.sort_order,is_default:v.is_default,active:true}));
  const {data:saved,error:saveError}=await supabase.from('travel_quote_item_variants').insert(publicRows).select('variant_id,sort_order');
  if(saveError) throw saveError;
  const adminRows=(saved||[]).map(savedRow=>{
    const v=variants.find(x=>x.sort_order===savedRow.sort_order);
    return {variant_id:savedRow.variant_id,supplier_id:v?.supplier_id||null,supplier_cost:v?.supplier_cost??null,booking_url:v?.booking_url||null,admin_notes:v?.supplier_cost!=null?'Supplier/base cost '+money(v.supplier_cost)+' · Client price '+money(v.amount):null};
  });
  if(adminRows.length){
    const {error:adminError}=await supabase.from('travel_quote_item_variant_admin').insert(adminRows);
    if(adminError) throw adminError;
  }
}
function renderItemAttachments(){
  const box=$('#quoteItemAttachmentList'); if(!box) return;
  box.innerHTML=currentItemAttachments.length
    ? currentItemAttachments.map((a,i)=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid #e8e1ef;border-radius:9px;margin:6px 0"><span>'+esc(a.name||a.url||'Attachment')+' · '+esc(a.type||'file')+'</span><button class="secondary-button remove-item-attachment" data-index="'+i+'" type="button">Remove</button></div>').join('')
    : '<span class="hint">No files attached.</span>';
  box.querySelectorAll('.remove-item-attachment').forEach(btn=>btn.onclick=()=>{currentItemAttachments.splice(Number(btn.dataset.index),1);renderItemAttachments();});
}
async function uploadQuoteItemFiles(input){
  const files=[...(input.files||[])]; if(!files.length) return;
  for(const file of files){
    if(!(file.type.startsWith('image/')||file.type==='application/pdf')){toast('Only images and PDFs can be attached to a quote item.',true);continue;}
    if(file.size>15*1024*1024){toast(file.name+' is over the 15 MB limit.',true);continue;}
    const ext=(file.name.split('.').pop()||'file').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path='quotes/'+Date.now()+'-'+crypto.randomUUID()+'.'+ext;
    toast('Uploading '+file.name+'…');
    const {error}=await supabase.storage.from('content-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error){toast(error.message,true);continue;}
    const {data}=supabase.storage.from('content-media').getPublicUrl(path);
    currentItemAttachments.push({name:file.name,url:data.publicUrl,type:file.type==='application/pdf'?'pdf':'image'});
  }
  input.value='';
  renderItemAttachments();
  toast('Quote attachment uploaded. Save the proposal item to keep it.');
}
$('#quoteItemUpload')?.addEventListener('change',e=>uploadQuoteItemFiles(e.target));

function clearQuoteItemForm(){
  ['quoteItemId','quoteItemTitle','quoteItemAmount','quoteItemDescription','quoteItemDetails','quoteItemAdminNotes','quoteItemImage','quoteItemSelectionGroup','quoteItemVariants'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
  if($('#quoteItemSupplier')) $('#quoteItemSupplier').value='';
  if($('#quoteItemCategory')) $('#quoteItemCategory').value='flight';
  if($('#quoteItemQuantity')) $('#quoteItemQuantity').value='1';
  if($('#quoteItemSelectionRule')) $('#quoteItemSelectionRule').value='fixed';
  if($('#quoteItemClientVisible')) $('#quoteItemClientVisible').checked=true;
  currentItemAttachments=[]; renderItemAttachments();
  if($('#saveQuoteItemButton')) $('#saveQuoteItemButton').textContent='Add Proposal Item';
}
function renderQuoteOptionChoices(){
  const select=$('#quoteOptionSelect'); if(!select) return;
  const current=select.value;
  const opts=(currentQuote?.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order);
  select.innerHTML=opts.map(o=>'<option value="'+esc(o.option_id)+'">'+esc(o.name)+'</option>').join('');
  if(current&&opts.some(o=>o.option_id===current)) select.value=current;
}
function currentOptionId(){
  return $('#quoteOptionSelect')?.value || (currentQuote?.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order)[0]?.option_id || null;
}
$('#quoteOptionSelect')?.addEventListener('change',()=>{clearQuoteItemForm();loadQuoteItems();});
async function loadQuoteItems(){
  const list=$('#quoteItemList'); if(!list) return;
  const optionId=currentOptionId();
  if(!optionId){ list.innerHTML='<div class="empty-state">Save the quote first, then add proposal items.</div>'; return; }
  const {data,error}=await supabase.from('travel_quote_items').select('*').eq('option_id',optionId).order('sort_order',{ascending:true});
  if(error){ list.innerHTML='<p class="hint">Proposal items could not be loaded.</p>'; return; }
  const itemIds=(data||[]).map(i=>i.item_id);
  let variantRows=[];
  if(itemIds.length){
    const {data:vr,error:variantError}=await supabase.from('travel_quote_item_variants').select('*,travel_quote_item_variant_admin(*)').in('item_id',itemIds).order('sort_order',{ascending:true});
    if(!variantError) variantRows=vr||[];
  }
  const variantsByItem=new Map();
  variantRows.forEach(v=>{if(!variantsByItem.has(v.item_id))variantsByItem.set(v.item_id,[]);variantsByItem.get(v.item_id).push(v);});
  list.innerHTML=(data||[]).map(i=>{
    const amount=i.amount==null?'Price pending':money(i.amount);
    const supplier=selectedSupplier(i.supplier_id);
    const adminNoteDisplay=mergeSupplierIntoAdminNotes(i.admin_notes,i.supplier_id);
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(i.title)+'</h3><p>'+esc(String(i.category||'').replaceAll('_',' '))+' · '+amount+(i.quantity>1?' · Qty '+i.quantity:'')+(supplier?' · '+esc(supplier.display_name||supplier.company_name):'')+'</p></div></div>'+(i.image_url?'<img src="'+esc(i.image_url)+'" alt="" style="width:100%;max-width:280px;border-radius:12px;margin:8px 0">':'')+'<p class="record-summary">'+esc(i.description||'')+'</p><div style="margin:10px 0;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;font-size:12px;white-space:pre-wrap"><strong>Admin only:</strong> '+esc(adminNoteDisplay)+'</div><div class="record-actions"><button class="secondary-button edit-quote-item" data-id="'+i.item_id+'">Edit</button><button class="danger-button delete-quote-item" data-id="'+i.item_id+'">Delete</button></div></div>';
  }).join('')||'<div class="empty-state">No proposal items yet.</div>';
  document.querySelectorAll('.edit-quote-item').forEach(btn=>btn.onclick=()=>{
    const i=(data||[]).find(x=>x.item_id===btn.dataset.id); if(!i)return;
    $('#quoteItemId').value=i.item_id; $('#quoteItemCategory').value=i.category||'other'; $('#quoteItemTitle').value=i.title||'';
    $('#quoteItemAmount').value=i.amount==null?'':(i.amount/100).toFixed(2); $('#quoteItemQuantity').value=i.quantity||1;
    $('#quoteItemDescription').value=i.description||'';
    $('#quoteItemSupplier').value=i.supplier_id||'';
    $('#quoteItemImage').value=i.image_url||'';
    $('#quoteItemAdminNotes').value=mergeSupplierIntoAdminNotes(i.admin_notes,i.supplier_id);
    $('#quoteItemDetails').value=Object.entries(i.details||{}).map(([k,v])=>k+' | '+v).join('\n');
    if($('#quoteItemSelectionGroup')) $('#quoteItemSelectionGroup').value=i.selection_group||'';
    if($('#quoteItemSelectionRule')) $('#quoteItemSelectionRule').value=i.selection_rule||'fixed';
    if($('#quoteItemClientVisible')) $('#quoteItemClientVisible').checked=i.client_visible!==false;
    if($('#quoteItemVariants')) $('#quoteItemVariants').value=formatItemVariants(variantsByItem.get(i.item_id)||[]);
    currentItemAttachments=Array.isArray(i.attachments)?[...i.attachments]:[];
    renderItemAttachments();
    $('#saveQuoteItemButton').textContent='Update Proposal Item';
  });
  document.querySelectorAll('.delete-quote-item').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Remove this proposal item?')) return;
    const {error}=await supabase.from('travel_quote_items').delete().eq('item_id',btn.dataset.id);
    if(error) return toast(error.message,true); toast('Proposal item removed.'); await loadQuoteItems();
  });
}
async function syncSupplierAssignment(itemId,itemPayload){
  if(!itemId) return;
  if(!itemPayload.supplier_id){
    await supabase.from('supplier_assignments').delete().eq('quote_item_id',itemId);
    return;
  }
  const assignment={
    supplier_id:itemPayload.supplier_id,
    context_type:'travel_quote',
    request_id:currentRequest?.request_id||null,
    quote_id:currentQuote?.quote_id||$('#quoteId')?.value||null,
    quote_item_id:itemId,
    service_type:itemPayload.category||null,
    description:[itemPayload.title,itemPayload.description].filter(Boolean).join(' — '),
    supplier_subtotal:itemPayload.amount==null?0:itemPayload.amount*Math.max(1,itemPayload.quantity||1),
    service_fee:0,
    taxes_fees:0,
    currency:'usd',
    status:'quoted',
    visible_to_supplier:true,
    updated_at:new Date().toISOString()
  };
  const {data:existing,error:lookupError}=await supabase.from('supplier_assignments').select('assignment_id').eq('quote_item_id',itemId).maybeSingle();
  if(lookupError){toast('Proposal item saved, but supplier assignment could not be checked: '+lookupError.message,true);return;}
  const result=existing?.assignment_id
    ? await supabase.from('supplier_assignments').update(assignment).eq('assignment_id',existing.assignment_id)
    : await supabase.from('supplier_assignments').insert(assignment);
  if(result.error) toast('Proposal item saved, but supplier assignment could not be synced: '+result.error.message,true);
}

async function saveQuoteItem(){
  const optionId=currentOptionId();
  if(!optionId) return toast('Save the quote first so the proposal item has an option to attach to.',true);
  const title=$('#quoteItemTitle')?.value.trim();
  if(!title) return toast('Enter an item title.',true);
  const category=$('#quoteItemCategory')?.value||'other';
  const supplierId=$('#quoteItemSupplier')?.value||null;
  let parsedVariants=[];
  try{parsedVariants=parseItemVariants();}catch(error){return toast(error.message,true);}
  if(!supplierId && !isInternalFeeItem(category,title) && !parsedVariants.some(v=>v.supplier_id)) return toast('Select the supplier/source for this quote item, or assign suppliers to its variants.',true);
  const amountRaw=$('#quoteItemAmount')?.value;
  const payload={
    option_id:optionId,
    category,
    title,
    description:$('#quoteItemDescription')?.value.trim()||null,
    amount:amountRaw===''?null:Math.round(Number(amountRaw)*100),
    quantity:Math.max(1,Number($('#quoteItemQuantity')?.value||1)),
    details:parseItemDetails(),
    supplier_id:supplierId,
    image_url:$('#quoteItemImage')?.value.trim()||null,
    admin_notes:isInternalFeeItem(category,title)
      ? String($('#quoteItemAdminNotes')?.value||'').replace(/^\[Supplier\][^\n]*(?:\n|$)/i,'').trim()
      : mergeSupplierIntoAdminNotes($('#quoteItemAdminNotes')?.value,supplierId),
    selection_group:$('#quoteItemSelectionGroup')?.value.trim()||null,
    selection_rule:$('#quoteItemSelectionRule')?.value||'fixed',
    client_visible:$('#quoteItemClientVisible')?.checked!==false,
    attachments:currentItemAttachments,
    updated_at:new Date().toISOString()
  };
  const id=$('#quoteItemId')?.value;
  let savedItemId=id||null;
  if(id){
    const {data:saved,error}=await supabase.from('travel_quote_items').update(payload).eq('item_id',id).select('item_id').single();
    if(error) return toast(error.message,true);
    savedItemId=saved.item_id;
    toast('Proposal item updated.');
  }else{
    const {data:maxRows}=await supabase.from('travel_quote_items').select('sort_order').eq('option_id',optionId).order('sort_order',{ascending:false}).limit(1);
    payload.sort_order=(maxRows?.[0]?.sort_order||0)+1;
    const {data:saved,error}=await supabase.from('travel_quote_items').insert(payload).select('item_id').single();
    if(error) return toast(error.message,true);
    savedItemId=saved.item_id;
    toast('Proposal item added.');
  }
  await syncSupplierAssignment(savedItemId,payload);
  try{await syncItemVariants(savedItemId,parsedVariants);}catch(error){return toast('Item saved, but variants could not be saved: '+error.message,true);}
  clearQuoteItemForm(); await loadQuoteItems();
}
$('#saveQuoteItemButton')?.addEventListener('click',saveQuoteItem);
$('#clearQuoteItemButton')?.addEventListener('click',clearQuoteItemForm);

function parseOptions(){
  return ($('#quoteOptions')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean).map((line,i)=>{
    const [name,total,deposit,...rest]=line.split('|').map(x=>x.trim());
    return {name,total_amount:Math.round(Number(total||0)*100),deposit_amount:deposit?Math.round(Number(deposit)*100):null,description:rest.join(' | ')||null,sort_order:i};
  }).filter(x=>x.name && x.total_amount>0);
}
async function loadRequests(){
  if(!$('#requestQuoteList')) return;
  const {data,error}=await supabase.from('travel_requests')
    .select('request_id,user_id,requester_email,primary_first_name,primary_last_name,destination,submitted_at,status,request_types,answers,travel_request_fulfillments(*),travel_quotes(quote_id,title,summary,status,valid_until,total_amount,deposit_amount,quote_kind,workflow_status,source_quote_id,travel_quote_options(*))')
    .order('submitted_at',{ascending:false});
  if(error){ $('#requestQuoteList').innerHTML='<p>Requests could not be loaded.</p>'; return; }
  $('#requestQuoteList').innerHTML=(data||[]).map(r=>{
    const name=[r.primary_first_name,r.primary_last_name].filter(Boolean).join(' ')||r.requester_email;
    const quotes=r.travel_quotes||[];
    const fulfillment=Array.isArray(r.travel_request_fulfillments)?r.travel_request_fulfillments[0]:r.travel_request_fulfillments;
    const card=r.answers?.payment_method_summary;
    const paymentLine=fulfillment
      ? 'Payment: '+String(fulfillment.status||'').replaceAll('_',' ')+(fulfillment.total_amount!=null?' · '+money(fulfillment.total_amount):'')
      : card?.last4 ? 'Payment method on file: '+String(card.brand||'card').toUpperCase()+' •••• '+esc(card.last4)
      : r.user_id ? 'Account linked · payment authorization not completed' : 'Legacy request · no linked TRV account';
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(name)+'</h3><p>'+esc(r.destination||'Travel request')+' · '+new Date(r.submitted_at).toLocaleDateString()+'</p></div><span class="status-badge '+esc(r.status)+'">'+esc(r.status.replaceAll('_',' '))+'</span></div><p class="record-summary">'+esc((r.request_types||[]).join(', '))+'<br><strong>'+paymentLine+'</strong></p><div class="record-actions"><button class="secondary-button open-request" data-id="'+r.request_id+'">Create New / Open Latest Quote</button></div>'+(quotes.length?quotes.map(q=>'<div class="quote-mini" style="margin-top:12px;padding:12px;background:#faf5ff;border-radius:10px"><strong>'+esc(q.title)+'</strong><br><small>'+esc(q.status)+' · '+esc(q.workflow_status||'')+' · '+(q.travel_quote_options||[]).length+' option(s)</small><div class="record-actions" style="margin-top:8px"><button class="secondary-button open-specific-quote" data-request="'+r.request_id+'" data-quote="'+q.quote_id+'">'+(q.quote_kind==='custom_selection'?'Review Client-Built Quote':'Edit / Preview Quote')+'</button></div></div>').join(''):'')+'</div>';
  }).join('') || '<div class="empty-state">No travel requests yet.</div>';
  document.querySelectorAll('.open-request').forEach(btn=>btn.onclick=()=>openRequest(data.find(r=>r.request_id===btn.dataset.id)));
  document.querySelectorAll('.open-specific-quote').forEach(btn=>btn.onclick=()=>openRequest(data.find(r=>r.request_id===btn.dataset.request),btn.dataset.quote));
}
async function loadTravelers(requestId){
  const list=$('#travelerList'); if(!list) return;
  if(!requestId){ list.innerHTML='<div class="empty-state">Select a request to manage travelers.</div>'; return; }
  const {data,error}=await supabase.from('request_travelers').select('*').eq('request_id',requestId).order('date_of_birth',{ascending:true});
  if(error){ list.innerHTML='<p class="hint">Travelers could not be loaded.</p>'; return; }
  list.innerHTML=(data||[]).map(t=>{
    const full=[t.first_name,t.middle_name,t.last_name].filter(Boolean).join(' ');
    const dob=t.date_of_birth?new Date(t.date_of_birth+'T00:00:00').toLocaleDateString():'DOB not entered';
    return '<div class="admin-record compact"><div><h3>'+esc(full)+'</h3><p>'+esc(dob)+(t.traveler_type?' · '+esc(t.traveler_type):'')+'</p></div><div class="record-actions"><button class="secondary-button edit-traveler" data-id="'+t.traveler_id+'">Edit</button><button class="danger-button delete-traveler" data-id="'+t.traveler_id+'">Delete</button></div></div>';
  }).join('')||'<div class="empty-state">No travelers added yet.</div>';
  document.querySelectorAll('.edit-traveler').forEach(btn=>btn.onclick=()=>{
    const t=(data||[]).find(x=>x.traveler_id===btn.dataset.id); if(!t)return;
    $('#travelerId').value=t.traveler_id||''; $('#travelerFirstName').value=t.first_name||''; $('#travelerMiddleName').value=t.middle_name||'';
    $('#travelerLastName').value=t.last_name||''; $('#travelerDob').value=t.date_of_birth||''; $('#travelerType').value=t.traveler_type||'';
    $('#travelerGender').value=t.gender||''; $('#travelerNotes').value=t.notes||'';
  });
  document.querySelectorAll('.delete-traveler').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Remove this traveler from the request?')) return;
    const {error}=await supabase.from('request_travelers').delete().eq('traveler_id',btn.dataset.id);
    if(error) return toast(error.message,true); toast('Traveler removed.'); await loadTravelers(requestId);
  });
}
function clearTravelerForm(){
  ['travelerId','travelerFirstName','travelerMiddleName','travelerLastName','travelerDob','travelerGender','travelerNotes'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
  if($('#travelerType')) $('#travelerType').value='';
}
async function saveTraveler(){
  if(!currentRequest) return toast('Select a travel request first.',true);
  const first=$('#travelerFirstName')?.value.trim(), last=$('#travelerLastName')?.value.trim();
  if(!first||!last) return toast('Traveler first and last name are required.',true);
  const payload={request_id:currentRequest.request_id,first_name:first,middle_name:$('#travelerMiddleName')?.value.trim()||null,last_name:last,date_of_birth:$('#travelerDob')?.value||null,traveler_type:$('#travelerType')?.value||null,gender:$('#travelerGender')?.value.trim()||null,notes:$('#travelerNotes')?.value.trim()||null,updated_at:new Date().toISOString()};
  const id=$('#travelerId')?.value;
  const q=id?supabase.from('request_travelers').update(payload).eq('traveler_id',id):supabase.from('request_travelers').insert(payload);
  const {error}=await q; if(error) return toast(error.message,true);
  toast(id?'Traveler updated.':'Traveler added.'); clearTravelerForm(); await loadTravelers(currentRequest.request_id);
}
$('#saveTravelerButton')?.addEventListener('click',saveTraveler);
$('#clearTravelerButton')?.addEventListener('click',clearTravelerForm);

function openRequest(r,quoteId=null){
  currentRequest=r;
  currentQuote=quoteId
    ? (r.travel_quotes||[]).find(q=>q.quote_id===quoteId)||null
    : (r.travel_quotes||[]).find(q=>!['declined','expired','withdrawn'].includes(q.status)) || null;
  $('#quoteRequestId').value=r.request_id; $('#quoteId').value=currentQuote?.quote_id||'';
  if($('#quoteRequesterEmail')) $('#quoteRequesterEmail').value=r.requester_email||'';
  if($('#memberAccountNewEmail')) $('#memberAccountNewEmail').value='';
  if($('#memberEmailChangeHint')) $('#memberEmailChangeHint').textContent=r.user_id
    ? 'This request is linked to a member account. Admin can start a secure email-change request; the traveler must complete the confirmation.'
    : 'This request is not linked to a member account. Use Requester email above instead.';
  if($('#sendMemberEmailChangeButton')) $('#sendMemberEmailChangeButton').disabled=!r.user_id;
  const name=[r.primary_first_name,r.primary_last_name].filter(Boolean).join(' ')||r.requester_email;
  $('#quoteClient').value=name+' · '+(r.destination||'Travel request');
  $('#quoteTitle').value=currentQuote?.title || (r.destination ? r.destination+' — The Real Vacations Quote' : 'Your TRV Travel Quote');
  $('#quoteSummary').value=currentQuote?.summary||'';
  $('#quoteValidUntil').value=currentQuote?.valid_until ? currentQuote.valid_until.slice(0,10) : '';
  $('#quoteOptions').value=(currentQuote?.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order).map(o=>[o.name,(o.total_amount/100).toFixed(2),o.deposit_amount==null?'':(o.deposit_amount/100).toFixed(2),o.description||''].join(' | ')).join('\n');
  renderQuoteOptionChoices();

  const fulfillment=Array.isArray(r.travel_request_fulfillments)?r.travel_request_fulfillments[0]:r.travel_request_fulfillments;
  $('#fulfillmentSupplierId').value=fulfillment?.supplier_id||'';
  $('#fulfillmentSupplier').value=fulfillment?.supplier_name||'';
  renderFulfillmentSupplierActions();
  $('#fulfillmentSubtotal').value=fulfillment?.supplier_subtotal!=null?(fulfillment.supplier_subtotal/100).toFixed(2):'';
  $('#fulfillmentFee').value=fulfillment?.service_fee!=null?(fulfillment.service_fee/100).toFixed(2):'0.00';
  $('#fulfillmentConfirmation').value=fulfillment?.confirmation_details||'';
  const card=r.answers?.payment_method_summary;
  const statusText=fulfillment
    ? 'Current payment status: '+String(fulfillment.status||'').replaceAll('_',' ')+(fulfillment.total_amount!=null?' · '+money(fulfillment.total_amount):'')
    : card?.last4
      ? 'Ready: '+String(card.brand||'card').toUpperCase()+' •••• '+card.last4+' is on file with signed request authorization.'
      : 'This request does not yet show a secured payment method and signed booking authorization.';
  $('#fulfillmentStatus').textContent=statusText;
  const link=$('#openConfirmedPaymentLink');
  link.style.display='none'; link.href='#';
  clearTravelerForm();
  loadTravelers(r.request_id);
  clearQuoteItemForm();
  renderQuoteOptionChoices();
  loadQuoteItems();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function duplicateCurrentOption(){
  if(!currentQuote) return toast('Open a quote first.',true);
  const optionId=currentOptionId();
  const source=(currentQuote.travel_quote_options||[]).find(o=>o.option_id===optionId);
  if(!source) return toast('Choose an option to duplicate.',true);
  const name=prompt('Name for the duplicated option:',source.name+' Copy');
  if(!name) return;
  const {data:newOption,error}=await supabase.from('travel_quote_options').insert({
    quote_id:currentQuote.quote_id,
    name:name.trim(),
    description:source.description||null,
    sort_order:Math.max(-1,...(currentQuote.travel_quote_options||[]).map(o=>Number(o.sort_order)||0))+1,
    total_amount:source.total_amount,
    deposit_amount:source.deposit_amount,
    is_recommended:false,
    details:source.details||{},
    allow_mix_and_match:true
  }).select('*').single();
  if(error) return toast(error.message,true);
  const {data:items,error:itemLoadError}=await supabase.from('travel_quote_items').select('*').eq('option_id',optionId).order('sort_order');
  if(itemLoadError) return toast('Option duplicated, but its items could not be copied: '+itemLoadError.message,true);
  if(items?.length){
    const copies=items.map(({item_id,created_at,updated_at,...i})=>({...i,option_id:newOption.option_id}));
    const {error:copyError}=await supabase.from('travel_quote_items').insert(copies);
    if(copyError) return toast('Option duplicated, but some items could not be copied: '+copyError.message,true);
  }
  currentQuote.travel_quote_options=[...(currentQuote.travel_quote_options||[]),newOption];
  $('#quoteOptions').value=(currentQuote.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order).map(o=>[o.name,(o.total_amount/100).toFixed(2),o.deposit_amount==null?'':(o.deposit_amount/100).toFixed(2),o.description||''].join(' | ')).join('\n');
  renderQuoteOptionChoices();
  $('#quoteOptionSelect').value=newOption.option_id;
  clearQuoteItemForm();
  await loadQuoteItems();
  toast('Option duplicated. Edit its items and pricing as needed.');
}
$('#duplicateQuoteOptionButton')?.addEventListener('click',duplicateCurrentOption);

async function saveRequesterEmail(showMessage=true){
  if(!currentRequest){
    if(showMessage) toast('Select a travel request first.',true);
    return false;
  }
  const input=$('#quoteRequesterEmail');
  const email=(input?.value||'').trim().toLowerCase();
  if(!email || !input?.checkValidity()){
    if(showMessage) toast('Enter a valid requester email address.',true);
    return false;
  }
  const {error}=await supabase.from('travel_requests')
    .update({requester_email:email,updated_at:new Date().toISOString()})
    .eq('request_id',currentRequest.request_id);
  if(error){
    if(showMessage) toast(error.message,true);
    return false;
  }
  currentRequest.requester_email=email;
  if(showMessage) toast('Requester email saved.');
  await loadRequests();
  return true;
}
$('#saveRequesterEmailButton')?.addEventListener('click',()=>saveRequesterEmail(true));

async function sendMemberEmailChange(){
  if(!currentRequest) return toast('Select a travel request first.',true);
  if(!currentRequest.user_id) return toast('This request is not linked to a member account.',true);
  const input=$('#memberAccountNewEmail');
  const newEmail=(input?.value||'').trim().toLowerCase();
  if(!newEmail || !input?.checkValidity()) return toast('Enter a valid new member login email.',true);
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token) return toast('Your admin session expired. Sign in again.',true);
  const button=$('#sendMemberEmailChangeButton');
  button.disabled=true; button.textContent='Sending secure instructions…';
  try{
    const resp=await fetch('/api/admin-request-email-change',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
      body:JSON.stringify({request_id:currentRequest.request_id,new_email:newEmail})
    });
    const result=await resp.json().catch(()=>({}));
    if(!resp.ok) throw new Error(result.error||'Unable to start member email change.');
    toast('Secure email-change instructions sent to the member’s current login email.');
    if($('#memberEmailChangeHint')) $('#memberEmailChangeHint').textContent='Instructions sent to '+result.current_email+'. Requested new login email: '+result.new_email+'.';
  }catch(error){
    toast(error.message||'Unable to start member email change.',true);
  }finally{
    button.disabled=false; button.textContent='Send Secure Email Change Instructions';
  }
}
$('#sendMemberEmailChangeButton')?.addEventListener('click',sendMemberEmailChange);

async function saveQuote(publish=false){
  if(!currentRequest) return toast('Select a travel request first.',true);
  if(publish && !(await saveRequesterEmail(false))) return toast('Add a valid requester email before publishing and emailing this quote.',true);
  if(publish && currentQuote?.quote_id){
    const optionIds=(currentQuote.travel_quote_options||[]).map(o=>o.option_id).filter(Boolean);
    if(optionIds.length){
      const {data:items,error:sourceCheckError}=await supabase.from('travel_quote_items').select('item_id,title,category,supplier_id,selection_rule,admin_notes').in('option_id',optionIds);
      if(sourceCheckError) return toast('Could not verify quote-item suppliers: '+sourceCheckError.message,true);
      const hasDocumentedSupplierChoices=i=>!i.supplier_id&&['choose_one','optional'].includes(i.selection_rule)&&/CHOICE A|TWO SUPPLIER|supplier choice/i.test(String(i.admin_notes||''));
      const missing=(items||[]).filter(i=>!i.supplier_id&&!isInternalFeeItem(i.category,i.title)&&!hasDocumentedSupplierChoices(i));
      if(missing.length) return toast('Every quote item must have its supplier/source before publishing. Missing: '+missing.map(i=>i.title).join(', '),true);
    }
  }
  const options=parseOptions(); if(!$('#quoteTitle').value.trim()||!options.length) return toast('Add a quote title and at least one option.',true);
  const valid=$('#quoteValidUntil').value ? new Date($('#quoteValidUntil').value+'T23:59:59').toISOString() : null;
  const qPayload={request_id:currentRequest.request_id,title:$('#quoteTitle').value.trim(),summary:$('#quoteSummary').value.trim()||null,status:publish?'ready':'draft',workflow_status:publish?'published':(currentQuote?.workflow_status==='admin_review'?'admin_review':'draft'),valid_until:valid,ready_at:publish?new Date().toISOString():null,total_amount:Math.min(...options.map(o=>o.total_amount)),deposit_amount:Math.min(...options.map(o=>o.deposit_amount||o.total_amount))};
  let quoteId=$('#quoteId').value;
  let existingOptions=[];
  if(quoteId){
    const {error}=await supabase.from('travel_quotes').update(qPayload).eq('quote_id',quoteId); if(error) return toast(error.message,true);
    existingOptions=(currentQuote?.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order);
  }else{
    const {data,error}=await supabase.from('travel_quotes').insert(qPayload).select('quote_id').single(); if(error) return toast(error.message,true);
    quoteId=data.quote_id; $('#quoteId').value=quoteId;
  }
  for(let i=0;i<options.length;i++){
    const payload={...options[i],quote_id:quoteId};
    if(existingOptions[i]?.option_id){
      const {error}=await supabase.from('travel_quote_options').update(payload).eq('option_id',existingOptions[i].option_id);
      if(error) return toast(error.message,true);
    }else{
      const {error}=await supabase.from('travel_quote_options').insert(payload);
      if(error) return toast(error.message,true);
    }
  }
  for(let i=options.length;i<existingOptions.length;i++){
    const {error}=await supabase.from('travel_quote_options').delete().eq('option_id',existingOptions[i].option_id);
    if(error) return toast(error.message,true);
  }
  await supabase.from('travel_requests').update({status:publish?'quote_ready':'quote_in_progress'}).eq('request_id',currentRequest.request_id);
  if(publish){
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token) return toast('Your admin session expired. Sign in again.',true);
    let emailResult={};
    let emailError=null;
    try{
      const emailResp=await fetch('/api/send-quote-ready',{
        method:'POST',
        headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
        body:JSON.stringify({quote_id:quoteId})
      });
      emailResult=await emailResp.json().catch(()=>({}));
      if(!emailResp.ok) emailError=new Error(emailResult?.error||'Email delivery failed');
    }catch(error){
      emailError=error;
    }
    if(emailError || !emailResult?.delivered){
      const detail=emailResult?.error||emailError?.message||'Email delivery failed';
      console.error('Quote email failed:',emailError,emailResult);
      toast('Quote published, but email failed: '+detail,true);
    }else{
      toast(emailResult?.duplicate?'Quote published. Email was already sent for this event.':'Quote published and emailed to the client.');
    }
  } else toast('Quote draft saved.');
  await loadRequests();
  if(currentRequest) {
    const refreshed=(await supabase.from('travel_requests').select('request_id,travel_quotes(quote_id,title,summary,status,valid_until,total_amount,deposit_amount,quote_kind,workflow_status,source_quote_id,travel_quote_options(*))').eq('request_id',currentRequest.request_id).maybeSingle()).data;
    if(refreshed?.travel_quotes){ currentQuote=(refreshed.travel_quotes||[]).find(q=>q.quote_id===quoteId)||(refreshed.travel_quotes||[]).find(q=>!['declined','expired','withdrawn'].includes(q.status))||currentQuote; }
    renderQuoteOptionChoices();
    await loadQuoteItems();
  }
}
$('#saveQuoteButton')?.addEventListener('click',()=>saveQuote(false));
$('#previewQuoteButton')?.addEventListener('click',()=>{
  const quoteId=$('#quoteId')?.value || currentQuote?.quote_id || '';
  if(!quoteId) return toast('Save the quote first, then preview the proposal.',true);
  window.open('/proposal?quote='+encodeURIComponent(quoteId),'_blank','noopener');
});
$('#publishQuoteButton')?.addEventListener('click',()=>saveQuote(true));
$('#resetQuoteResponseButton')?.addEventListener('click',async()=>{
  const quoteId=$('#quoteId')?.value || currentQuote?.quote_id || '';
  if(!currentRequest||!quoteId) return toast('Select a quote first.',true);
  if(!confirm('Reset this client response and reopen the unpaid quote for review?')) return;
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token) return toast('Your admin session expired. Sign in again.',true);
  const button=$('#resetQuoteResponseButton');
  button.disabled=true; button.textContent='Resetting…';
  try{
    const resp=await fetch('/api/admin-reset-quote-response',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
      body:JSON.stringify({quote_id:quoteId})
    });
    const result=await resp.json().catch(()=>({}));
    if(!resp.ok) throw new Error(result.error||'Unable to reset client response.');
    toast('Client response reset. The quote is reopened for review and approval.');
    await loadRequests();
    const {data:refreshed}=await supabase.from('travel_requests')
      .select('request_id,user_id,requester_email,primary_first_name,primary_last_name,destination,submitted_at,status,request_types,answers,travel_request_fulfillments(*),travel_quotes(quote_id,title,summary,status,valid_until,total_amount,deposit_amount,travel_quote_options(*))')
      .eq('request_id',currentRequest.request_id).maybeSingle();
    if(refreshed) openRequest(refreshed);
  }catch(error){
    toast(error.message||'Unable to reset client response.',true);
  }finally{
    button.disabled=false; button.textContent='Reset Client Response';
  }
});
$('#clearQuoteButton')?.addEventListener('click',()=>{
  currentRequest=null;currentQuote=null;
  ['quoteRequestId','quoteId','quoteClient','quoteRequesterEmail','memberAccountNewEmail','quoteTitle','quoteSummary','quoteValidUntil','quoteOptions','fulfillmentSupplier','fulfillmentSubtotal','fulfillmentConfirmation'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
  if($('#fulfillmentFee')) $('#fulfillmentFee').value='0.00';
  if($('#fulfillmentStatus')) $('#fulfillmentStatus').textContent='Select a request to view payment readiness.';
  if($('#openConfirmedPaymentLink')){$('#openConfirmedPaymentLink').style.display='none';$('#openConfirmedPaymentLink').href='#';}
  clearTravelerForm();
  clearQuoteItemForm();
  if($('#travelerList')) $('#travelerList').innerHTML='<div class="empty-state">Select a request to manage travelers.</div>';
  if($('#quoteItemList')) $('#quoteItemList').innerHTML='<div class="empty-state">Select a request to manage proposal items.</div>';
});

async function createConfirmedPayment(){
  if(!currentRequest) return toast('Select a travel request first.',true);
  const subtotal=Math.round(Number($('#fulfillmentSubtotal')?.value||0)*100);
  const fee=Math.round(Number($('#fulfillmentFee')?.value||0)*100);
  if(!Number.isInteger(subtotal)||subtotal<0||!Number.isInteger(fee)||fee<0||subtotal+fee<=0){
    return toast('Enter the supplier-confirmed amount and any TRV service fee.',true);
  }
  const {data:{session}}=await supabase.auth.getSession();
  if(!session) return toast('Your admin session expired. Sign in again.',true);

  const button=$('#createConfirmedPaymentButton');
  button.disabled=true; button.textContent='Creating secure payment…';
  try{
    const resp=await fetch('/api/admin-create-confirmed-payment-link',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
      body:JSON.stringify({
        request_id:currentRequest.request_id,
        supplier_id:$('#fulfillmentSupplierId')?.value||null,
        supplier_name:$('#fulfillmentSupplier')?.value?.trim()||selectedSupplier($('#fulfillmentSupplierId')?.value||'')?.display_name||selectedSupplier($('#fulfillmentSupplierId')?.value||'')?.company_name||'',
        supplier_subtotal:subtotal,
        service_fee:fee,
        confirmation_details:$('#fulfillmentConfirmation')?.value?.trim()||''
      })
    });
    const result=await resp.json().catch(()=>({}));
    if(!resp.ok) throw new Error(result.error||'Unable to create confirmed payment.');
    $('#fulfillmentStatus').textContent='Secure payment link created and emailed · '+money(result.total_amount);
    const link=$('#openConfirmedPaymentLink');
    link.href=result.checkout_url; link.style.display='inline-block';
    toast('Confirmed payment link created and emailed to the traveler.');
    await loadRequests();
  }catch(error){
    toast(error.message||'Unable to create confirmed payment.',true);
  }finally{
    button.disabled=false; button.textContent='Create Confirmed Payment Link';
  }
}
$('#createConfirmedPaymentButton')?.addEventListener('click',createConfirmedPayment);

document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',async()=>{ if(btn.dataset.tab==='quotes'){await loadSupplierChoices();loadRequests();} }));
await loadSupplierChoices();
loadRequests();
