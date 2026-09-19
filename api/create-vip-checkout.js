import { createClient } from '@supabase/supabase-js';

function formEncode(obj){
  const p=new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{ if(v!==undefined&&v!==null) p.append(k,String(v)); });
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

  const {error:membershipError}=await admin.from('vip_memberships').upsert({
    user_id:user.id,
    status:'inactive',
    billing_plan:plan,
    welcome_gift_status:'not_eligible',
    welcome_gift_shipping:shipping,
    welcome_gift_size:size||null,
    welcome_gift_note:note,
    updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(membershipError) return res.status(500).json({error:'VIP enrollment details could not be saved'});

  const now=new Date();
  const annualTrialEnd=new Date(now);
  annualTrialEnd.setMonth(annualTrialEnd.getMonth()+2);

  const form=formEncode({
    mode:'subscription',
    customer_email:user.email,
    client_reference_id:user.id,
    'line_items[0][price_data][currency]':'usd',
    'line_items[0][price_data][product_data][name]':'TRV VIP Membership',
    'line_items[0][price_data][product_data][description]':'Member-only travel offers, perks, and a TRV welcome travel/lifestyle item upon joining.',
    'line_items[0][price_data][unit_amount]':amount,
    'line_items[0][price_data][recurring][interval]':interval,
    'line_items[0][quantity]':1,
    'metadata[checkout_type]':'vip_membership',
    'metadata[user_id]':user.id,
    'metadata[billing_plan]':plan,
    'subscription_data[metadata][checkout_type]':'vip_membership',
    'subscription_data[metadata][user_id]':user.id,
    'subscription_data[metadata][billing_plan]':plan,
    ...(plan==='monthly'
      ? {'subscription_data[trial_period_days]':7}
      : {'subscription_data[trial_end]':Math.floor(annualTrialEnd.getTime()/1000)}),
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
  return res.status(200).json({url:session.url});
}
