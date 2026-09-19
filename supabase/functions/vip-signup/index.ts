import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://therealvacations.com",
  "https://www.therealvacations.com",
  "https://therealvacations.vercel.app"
]);

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://therealvacations.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});

const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) } });

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c] || c));
const makeCode = () => `TRV-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (!origin || !allowedOrigins.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
  const fromName = Deno.env.get("RESEND_FROM_NAME") ?? "The Real Vacations";
  if (!supabaseUrl || !serviceRoleKey || !resendKey || !fromEmail) return json({ error: "Server configuration incomplete" }, 500, origin);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, origin); }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
  const phone = String(body.phone ?? "").trim().slice(0, 40);
  const source = String(body.source ?? "vip_signup").trim().slice(0, 80);
  const tripInterest = String(body.trip_interest ?? "All TRV Group Trips").trim().slice(0, 160);
  const prize = String(body.spin_prize ?? "").trim().slice(0, 160);
  const optedIn = body.opted_in === true;
  const website = String(body.website ?? "").trim();
  if (website) return json({ ok: true }, 200, origin);

  if (!optedIn) return json({ error: "VIP subscription is required to receive a prize code" }, 422, origin);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Name and a valid email are required" }, 422, origin);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const expiresIso = expires.toISOString();

  const { data: existing } = await admin.from("subscribers")
    .select("subscriber_id,spin_code,spin_expires_at")
    .ilike("email", email)
    .maybeSingle();

  let code: string | null = null;
  if (prize && !/try again/i.test(prize)) {
    const existingStillValid = existing?.spin_code && existing?.spin_expires_at && new Date(existing.spin_expires_at) > now;
    code = existingStillValid ? existing.spin_code : makeCode();
  }

  let subscriberId = existing?.subscriber_id ?? null;
  const subscriberPayload = {
    name,
    email,
    phone: phone || null,
    source,
    trip_interest: tripInterest || null,
    spin_prize: prize || null,
    spin_code: code,
    spin_expires_at: code ? expiresIso : null,
    opted_in: true
  };

  if (subscriberId) {
    const { error } = await admin.from("subscribers").update(subscriberPayload).eq("subscriber_id", subscriberId);
    if (error) return json({ error: "Could not update VIP member" }, 500, origin);
  } else {
    const { data, error } = await admin.from("subscribers").insert(subscriberPayload).select("subscriber_id").single();
    if (error) return json({ error: "Could not save VIP member" }, 500, origin);
    subscriberId = data.subscriber_id;
  }

  if (code) {
    const { data: existingCode } = await admin.from("discount_codes").select("code_id").eq("code", code).maybeSingle();
    if (!existingCode) {
      const { error: codeError } = await admin.from("discount_codes").insert({
        code,
        discount_amount: null,
        discount_type: "wheel_prize",
        trip_id: null,
        expires_at: expiresIso,
        max_uses: 1,
        used_count: 0
      });
      if (codeError) return json({ error: "Could not create prize code" }, 500, origin);
    } else {
      await admin.from("discount_codes").update({ expires_at: expiresIso, max_uses: 1 }).eq("code", code);
    }
  }

  const subject = prize ? "Your TRV prize code — valid for 24 hours" : "Welcome to The Real Vacations VIP List";
  const prizeBlock = prize
    ? `<p>You won: <strong>${esc(prize)}</strong>.</p>${code ? `<p>Your prize code is <strong style="font-size:20px">${esc(code)}</strong>.</p><p><strong>Use it to book within 24 hours.</strong> It expires ${esc(expires.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }))} ET.</p>` : "<p>This spin did not generate a code.</p>"}<p>Prize eligibility and fulfillment are subject to the trip terms.</p>`
    : "<p>You’re now on our VIP list for early trip announcements, special offers, and member-only updates.</p>";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1f7;font-family:Arial,sans-serif;color:#30243e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#fff;border-radius:16px"><tr><td style="background:#1a0533;color:#fff;padding:24px 30px;border-radius:16px 16px 0 0"><strong style="font-size:20px">The Real Vacations</strong></td></tr><tr><td style="padding:30px"><h1 style="color:#1a0533">Welcome, ${esc(name)}!</h1>${prizeBlock}<p>Trip interest: <strong>${esc(tripInterest)}</strong></p><p><a href="https://therealvacations.com/trips" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold">Browse Group Trips</a></p><p style="color:#777;font-size:12px;margin-top:28px">You subscribed to The Real Vacations VIP list to receive this offer.</p></td></tr></table></td></tr></table></body></html>`;

  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject,
      html,
      tags: [{ name: "category", value: prize ? "wheel-prize" : "vip-signup" }]
    })
  });

  return json({ ok: true, subscriber_id: subscriberId, code, expires_at: code ? expiresIso : null, email_sent: send.ok }, 200, origin);
});
