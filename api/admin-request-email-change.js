import { createClient } from '@supabase/supabase-js';

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey=process.env.RESEND_API_KEY;
  const fromEmail=process.env.RESEND_FROM_EMAIL||'kc@therealvacations.com';
  const fromName=process.env.RESEND_FROM_NAME||'The Real Vacations';
  const siteUrl=(process.env.PUBLIC_SITE_URL||'https://therealvacations.com').replace(/\/$/,'');
  if(!serviceKey||!resendKey) return res.status(500).json({error:'Server configuration error'});

  const bearer=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!bearer) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(bearer);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});
  const {data:adminRow}=await admin.from('admin_users').select('id').eq('id',user.id).maybeSingle();
  if(!adminRow) return res.status(403).json({error:'Forbidden'});

  const requestId=String(req.body?.request_id||'').trim();
  const newEmail=String(req.body?.new_email||'').trim().toLowerCase();
  if(!requestId||!newEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({error:'A valid new email is required'});

  const {data:travelRequest,error:requestError}=await admin.from('travel_requests')
    .select('request_id,user_id,primary_first_name,requester_email')
    .eq('request_id',requestId).maybeSingle();
  if(requestError||!travelRequest) return res.status(404).json({error:'Travel request not found'});
  if(!travelRequest.user_id) return res.status(409).json({error:'This request is not linked to a member account. Update the requester email instead.'});

  const {data:userResult,error:authError}=await admin.auth.admin.getUserById(travelRequest.user_id);
  const member=userResult?.user;
  if(authError||!member?.email) return res.status(409).json({error:'The linked member account email could not be found'});
  if(member.email.toLowerCase()===newEmail) return res.status(409).json({error:'That is already the member login email'});

  const profileUrl=siteUrl+'/member-profile?new_email='+encodeURIComponent(newEmail);
  const firstName=travelRequest.primary_first_name||'Traveler';
  const html=`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f1f7;color:#30243e;margin:0;padding:30px">
    <div style="max-width:620px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:#1a0533;color:#fff;padding:24px 30px"><strong style="font-size:22px">The Real Vacations</strong></div>
      <div style="padding:30px">
        <h1 style="font-size:24px;color:#1a0533">Update your TRV login email</h1>
        <p>Hi ${esc(firstName)},</p>
        <p>TRV Admin received a request to change the login email for your account to <strong>${esc(newEmail)}</strong>.</p>
        <p>For your security, Admin cannot silently replace your login address. Sign in to your TRV account and confirm the change from your Profile page.</p>
        <p><a href="${profileUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold">Review Email Change →</a></p>
        <p style="font-size:13px;color:#6b6270">After you submit the change, the required authentication confirmation must be completed before your login email changes. Your existing trips, quotes, and payments remain attached to the same account.</p>
        <p style="font-size:12px;color:#777;margin-top:28px">If you did not request this change, you can ignore this message and contact The Real Vacations.</p>
      </div>
    </div>
  </body></html>`;

  const send=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json'},
    body:JSON.stringify({
      to:[member.email],
      from:`${fromName} <${fromEmail}>`,
      subject:'Confirm your TRV account email change',
      html,
      tags:[{name:'category',value:'trv-transactional'},{name:'template',value:'account-email-change-request'}]
    })
  });
  const provider=await send.json().catch(()=>({}));
  if(!send.ok) return res.status(502).json({error:provider?.message||'Email provider rejected the message'});

  return res.status(200).json({ok:true,current_email:member.email,new_email:newEmail,message_id:provider?.id||null});
}
