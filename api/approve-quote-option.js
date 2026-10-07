import { createClient } from '@supabase/supabase-js';

const isProcessing=i=>String(i.category||'').toLowerCase()==='processing_fee'||/processing convenience fee/i.test(String(i.title||''));

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

  const quoteId=String(req.body?.quote_id||'').trim();
  const optionId=String(req.body?.option_id||'').trim();
  const selectedVariantIds=Array.isArray(req.body?.selected_variant_ids)
    ? [...new Set(req.body.selected_variant_ids.map(v=>String(v||'').trim()).filter(Boolean))]
    : [];
  if(!quoteId||!optionId) return res.status(422).json({error:'Quote and option are required.'});

  const {data:quote,error:quoteError}=await admin.from('travel_quotes')
    .select('quote_id,request_id,status,valid_until,currency,travel_requests!inner(user_id),travel_quote_options(option_id,total_amount,deposit_amount,travel_quote_items(item_id,category,title,amount,client_visible,travel_quote_item_variants(variant_id,item_id,label,amount,active,is_default)))')
    .eq('quote_id',quoteId).maybeSingle();
  if(quoteError||!quote) return res.status(404).json({error:'Quote not found'});
  const request=Array.isArray(quote.travel_requests)?quote.travel_requests[0]:quote.travel_requests;
  if(request?.user_id!==user.id) return res.status(403).json({error:'This quote does not belong to your account.'});
  if(!['ready','viewed'].includes(quote.status)) return res.status(409).json({error:'This quote is not currently open for approval.'});
  if(quote.valid_until&&new Date(quote.valid_until).getTime()<Date.now()) return res.status(409).json({error:'This quote has expired. Ask TRV to refresh pricing.'});

  const option=(quote.travel_quote_options||[]).find(o=>o.option_id===optionId);
  if(!option) return res.status(422).json({error:'Selected option is not part of this quote.'});
  const items=(option.travel_quote_items||[]).filter(i=>i.client_visible!==false);
  const variantMap=new Map();
  for(const item of items){
    for(const v of (item.travel_quote_item_variants||[]).filter(v=>v.active!==false)) variantMap.set(v.variant_id,{...v,item_id:item.item_id});
  }
  const selected=selectedVariantIds.map(id=>variantMap.get(id)).filter(Boolean);
  if(selected.length!==selectedVariantIds.length) return res.status(422).json({error:'One or more selected item choices are invalid.'});

  const selectedByItem=new Map(selected.map(v=>[v.item_id,v]));
  for(const item of items){
    const variants=(item.travel_quote_item_variants||[]).filter(v=>v.active!==false);
    if(variants.length&&!selectedByItem.has(item.item_id)){
      return res.status(422).json({error:'Choose one option for '+item.title+'.'});
    }
  }

  const subtotal=items.filter(i=>!isProcessing(i)).reduce((sum,item)=>{
    const chosen=selectedByItem.get(item.item_id);
    return sum+Math.max(0,Number(chosen?.amount??item.amount)||0);
  },0);
  const processingFee=Math.round(subtotal*0.035);
  const total=subtotal+processingFee;
  if(total<=0) return res.status(422).json({error:'This option does not have a valid total.'});

  const snapshot={};
  for(const [itemId,v] of selectedByItem){
    snapshot[itemId]={variant_id:v.variant_id,label:v.label,amount:v.amount};
  }

  const now=new Date().toISOString();
  const {error:responseError}=await admin.from('travel_quote_responses').upsert({
    quote_id:quoteId,
    option_id:optionId,
    user_id:user.id,
    decision:'approved',
    note:null,
    selected_item_variants:snapshot,
    updated_at:now
  },{onConflict:'quote_id,user_id'});
  if(responseError) return res.status(500).json({error:'Your approval could not be saved.'});

  const deposit=option.deposit_amount&&option.deposit_amount<total?option.deposit_amount:total;
  const {data:booking,error:bookingError}=await admin.from('custom_bookings')
    .update({
      total_amount:total,
      deposit_amount:deposit,
      balance_due:total,
      selection_snapshot:snapshot,
      updated_at:now
    })
    .eq('quote_id',quoteId)
    .eq('user_id',user.id)
    .select('custom_booking_id,total_amount,deposit_amount')
    .maybeSingle();
  if(bookingError||!booking?.custom_booking_id) return res.status(500).json({error:'Your quote was approved, but the booking could not be prepared.'});

  return res.status(200).json({ok:true,booking_id:booking.custom_booking_id,total_amount:total,deposit_amount:deposit});
}
