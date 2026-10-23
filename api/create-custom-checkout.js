import { createClient } from '@supabase/supabase-js';

function encodeForm(obj){
  const p=new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{if(v!==undefined&&v!==null)p.append(k,String(v));});
  return p;
}
export default async function handler(req,res){
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

  const bookingId=String(req.body?.custom_booking_id||'');
  const plan=String(req.body?.payment_plan||'');
  const signer=String(req.body?.signer_name||'').trim();
  if(!bookingId||!['deposit','pay_in_full','balance'].includes(plan)) return res.status(422).json({error:'Choose a valid payment option'});
  if(signer.length<2) return res.status(422).json({error:'Type your full legal name'});

  const {data:booking,error}=await admin.from('custom_bookings')
    .select('custom_booking_id,user_id,status,total_amount,deposit_amount,amount_paid,balance_due,currency,travel_quotes!inner(title,request_id,travel_requests!inner(destination))')
    .eq('custom_booking_id',bookingId).maybeSingle();
  if(error||!booking||booking.user_id!==user.id) return res.status(404).json({error:'Booking not found'});
  if(booking.balance_due<=0) return res.status(409).json({error:'This booking is already paid in full'});

  let amount,kind;
  if(plan==='deposit'){
    if(booking.amount_paid>0) return res.status(409).json({error:'The deposit has already been paid'});
    if(!booking.deposit_amount||booking.deposit_amount<=0) return res.status(409).json({error:'This quote does not have a deposit option'});
    amount=Math.min(booking.deposit_amount,booking.balance_due); kind='deposit';
  }else if(plan==='balance'){ amount=booking.balance_due; kind='balance'; }
  else { amount=booking.balance_due; kind='pay_in_full'; }

  // Reserve a payment row under a booking lock. Stripe's stable idempotency
  // key ensures that simultaneous requests reuse the SAME Checkout Session.
  let payment;
  for(let attempt=0;attempt<2;attempt++){
    const {data:rows,error:reserveError}=await admin.rpc('reserve_custom_checkout_payment',{
      p_booking_id:bookingId,p_user_id:user.id,p_plan:plan
    });
    if(reserveError||!rows?.length) return res.status(409).json({error:'Unable to prepare payment'});
    payment=rows[0];
    if(!payment.checkout_session_id) break;
    const existingResponse=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(payment.checkout_session_id),{
      headers:{authorization:'Bearer '+stripeKey}
    });
    const existing=await existingResponse.json().catch(()=>({}));
    if(!existingResponse.ok) return res.status(502).json({error:'Unable to check existing checkout'});
    if(existing.status==='open'&&existing.url) return res.status(200).json({url:existing.url});
    if(existing.payment_status==='paid') return res.status(409).json({error:'This payment is complete or awaiting booking confirmation'});
    const {error:expireError}=await admin.from('custom_booking_payments')
      .update({status:'expired',updated_at:new Date().toISOString()})
      .eq('payment_id',payment.payment_id).eq('stripe_checkout_session_id',existing.id).eq('status','open');
    if(expireError) return res.status(500).json({error:'Unable to refresh expired checkout'});
    payment=null;
  }
  if(!payment) return res.status(409).json({error:'Please retry checkout'});
  const title=booking.travel_quotes?.title||booking.travel_quotes?.travel_requests?.destination||'The Real Vacations Custom Trip';
  const form=encodeForm({
    mode:'payment',
    customer_email:user.email,
    client_reference_id:bookingId,
    'consent_collection[terms_of_service]':'required',
    'line_items[0][price_data][currency]':booking.currency||'usd',
    'line_items[0][price_data][product_data][name]':title+' — '+(kind==='deposit'?'Deposit':kind==='balance'?'Remaining Balance':'Pay in Full'),
    'line_items[0][price_data][unit_amount]':amount,
    'line_items[0][quantity]':1,
    'metadata[checkout_type]':'custom_quote',
    'metadata[custom_booking_id]':bookingId,
    'metadata[payment_id]':payment.payment_id,
    'metadata[user_id]':user.id,
    'payment_intent_data[metadata][checkout_type]':'custom_quote',
    'payment_intent_data[metadata][custom_booking_id]':bookingId,
    'payment_intent_data[metadata][payment_id]':payment.payment_id,
    success_url:siteUrl+'/custom-payment-result?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:siteUrl+'/quote-checkout?booking='+encodeURIComponent(bookingId)
  });
  const stripe=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',
    headers:{authorization:'Bearer '+stripeKey,'content-type':'application/x-www-form-urlencoded','Idempotency-Key':'trv-custom-checkout-'+payment.payment_id},
    body:form
  });
  const session=await stripe.json().catch(()=>({}));
  if(!stripe.ok||!session.id||!session.url){
    // Leave reservation available for a safe retry; do not create another payment row.
    console.error('Stripe custom checkout error', {type:session?.error?.type,code:session?.error?.code,message:session?.error?.message,status:stripe.status});
    return res.status(502).json({error:session?.error?.message||'Stripe checkout could not be created'});
  }
  const {error:sessionSaveError}=await admin.from('custom_booking_payments')
    .update({stripe_checkout_session_id:session.id})
    .eq('payment_id',payment.payment_id).eq('status','open');
  if(sessionSaveError) return res.status(500).json({error:'Checkout created but could not be linked. Please retry.'});
  await admin.from('custom_bookings').update({payment_plan:kind,updated_at:new Date().toISOString()}).eq('custom_booking_id',bookingId);
  return res.status(200).json({url:session.url});
}
