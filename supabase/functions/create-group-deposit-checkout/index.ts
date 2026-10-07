import Stripe from 'npm:stripe@22.6.2'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://therealvacations.com').replace(/\/$/, '')
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) return jsonResponse({ error: 'Server configuration error' }, 500)
  if (!token) return jsonResponse({ error: 'Sign in is required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData.user
  if (authError || !user?.email) return jsonResponse({ error: 'A confirmed account is required' }, 401)

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return jsonResponse({ error: 'Invalid JSON' }, 400) }
  const groupId = String(body.group_id ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(groupId)) return jsonResponse({ error: 'Invalid group' }, 422)

  const { data: member, error: memberError } = await admin.from('travel_group_members')
    .select('membership_id,group_id,user_id,status,booking_id,share_total,share_paid,share_status,deposit_required,deposit_due_at,deposit_paid_at,stripe_deposit_session_id,travel_groups!inner(name,separate_payments,status,trip_id,trips!inner(title,dates_start,dates_end))')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !member || member.status !== 'joined') return jsonResponse({ error: 'This traveler payment invitation is not available' }, 404)
  if (!member.travel_groups?.separate_payments) return jsonResponse({ error: 'This booking does not use individual traveler payments' }, 409)
  if (member.deposit_paid_at) return jsonResponse({ error: 'Your deposit has already been paid' }, 409)
  if (member.deposit_due_at && new Date(member.deposit_due_at).getTime() < Date.now()) return jsonResponse({ error: 'This 24-hour deposit invitation has expired. Contact The Real Vacations.' }, 409)

  const amount = Number(member.deposit_required ?? 0)
  if (!amount || amount <= 0) return jsonResponse({ error: 'No traveler deposit is due' }, 409)

  const stripe = new Stripe(stripeSecretKey)
  if (member.stripe_deposit_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(member.stripe_deposit_session_id)
      if (existing.status === 'open' && existing.url) return jsonResponse({ url: existing.url })
    } catch {}
  }

  const tripTitle = member.travel_groups?.trips?.title || member.travel_groups?.name || 'The Real Vacations Group Trip'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    client_reference_id: member.booking_id || member.membership_id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amount,
        product_data: { name: `${tripTitle} — Traveler Deposit` },
      },
    }],
    metadata: {
      checkout_type: 'group_member_deposit',
      membership_id: member.membership_id,
      group_id: member.group_id,
      booking_id: member.booking_id || '',
      user_id: user.id,
    },
    payment_intent_data: {
      metadata: {
        checkout_type: 'group_member_deposit',
        membership_id: member.membership_id,
        group_id: member.group_id,
        booking_id: member.booking_id || '',
      },
    },
    success_url: `${siteUrl}/group-deposit?group=${encodeURIComponent(groupId)}&status=success`,
    cancel_url: `${siteUrl}/group-deposit?group=${encodeURIComponent(groupId)}&status=cancelled`,
  })

  await admin.from('travel_group_members').update({
    stripe_deposit_session_id: session.id,
    updated_at: new Date().toISOString(),
  }).eq('membership_id', member.membership_id)

  return jsonResponse({ url: session.url })
})
