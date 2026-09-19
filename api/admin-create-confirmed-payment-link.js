import { createClient } from '@supabase/supabase-js';

function form(values){
  const p=new URLSearchParams();
  Object.entries(values).forEach(([k,v])=>{
    if(v!==undefined&&v!==null&&v!=='') p.append(k,String(v));
  });
  return p;
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL;
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
  const supplierName=String(req.body?.supplier_name||'').trim();
  const confirmationDetails=String(req.body?.confirmation_details||'').trim();
  const supplierSubtotal=Number(req.body?.supplier_subtotal);
  const serviceFee=Number(req.body?.service_fee||0);

  if(!requestId || !Number.isInteger(supplierSubtotal) || !Number.isInteger(serviceFee) || supplierSubtotal<0 || serviceFee<0){
    return res.status(422).json({error:'Enter valid confirmed amounts'});
  }

  const {data:prepared,error:prepError}=await admin.rpc('prepare_travel_request_charge',{
    p_request_id:requestId,
    p_supplier_name:supplierName,
    p_supplier_subtotal:supplierSubtotal,
    p_service_fee:serviceFee,
    p_confirmation_details:confirmationDetails,
  });
  const row=Array.isArray(prepared)?prepared[0]:prepared;
  if(prepError||!row){
    return res.status(409).json({error:prepError?.message||'This request is not ready for confirmed payment'});
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
    'payment_method_types[0]':'card',
    'line_items[0][price_data][currency]':row.currency||'usd',
    'line_items[0][price_data][product_data][name]':supplierName||'Confirmed travel arrangements',
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
    return res.status(502).json({error:'Stripe payment completion could not be created'});
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
