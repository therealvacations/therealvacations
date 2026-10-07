import { createClient } from '@supabase/supabase-js';

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

  const sourceQuoteId=String(req.body?.quote_id||'').trim();
  const selectedIds=Array.isArray(req.body?.selected_item_ids)
    ? [...new Set(req.body.selected_item_ids.map(v=>String(v||'').trim()).filter(Boolean))]
    : [];
  const note=String(req.body?.note||'').trim()||null;

  if(!sourceQuoteId||!selectedIds.length) return res.status(422).json({error:'Choose the trip components you want before submitting.'});

  const {data:quote,error:quoteError}=await admin.from('travel_quotes')
    .select('quote_id,request_id,title,summary,status,currency,deposit_amount,valid_until,travel_requests!inner(user_id),travel_quote_options(option_id,name,sort_order,travel_quote_items(item_id,option_id,category,title,description,amount,quantity,sort_order,details,admin_notes,supplier_id,image_url,selection_group,selection_rule,client_visible,builder_managed,attachments))')
    .eq('quote_id',sourceQuoteId).maybeSingle();

  if(quoteError||!quote) return res.status(404).json({error:'Quote not found'});
  const request=Array.isArray(quote.travel_requests)?quote.travel_requests[0]:quote.travel_requests;
  if(!request?.user_id||request.user_id!==user.id) return res.status(403).json({error:'This quote does not belong to your account.'});
  if(!['ready','viewed'].includes(quote.status)) return res.status(409).json({error:'This quote is not currently open for selections.'});
  if(quote.valid_until&&new Date(quote.valid_until).getTime()<Date.now()) return res.status(409).json({error:'This quote has expired. Ask TRV to refresh pricing.'});

  const allItems=(quote.travel_quote_options||[]).flatMap(o=>(o.travel_quote_items||[]).filter(i=>i.builder_managed===true).map(i=>({...i,option_name:o.name,option_sort:o.sort_order})));
  const itemMap=new Map(allItems.map(i=>[i.item_id,i]));
  const selected=selectedIds.map(id=>itemMap.get(id)).filter(Boolean);
  if(selected.length!==selectedIds.length) return res.status(422).json({error:'One or more selected items are not part of this quote.'});
  if(selected.some(i=>i.client_visible===false)) return res.status(422).json({error:'One or more selected items are not available for client selection.'});

  const grouped=new Map();
  for(const item of allItems.filter(i=>i.client_visible!==false)){
    const rule=item.selection_rule||'fixed';
    const group=(item.selection_group||'').trim();
    if(!group) continue;
    if(!grouped.has(group)) grouped.set(group,{rule,items:[]});
    grouped.get(group).items.push(item);
  }

  for(const [group,info] of grouped){
    const count=selected.filter(i=>(i.selection_group||'').trim()===group).length;
    if(info.rule==='choose_one'&&count!==1) return res.status(422).json({error:'Choose exactly one option for '+group+'.'});
    if(info.rule==='fixed'&&count!==1) return res.status(422).json({error:'The required '+group+' item must remain in your selection.'});
    if(info.rule==='optional'&&count>1) return res.status(422).json({error:'Choose no more than one option for '+group+'.'});
  }

  const ungroupedFixed=allItems.filter(i=>i.client_visible!==false&&(i.selection_rule||'fixed')==='fixed'&&!(i.selection_group||'').trim());
  for(const fixed of ungroupedFixed){
    if(!selectedIds.includes(fixed.item_id)) return res.status(422).json({error:'A required trip item is missing from your selection.'});
  }

  const pricedSelected=selected.filter(i=>String(i.category||'').toLowerCase()!=='processing_fee'&&!/processing convenience fee/i.test(String(i.title||'')));
  const subtotal=pricedSelected.reduce((sum,i)=>sum+Math.max(0,Number(i.amount)||0),0);
  const processingFee=Math.round(subtotal*0.035);
  const total=subtotal+processingFee;
  if(total<=0) return res.status(422).json({error:'The selected trip does not have a valid total yet.'});

  const now=new Date().toISOString();
  const {data:newQuote,error:newQuoteError}=await admin.from('travel_quotes').insert({
    request_id:quote.request_id,
    title:(quote.title||'TRV Proposal')+' — Client Selection',
    summary:'Client-built selection submitted for TRV price and availability verification.',
    status:'draft',
    currency:quote.currency||'USD',
    total_amount:0,
    deposit_amount:null,
    valid_until:quote.valid_until,
    quote_kind:'custom_selection',
    source_quote_id:quote.quote_id,
    workflow_status:'admin_review',
    created_by:null,
    updated_at:now
  }).select('quote_id').single();
  if(newQuoteError) return res.status(500).json({error:'Your selection could not be prepared for review.'});

  const {data:newOption,error:newOptionError}=await admin.from('travel_quote_options').insert({
    quote_id:newQuote.quote_id,
    name:'Custom Quote — Client Selection',
    description:'Built from the traveler’s selected components. Pending TRV verification.',
    sort_order:0,
    total_amount:0,
    deposit_amount:null,
    is_recommended:true,
    allow_mix_and_match:false,
    details:{source_quote_id:quote.quote_id}
  }).select('option_id').single();
  if(newOptionError){
    await admin.from('travel_quotes').delete().eq('quote_id',newQuote.quote_id);
    return res.status(500).json({error:'Your custom quote option could not be created.'});
  }

  // Client selections are saved for Admin review only. Proposal items are created only in Requests & Quotes.
  const {data:selection,error:selectionError}=await admin.from('travel_quote_client_selections').insert({
    source_quote_id:quote.quote_id,
    generated_quote_id:newQuote.quote_id,
    user_id:user.id,
    selected_item_ids:selectedIds,
    selected_option_ids:[...new Set(selected.map(i=>i.option_id))],
    total_amount:total,
    status:'admin_review',
    note,
    updated_at:now
  }).select('selection_id').single();
  if(selectionError){
    await admin.from('travel_quotes').delete().eq('quote_id',newQuote.quote_id);
    return res.status(500).json({error:'Your selection could not be submitted for review.'});
  }

  await admin.from('travel_quotes').update({workflow_status:'selection_submitted',updated_at:now}).eq('quote_id',quote.quote_id);
  await admin.from('travel_requests').update({status:'quote_in_progress'}).eq('request_id',quote.request_id);

  return res.status(200).json({
    ok:true,
    selection_id:selection.selection_id,
    generated_quote_id:newQuote.quote_id,
    total_amount:total,
    status:'admin_review'
  });
}
