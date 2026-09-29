import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL;
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
