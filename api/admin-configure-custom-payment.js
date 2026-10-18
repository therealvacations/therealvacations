import { createClient } from '@supabase/supabase-js';

const cents = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const bookingId=String(req.body?.custom_booking_id||'').trim();
  const travelBase=cents(req.body?.trip_base_amount);
  const processing=cents(req.body?.extended_payment_processing_amount);
  const travelDown=cents(req.body?.travel_down_payment_amount);
  const dueNow=cents(req.body?.due_now_amount);
  const nextAmount=cents(req.body?.next_payment_amount);
  const finalAmount=cents(req.body?.final_balance_amount);
  const nextDate=String(req.body?.next_payment_date||'').trim();
  const finalDate=String(req.body?.final_balance_due_date||'').trim();
  const externalUrl=String(req.body?.external_payment_url||'').trim();

  if(!bookingId) return res.status(422).json({error:'Booking is required.'});
  for(const [label,value] of [['Trip total',travelBase],['Processing amount',processing],['Travel down payment',travelDown],['Due now',dueNow],['Next payment',nextAmount],['Final balance',finalAmount]]){
    if(!Number.isInteger(value)||value<0) return res.status(422).json({error:label+' is invalid.'});
  }
  if(dueNow!==travelDown+processing) return res.status(422).json({error:'Due now must equal the travel down payment plus Extended Payment Processing.'});
  const remainingTravel=travelBase-travelDown;
  if(remainingTravel<0) return res.status(422).json({error:'Travel down payment cannot exceed the trip total.'});
  if(nextAmount+finalAmount!==remainingTravel) return res.status(422).json({error:'The two remaining payments must equal the remaining travel balance.'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)||!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return res.status(422).json({error:'Enter both payment dates.'});
  if(new Date(nextDate+'T00:00:00Z')>=new Date(finalDate+'T00:00:00Z')) return res.status(422).json({error:'Final balance date must be after the next payment date.'});
  if(!/^https:\/\//i.test(externalUrl)) return res.status(422).json({error:'Enter a secure https payment link.'});

  const {data:booking,error:bookingError}=await admin.from('custom_bookings')
    .select('custom_booking_id,quote_id,request_id,user_id,amount_paid')
    .eq('custom_booking_id',bookingId).maybeSingle();
  if(bookingError||!booking) return res.status(404).json({error:'Approved booking not found.'});
  if(Number(booking.amount_paid||0)>0) return res.status(409).json({error:'This payment setup cannot replace a booking that already has a recorded payment.'});

  const totalWithProcessing=travelBase+processing;
  const snapshot={
    payment_provider:'paypal_external',
    external_payment_url:externalUrl,
    trip_base_amount:travelBase,
    travel_down_payment_amount:travelDown,
    extended_payment_processing_amount:processing,
    due_now_amount:dueNow,
    remaining_travel_balance:remainingTravel,
    next_payment_date:nextDate,
    next_payment_amount:nextAmount,
    final_balance_due_date:finalDate,
    final_balance_amount:finalAmount,
    payment_page_mode:'trv_branded_external_handoff',
    one_time_exception:true
  };

  const {error:updateError}=await admin.from('custom_bookings').update({
    total_amount:totalWithProcessing,
    deposit_amount:dueNow,
    balance_due:totalWithProcessing,
    payment_plan:'deposit',
    selection_snapshot:snapshot,
    updated_at:new Date().toISOString()
  }).eq('custom_booking_id',bookingId);
  if(updateError) return res.status(500).json({error:'Payment setup could not be saved.'});

  await admin.from('custom_booking_payments').delete().eq('custom_booking_id',bookingId).eq('status','open');
  const {data:payment,error:paymentError}=await admin.from('custom_booking_payments').insert({
    custom_booking_id:bookingId,
    amount:dueNow,
    kind:'deposit',
    status:'open',
    updated_at:new Date().toISOString()
  }).select('payment_id').single();
  if(paymentError) return res.status(500).json({error:'Payment request could not be prepared.'});

  await admin.from('admin_client_history').insert({
    user_id:booking.user_id,
    request_id:booking.request_id,
    quote_id:booking.quote_id,
    entry_type:'payment_requested',
    note:'Admin prepared a TRV payment plan. Due now: '+(dueNow/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+
      ', including '+(processing/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+
      ' Extended Payment Processing. Remaining travel payments: '+(nextAmount/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+
      ' due '+nextDate+' and '+(finalAmount/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+' due '+finalDate+'.',
    metadata:{custom_booking_id:bookingId,payment_id:payment.payment_id,...snapshot},
    occurred_at:new Date().toISOString(),
    created_by:user.id,
    actor_type:'admin',
    actor_user_id:user.id,
    actor_label:'TRV Admin'
  });

  return res.status(200).json({ok:true,custom_booking_id:bookingId,payment_id:payment.payment_id,total_amount:totalWithProcessing,balance_due:totalWithProcessing});
}