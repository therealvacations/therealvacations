import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey) return res.status(500).json({error:'Server configuration error'});

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
    .select('quote_id,status,travel_requests!inner(requester_email)')
    .eq('quote_id',quoteId).maybeSingle();
  if(quoteError||!quote) return res.status(404).json({error:'Quote not found'});
  if(quote.status!=='ready') return res.status(409).json({error:'Quote is not published'});
  if(!quote.travel_requests?.requester_email) return res.status(422).json({error:'Traveler email address is missing'});

  const eventId='admin-quote-ready-'+quoteId+'-'+Date.now();
  const response=await fetch(supabaseUrl+'/functions/v1/send-email',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'authorization':'Bearer '+serviceKey,
      'apikey':serviceKey
    },
    body:JSON.stringify({
      template_type:'quote_ready',
      event_id:eventId,
      quote_id:quoteId
    })
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
    console.error('Supabase send-email quote failure',response.status,result);
    return res.status(502).json({error:result?.error||'Quote email could not be sent'});
  }

  return res.status(200).json({ok:true,delivered:true,duplicate:result?.duplicate===true});
}
