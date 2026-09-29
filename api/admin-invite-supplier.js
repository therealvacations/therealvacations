import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Administrator access required'});

  const supplierId=String(req.body?.supplier_id||'');
  const {data:supplier,error:supplierError}=await admin.from('suppliers').select('*').eq('supplier_id',supplierId).maybeSingle();
  if(supplierError||!supplier) return res.status(404).json({error:'Supplier not found'});

  const email=String(supplier.contact_email||supplier.invite_email||'').trim().toLowerCase();
  if(!email) return res.status(422).json({error:'Add a supplier email first'});

  const redirectTo='https://therealvacations.com/supplier-portal?invited=1';

  if(supplier.auth_user_id){
    const {error:otpError}=await admin.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:false,emailRedirectTo:redirectTo}
    });
    if(otpError) return res.status(502).json({error:otpError.message||'Supplier access email could not be sent'});
    await admin.from('suppliers').update({
      status:'connected',
      invite_email:email,
      invited_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq('supplier_id',supplierId);
    return res.status(200).json({ok:true,connected:true});
  }

  // If the email already belongs to a TRV user, connect that account instead of creating a duplicate.
  let existing=null;
  for(let page=1;page<=5&&!existing;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:200});
    if(error) break;
    existing=(data?.users||[]).find(u=>String(u.email||'').toLowerCase()===email)||null;
    if((data?.users||[]).length<200) break;
  }

  if(existing){
    const {error:linkError}=await admin.from('suppliers').update({
      auth_user_id:existing.id,
      invite_email:email,
      status:'connected',
      connected_at:new Date().toISOString(),
      invited_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    }).eq('supplier_id',supplierId);
    if(linkError) return res.status(500).json({error:'Supplier account could not be linked'});
    const {error:otpError}=await admin.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:false,emailRedirectTo:redirectTo}
    });
    if(otpError) return res.status(502).json({error:otpError.message||'Supplier access email could not be sent'});
    return res.status(200).json({ok:true,connected:true});
  }

  const {data:invite,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{
    redirectTo,
    data:{account_type:'supplier',supplier_id:supplierId,company_name:supplier.company_name}
  });
  if(inviteError) return res.status(502).json({error:inviteError.message||'Supplier invite could not be sent'});

  const invitedUser=invite?.user||null;
  const {error:updateError}=await admin.from('suppliers').update({
    auth_user_id:invitedUser?.id||null,
    invite_email:email,
    status:'invited',
    invited_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('supplier_id',supplierId);
  if(updateError) return res.status(500).json({error:'Invite sent but supplier profile could not be updated'});

  return res.status(200).json({ok:true,connected:false});
}
