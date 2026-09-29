import { createClient } from '@supabase/supabase-js';

function formEncode(obj){
  const p=new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{ if(v!==undefined&&v!==null) p.append(k,String(v)); });
  return p;
}

export default async function handler(req,res){
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
