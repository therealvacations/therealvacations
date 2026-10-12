import { createClient } from '@supabase/supabase-js';

const clean=(v,max=4000)=>String(v??'').trim().slice(0,max);

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Sign in required'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user) return res.status(401).json({error:'Sign in required'});

  const body=req.body||{};
  const title=clean(body.title,180);
  const description=clean(body.description,5000);
  if(title.length<3||description.length<5) return res.status(422).json({error:'Add a short title and describe what happened.'});

  const [{data:adminRow},{data:supplierRow},{data:hostRow}]=await Promise.all([
    admin.from('admin_users').select('id').eq('id',user.id).maybeSingle(),
    admin.from('suppliers').select('supplier_id').eq('auth_user_id',user.id).maybeSingle(),
    admin.from('host_profiles').select('user_id').eq('user_id',user.id).maybeSingle()
  ]);
  const reporterRole=adminRow?'admin':supplierRow?'supplier':hostRow?'host':'member';

  const safeContext=body.related_context&&typeof body.related_context==='object'&&!Array.isArray(body.related_context)
    ? body.related_context : {};
  const browserContext=body.browser_context&&typeof body.browser_context==='object'&&!Array.isArray(body.browser_context)
    ? body.browser_context : {};

  const {data,error}=await admin.from('system_issue_reports').insert({
    reporter_user_id:user.id,
    reporter_email:user.email||null,
    reporter_role:reporterRole,
    title,
    description,
    page_url:clean(body.page_url,1200)||null,
    page_path:clean(body.page_path,300)||null,
    page_title:clean(body.page_title,300)||null,
    browser_context:browserContext,
    related_context:safeContext,
    status:'new',
    priority:'normal',
    updated_at:new Date().toISOString()
  }).select('issue_id,status,created_at').single();

  if(error||!data?.issue_id){
    console.error('Issue report insert failed',error?.message);
    return res.status(500).json({error:'Your report could not be saved. Please try again.'});
  }
  return res.status(200).json({ok:true,issue_id:data.issue_id,status:data.status,created_at:data.created_at});
}
