import { createClient } from '@supabase/supabase-js';

async function stripeGet(path, secretKey) {
  const response = await fetch('https://api.stripe.com/v1' + path, {
    headers: { authorization: 'Bearer ' + secretKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
}

const actions = {
  'confirm-custom': confirmCustomPayment,
  'confirm-request': confirmRequestPayment,
  'save-method': savePaymentMethod,
  'update-vip-gift': updateVipGift,
};

export default async function handler(req,res){
  const action = req.query.action;
  const fn = actions[action];
  if(!fn) return res.status(404).json({error:'Not found'});
  return fn(req,res);
}

async function confirmCustomPayment(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co'), serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY, stripeKey=process.env.STRIPE_SECRET_KEY;
  if(!supabaseUrl||!serviceKey||!stripeKey) return res.status(500).json({error:'Server configuration error'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const sessionId=String(req.body?.session_id||'');
  if(!token||!sessionId) return res.status(401).json({error:'Unauthorized'});
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const stripe=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId),{
    headers:{authorization:'Bearer '+stripeKey}
  });
  const session=await stripe.json().catch(()=>({}));
  if(!stripe.ok) return res.status(502).json({error:'Unable to verify payment'});
  if(session.payment_status!=='paid') return res.status(409).json({error:'Payment is not complete'});
  if(session.metadata?.checkout_type!=='custom_quote'||session.metadata?.user_id!==user.id) return res.status(403).json({error:'Payment does not belong to this account'});

  const paymentId=session.metadata?.payment_id;
  const bookingId=session.metadata?.custom_booking_id;
  const {data:payment}=await admin.from('custom_booking_payments').select('*').eq('payment_id',paymentId).eq('custom_booking_id',bookingId).maybeSingle();
  const {data:booking}=await admin.from('custom_bookings').select('*').eq('custom_booking_id',bookingId).eq('user_id',user.id).maybeSingle();
  if(!payment||!booking) return res.status(404).json({error:'Payment record not found'});

  if(payment.status!=='succeeded'){
    const {data:claimed}=await admin.from('custom_booking_payments').update({
      status:'succeeded',
      stripe_payment_intent_id:typeof session.payment_intent==='string'?session.payment_intent:null,
      paid_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq('payment_id',payment.payment_id).neq('status','succeeded').select('payment_id').maybeSingle();

    if(claimed){
      const paid=Math.min(booking.total_amount,Number(booking.amount_paid||0)+Number(payment.amount||0));
      const balance=Math.max(0,booking.total_amount-paid);
      await admin.from('custom_bookings').update({
        amount_paid:paid,balance_due:balance,status:balance===0?'paid_in_full':'deposit_paid',updated_at:new Date().toISOString()
      }).eq('custom_booking_id',booking.custom_booking_id);
    }
  }
  const {data:finalBooking}=await admin.from('custom_bookings').select('custom_booking_id,status,total_amount,amount_paid,balance_due').eq('custom_booking_id',bookingId).single();
  return res.status(200).json({ok:true,booking:finalBooking});
}

async function confirmRequestPayment(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey=process.env.STRIPE_SECRET_KEY;
  if(!serviceKey||!stripeKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Sign in required'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Sign in required'});

  const sessionId=String(req.body?.session_id||'').trim();
  if(!/^cs_/.test(sessionId)) return res.status(422).json({error:'A valid Stripe checkout session is required'});

  let session;
  try{session=await stripeGet('/checkout/sessions/'+encodeURIComponent(sessionId),stripeKey);}
  catch(error){return res.status(409).json({error:error.message||'Payment session could not be verified'});}

  if(session.metadata?.checkout_type!=='travel_request_fulfillment'){
    return res.status(409).json({error:'This is not a TRV confirmed-request payment session'});
  }
  if(session.metadata?.user_id!==user.id){
    return res.status(403).json({error:'This payment session belongs to another TRV account'});
  }

  const fulfillmentId=String(session.metadata?.fulfillment_id||'');
  const requestId=String(session.metadata?.request_id||'');
  const {data:fulfillment,error}=await admin.from('travel_request_fulfillments')
    .select('fulfillment_id,request_id,user_id,supplier_name,total_amount,currency,status,confirmation_details,charged_at,failure_code,failure_message,stripe_payment_intent_id')
    .eq('fulfillment_id',fulfillmentId)
    .eq('user_id',user.id)
    .maybeSingle();
  if(error||!fulfillment) return res.status(404).json({error:'TRV payment record was not found'});

  const stripePaid=session.payment_status==='paid';
  const resolvedStatus=stripePaid?'paid':(session.status==='expired'?'expired':fulfillment.status);
  return res.status(200).json({
    ok:true,
    stripe_status:session.status,
    payment_status:session.payment_status,
    request_id:requestId,
    fulfillment:{
      ...fulfillment,
      status:resolvedStatus
    }
  });
}

async function savePaymentMethod(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = (process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in is required' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user?.email) return res.status(401).json({ error: 'Sign in is required' });

  const setupIntentId = String(req.body?.setup_intent_id || '');
  const cardholderName = String(req.body?.cardholder_name || '').trim();
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) {
    return res.status(422).json({ error: 'Invalid payment setup' });
  }
  if (cardholderName.length < 2 || cardholderName.length > 160) {
    return res.status(422).json({ error: 'Enter the cardholder name' });
  }

  const setupIntent = await stripeGet('/setup_intents/' + encodeURIComponent(setupIntentId), stripeKey);
  if (setupIntent.status !== 'succeeded') {
    return res.status(409).json({ error: 'Card setup is not complete' });
  }
  if (String(setupIntent.metadata?.trv_user_id || '') !== user.id) {
    return res.status(403).json({ error: 'Payment setup does not belong to this account' });
  }

  const paymentMethodId = typeof setupIntent.payment_method === 'string'
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;
  const customerId = typeof setupIntent.customer === 'string'
    ? setupIntent.customer
    : setupIntent.customer?.id;

  if (!paymentMethodId || !customerId) {
    return res.status(409).json({ error: 'Stripe did not return a reusable payment method' });
  }

  const paymentMethod = await stripeGet('/payment_methods/' + encodeURIComponent(paymentMethodId), stripeKey);
  const card = paymentMethod.card;
  if (!card?.last4) return res.status(409).json({ error: 'Saved card details are unavailable' });

  const { data: atomicRows, error: atomicError } = await admin.rpc('save_user_payment_method_atomic', {
    p_user_id: user.id,
    p_customer_id: customerId,
    p_payment_method_id: paymentMethodId,
    p_cardholder_name: cardholderName,
    p_last4: card.last4,
    p_brand: card.brand || null,
    p_exp_month: card.exp_month || null,
    p_exp_year: card.exp_year || null,
    p_stripe_account_id: null
  });

  if (atomicError) {
    console.error('Unable to atomically save payment method', atomicError.message);
    return res.status(500).json({ error: 'Your payment method could not be updated. No TRV payment schedule was changed.' });
  }

  const savedRow = Array.isArray(atomicRows) ? atomicRows[0] : atomicRows;
  if (!savedRow?.method_id) {
    return res.status(500).json({ error: 'Your payment method could not be updated. No TRV payment schedule was changed.' });
  }

  const method = {
    method_id: savedRow.method_id,
    last4: savedRow.last4,
    brand: savedRow.brand,
    exp_month: savedRow.exp_month,
    exp_year: savedRow.exp_year,
    is_default: savedRow.is_default
  };

  return res.status(200).json({
    saved: true,
    method,
    autopay_updated: true,
    updated_booking_schedules: Number(savedRow.updated_bookings || 0),
    updated_traveler_schedules: Number(savedRow.updated_group_members || 0)
  });
}

async function updateVipGift(req,res){
  const clean=v=>String(v??'').trim();

  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co'), serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey) return res.status(500).json({error:'Server configuration error'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const {data:membership}=await admin.from('vip_memberships')
    .select('status,welcome_gift_status,stripe_subscription_id')
    .eq('user_id',user.id).maybeSingle();
  if(!membership||!membership.stripe_subscription_id||!['active','trialing'].includes(membership.status)){
    return res.status(403).json({error:'An active paid TRV VIP membership is required'});
  }

  const shipping={
    name:clean(req.body?.name),
    address1:clean(req.body?.address1),
    address2:clean(req.body?.address2)||null,
    city:clean(req.body?.city),
    state:clean(req.body?.state),
    postal_code:clean(req.body?.postal_code),
    country:clean(req.body?.country)||'US'
  };
  if(!shipping.name||!shipping.address1||!shipping.city||!shipping.state||!shipping.postal_code){
    return res.status(422).json({error:'Complete the required shipping fields'});
  }

  const {error}=await admin.from('vip_memberships').update({
    welcome_gift_shipping:shipping,
    welcome_gift_size:clean(req.body?.size)||null,
    welcome_gift_note:clean(req.body?.note)||null,
    welcome_gift_status:membership.welcome_gift_status==='sent'?'sent':'processing',
    updated_at:new Date().toISOString()
  }).eq('user_id',user.id);
  if(error) return res.status(500).json({error:'Gift details could not be saved'});
  return res.status(200).json({ok:true});
}   
