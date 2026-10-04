import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!bearer) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(bearer);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const quoteId=String(req.body?.quote_id||'').trim();
  if(!quoteId) return res.status(400).json({error:'Quote ID is required'});

  const {data:quote,error:quoteError}=await admin.from('travel_quotes')
    .select('quote_id,request_id,status')
    .eq('quote_id',quoteId).maybeSingle();
  if(quoteError||!quote) return res.status(404).json({error:'Quote not found'});

  const {data:booking}=await admin.from('custom_bookings')
    .select('custom_booking_id,amount_paid')
    .eq('quote_id',quoteId).maybeSingle();

  if(booking){
    if(Number(booking.amount_paid||0)>0) return res.status(409).json({error:'This quote has a payment recorded and cannot be reset from Admin.'});
    const {data:succeeded}=await admin.from('custom_booking_payments')
      .select('payment_id').eq('custom_booking_id',booking.custom_booking_id).eq('status','succeeded').limit(1);
    if(succeeded?.length) return res.status(409).json({error:'This quote has a successful payment and cannot be reset from Admin.'});
    const {error:deleteBookingError}=await admin.from('custom_bookings').delete().eq('custom_booking_id',booking.custom_booking_id);
    if(deleteBookingError) return res.status(500).json({error:'Unable to remove the unpaid booking'});
  }

  const {error:responseError}=await admin.from('travel_quote_responses').delete().eq('quote_id',quoteId);
  if(responseError) return res.status(500).json({error:'Unable to reset the traveler response'});

  const {error:quoteUpdateError}=await admin.from('travel_quotes').update({
    status:'ready',
    approved_at:null,
    declined_at:null,
    ready_at:new Date().toISOString()
  }).eq('quote_id',quoteId);
  if(quoteUpdateError) return res.status(500).json({error:'Unable to reopen the quote'});

  const {error:requestUpdateError}=await admin.from('travel_requests').update({status:'quote_ready'}).eq('request_id',quote.request_id);
  if(requestUpdateError) return res.status(500).json({error:'Quote reset, but the request status could not be updated'});

  return res.status(200).json({ok:true,quote_id:quoteId,status:'ready'});
}
