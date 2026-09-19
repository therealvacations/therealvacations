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

  const monthly=1599, annual=12999;
  const amount=plan==='monthly'?monthly:annual;
  const interval=plan==='monthly'?'month':'year';

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
