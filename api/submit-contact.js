import { createClient } from '@supabase/supabase-js';

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const body=req.body||{};
  if(clean(body.website,120)) return res.status(200).json({ok:true});
  const fullName=clean(body.full_name,120);
  const email=clean(body.email,254).toLowerCase();
  const phone=clean(body.phone,50)||null;
  const topic=clean(body.trip_interest,160)||null;
  const message=clean(body.message,5000);
  const travelersRaw=Number(body.num_travelers||0);
  const travelers=Number.isFinite(travelersRaw)&&travelersRaw>0?Math.min(500,Math.trunc(travelersRaw)):null;

  if(fullName.length<2||!emailOk(email)||message.length<5){
    return res.status(422).json({error:'Name, valid email, and message are required.'});
  }

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.from('contact_submissions').insert({
    full_name:fullName,
    email,
    phone,
    trip_interest:topic,
    num_travelers:travelers,
    message,
    status:'new',
    updated_at:new Date().toISOString()
  }).select('submission_id').single();

  if(error||!data?.submission_id){
    console.error('Contact submission insert failed',error?.message);
    return res.status(500).json({error:'Your message could not be saved. Please try again.'});
  }

  const callEmail=async(template_type,suffix)=>{
    try{
      const response=await fetch(supabaseUrl+'/functions/v1/send-email',{
        method:'POST',
        headers:{'content-type':'application/json','authorization':'Bearer '+serviceKey,'apikey':serviceKey},
        body:JSON.stringify({
          template_type,
          submission_id:data.submission_id,
          event_id:'contact-'+data.submission_id+'-'+suffix
        })
      });
      if(!response.ok) console.error('Contact email failed',template_type,response.status);
    }catch(err){console.error('Contact email failed',template_type,err?.message||err);}
  };
  await Promise.all([
    callEmail('contact_received','traveler'),
    callEmail('contact_admin_notification','admin')
  ]);

  return res.status(200).json({ok:true,submission_id:data.submission_id});
}
