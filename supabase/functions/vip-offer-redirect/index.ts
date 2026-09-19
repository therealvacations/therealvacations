import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "content-type": "application/json; charset=utf-8"
};
const json = (body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid = (v: unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));

Deno.serve(async (req: Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  const url=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!url||!service) return json({error:"Server configuration error"},500);
  if(!token) return json({error:"Sign in required"},401);

  let body:Record<string,unknown>;
  try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
  const offerId=String(body.offer_id||"");
  if(!uuid(offerId)) return json({error:"Invalid offer"},422);

  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user) return json({error:"Sign in required"},401);

  const {data:membership}=await admin.from("vip_memberships")
    .select("status,trial_ends_at,paid_through").eq("user_id",user.id).maybeSingle();
  const now=new Date();
  const allowed=!!membership && (
    (membership.status==="trialing" && membership.trial_ends_at && new Date(membership.trial_ends_at)>now) ||
    (membership.status==="active" && (!membership.paid_through || new Date(membership.paid_through)>now))
  );
  if(!allowed) return json({error:"Active paid VIP membership required"},403);

  const {data:offer}=await admin.from("vip_offers")
    .select("offer_id,target_url,is_active,starts_at,ends_at")
    .eq("offer_id",offerId).maybeSingle();
  if(!offer?.is_active) return json({error:"Offer unavailable"},404);
  if(offer.starts_at && new Date(offer.starts_at)>now) return json({error:"Offer not started"},403);
  if(offer.ends_at && new Date(offer.ends_at)<=now) return json({error:"Offer expired"},410);

  let target:URL;
  try { target=new URL(offer.target_url); } catch { return json({error:"Offer destination invalid"},500); }
  if(target.protocol!=="https:") return json({error:"Offer destination invalid"},500);

  return json({ok:true,url:target.toString()});
});
