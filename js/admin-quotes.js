import { supabase } from './supabase-client.js';

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(n)||0)/100);
const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let currentRequest=null, currentQuote=null;

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
function clearQuoteItemForm(){
  ['quoteItemId','quoteItemTitle','quoteItemAmount','quoteItemDescription','quoteItemDetails','quoteItemAdminNotes'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
  if($('#quoteItemCategory')) $('#quoteItemCategory').value='flight';
  if($('#quoteItemQuantity')) $('#quoteItemQuantity').value='1';
  if($('#saveQuoteItemButton')) $('#saveQuoteItemButton').textContent='Add Proposal Item';
}
function currentOptionId(){
  return (currentQuote?.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order)[0]?.option_id || null;
}
async function loadQuoteItems(){
  const list=$('#quoteItemList'); if(!list) return;
  const optionId=currentOptionId();
  if(!optionId){ list.innerHTML='<div class="empty-state">Save the quote first, then add proposal items.</div>'; return; }
  const {data,error}=await supabase.from('travel_quote_items').select('*').eq('option_id',optionId).order('sort_order',{ascending:true});
  if(error){ list.innerHTML='<p class="hint">Proposal items could not be loaded.</p>'; return; }
  list.innerHTML=(data||[]).map(i=>{
    const amount=i.amount==null?'Price pending':money(i.amount);
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(i.title)+'</h3><p>'+esc(String(i.category||'').replaceAll('_',' '))+' · '+amount+(i.quantity>1?' · Qty '+i.quantity:'')+'</p></div></div><p class="record-summary">'+esc(i.description||'')+'</p>'+(i.admin_notes?'<div style="margin:10px 0;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:9px;font-size:12px"><strong>Admin only:</strong> '+esc(i.admin_notes)+'</div>':'')+'<div class="record-actions"><button class="secondary-button edit-quote-item" data-id="'+i.item_id+'">Edit</button><button class="danger-button delete-quote-item" data-id="'+i.item_id+'">Delete</button></div></div>';
  }).join('')||'<div class="empty-state">No proposal items yet.</div>';
  document.querySelectorAll('.edit-quote-item').forEach(btn=>btn.onclick=()=>{
    const i=(data||[]).find(x=>x.item_id===btn.dataset.id); if(!i)return;
    $('#quoteItemId').value=i.item_id; $('#quoteItemCategory').value=i.category||'other'; $('#quoteItemTitle').value=i.title||'';
    $('#quoteItemAmount').value=i.amount==null?'':(i.amount/100).toFixed(2); $('#quoteItemQuantity').value=i.quantity||1;
    $('#quoteItemDescription').value=i.description||'';
    $('#quoteItemAdminNotes').value=i.admin_notes||'';
    $('#quoteItemDetails').value=Object.entries(i.details||{}).map(([k,v])=>k+' | '+v).join('\n');
    $('#saveQuoteItemButton').textContent='Update Proposal Item';
  });
  document.querySelectorAll('.delete-quote-item').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Remove this proposal item?')) return;
    const {error}=await supabase.from('travel_quote_items').delete().eq('item_id',btn.dataset.id);
    if(error) return toast(error.message,true); toast('Proposal item removed.'); await loadQuoteItems();
  });
}
async function saveQuoteItem(){
  const optionId=currentOptionId();
  if(!optionId) return toast('Save the quote first so the proposal item has an option to attach to.',true);
  const title=$('#quoteItemTitle')?.value.trim();
  if(!title) return toast('Enter an item title.',true);
  const amountRaw=$('#quoteItemAmount')?.value;
  const payload={
    option_id:optionId,
    category:$('#quoteItemCategory')?.value||'other',
    title,
    description:$('#quoteItemDescription')?.value.trim()||null,
    amount:amountRaw===''?null:Math.round(Number(amountRaw)*100),
    quantity:Math.max(1,Number($('#quoteItemQuantity')?.value||1)),
    details:parseItemDetails(),
    admin_notes:$('#quoteItemAdminNotes')?.value.trim()||null,
    updated_at:new Date().toISOString()
  };
  const id=$('#quoteItemId')?.value;
  if(id){
    const {error}=await supabase.from('travel_quote_items').update(payload).eq('item_id',id);
    if(error) return toast(error.message,true);
    toast('Proposal item updated.');
  }else{
    const {data:maxRows}=await supabase.from('travel_quote_items').select('sort_order').eq('option_id',optionId).order('sort_order',{ascending:false}).limit(1);
    payload.sort_order=(maxRows?.[0]?.sort_order||0)+1;
    const {error}=await supabase.from('travel_quote_items').insert(payload);
    if(error) return toast(error.message,true);
    toast('Proposal item added.');
  }
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
    .select('request_id,user_id,requester_email,primary_first_name,primary_last_name,destination,submitted_at,status,request_types,answers,travel_request_fulfillments(*),travel_quotes(quote_id,title,summary,status,valid_until,total_amount,deposit_amount,travel_quote_options(*))')
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
    return '<div class="admin-record"><div class="record-heading"><div><h3>'+esc(name)+'</h3><p>'+esc(r.destination||'Travel request')+' · '+new Date(r.submitted_at).toLocaleDateString()+'</p></div><span class="status-badge '+esc(r.status)+'">'+esc(r.status.replaceAll('_',' '))+'</span></div><p class="record-summary">'+esc((r.request_types||[]).join(', '))+'<br><strong>'+paymentLine+'</strong></p><div class="record-actions"><button class="secondary-button open-request" data-id="'+r.request_id+'">Create / Edit Quote</button></div>'+(quotes.length?quotes.map(q=>'<div class="quote-mini" style="margin-top:12px;padding:12px;background:#faf5ff;border-radius:10px"><strong>'+esc(q.title)+'</strong><br><small>'+esc(q.status)+' · '+(q.travel_quote_options||[]).length+' option(s)</small></div>').join(''):'')+'</div>';
  }).join('') || '<div class="empty-state">No travel requests yet.</div>';
  document.querySelectorAll('.open-request').forEach(btn=>btn.onclick=()=>openRequest(data.find(r=>r.request_id===btn.dataset.id)));
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

function openRequest(r){
  currentRequest=r; currentQuote=(r.travel_quotes||[]).find(q=>!['declined','expired','withdrawn'].includes(q.status)) || null;
  $('#quoteRequestId').value=r.request_id; $('#quoteId').value=currentQuote?.quote_id||'';
  const name=[r.primary_first_name,r.primary_last_name].filter(Boolean).join(' ')||r.requester_email;
  $('#quoteClient').value=name+' · '+(r.destination||'Travel request');
  $('#quoteTitle').value=currentQuote?.title || (r.destination ? r.destination+' — The Real Vacations Quote' : 'Your TRV Travel Quote');
  $('#quoteSummary').value=currentQuote?.summary||'';
  $('#quoteValidUntil').value=currentQuote?.valid_until ? currentQuote.valid_until.slice(0,10) : '';
  $('#quoteOptions').value=(currentQuote?.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order).map(o=>[o.name,(o.total_amount/100).toFixed(2),o.deposit_amount==null?'':(o.deposit_amount/100).toFixed(2),o.description||''].join(' | ')).join('\n');

  const fulfillment=Array.isArray(r.travel_request_fulfillments)?r.travel_request_fulfillments[0]:r.travel_request_fulfillments;
  $('#fulfillmentSupplier').value=fulfillment?.supplier_name||'';
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
  loadQuoteItems();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function saveQuote(publish=false){
  if(!currentRequest) return toast('Select a travel request first.',true);
  const options=parseOptions(); if(!$('#quoteTitle').value.trim()||!options.length) return toast('Add a quote title and at least one option.',true);
  const valid=$('#quoteValidUntil').value ? new Date($('#quoteValidUntil').value+'T23:59:59').toISOString() : null;
  const qPayload={request_id:currentRequest.request_id,title:$('#quoteTitle').value.trim(),summary:$('#quoteSummary').value.trim()||null,status:publish?'ready':'draft',valid_until:valid,ready_at:publish?new Date().toISOString():null,total_amount:Math.min(...options.map(o=>o.total_amount)),deposit_amount:Math.min(...options.map(o=>o.deposit_amount||o.total_amount))};
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
    const resp=await fetch('/api/send-quote-ready',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+(session?.access_token||'')},body:JSON.stringify({quote_id:quoteId})});
    if(!resp.ok) toast('Quote published, but the email could not be sent.',true); else toast('Quote published and emailed to the client.');
  } else toast('Quote draft saved.');
  await loadRequests();
  if(currentRequest) {
    const refreshed=(await supabase.from('travel_requests').select('request_id,travel_quotes(quote_id,title,summary,status,valid_until,total_amount,deposit_amount,travel_quote_options(*))').eq('request_id',currentRequest.request_id).maybeSingle()).data;
    if(refreshed?.travel_quotes){ currentQuote=(refreshed.travel_quotes||[]).find(q=>!['declined','expired','withdrawn'].includes(q.status))||currentQuote; }
    await loadQuoteItems();
  }
}
$('#saveQuoteButton')?.addEventListener('click',()=>saveQuote(false));
$('#previewQuoteButton')?.addEventListener('click',()=>{
  const quoteId=$('#quoteId')?.value || currentQuote?.quote_id || '';
  if(!quoteId) return toast('Save the quote first, then preview the proposal.',true);
  window.open('/proposal?quote='+encodeURIComponent(quoteId),'_blank','noopener');
});
$('#pdfQuoteButton')?.addEventListener('click',async()=>{
  const quoteId=$('#quoteId')?.value || currentQuote?.quote_id || '';
  if(!quoteId) return toast('Save the quote first, then download the PDF.',true);
  if(typeof window.html2pdf!=='function') return toast('PDF generator is still loading. Refresh once and try again.',true);

  const button=$('#pdfQuoteButton');
  button.disabled=true; button.textContent='Creating PDF…';
  let root=null;
  try{
    const {data:q,error}=await supabase.from('travel_quotes')
      .select('quote_id,title,summary,status,valid_until,travel_quote_options(option_id,name,description,total_amount,deposit_amount,is_recommended,sort_order,travel_quote_items(item_id,category,title,description,amount,quantity,sort_order,details))')
      .eq('quote_id',quoteId).maybeSingle();
    if(error||!q) throw new Error(error?.message||'Quote could not be loaded.');

    const opts=(q.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order);
    const safeName=String(q.title||'TRV-Travel-Proposal').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'TRV-Travel-Proposal';

    root=document.createElement('div');
    root.id='trvPdfRender';
    root.style.cssText='position:absolute;left:0;top:0;width:1100px;background:#f7f3fb;color:#30243e;font-family:"Segoe UI",Arial,sans-serif;margin:0;padding:0;z-index:2147483647';

    const hero=document.createElement('section');
    hero.style.cssText='background:linear-gradient(135deg,#1a0533,#4c1d6f);color:#fff;padding:54px 58px 48px';
    hero.innerHTML=
      '<div style="max-width:960px;margin:0 auto">'+
        '<div style="text-transform:uppercase;letter-spacing:.12em;font-size:12px;color:#d8b4fe;font-weight:800">Your Personalized TRV Proposal</div>'+
        '<h1 style="font-size:52px;line-height:1.05;margin:12px 0 28px;font-weight:800;color:#fff">'+esc(q.title||'Your Travel Proposal')+'</h1>'+
        '<div style="max-width:900px;line-height:1.7;color:#eee2f7;font-size:17px">'+esc(q.summary||'')+'</div>'+
      '</div>';
    root.appendChild(hero);

    const shell=document.createElement('main');
    shell.style.cssText='max-width:960px;margin:0 auto;padding:34px 0 54px';

    const meta=document.createElement('div');
    meta.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin-bottom:26px';
    if(q.valid_until){
      const pill=document.createElement('span');
      pill.style.cssText='background:#eee5f7;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:700';
      pill.textContent='Valid through '+new Date(q.valid_until).toLocaleDateString();
      meta.appendChild(pill);
    }
    const status=document.createElement('span');
    status.style.cssText='background:#eee5f7;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:700';
    status.textContent='Status: '+String(q.status||'ready').replaceAll('_',' ');
    meta.appendChild(status);
    shell.appendChild(meta);

    opts.forEach(o=>{
      const wrap=document.createElement('article');
      wrap.style.cssText='background:#fff;border:'+(o.is_recommended?'2px solid #7c3aed':'1px solid #e5dcec')+';border-radius:20px;padding:26px;margin:18px 0;box-shadow:0 10px 30px rgba(55,30,75,.06)';

      const title=document.createElement('div');
      title.innerHTML=
        '<h2 style="color:#1a0533;margin:0 0 9px;font-size:26px">'+esc(o.name||'Travel Option')+(o.is_recommended?' · Recommended':'')+'</h2>'+
        (o.description?'<div style="color:#6d6273;line-height:1.7;font-size:16px;margin-bottom:14px">'+esc(o.description)+'</div>':'');
      wrap.appendChild(title);

      const items=(o.travel_quote_items||[]).sort((a,b)=>a.sort_order-b.sort_order);
      const itemsBox=document.createElement('div');
      itemsBox.style.cssText='display:grid;gap:14px;margin:18px 0';

      items.forEach(i=>{
        const card=document.createElement('section');
        card.style.cssText='border:1px solid #eadff2;border-radius:14px;padding:17px;background:#fff;break-inside:avoid;page-break-inside:avoid';

        const details=i.details&&Object.keys(i.details).length
          ? '<div style="margin-top:10px;background:#faf7fc;border-radius:10px;padding:11px;font-size:13px;line-height:1.7">'+
              Object.entries(i.details).map(([k,v])=>'<div><strong>'+esc(k)+':</strong> '+esc(v)+'</div>').join('')+
            '</div>'
          :'';

        card.innerHTML=
          '<div style="display:flex;justify-content:space-between;gap:18px;align-items:flex-start">'+
            '<div>'+
              '<div style="text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:900;color:#7c3aed">'+esc(String(i.category||'other').replaceAll('_',' '))+'</div>'+
              '<h3 style="margin:4px 0 6px;color:#1a0533;font-size:18px">'+esc(i.title||'')+'</h3>'+
            '</div>'+
            '<div style="font-weight:900;color:#1a0533;white-space:nowrap;font-size:16px">'+(i.amount==null?'Price pending':money(i.amount))+'</div>'+
          '</div>'+
          (i.description?'<div style="color:#6d6273;margin:6px 0;font-size:14px;line-height:1.5">'+esc(i.description)+'</div>':'')+
          details;
        itemsBox.appendChild(card);
      });

      wrap.appendChild(itemsBox);

      const total=document.createElement('div');
      total.style.cssText='border-top:2px solid #ede4f3;margin-top:18px;padding-top:14px;display:flex;justify-content:space-between;align-items:center';
      total.innerHTML='<strong style="color:#1a0533;font-size:16px">Proposal Total</strong><div style="font-size:30px;font-weight:900;color:#6d28d9;white-space:nowrap">'+money(o.total_amount)+'</div>';
      wrap.appendChild(total);

      shell.appendChild(wrap);
    });

    root.appendChild(shell);

    const previousBodyOverflow=document.body.style.overflow;
    const previousScrollX=window.scrollX;
    const previousScrollY=window.scrollY;
    document.body.style.overflow='hidden';
    document.body.appendChild(root);
    window.scrollTo(0,0);

    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

    await window.html2pdf().set({
      margin:[0.18,0.18,0.18,0.18],
      filename:safeName+'.pdf',
      image:{type:'jpeg',quality:0.99},
      html2canvas:{
        scale:1.6,
        useCORS:true,
        backgroundColor:'#f7f3fb',
        scrollX:0,
        scrollY:0,
        windowWidth:1100
      },
      jsPDF:{unit:'in',format:'letter',orientation:'portrait'},
      pagebreak:{
        mode:['css','legacy'],
        avoid:['.proposal-item']
      }
    }).from(root).save();

    toast('PDF downloaded.');
  }catch(error){
    toast(error.message||'PDF could not be created.',true);
  }finally{
    if(root) root.remove();
    document.body.style.overflow=previousBodyOverflow||'';
    window.scrollTo(previousScrollX||0,previousScrollY||0);
    button.disabled=false; button.textContent='Download PDF';
  }
});

$('#publishQuoteButton')?.addEventListener('click',()=>saveQuote(true));
$('#clearQuoteButton')?.addEventListener('click',()=>{
  currentRequest=null;currentQuote=null;
  ['quoteRequestId','quoteId','quoteClient','quoteTitle','quoteSummary','quoteValidUntil','quoteOptions','fulfillmentSupplier','fulfillmentSubtotal','fulfillmentConfirmation'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
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
        supplier_name:$('#fulfillmentSupplier')?.value?.trim()||'',
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

document.querySelectorAll('.admin-tab').forEach(btn=>btn.addEventListener('click',()=>{ if(btn.dataset.tab==='quotes') loadRequests(); }));
loadRequests();
