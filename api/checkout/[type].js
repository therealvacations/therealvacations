import { createClient } from '@supabase/supabase-js';

function encodeForm(obj){
  const p=new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{if(v!==undefined&&v!==null)p.append(k,String(v));});
  return p;
}

function formEncode(obj){
  const p=new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{ if(v!==undefined&&v!==null) p.append(k,String(v)); });
  return p;
}

function enc(o){const p=new URLSearchParams();Object.entries(o).forEach(([k,v])=>{if(v!==undefined&&v!==null)p.append(k,String(v))});return p}

async function stripeRequest(path, secretKey, options = {}) {
  const response = await fetch('https://api.stripe.com/v1' + path, {
    ...options,
    headers: {
      authorization: 'Bearer ' + secretKey,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
}

const actions = {
  'custom': createCustomCheckout,
  'portal': createCustomerPortal,
  'host': createHostCheckout,
  'vip': createVipCheckout,
  'payment-method-setup': createPaymentMethodSetup,
};

export default async function handler(req,res){
  const type = req.query.type;
  const fn = actions[type];
  if(!fn) return res.status(404).json({error:'Not found'});
  return fn(req,res);
}

async function createCustomCheckout(req,res){
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

  const {data:payment,error:payErr}=await admin.from('custom_booking_payments').insert({
    custom_booking_id:bookingId,amount,kind,status:'open'
  }).select('payment_id').single();
  if(payErr) return res.status(500).json({error:'Unable to prepare payment'});

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
    headers:{authorization:'Bearer '+stripeKey,'content-type':'application/x-www-form-urlencoded'},
    body:form
  });
  const session=await stripe.json().catch(()=>({}));
  if(!stripe.ok||!session.id||!session.url){
    await admin.from('custom_booking_payments').update({status:'failed'}).eq('payment_id',payment.payment_id);
    console.error('Stripe custom checkout error', {type:session?.error?.type,code:session?.error?.code,message:session?.error?.message,status:stripe.status});
    return res.status(502).json({error:session?.error?.message||'Stripe checkout could not be created'});
  }
  await admin.from('custom_booking_payments').update({stripe_checkout_session_id:session.id}).eq('payment_id',payment.payment_id);
  await admin.from('custom_bookings').update({payment_plan:kind,updated_at:new Date().toISOString()}).eq('custom_booking_id',bookingId);
  return res.status(200).json({url:session.url});
}

async function createCustomerPortal(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey=process.env.STRIPE_SECRET_KEY;
  const siteUrl=(process.env.PUBLIC_SITE_URL||'https://therealvacations.com').replace(/\/$/,'');

  if(!supabaseUrl||!serviceKey||!stripeKey){
    return res.status(500).json({error:'Server configuration error'});
  }

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const {data:membership,error:membershipError}=await admin
    .from('vip_memberships')
    .select('stripe_customer_id,stripe_subscription_id,status')
    .eq('user_id',user.id)
    .maybeSingle();

  if(membershipError) return res.status(500).json({error:'Unable to load membership'});
  if(!membership?.stripe_customer_id){
    return res.status(409).json({error:'No Stripe billing profile is connected to this TRV account yet'});
  }

  const stripe=await fetch('https://api.stripe.com/v1/billing_portal/sessions',{
    method:'POST',
    headers:{
      authorization:'Bearer '+stripeKey,
      'content-type':'application/x-www-form-urlencoded'
    },
    body:formEncode({
      customer:membership.stripe_customer_id,
      return_url:siteUrl+'/my-trips'
    })
  });

  const session=await stripe.json().catch(()=>({}));
  if(!stripe.ok||!session.url){
    return res.status(502).json({error:session?.error?.message||'Customer portal could not be opened'});
  }

  return res.status(200).json({url:session.url});
}

async function createHostCheckout(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,stripeKey=process.env.STRIPE_SECRET_KEY,site=(process.env.PUBLIC_SITE_URL||'https://therealvacations.com').replace(/\/$/,'');
  if(!serviceKey||!stripeKey)return res.status(500).json({error:'Server configuration error'});
  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const{data:{user}}=await admin.auth.getUser(token);
  if(!user)return res.status(401).json({error:'Unauthorized'});
  const plan=String(req.body?.plan||'');
  if(!['monthly','annual'].includes(plan))return res.status(422).json({error:'Choose a valid Host plan'});
  const[{data:application},{data:vip}]=await Promise.all([admin.from('host_applications').select('status').eq('user_id',user.id).maybeSingle(),admin.from('vip_memberships').select('status').eq('user_id',user.id).maybeSingle()]);
  if(application?.status!=='approved')return res.status(403).json({error:'TRV Host approval is required before billing'});
  if(!vip||!['active','trialing'].includes(vip.status))return res.status(403).json({error:'An active TRV VIP membership is required for the Host add-on'});
  const amount=plan==='monthly'?1999:14999,interval=plan==='monthly'?'month':'year',lookup=plan==='monthly'?'trv_host_monthly':'trv_host_annual';
  let price=null;
  try{
    const r=await fetch('https://api.stripe.com/v1/prices?active=true&limit=1&lookup_keys[]='+encodeURIComponent(lookup),{headers:{authorization:'Bearer '+stripeKey}});
    const d=await r.json();
    if(r.ok&&d.data?.[0]?.id)price=d.data[0].id
  }catch{}
  await admin.from('host_memberships').upsert({user_id:user.id,status:'inactive',billing_plan:plan,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  const line=price?{'line_items[0][price]':price}:{'line_items[0][price_data][currency]':'usd','line_items[0][price_data][product_data][name]':plan==='monthly'?'TRV Host Add-On — Monthly':'TRV Host Add-On — Annual','line_items[0][price_data][product_data][description]':'TRV Host business tools and hosted-trip program access.','line_items[0][price_data][unit_amount]':amount,'line_items[0][price_data][recurring][interval]':interval};
  const form=enc({mode:'subscription',customer_email:user.email,client_reference_id:user.id,'consent_collection[terms_of_service]':'required',...line,'line_items[0][quantity]':1,'metadata[checkout_type]':'host_membership','metadata[user_id]':user.id,'metadata[billing_plan]':plan,'subscription_data[metadata][checkout_type]':'host_membership','subscription_data[metadata][user_id]':user.id,'subscription_data[metadata][billing_plan]':plan,success_url:site+'/host-center?joined=1',cancel_url:site+'/host-center?cancelled=1'});
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{authorization:'Bearer '+stripeKey,'content-type':'application/x-www-form-urlencoded'},body:form});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.url)return res.status(502).json({error:'Host checkout could not be started'});
  return res.status(200).json({url:d.url})
}

async function createVipCheckout(req,res){
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

  const {data:qualifyingBooking}=await admin.from('bookings')
    .select('booking_id,status,payment_plan,balance_due,created_at')
    .eq('user_id',user.id)
    .eq('payment_plan','installments')
    .in('status',['pending','confirmed','partial','payment_due','overdue'])
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  const plan=String(req.body?.plan||'');
  if(!['monthly','annual'].includes(plan)) return res.status(422).json({error:'Choose a valid VIP plan'});

  const clean=v=>String(v??'').trim();
  const shipping={
    name:clean(req.body?.name),
    address1:clean(req.body?.address1),
    address2:clean(req.body?.address2)||null,
    city:clean(req.body?.city),
    state:clean(req.body?.state),
    postal_code:clean(req.body?.postal_code),
    country:clean(req.body?.country)||'US'
  };
  const size=clean(req.body?.size);
  const note=clean(req.body?.note)||null;
  if(!shipping.name||!shipping.address1||!shipping.city||!shipping.state||!shipping.postal_code){
    return res.status(422).json({error:'Complete the required welcome-gift shipping fields'});
  }

  const monthly=1599, annual=12999;
  const amount=plan==='monthly'?monthly:annual;
  const interval=plan==='monthly'?'month':'year';
  const lookupKey=plan==='monthly'?'trv_vip_monthly':'trv_vip_annual';

  let stripePriceId=null;
  try{
    const priceLookup=await fetch('https://api.stripe.com/v1/prices?active=true&limit=1&lookup_keys[]='+encodeURIComponent(lookupKey),{
      headers:{authorization:'Bearer '+stripeKey}
    });
    const priceData=await priceLookup.json().catch(()=>({}));
    if(priceLookup.ok&&Array.isArray(priceData.data)&&priceData.data[0]?.id){
      stripePriceId=priceData.data[0].id;
    }
  }catch{}

  const {error:membershipError}=await admin.from('vip_memberships').upsert({
    user_id:user.id,
    status:'inactive',
    billing_plan:plan,
    welcome_gift_status:'not_eligible',
    welcome_gift_shipping:shipping,
    welcome_gift_size:size||null,
    welcome_gift_note:note,
    qualifying_booking_id:plan==='annual'&&qualifyingBooking?.booking_id?qualifyingBooking.booking_id:null,
    updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(membershipError) return res.status(500).json({error:'VIP enrollment details could not be saved'});

  const lineItem = stripePriceId
    ? {'line_items[0][price]':stripePriceId}
    : {
        'line_items[0][price_data][currency]':'usd',
        'line_items[0][price_data][product_data][name]':plan==='monthly'?'TRV VIP Membership — Monthly':'TRV VIP Membership — Annual',
        'line_items[0][price_data][product_data][description]':'Member-only travel offers, perks, and a TRV welcome travel/lifestyle item upon joining.',
        'line_items[0][price_data][unit_amount]':amount,
        'line_items[0][price_data][recurring][interval]':interval
      };

  const form=formEncode({
    mode:'subscription',
    customer_email:user.email,
    client_reference_id:user.id,
    'consent_collection[terms_of_service]':'required',
    ...lineItem,
    'line_items[0][quantity]':1,
    'metadata[checkout_type]':'vip_membership',
    'metadata[user_id]':user.id,
    'metadata[billing_plan]':plan,
    'subscription_data[metadata][checkout_type]':'vip_membership',
    'subscription_data[metadata][user_id]':user.id,
    'subscription_data[metadata][billing_plan]':plan,
    ...(plan==='annual'&&qualifyingBooking?.booking_id ? {'subscription_data[metadata][qualifying_booking_id]':qualifyingBooking.booking_id} : {}),
    ...(plan==='monthly'
      ? {'subscription_data[trial_period_days]':7}
      : (qualifyingBooking?.booking_id ? {'subscription_data[trial_period_days]':60} : {})),
    success_url:siteUrl+'/vip?joined=1',
    cancel_url:siteUrl+'/vip?cancelled=1'
  });

  const stripe=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',
    headers:{authorization:'Bearer '+stripeKey,'content-type':'application/x-www-form-urlencoded'},
    body:form
  });
  const session=await stripe.json().catch(()=>({}));
  if(!stripe.ok||!session.url) return res.status(502).json({error:'VIP checkout could not be started'});
  return res.status(200).json({
    url:session.url,
    annual_group_benefit:plan==='annual'&&!!qualifyingBooking?.booking_id,
    qualifying_booking_id:plan==='annual'?qualifyingBooking?.booking_id||null:null
  });
}

async function createPaymentMethodSetup(req,res){
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

  const { data: existing } = await admin
    .from('user_payment_methods')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await stripeRequest('/customers', stripeKey, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formEncode({
        email: user.email,
        'metadata[trv_user_id]': user.id,
      }),
    });
    customerId = customer.id;
  }

  const setupIntent = await stripeRequest('/setup_intents', stripeKey, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formEncode({
      customer: customerId,
      usage: 'off_session',
      'payment_method_types[0]': 'card',
      'metadata[trv_user_id]': user.id,
      'metadata[purpose]': 'travel_request_payment_method',
    }),
  });

  return res.status(200).json({
    client_secret: setupIntent.client_secret,
    setup_intent_id: setupIntent.id,
  });
}   
