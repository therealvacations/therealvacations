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
  window.scrollTo({top:0,behavior:'smooth'});
}
async function saveQuote(publish=false){
  if(!currentRequest) return toast('Select a travel request first.',true);
  const options=parseOptions(); if(!$('#quoteTitle').value.trim()||!options.length) return toast('Add a quote title and at least one option.',true);
  const valid=$('#quoteValidUntil').value ? new Date($('#quoteValidUntil').value+'T23:59:59').toISOString() : null;
  const qPayload={request_id:currentRequest.request_id,title:$('#quoteTitle').value.trim(),summary:$('#quoteSummary').value.trim()||null,status:publish?'ready':'draft',valid_until:valid,ready_at:publish?new Date().toISOString():null,total_amount:Math.min(...options.map(o=>o.total_amount)),deposit_amount:Math.min(...options.map(o=>o.deposit_amount||o.total_amount))};
  let quoteId=$('#quoteId').value;
  if(quoteId){
    const {error}=await supabase.from('travel_quotes').update(qPayload).eq('quote_id',quoteId); if(error) return toast(error.message,true);
    const {error:delErr}=await supabase.from('travel_quote_options').delete().eq('quote_id',quoteId); if(delErr) return toast(delErr.message,true);
  }else{
    const {data,error}=await supabase.from('travel_quotes').insert(qPayload).select('quote_id').single(); if(error) return toast(error.message,true);
    quoteId=data.quote_id; $('#quoteId').value=quoteId;
  }
  const {error:optErr}=await supabase.from('travel_quote_options').insert(options.map(o=>({...o,quote_id:quoteId}))); if(optErr) return toast(optErr.message,true);
  await supabase.from('travel_requests').update({status:publish?'quote_ready':'quote_in_progress'}).eq('request_id',currentRequest.request_id);
  if(publish){
    const {data:{session}}=await supabase.auth.getSession();
    const resp=await fetch('/api/send-quote-ready',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+(session?.access_token||'')},body:JSON.stringify({quote_id:quoteId})});
    if(!resp.ok) toast('Quote published, but the email could not be sent.',true); else toast('Quote published and emailed to the client.');
  } else toast('Quote draft saved.');
  await loadRequests();
}
$('#saveQuoteButton')?.addEventListener('click',()=>saveQuote(false));
$('#publishQuoteButton')?.addEventListener('click',()=>saveQuote(true));
$('#clearQuoteButton')?.addEventListener('click',()=>{
  currentRequest=null;currentQuote=null;
  ['quoteRequestId','quoteId','quoteClient','quoteTitle','quoteSummary','quoteValidUntil','quoteOptions','fulfillmentSupplier','fulfillmentSubtotal','fulfillmentConfirmation'].forEach(id=>{const e=$('#'+id);if(e)e.value='';});
  if($('#fulfillmentFee')) $('#fulfillmentFee').value='0.00';
  if($('#fulfillmentStatus')) $('#fulfillmentStatus').textContent='Select a request to view payment readiness.';
  if($('#openConfirmedPaymentLink')){$('#openConfirmedPaymentLink').style.display='none';$('#openConfirmedPaymentLink').href='#';}
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
