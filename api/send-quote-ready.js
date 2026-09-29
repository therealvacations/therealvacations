import { createClient } from '@supabase/supabase-js';

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!bearer) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:userData,error:userError}=await admin.auth.getUser(bearer);
  const user=userData?.user;
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const quoteId=String(req.body?.quote_id||'');
  const {data:quote,error}=await admin.from('travel_quotes')
    .select('quote_id,title,summary,status,valid_until,travel_quote_options(name,total_amount,deposit_amount,sort_order),travel_requests!inner(requester_email,primary_first_name,destination)')
    .eq('quote_id',quoteId).maybeSingle();
  if(error||!quote) return res.status(404).json({error:'Quote not found'});
  if(quote.status!=='ready') return res.status(409).json({error:'Quote is not published'});

  const send=await fetch(`${supabaseUrl}/functions/v1/send-email`,{
    method:'POST',
    headers:{
      authorization:`Bearer ${serviceKey}`,
      apikey:serviceKey,
      'content-type':'application/json'
    },
    body:JSON.stringify({
      template_type:'quote_ready',
      quote_id:quoteId,
      event_id:'quote-ready-'+quoteId+'-'+String(quote.valid_until||'current')
    })
  });
  const provider=await send.json().catch(()=>({}));
  if(!send.ok) return res.status(send.status>=500?502:send.status).json({error:provider.error||'Quote email could not be sent'});
  return res.status(200).json({ok:true,delivered:provider.delivered!==false});
}
