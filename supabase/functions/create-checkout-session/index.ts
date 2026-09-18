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

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ''))
}

type CheckoutRow = {
  payment_id: string
  booking_id: string
  trip_title: string
  package_name: string
  amount: number
  currency: string
  checkout_attempt?: number
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://therealvacations.com').replace(/\/$/, '')
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }
  if (!token) return jsonResponse({ error: 'Sign in is required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData.user
  if (authError || !user?.email || !user.email_confirmed_at) {
    return jsonResponse({ error: 'A confirmed account is required' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const stripe = new Stripe(stripeSecretKey)
  let paymentId = String(body.payment_id ?? '')

  if (paymentId) {
    if (!isUuid(paymentId)) return jsonResponse({ error: 'Invalid payment' }, 422)

    const { data: existing } = await admin
      .from('booking_payments')
      .select('stripe_checkout_session_id, bookings!inner(user_id)')
      .eq('payment_id', paymentId)
      .eq('bookings.user_id', user.id)
      .maybeSingle()
    if (!existing) return jsonResponse({ error: 'Payment not found' }, 404)

    if (existing.stripe_checkout_session_id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(existing.stripe_checkout_session_id)
        if (session.status === 'open' && session.url) return jsonResponse({ url: session.url })
      } catch {
        // A missing or inaccessible old session is replaced below.
      }
    }
  } else {
    const tripSlug = String(body.trip_slug ?? '').trim()
    const packageCode = String(body.package_code ?? '').trim()
    const paymentPlan = String(body.payment_plan ?? '').trim()
    if (!/^[a-z0-9-]{3,160}$/.test(tripSlug) || !/^(general|vip)$/.test(packageCode)) {
      return jsonResponse({ error: 'Choose an available trip package' }, 422)
    }
    if (!/^(installments|pay_in_full)$/.test(paymentPlan)) {
      return jsonResponse({ error: 'Choose a payment plan' }, 422)
    }

    const { data, error } = await admin.rpc('prepare_stripe_booking_checkout', {
      p_user_id: user.id,
      p_trip_slug: tripSlug,
      p_package_code: packageCode,
      p_payment_plan: paymentPlan,
    }).single()
    if (error || !data) {
      console.error('Unable to prepare Stripe booking', error?.message)
      return jsonResponse({ error: 'This trip or payment plan is not available' }, 409)
    }
    paymentId = (data as CheckoutRow).payment_id
  }

  const { data: preparedPayment } = await admin
    .from('booking_payments')
    .select('stripe_checkout_session_id, bookings!inner(user_id)')
    .eq('payment_id', paymentId)
    .eq('bookings.user_id', user.id)
    .maybeSingle()
  if (preparedPayment?.stripe_checkout_session_id) {
    try {
      const existingSession = await stripe.checkout.sessions.retrieve(preparedPayment.stripe_checkout_session_id)
      if (existingSession.status === 'open' && existingSession.url) return jsonResponse({ url: existingSession.url })
    } catch {
      // Claim a replacement attempt below.
    }
  }

  const { data: claimed, error: claimError } = await admin.rpc('claim_stripe_booking_payment', {
    p_user_id: user.id,
    p_payment_id: paymentId,
  }).single()
  if (claimError || !claimed) {
    console.error('Unable to claim Stripe payment', claimError?.message)
    return jsonResponse({ error: 'This payment cannot be started' }, 409)
  }
  const payment = claimed as CheckoutRow

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: payment.booking_id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: payment.amount,
          product_data: { name: `${payment.trip_title} — ${payment.package_name}` },
        },
      }],
      metadata: { payment_id: payment.payment_id, booking_id: payment.booking_id },
      payment_intent_data: {
        metadata: { payment_id: payment.payment_id, booking_id: payment.booking_id },
      },
      success_url: `${siteUrl}/payment-result?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment-result?status=cancelled`,
    }, {
      idempotencyKey: `booking-payment-${payment.payment_id}-${payment.checkout_attempt}`,
    })
  } catch (error) {
    console.error('Unable to create Stripe Checkout Session', error instanceof Error ? error.message : 'Unknown error')
    await admin.from('booking_payments').update({
      status: 'failed',
      failure_code: 'checkout_create_failed',
      failure_message: null,
    }).eq('payment_id', payment.payment_id).eq('checkout_attempt', payment.checkout_attempt)
    return jsonResponse({ error: 'Checkout is temporarily unavailable' }, 502)
  }

  const { data: saved } = await admin
    .from('booking_payments')
    .update({ stripe_checkout_session_id: session.id })
    .eq('payment_id', payment.payment_id)
    .eq('checkout_attempt', payment.checkout_attempt)
    .select('payment_id')
    .maybeSingle()
  if (!saved) {
    try { await stripe.checkout.sessions.expire(session.id) } catch { /* already completed or expired */ }
    return jsonResponse({ error: 'Checkout changed; please try again' }, 409)
  }

  return jsonResponse({ url: session.url })
})
