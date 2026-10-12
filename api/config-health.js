import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');

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

  const [cronResult,jobRunResult,emailResult,webhookResult] = await Promise.all([
    admin.rpc('get_system_cron_health'),
    admin.from('system_job_runs')
      .select('run_id,job_name,status,processed_count,sent_count,error_message,details,started_at,finished_at')
      .order('started_at',{ascending:false})
      .limit(30),
    admin.from('email_deliveries')
      .select('delivery_id,template_type,recipient_email,subject,status,attempt_count,attempted_at,sent_at,last_error,created_at')
      .order('created_at',{ascending:false})
      .limit(30),
    admin.from('stripe_webhook_events')
      .select('event_id,event_type,livemode,payment_id,processed_at')
      .order('processed_at',{ascending:false})
      .limit(30)
  ]);

  const emailRows=emailResult.data||[];
  const config={
    supabase_url:!!(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_service_role:!!process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripe_secret_key:!!process.env.STRIPE_SECRET_KEY,
    public_site_url:!!process.env.PUBLIC_SITE_URL,
    resend_api_key:!!process.env.RESEND_API_KEY,
    resend_from_email:!!process.env.RESEND_FROM_EMAIL,
    public_supabase_anon_key:!!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY),
    stripe_public_key:!!process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY
  };

  return res.status(200).json({
    ok:true,
    config,
    config_ready:Object.values(config).every(Boolean),
    cron:cronResult.data||[],
    cron_error:cronResult.error?.message||null,
    job_runs:jobRunResult.data||[],
    job_run_error:jobRunResult.error?.message||null,
    emails:emailRows,
    email_error:emailResult.error?.message||null,
    email_summary:{
      recent:emailRows.length,
      sent:emailRows.filter(row=>row.status==='sent').length,
      failed:emailRows.filter(row=>row.status==='failed').length,
      pending:emailRows.filter(row=>!['sent','failed'].includes(row.status)).length
    },
    stripe_webhooks:webhookResult.data||[],
    stripe_webhook_error:webhookResult.error?.message||null
  });
}
