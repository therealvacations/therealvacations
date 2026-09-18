import Stripe from 'npm:stripe@22.6.2'
import { createClient } from 'npm:@supabase/supabase-js@2'

type DuePayment = {
  payment_id: string
  booking_id: string
  amount: number
  currency: string
  stripe_customer_id: string
  stripe_payment_method_id: string
  trip_title: string
  checkout_attempt: number
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
})

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) return json({ error: 'Server configuration error' }, 500)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const suppliedSecret = request.headers.get('x-cron-secret') ?? ''
  const { data: authorized, error: authError } = await admin.rpc('verify_autopay_cron_secret', { p_secret: suppliedSecret })
  if (authError || authorized !== true) return json({ error: 'Unauthorized' }, 401)

  const { data, error } = await admin.rpc('claim_due_auto_payments', { p_limit: 25 })
  if (error) {
    console.error('Unable to claim due automatic payments', error.message)
    return json({ error: 'Unable to load scheduled payments' }, 500)
  }

  const stripe = new Stripe(stripeSecretKey)
  const results: Array<{ payment_id: string; status: string }> = []
  for (const payment of (data ?? []) as DuePayment[]) {
    let chargeSucceeded = false
    try {
      const intent = await stripe.paymentIntents.create({
        amount: payment.amount,
        currency: payment.currency,
        customer: payment.stripe_customer_id,
        payment_method: payment.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `${payment.trip_title} — automatic monthly installment`,
        metadata: { payment_id: payment.payment_id, booking_id: payment.booking_id, payment_type: 'automatic_installment' },
      }, { idempotencyKey: `autopay-${payment.payment_id}-${payment.checkout_attempt}` })

      if (intent.status !== 'succeeded') throw new Error(`payment_intent_${intent.status}`)
      chargeSucceeded = true
      const { error: completeError } = await admin.rpc('complete_stripe_booking_payment', {
        p_event_id: `autopay:${intent.id}`,
        p_event_type: 'scheduled.payment.succeeded',
        p_livemode: intent.livemode,
        p_payment_id: payment.payment_id,
        p_checkout_session_id: null,
        p_payment_intent_id: intent.id,
        p_amount_total: intent.amount_received,
        p_currency: intent.currency,
        p_customer_id: typeof intent.customer === 'string' ? intent.customer : payment.stripe_customer_id,
        p_payment_method_id: typeof intent.payment_method === 'string' ? intent.payment_method : payment.stripe_payment_method_id,
      })
      if (completeError) throw completeError
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'content-type': 'application/json' },
        body: JSON.stringify({ template_type: 'payment_update', payment_id: payment.payment_id, event_id: `autopay:${intent.id}` }),
      }).catch(() => undefined)
      results.push({ payment_id: payment.payment_id, status: 'succeeded' })
    } catch (chargeError) {
      const stripeError = chargeError as { code?: string; decline_code?: string; message?: string }
      console.error('Automatic installment failed', payment.payment_id, stripeError.code ?? stripeError.message ?? 'unknown')
      if (chargeSucceeded) {
        // Keep the row in processing. A later run reuses the same Stripe
        // idempotency key and safely finishes database reconciliation.
        results.push({ payment_id: payment.payment_id, status: 'reconciliation_pending' })
        continue
      }
      const { error: syncError } = await admin.rpc('sync_stripe_booking_payment_status', {
        p_event_id: `autopay-failed:${payment.payment_id}:${payment.checkout_attempt}`,
        p_event_type: 'scheduled.payment.failed',
        p_livemode: !stripeSecretKey.startsWith('sk_test_'),
        p_payment_id: payment.payment_id,
        p_status: 'failed',
        p_failure_code: stripeError.decline_code ?? stripeError.code ?? 'automatic_charge_failed',
        p_failure_message: 'Automatic payment was not completed. The traveler can securely retry from My Trips.',
      })
      if (syncError) console.error('Unable to record failed installment', syncError.message)
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'content-type': 'application/json' },
        body: JSON.stringify({ template_type: 'payment_update', payment_id: payment.payment_id, event_id: `autopay-failed:${payment.payment_id}:${payment.checkout_attempt}` }),
      }).catch(() => undefined)
      results.push({ payment_id: payment.payment_id, status: 'failed' })
    }
  }

  return json({ processed: results.length, results })
})
