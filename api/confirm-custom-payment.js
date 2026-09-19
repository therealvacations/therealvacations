import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY, stripeKey=process.env.STRIPE_SECRET_KEY;
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
