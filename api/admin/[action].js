import { createClient } from '@supabase/supabase-js';

const cents = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

function form(values){
  const p=new URLSearchParams();
  Object.entries(values).forEach(([k,v])=>{
    if(v!==undefined&&v!==null&&v!=='') p.append(k,String(v));
  });
  return p;
}

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const actions = {
  'configure-custom-payment': configureCustomPayment,
  'create-confirmed-payment-link': createConfirmedPaymentLink,
  'invite-supplier': inviteSupplier,
  'record-log': recordLog,
  'request-email-change': requestEmailChange,
  'reset-quote-response': resetQuoteResponse,
  'stripe-account': stripeAccount,
};

export default async function handler(req,res){
  const action = req.query.action;
  const fn = actions[action];
  if(!fn) return res.status(404).json({error:'Not found'});
  return fn(req,res);
}

async function configureCustomPayment(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const bookingId=String(req.body?.custom_booking_id||'').trim();
  const travelBase=cents(req.body?.trip_base_amount);
  const processing=cents(req.body?.extended_payment_processing_amount);
  const travelDown=cents(req.body?.travel_down_payment_amount);
  const dueNow=cents(req.body?.due_now_amount);
  const nextAmount=cents(req.body?.next_payment_amount);
  const finalAmount=cents(req.body?.final_balance_amount);
  const nextDate=String(req.body?.next_payment_date||'').trim();
  const finalDate=String(req.body?.final_balance_due_date||'').trim();
  const externalUrl=String(req.body?.external_payment_url||'').trim();

  if(!bookingId) return res.status(422).json({error:'Booking is required.'});
  for(const [label,value] of [['Trip total',travelBase],['Processing amount',processing],['Travel down payment',travelDown],['Due now',dueNow],['Next payment',nextAmount],['Final balance',finalAmount]]){
    if(!Number.isInteger(value)||value<0) return res.status(422).json({error:label+' is invalid.'});
  }
  if(dueNow!==travelDown+processing) return res.status(422).json({error:'Due now must equal the travel down payment plus Extended Payment Processing.'});
  const remainingTravel=travelBase-travelDown;
  if(remainingTravel<0) return res.status(422).json({error:'Travel down payment cannot exceed the trip total.'});
  if(nextAmount+finalAmount!==remainingTravel) return res.status(422).json({error:'The two remaining payments must equal the remaining travel balance.'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)||!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return res.status(422).json({error:'Enter both payment dates.'});
  if(new Date(nextDate+'T00:00:00Z')>=new Date(finalDate+'T00:00:00Z')) return res.status(422).json({error:'Final balance date must be after the next payment date.'});
  if(!/^https:\/\//i.test(externalUrl)) return res.status(422).json({error:'Enter a secure https payment link.'});

  const {data:booking,error:bookingError}=await admin.from('custom_bookings')
    .select('custom_booking_id,quote_id,request_id,user_id,amount_paid')
    .eq('custom_booking_id',bookingId).maybeSingle();
  if(bookingError||!booking) return res.status(404).json({error:'Approved booking not found.'});
  if(Number(booking.amount_paid||0)>0) return res.status(409).json({error:'This payment setup cannot replace a booking that already has a recorded payment.'});

  const totalWithProcessing=travelBase+processing;
  const snapshot={
    payment_provider:'paypal_external',
    external_payment_url:externalUrl,
    trip_base_amount:travelBase,
    travel_down_payment_amount:travelDown,
    extended_payment_processing_amount:processing,
    due_now_amount:dueNow,
    remaining_travel_balance:remainingTravel,
    next_payment_date:nextDate,
    next_payment_amount:nextAmount,
    final_balance_due_date:finalDate,
    final_balance_amount:finalAmount,
    payment_page_mode:'trv_branded_external_handoff',
    one_time_exception:true
  };

  const {error:updateError}=await admin.from('custom_bookings').update({
    total_amount:totalWithProcessing,
    deposit_amount:dueNow,
    balance_due:totalWithProcessing,
    payment_plan:'deposit',
    selection_snapshot:snapshot,
    updated_at:new Date().toISOString()
  }).eq('custom_booking_id',bookingId);
  if(updateError) return res.status(500).json({error:'Payment setup could not be saved.'});

  await admin.from('custom_booking_payments').delete().eq('custom_booking_id',bookingId).eq('status','open');
  const {data:payment,error:paymentError}=await admin.from('custom_booking_payments').insert({
    custom_booking_id:bookingId,
    amount:dueNow,
    kind:'deposit',
    status:'open',
    updated_at:new Date().toISOString()
  }).select('payment_id').single();
  if(paymentError) return res.status(500).json({error:'Payment request could not be prepared.'});

  await admin.from('admin_client_history').insert({
    user_id:booking.user_id,
    request_id:booking.request_id,
    quote_id:booking.quote_id,
    entry_type:'payment_requested',
    note:'Admin prepared a TRV payment plan. Due now: '+(dueNow/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+
      ', including '+(processing/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+
      ' Extended Payment Processing. Remaining travel payments: '+(nextAmount/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+
      ' due '+nextDate+' and '+(finalAmount/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+' due '+finalDate+'.',
    metadata:{custom_booking_id:bookingId,payment_id:payment.payment_id,...snapshot},
    occurred_at:new Date().toISOString(),
    created_by:user.id,
    actor_type:'admin',
    actor_user_id:user.id,
    actor_label:'TRV Admin'
  });

  return res.status(200).json({ok:true,custom_booking_id:bookingId,payment_id:payment.payment_id,total_amount:totalWithProcessing,balance_due:totalWithProcessing});
}

async function createConfirmedPaymentLink(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey=process.env.STRIPE_SECRET_KEY;
  const siteUrl=(process.env.PUBLIC_SITE_URL||'https://therealvacations.com').replace(/\/$/,'');
  if(!supabaseUrl||!serviceKey||!stripeKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:isAdmin}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!isAdmin) return res.status(403).json({error:'Administrator access required'});

  const requestId=String(req.body?.request_id||'');
  const supplierId=req.body?.supplier_id?String(req.body.supplier_id):null;
  const supplierName=String(req.body?.supplier_name||'').trim();
  const confirmationDetails=String(req.body?.confirmation_details||'').trim();
  const supplierSubtotal=Number(req.body?.supplier_subtotal);
  const serviceFee=Number(req.body?.service_fee||0);

  if(!requestId || !Number.isInteger(supplierSubtotal) || !Number.isInteger(serviceFee) || supplierSubtotal<0 || serviceFee<0){
    return res.status(422).json({error:'Enter valid confirmed amounts'});
  }

  let supplierRecord=null;
  if(supplierId){
    const {data:supplier,error:supplierError}=await admin.from('suppliers').select('supplier_id,company_name,display_name,status').eq('supplier_id',supplierId).maybeSingle();
    if(supplierError||!supplier||supplier.status==='inactive') return res.status(422).json({error:'Choose an active supplier'});
    supplierRecord=supplier;
  }

  const {data:prepared,error:prepError}=await admin.rpc('prepare_travel_request_charge',{
    p_request_id:requestId,
    p_supplier_name:supplierName||supplierRecord?.display_name||supplierRecord?.company_name||'',
    p_supplier_subtotal:supplierSubtotal,
    p_service_fee:serviceFee,
    p_confirmation_details:confirmationDetails,
  });
  const row=Array.isArray(prepared)?prepared[0]:prepared;
  if(prepError||!row){
    return res.status(409).json({error:prepError?.message||'This request is not ready for confirmed payment'});
  }

  if(supplierId){
    await admin.from('travel_request_fulfillments').update({supplier_id:supplierId,updated_at:new Date().toISOString()}).eq('fulfillment_id',row.fulfillment_id);
  }

  const {data:travelRequest}=await admin.from('travel_requests')
    .select('requester_email,primary_first_name,destination')
    .eq('request_id',requestId).maybeSingle();
  if(!travelRequest?.requester_email){
    await admin.from('travel_request_fulfillments').update({status:'failed',failure_message:'Traveler email missing',updated_at:new Date().toISOString()}).eq('fulfillment_id',row.fulfillment_id);
    return res.status(409).json({error:'Traveler email is missing'});
  }

  const values={
    mode:'payment',
    customer:row.stripe_customer_id,
    client_reference_id:requestId,
    'line_items[0][price_data][currency]':row.currency||'usd',
    'line_items[0][price_data][product_data][name]':supplierName||supplierRecord?.display_name||supplierRecord?.company_name||'Confirmed travel arrangements',
    'line_items[0][price_data][unit_amount]':supplierSubtotal,
    'line_items[0][quantity]':1,
    'metadata[checkout_type]':'travel_request_fulfillment',
    'metadata[request_id]':requestId,
    'metadata[fulfillment_id]':row.fulfillment_id,
    'metadata[user_id]':row.user_id,
    'payment_intent_data[metadata][checkout_type]':'travel_request_fulfillment',
    'payment_intent_data[metadata][request_id]':requestId,
    'payment_intent_data[metadata][fulfillment_id]':row.fulfillment_id,
    success_url:siteUrl+'/request-payment-result?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:siteUrl+'/my-trips',
  };
  if(serviceFee>0){
    values['line_items[1][price_data][currency]']=row.currency||'usd';
    values['line_items[1][price_data][product_data][name]']='The Real Vacations service fee';
    values['line_items[1][price_data][unit_amount]']=serviceFee;
    values['line_items[1][quantity]']=1;
  }

  const stripeResponse=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',
    headers:{authorization:'Bearer '+stripeKey,'content-type':'application/x-www-form-urlencoded'},
    body:form(values),
  });
  const session=await stripeResponse.json().catch(()=>({}));
  if(!stripeResponse.ok||!session.id||!session.url){
    await admin.from('travel_request_fulfillments').update({
      status:'failed',
      failure_code:String(session?.error?.code||'checkout_create_failed').slice(0,120),
      failure_message:String(session?.error?.message||'Stripe checkout could not be created').slice(0,500),
      updated_at:new Date().toISOString()
    }).eq('fulfillment_id',row.fulfillment_id);
    return res.status(502).json({error:String(session?.error?.message||'Stripe payment completion could not be created')});
  }

  await admin.from('travel_request_fulfillments').update({
    status:'requires_customer_action',
    stripe_checkout_session_id:session.id,
    updated_at:new Date().toISOString(),
  }).eq('fulfillment_id',row.fulfillment_id);

  try{
    await fetch(`${supabaseUrl}/functions/v1/send-email`,{
      method:'POST',
      headers:{authorization:`Bearer ${serviceKey}`,apikey:serviceKey,'content-type':'application/json'},
      body:JSON.stringify({
        template_type:'request_payment_ready',
        request_id:requestId,
        fulfillment_id:row.fulfillment_id,
        checkout_url:session.url,
        event_id:'request-payment-ready-'+session.id,
      })
    });
  }catch(emailError){
    console.error('Confirmed payment email failed',emailError);
  }

  return res.status(200).json({
    ok:true,
    fulfillment_id:row.fulfillment_id,
    checkout_url:session.url,
    total_amount:row.total_amount,
    status:'requires_customer_action',
  });
}

async function inviteSupplier(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Administrator access required'});

  const supplierId=String(req.body?.supplier_id||'');
  const {data:supplier,error:supplierError}=await admin.from('suppliers').select('*').eq('supplier_id',supplierId).maybeSingle();
  if(supplierError||!supplier) return res.status(404).json({error:'Supplier not found'});

  const email=String(supplier.contact_email||supplier.invite_email||'').trim().toLowerCase();
  if(!email) return res.status(422).json({error:'Add a supplier email first'});

  const redirectTo='https://therealvacations.com/supplier-portal?invited=1';

  if(supplier.auth_user_id){
    const {error:otpError}=await admin.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:false,emailRedirectTo:redirectTo}
    });
    if(otpError) return res.status(502).json({error:otpError.message||'Supplier access email could not be sent'});
    await admin.from('suppliers').update({
      status:'connected',
      invite_email:email,
      invited_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq('supplier_id',supplierId);
    return res.status(200).json({ok:true,connected:true});
  }

  let existing=null;
  for(let page=1;page<=5&&!existing;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:200});
    if(error) break;
    existing=(data?.users||[]).find(u=>String(u.email||'').toLowerCase()===email)||null;
    if((data?.users||[]).length<200) break;
  }

  if(existing){
    const {error:linkError}=await admin.from('suppliers').update({
      auth_user_id:existing.id,
      invite_email:email,
      status:'connected',
      connected_at:new Date().toISOString(),
      invited_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq('supplier_id',supplierId);
    if(linkError) return res.status(500).json({error:'Supplier account could not be linked'});
    const {error:otpError}=await admin.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:false,emailRedirectTo:redirectTo}
    });
    if(otpError) return res.status(502).json({error:otpError.message||'Supplier access email could not be sent'});
    return res.status(200).json({ok:true,connected:true});
  }

  const {data:invite,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{
    redirectTo,
    data:{account_type:'supplier',supplier_id:supplierId,company_name:supplier.company_name}
  });
  if(inviteError) return res.status(502).json({error:inviteError.message||'Supplier invite could not be sent'});

  const invitedUser=invite?.user||null;
  const {error:updateError}=await admin.from('suppliers').update({
    auth_user_id:invitedUser?.id||null,
    invite_email:email,
    status:'invited',
    invited_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('supplier_id',supplierId);
  if(updateError) return res.status(500).json({error:'Invite sent but supplier profile could not be updated'});

  return res.status(200).json({ok:true,connected:false});
}

async function recordLog(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:isAdmin}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!isAdmin) return res.status(403).json({error:'Administrator access required'});

  const q=String(req.query.q||'').trim();
  const table=String(req.query.table||'').trim();
  let query=admin.from('trv_record_log')
    .select('record_id,table_name,operation,source_record_id,actor_user_id,changed_fields,occurred_at')
    .order('occurred_at',{ascending:false})
    .limit(200);

  if(table) query=query.eq('table_name',table);
  if(q){
    const safe=q.replace(/[%(),]/g,'').slice(0,120);
    query=query.or('record_id.ilike.%'+safe+'%,source_record_id.ilike.%'+safe+'%,table_name.ilike.%'+safe+'%');
  }
  const {data,error}=await query;
  if(error) return res.status(500).json({error:error.message});
  return res.status(200).json({records:data||[]});
}

async function requestEmailChange(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey=process.env.RESEND_API_KEY;
  const fromEmail=process.env.RESEND_FROM_EMAIL||'kc@therealvacations.com';
  const fromName=process.env.RESEND_FROM_NAME||'The Real Vacations';
  const siteUrl=(process.env.PUBLIC_SITE_URL||'https://therealvacations.com').replace(/\/$/,'');
  if(!serviceKey||!resendKey) return res.status(500).json({error:'Server configuration error'});

  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!bearer) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(bearer);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const requestId=String(req.body?.request_id||'').trim();
  const newEmail=String(req.body?.new_email||'').trim().toLowerCase();
  if(!requestId||!newEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({error:'A valid new email is required'});

  const {data:travelRequest,error:requestError}=await admin.from('travel_requests')
    .select('request_id,user_id,primary_first_name,requester_email')
    .eq('request_id',requestId).maybeSingle();
  if(requestError||!travelRequest) return res.status(404).json({error:'Travel request not found'});
  if(!travelRequest.user_id) return res.status(409).json({error:'This request is not linked to a member account. Update the requester email instead.'});

  const {data:userResult,error:authError}=await admin.auth.admin.getUserById(travelRequest.user_id);
  const member=userResult?.user;
  if(authError||!member?.email) return res.status(409).json({error:'The linked member account email could not be found'});
  if(member.email.toLowerCase()===newEmail) return res.status(409).json({error:'That is already the member login email'});

  const profileUrl=siteUrl+'/member-profile?new_email='+encodeURIComponent(newEmail);
  const firstName=travelRequest.primary_first_name||'Traveler';
  const html=`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f1f7;color:#30243e;margin:0;padding:30px">
    <div style="max-width:620px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:#1a0533;color:#fff;padding:24px 30px"><strong style="font-size:22px">The Real Vacations</strong></div>
      <div style="padding:30px">
        <h1 style="font-size:24px;color:#1a0533">Update your TRV login email</h1>
        <p>Hi ${esc(firstName)},</p>
        <p>TRV Admin received a request to change the login email for your account to <strong>${esc(newEmail)}</strong>.</p>
        <p>For your security, Admin cannot silently replace your login address. Sign in to your TRV account and confirm the change from your Profile page.</p>
        <p><a href="${profileUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold">Review Email Change →</a></p>
        <p style="font-size:13px;color:#6b6270">After you submit the change, the required authentication confirmation must be completed before your login email changes. Your existing trips, quotes, and payments remain attached to the same account.</p>
        <p style="font-size:12px;color:#777;margin-top:28px">If you did not request this change, you can ignore this message and contact The Real Vacations.</p>
      </div>
    </div>
  </body></html>`;

  const send=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json'},
    body:JSON.stringify({
      to:[member.email],
      from:`${fromName} <${fromEmail}>`,
      subject:'Confirm your TRV account email change',
      html,
      tags:[{name:'category',value:'trv-transactional'},{name:'template',value:'account-email-change-request'}]
    })
  });
  const provider=await send.json().catch(()=>({}));
  if(!send.ok) return res.status(502).json({error:provider?.message||'Email provider rejected the message'});

  return res.status(200).json({ok:true,current_email:member.email,new_email:newEmail,message_id:provider?.id||null});
}

async function resetQuoteResponse(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!bearer) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(bearer);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const quoteId=String(req.body?.quote_id||'').trim();
  if(!quoteId) return res.status(400).json({error:'Quote ID is required'});

  const {data:quote,error:quoteError}=await admin.from('travel_quotes')
    .select('quote_id,request_id,status')
    .eq('quote_id',quoteId).maybeSingle();
  if(quoteError||!quote) return res.status(404).json({error:'Quote not found'});

  const {data:booking}=await admin.from('custom_bookings')
    .select('custom_booking_id,amount_paid')
    .eq('quote_id',quoteId).maybeSingle();

  if(booking){
    if(Number(booking.amount_paid||0)>0) return res.status(409).json({error:'This quote has a payment recorded and cannot be reset from Admin.'});
    const {data:succeeded}=await admin.from('custom_booking_payments')
      .select('payment_id').eq('custom_booking_id',booking.custom_booking_id).eq('status','succeeded').limit(1);
    if(succeeded?.length) return res.status(409).json({error:'This quote has a successful payment and cannot be reset from Admin.'});
    const {error:deleteBookingError}=await admin.from('custom_bookings').delete().eq('custom_booking_id',booking.custom_booking_id);
    if(deleteBookingError) return res.status(500).json({error:'Unable to remove the unpaid booking'});
  }

  const {error:responseError}=await admin.from('travel_quote_responses').delete().eq('quote_id',quoteId);
  if(responseError) return res.status(500).json({error:'Unable to reset the traveler response'});

  const {error:quoteUpdateError}=await admin.from('travel_quotes').update({
    status:'ready',
    approved_at:null,
    declined_at:null,
    ready_at:new Date().toISOString()
  }).eq('quote_id',quoteId);
  if(quoteUpdateError) return res.status(500).json({error:'Unable to reopen the quote'});

  const {error:requestUpdateError}=await admin.from('travel_requests').update({status:'quote_ready'}).eq('request_id',quote.request_id);
  if(requestUpdateError) return res.status(500).json({error:'Quote reset, but the request status could not be updated'});

  return res.status(200).json({ok:true,quote_id:quoteId,status:'ready'});
}

async function stripeAccount(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey=process.env.STRIPE_SECRET_KEY;
  if(!supabaseUrl||!serviceKey||!stripeKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const {data:isAdmin}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!isAdmin) return res.status(403).json({error:'Administrator access required'});

  const stripe=await fetch('https://api.stripe.com/v1/account',{
    headers:{authorization:'Bearer '+stripeKey}
  });
  const account=await stripe.json().catch(()=>({}));
  if(!stripe.ok) return res.status(502).json({error:'Stripe account verification failed'});

  return res.status(200).json({
    account_id:account.id||null,
    business_name:account.business_profile?.name||account.settings?.dashboard?.display_name||null,
    country:account.country||null,
    default_currency:account.default_currency||null,
    charges_enabled:!!account.charges_enabled,
    payouts_enabled:!!account.payouts_enabled,
    livemode:stripeKey.startsWith('sk_live_')
  });
}   
