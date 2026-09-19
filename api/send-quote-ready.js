import { createClient } from '@supabase/supabase-js';

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const supabaseUrl=process.env.SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey=process.env.RESEND_API_KEY;
  const fromEmail=process.env.RESEND_FROM_EMAIL;
  const fromName=process.env.RESEND_FROM_NAME || 'The Real Vacations';
  const contactEmail=process.env.TRV_CONTACT_EMAIL || fromEmail;
  const siteUrl=(process.env.PUBLIC_SITE_URL || 'https://therealvacations.com').replace(/\/$/,'');
  if(!supabaseUrl||!serviceKey||!resendKey||!fromEmail) return res.status(500).json({error:'Server configuration error'});

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

  const request=quote.travel_requests;
  const recipient=request.requester_email;
  const options=(quote.travel_quote_options||[]).sort((a,b)=>a.sort_order-b.sort_order);
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(n)||0)/100);
  const optionHtml=options.map(o=>`<div style="padding:14px 0;border-bottom:1px solid #eee"><strong style="color:#1a0533">${esc(o.name)}</strong><div style="font-size:18px;font-weight:700;color:#7c3aed;margin-top:4px">${money(o.total_amount)}</div>${o.deposit_amount?'<div style="font-size:13px;color:#6b6270">Deposit: '+money(o.deposit_amount)+'</div>':''}</div>`).join('');
  const next='/my-trips';
  const loginUrl=siteUrl+'/login?next='+encodeURIComponent(next);
  const signupUrl=siteUrl+'/signup?next='+encodeURIComponent(next);
  const validText=quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : '';

  const html=`<!doctype html><html><body style="margin:0;background:#f5f1f8;font-family:Arial,sans-serif;color:#30243e">
  <table width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:28px 14px">
  <table width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#fff;border-radius:18px;overflow:hidden">
  <tr><td style="background:#1a0533;color:#fff;padding:28px"><strong style="font-size:22px">The Real Vacations</strong><div style="margin-top:6px;color:#d8c6ef">You bring the people. We handle the details.</div></td></tr>
  <tr><td style="padding:32px">
  <p style="margin-top:0">Hi ${esc(request.primary_first_name||'Traveler')},</p>
  <h1 style="font-size:26px;color:#1a0533;margin:8px 0 14px">Your TRV quote is ready.</h1>
  <p style="line-height:1.6">${esc(quote.summary||('We created your personalized travel options'+(request.destination?' for '+request.destination:'')+'.'))}</p>
  <div style="margin:22px 0">${optionHtml}</div>
  ${validText?'<p style="font-size:13px;color:#6b6270">Quote valid through <strong>'+esc(validText)+'</strong>.</p>':''}
  <p style="line-height:1.6">Open your secure TRV account to review the full quote and approve the option you want.</p>
  <p><a href="${loginUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700">Review My Quote</a></p>
  <p style="font-size:13px;color:#6b6270">New to TRV? <a href="${signupUrl}" style="color:#7c3aed;font-weight:700">Create your account using this email address</a> so we can securely match the quote to you.</p>
  <p style="margin-top:28px;font-size:12px;color:#81758a">Questions? Reply to this email or contact ${esc(contactEmail)}.</p>
  </td></tr></table></td></tr></table></body></html>`;

  const send=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json'},
    body:JSON.stringify({
      from:`${fromName} <${fromEmail}>`,
      to:[recipient],
      reply_to:contactEmail||undefined,
      subject:`Your TRV quote is ready: ${quote.title}`,
      html,
      tags:[{name:'category',value:'trv-transactional'},{name:'template',value:'quote-ready'}]
    })
  });
  const provider=await send.json().catch(()=>({}));
  if(!send.ok) return res.status(502).json({error:'Email provider rejected the message'});
  return res.status(200).json({ok:true,id:provider.id||null});
}
