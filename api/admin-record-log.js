import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});
  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:isAdmin}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!isAdmin) return res.status(403).json({error:'Administrator access required'});

  const q=String(req.query.q||'').trim();
  const table=String(req.query.table||'').trim();
  let query=admin.from('trv_record_log')
    .select('record_id,table_name,operation,source_record_id,actor_user_id,changed_fields,occurred_at')
    .order('occurred_at',{ascending:false})
    .limit(200);

  if(table) query=query.eq('table_name',table);
  if(q){
    const safe=q.replace(/[%(),]/g,'').slice(0,120);
    query=query.or('record_id.ilike.%'+safe+'%,source_record_id.ilike.%'+safe+'%,table_name.ilike.%'+safe+'%');
  }
  const {data,error}=await query;
  if(error) return res.status(500).json({error:error.message});
  return res.status(200).json({records:data||[]});
}