import { createClient } from '@supabase/supabase-js';

const clean=v=>String(v??'').trim();

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
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
