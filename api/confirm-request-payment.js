import { createClient } from '@supabase/supabase-js';

async function stripeGet(path,key){
  const response=await fetch('https://api.stripe.com/v1'+path,{headers:{authorization:'Bearer '+key}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||'Stripe request failed');
  return data;
}

export default async function handler(req,res){
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
