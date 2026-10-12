import { createClient } from '@supabase/supabase-js';

const clean=(v,max=500)=>String(v??'').trim().slice(0,max);
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const truthy=v=>['true','1','yes','on'].includes(clean(v).toLowerCase());

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const now=Date.now();
  const promoStart=Date.parse('2026-10-05T04:00:00Z');
  const promoEnd=Date.parse('2026-11-18T04:59:59Z');
  if(now<promoStart||now>promoEnd){
    return res.status(409).json({error:'The Travel Trivia entry period is not currently open.'});
  }

  const body=req.body||{};
  if(clean(body.website,100)) return res.status(200).json({ok:true});
  const fullName=clean(body.full_name,120);
  const email=clean(body.email,254).toLowerCase();
  const stateOrDc=clean(body.state_or_dc,80);
  const q1=Number(body.quiz_1_score);
  const q2=Number(body.quiz_2_score);
  const q3=Number(body.quiz_3_score);
  const completed=truthy(body.completed_consecutively);
  const ageEligible=truthy(body.age_eligible);
  const residencyEligible=truthy(body.residency_eligible);
  const certified=truthy(body.certification_ack);

  if(fullName.length<2||!emailOk(email)||!stateOrDc){
    return res.status(422).json({error:'Name, valid email, and state/D.C. are required.'});
  }
  if(![q1,q2,q3].every(v=>Number.isFinite(v)&&v>=70&&v<=100)){
    return res.status(422).json({error:'Each official quiz score must be between 70 and 100 to qualify.'});
  }
  if(!completed||!ageEligible||!residencyEligible||!certified){
    return res.status(422).json({error:'Complete all eligibility certifications before submitting.'});
  }

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:existing}=await admin.from('travel_trivia_entries')
    .select('entry_id,status')
    .eq('email_normalized',email)
    .maybeSingle();
  if(existing){
    return res.status(409).json({error:'An official Travel Trivia entry has already been submitted for this email address.'});
  }

  const {data,error}=await admin.from('travel_trivia_entries').insert({
    full_name:fullName,
    email,
    state_or_dc:stateOrDc,
    quiz_1_score:Math.round(q1),
    quiz_2_score:Math.round(q2),
    quiz_3_score:Math.round(q3),
    completed_consecutively:true,
    age_eligible:true,
    residency_eligible:true,
    certification_ack:true,
    status:'submitted'
  }).select('entry_id').single();

  if(error||!data?.entry_id){
    if(error?.code==='23505') return res.status(409).json({error:'An official Travel Trivia entry has already been submitted for this email address.'});
    console.error('Trivia entry insert failed',error?.message);
    return res.status(500).json({error:'Your entry could not be saved. Please try again.'});
  }

  try{
    await fetch(supabaseUrl+'/functions/v1/send-email',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        authorization:'Bearer '+serviceKey,
        apikey:serviceKey
      },
      body:JSON.stringify({
        template_type:'travel_trivia_entry',
        entry_id:data.entry_id,
        event_id:'travel-trivia-'+data.entry_id
      })
    });
  }catch(err){
    console.error('Trivia confirmation email failed',err?.message||err);
  }

  return res.status(200).json({ok:true,entry_id:data.entry_id});
}
