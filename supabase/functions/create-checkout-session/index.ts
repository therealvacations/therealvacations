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

function prizeDiscountCents(prize: string, totalAmount: number) {
  const fixed = prize.match(/^\$(\d+(?:\.\d{1,2})?)\s*Off/i)
  if (fixed) return Math.min(totalAmount, Math.round(Number(fixed[1]) * 100))
  const percent = prize.match(/^(\d+(?:\.\d+)?)%\s*Off/i)
  if (percent) return Math.min(totalAmount, Math.round(totalAmount * (Number(percent[1]) / 100)))
  return 0
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
  const requestedPromoCode = String(body.promo_code ?? '').trim().toUpperCase()
  let appliedPromoCode = ''
  let appliedPrize = ''
  let appliedDiscountAmount = 0

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
    if (!/^[a-z0-9-]{3,160}$/.test(tripSlug) || !/^[a-z0-9-]{1,50}$/.test(packageCode)) {
      return jsonResponse({ error: 'Choose an available trip package' }, 422)
    }
    if (!/^(installments|pay_in_full)$/.test(paymentPlan)) {
      return jsonResponse({ error: 'Choose a payment plan' }, 422)
    }

    if (paymentPlan === 'installments') {
      const { data: subscriber } = await admin.from('subscribers')
        .select('subscriber_id,opted_in')
        .ilike('email', user.email)
        .eq('opted_in', true)
        .maybeSingle()
      if (!subscriber) {
        return jsonResponse({
          error: 'Deposit + monthly payments require a free TRV email subscription. Subscribe first, then continue.'
        }, 422)
      }
    }

    const signerName = String(body.signer_name ?? '').trim()
    if (body.booking_terms_consent !== true || signerName.length < 2 || signerName.length > 160) {
      return jsonResponse({ error: 'Accept the booking policies and provide your legal name' }, 422)
    }

    if (requestedPromoCode) {
      if (!/^TRV-[A-Z0-9]{8}$/.test(requestedPromoCode)) {
        return jsonResponse({ error: 'That prize code is not valid' }, 422)
      }

      const [{ data: subscriber }, { data: codeRow }, { data: packageInfo }] = await Promise.all([
        admin.from('subscribers')
          .select('email,spin_prize,spin_code,spin_expires_at,opted_in')
          .ilike('email', user.email)
          .eq('spin_code', requestedPromoCode)
          .maybeSingle(),
        admin.from('discount_codes')
          .select('code,expires_at,max_uses,used_count')
          .eq('code', requestedPromoCode)
          .maybeSingle(),
        admin.from('trip_packages')
          .select('total_amount,deposit_amount,trips!inner(slug,status)')
          .eq('code', packageCode)
          .eq('is_active', true)
          .eq('trips.slug', tripSlug)
          .eq('trips.status', 'active')
          .maybeSingle(),
      ])

      const now = new Date()
      const subscriberExpiry = subscriber?.spin_expires_at ? new Date(subscriber.spin_expires_at) : null
      const codeExpiry = codeRow?.expires_at ? new Date(codeRow.expires_at) : null
      const maxUses = Number(codeRow?.max_uses ?? 1)
      const usedCount = Number(codeRow?.used_count ?? 0)

      if (!subscriber?.opted_in || !subscriberExpiry || subscriberExpiry <= now ||
          !codeRow || !codeExpiry || codeExpiry <= now || usedCount >= maxUses || !packageInfo) {
        return jsonResponse({ error: 'This prize code has expired, has already been used, or is not eligible' }, 422)
      }

      appliedPromoCode = requestedPromoCode
      appliedPrize = String(subscriber.spin_prize ?? '')
      appliedDiscountAmount = prizeDiscountCents(appliedPrize, Number(packageInfo.total_amount ?? 0))
    }

    const { data, error } = await admin.rpc('prepare_stripe_booking_checkout', {
      p_user_id: user.id,
      p_trip_slug: tripSlug,
      p_package_code: packageCode,
      p_payment_plan: paymentPlan,
      p_auto_pay_consent: body.auto_pay_consent === true,
    }).single()
    if (error || !data) {
      console.error('Unable to prepare Stripe booking', error?.message)
      return jsonResponse({ error: 'This trip or payment plan is not available' }, 409)
    }
    const prepared = data as CheckoutRow

    if (appliedPromoCode) {
      const { data: bookingAmounts, error: bookingAmountsError } = await admin
        .from('bookings')
        .select('total_amount,deposit_amount,payment_plan')
        .eq('booking_id', prepared.booking_id)
        .eq('user_id', user.id)
        .single()
      if (bookingAmountsError || !bookingAmounts) {
        return jsonResponse({ error: 'Prize code could not be applied' }, 500)
      }

      const originalTotal = Number(bookingAmounts.total_amount ?? 0)
      const originalDeposit = Number(bookingAmounts.deposit_amount ?? 0)
      const discountedTotal = Math.max(0, originalTotal - appliedDiscountAmount)
      const amountDueNow = paymentPlan === 'pay_in_full'
        ? discountedTotal
        : Math.min(originalDeposit, discountedTotal)

      const { error: promoBookingError } = await admin.from('bookings').update({
        total_amount: discountedTotal,
        deposit_amount: Math.min(originalDeposit, discountedTotal),
        balance_due: discountedTotal,
        promo_code: appliedPromoCode,
        promo_description: appliedPrize,
        promo_discount_amount: appliedDiscountAmount,
      }).eq('booking_id', prepared.booking_id).eq('user_id', user.id)
      if (promoBookingError) return jsonResponse({ error: 'Prize code could not be applied' }, 500)

      const { error: promoPaymentError } = await admin.from('booking_payments').update({
        scheduled_amount: amountDueNow,
      }).eq('payment_id', prepared.payment_id)
      if (promoPaymentError) return jsonResponse({ error: 'Prize code could not be applied' }, 500)

      prepared.amount = amountDueNow
    }

    paymentId = prepared.payment_id
    const sourceIp = (request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? '').split(',')[0].trim().slice(0, 120) || null
    const { error: acceptanceError } = await admin.rpc('record_booking_acceptance', {
      p_booking_id: prepared.booking_id, p_user_id: user.id, p_signer_name: signerName,
      p_booking_terms_version: '2026-09-booking-v1', p_privacy_policy_version: '2026-09-privacy-v1',
      p_refund_policy_version: '2026-09-refund-v1',
      p_automatic_payment_authorized: paymentPlan === 'installments' && body.auto_pay_consent === true,
      p_automatic_payment_terms_version: paymentPlan === 'installments' ? '2026-09-auto-monthly-v1' : null,
      p_trip_title: prepared.trip_title, p_package_name: prepared.package_name, p_payment_plan: paymentPlan,
      p_amount_due_now: prepared.amount, p_currency: prepared.currency, p_source_ip: sourceIp,
      p_user_agent: (request.headers.get('user-agent') ?? '').slice(0, 500) || null,
      p_agreement_urls: { booking_terms: `${siteUrl}/terms-of-service`, privacy_policy: `${siteUrl}/privacy-policy` },
    })
    if (acceptanceError) {
      console.error('Unable to record booking acceptance', acceptanceError.message)
      return jsonResponse({ error: 'Your agreement could not be recorded. No payment was started.' }, 500)
    }
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

  const { data: billing } = await admin
    .from('bookings')
    .select('payment_plan,stripe_customer_id')
    .eq('booking_id', payment.booking_id)
    .eq('user_id', user.id)
    .single()
  if (!billing) return jsonResponse({ error: 'Booking payment settings are unavailable' }, 409)

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(billing.stripe_customer_id
        ? { customer: billing.stripe_customer_id }
        : { customer_email: user.email, customer_creation: 'always' as const }),
      client_reference_id: payment.booking_id,
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: payment.amount,
          product_data: { name: `${payment.trip_title} — ${payment.package_name}` },
        },
      }],
      metadata: {
        payment_id: payment.payment_id,
        booking_id: payment.booking_id,
        ...(appliedPromoCode ? { promo_code: appliedPromoCode, promo_prize: appliedPrize } : {}),
      },
      payment_intent_data: {
        metadata: {
          payment_id: payment.payment_id,
          booking_id: payment.booking_id,
          ...(appliedPromoCode ? { promo_code: appliedPromoCode } : {}),
        },
        ...(billing.payment_plan === 'installments' ? { setup_future_usage: 'off_session' as const } : {}),
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
