import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "content-type": "application/json; charset=utf-8"
};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i,"");
  if (!url || !service) return json({error:"Server configuration error"},500);
  if (!token) return json({error:"Sign in required"},401);

  const admin = createClient(url, service, {auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError} = await admin.auth.getUser(token);
  if (authError || !user) return json({error:"Sign in required"},401);

  const {data: existing} = await admin.from("vip_memberships")
    .select("*").eq("user_id",user.id).maybeSingle();

  const now = new Date();
  if (existing) {
    const validTrial = existing.status === "trialing" && existing.trial_ends_at && new Date(existing.trial_ends_at) > now;
    const validPaid = existing.status === "active" && (!existing.paid_through || new Date(existing.paid_through) > now);
    if (validTrial || validPaid) return json({ok:true,membership:existing,already_active:true});
    if (existing.trial_started_at) {
      return json({
        ok:false,
        eligible_for_trial:false,
        trial_already_used:true,
        requires_paid_membership:true,
        message:"The complimentary 2-month VIP trial has already been used on this account."
      },403);
    }
  }

  const {data: qualifying} = await admin.from("bookings")
    .select("booking_id,payment_plan,amount_paid,status,created_at")
    .eq("user_id",user.id)
    .eq("payment_plan","installments")
    .gt("amount_paid",0)
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if (!qualifying) {
    return json({
      ok:false,
      eligible_for_trial:false,
      requires_paid_membership:true,
      message:"The 2-month VIP trial is available after a successful deposit on a monthly-payment group trip."
    },403);
  }

  const trialStart = now;
  const trialEnd = new Date(now);
  trialEnd.setMonth(trialEnd.getMonth()+2);

  const payload = {
    user_id:user.id,
    status:"trialing",
    trial_started_at:trialStart.toISOString(),
    trial_ends_at:trialEnd.toISOString(),
    qualifying_booking_id:qualifying.booking_id,
    updated_at:now.toISOString()
  };

  const {data: membership,error} = await admin.from("vip_memberships")
    .upsert(payload,{onConflict:"user_id"}).select("*").single();
  if (error) return json({error:"Could not start VIP trial"},500);

  return json({ok:true,eligible_for_trial:true,membership});
});
