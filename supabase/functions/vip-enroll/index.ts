import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "content-type": "application/json; charset=utf-8"
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers});

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  const url=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!url||!service) return json({error:"Server configuration error"},500);
  if(!token) return json({error:"Sign in required"},401);

  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user) return json({error:"Sign in required"},401);

  const {data:membership}=await admin.from("vip_memberships")
    .select("status,billing_plan,trial_started_at,trial_ends_at,paid_through,stripe_subscription_id")
    .eq("user_id",user.id).maybeSingle();

  const now=new Date();
  const active=!!membership && (
    (membership.status==="trialing" && membership.trial_ends_at && new Date(membership.trial_ends_at)>now) ||
    (membership.status==="active" && (!membership.paid_through || new Date(membership.paid_through)>now))
  );

  if(active) return json({ok:true,membership,already_active:true});

  return json({
    ok:false,
    requires_paid_membership:true,
    message:"Choose TRV VIP Monthly for a 7-day free trial or TRV VIP Annual for a 2-month free trial."
  },403);
});