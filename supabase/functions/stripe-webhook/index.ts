import Stripe from 'npm:stripe@22.6.2'
import { createClient } from 'npm:@supabase/supabase-js@2'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !webhookSecret) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return jsonResponse({ error: 'Missing signature' }, 400)

  const stripe = new Stripe(stripeSecretKey)
  const cryptoProvider = Stripe.createSubtleCryptoProvider()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(), signature, webhookSecret, undefined, cryptoProvider,
    )
  } catch {
    return jsonResponse({ error: 'Invalid signature' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const sendPaymentEmail = async (paymentId: string) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_type: 'payment_update',
        payment_id: paymentId,
        event_id: event.id,
      }),
    })
    if (!response.ok) throw new Error(`Payment email failed with HTTP ${response.status}`)
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      const paymentId = session.metadata?.payment_id
      if (!paymentId) return jsonResponse({ received: true, legacy: true })
      if (session.payment_status !== 'paid') return jsonResponse({ received: true })

      const { error } = await admin.rpc('complete_stripe_booking_payment', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_livemode: event.livemode,
        p_payment_id: paymentId,
        p_checkout_session_id: session.id,
        p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_amount_total: session.amount_total ?? 0,
        p_currency: session.currency ?? '',
        p_customer_id: typeof session.customer === 'string' ? session.customer : null,
      })
      if (error) throw error
      await sendPaymentEmail(paymentId)
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      const paymentId = session.metadata?.payment_id
      if (!paymentId) return jsonResponse({ received: true, legacy: true })
      const { error } = await admin.rpc('sync_stripe_booking_payment_status', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_livemode: event.livemode,
        p_payment_id: paymentId,
        p_status: event.type === 'checkout.session.expired' ? 'cancelled' : 'failed',
        p_failure_code: null,
        p_failure_message: null,
      })
      if (error) throw error
      if (event.type === 'checkout.session.async_payment_failed') await sendPaymentEmail(paymentId)
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge
      let paymentId = charge.metadata?.payment_id
      if (!paymentId && typeof charge.payment_intent === 'string') {
        const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent)
        paymentId = paymentIntent.metadata?.payment_id
      }
      if (paymentId && charge.refunded) {
        const { error } = await admin.rpc('sync_stripe_booking_payment_status', {
          p_event_id: event.id,
          p_event_type: event.type,
          p_livemode: event.livemode,
          p_payment_id: paymentId,
          p_status: 'refunded',
          p_failure_code: null,
          p_failure_message: null,
        })
        if (error) throw error
        await sendPaymentEmail(paymentId)
      }
    }
  } catch (error) {
    console.error('Unable to process Stripe event', event.id, error instanceof Error ? error.message : 'Unknown error')
    return jsonResponse({ error: 'Webhook processing failed' }, 500)
  }

  return jsonResponse({ received: true })
})
