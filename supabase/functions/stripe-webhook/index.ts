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
  const tryPaymentEmail = async (paymentId: string) => {
    try {
      await sendPaymentEmail(paymentId)
    } catch (error) {
      // Payment reconciliation must never be rolled back or retried because an
      // optional notification provider is temporarily unavailable.
      console.error('Payment notification was not sent', paymentId, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.metadata?.checkout_type === 'vip_membership') {
        const userId = session.metadata?.user_id
        const billingPlan = session.metadata?.billing_plan
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null
        if (!userId || !subscriptionId || !['monthly','annual'].includes(String(billingPlan ?? ''))) {
          return jsonResponse({ error: 'VIP checkout metadata is incomplete' }, 422)
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const periodEnd = (subscription as any).current_period_end
          ? new Date(Number((subscription as any).current_period_end) * 1000).toISOString()
          : null
        const trialStart = (subscription as any).trial_start
          ? new Date(Number((subscription as any).trial_start) * 1000).toISOString()
          : null
        const trialEnd = (subscription as any).trial_end
          ? new Date(Number((subscription as any).trial_end) * 1000).toISOString()
          : null
        const { error: vipError } = await admin.from('vip_memberships').upsert({
          user_id: userId,
          status: subscription.status === 'trialing' ? 'trialing' : 'active',
          billing_plan: String(billingPlan),
          trial_started_at: trialStart,
          trial_ends_at: trialEnd,
          paid_through: periodEnd,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          welcome_gift_status: 'pending',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        if (vipError) throw vipError

        try {
          const welcome = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              template_type: 'vip_welcome',
              user_id: userId,
              event_id: event.id,
            }),
          })
          if (!welcome.ok) console.error('VIP welcome email failed', welcome.status)
        } catch (emailError) {
          console.error('VIP welcome email failed', emailError instanceof Error ? emailError.message : 'Unknown error')
        }

        return jsonResponse({ received: true, vip_membership: true })
      }

      if (session.metadata?.checkout_type === 'custom_quote') {
        const paymentId = session.metadata?.payment_id
        const customBookingId = session.metadata?.custom_booking_id
        if (!paymentId || !customBookingId) {
          return jsonResponse({ error: 'Custom quote checkout metadata is incomplete' }, 422)
        }
        if (session.payment_status !== 'paid') return jsonResponse({ received: true })

        const paymentIntent = typeof session.payment_intent === 'string'
          ? await stripe.paymentIntents.retrieve(session.payment_intent)
          : session.payment_intent
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : typeof paymentIntent?.customer === 'string' ? paymentIntent.customer : null

        const { error: customError } = await admin.rpc('complete_custom_booking_payment', {
          p_payment_id: paymentId,
          p_checkout_session_id: session.id,
          p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          p_amount_total: session.amount_total ?? 0,
          p_customer_id: customerId,
        })
        if (customError) throw customError

        return jsonResponse({ received: true, custom_quote: true })
      }

      const paymentId = session.metadata?.payment_id
      if (!paymentId) return jsonResponse({ received: true, legacy: true })
      if (session.payment_status !== 'paid') return jsonResponse({ received: true })

      const paymentIntent = typeof session.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(session.payment_intent)
        : session.payment_intent
      const paymentMethodId = typeof paymentIntent?.payment_method === 'string'
        ? paymentIntent.payment_method
        : paymentIntent?.payment_method?.id ?? null

      const { error } = await admin.rpc('complete_stripe_booking_payment', {
        p_event_id: event.id,
        p_event_type: event.type,
        p_livemode: event.livemode,
        p_payment_id: paymentId,
        p_checkout_session_id: session.id,
        p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        p_amount_total: session.amount_total ?? 0,
        p_currency: session.currency ?? '',
        p_customer_id: typeof session.customer === 'string'
          ? session.customer
          : typeof paymentIntent?.customer === 'string' ? paymentIntent.customer : null,
        p_payment_method_id: paymentMethodId,
      })
      if (error) throw error

      const promoCode = session.metadata?.promo_code
      const bookingId = session.metadata?.booking_id
      if (promoCode && bookingId) {
        const { data: redeemedBooking } = await admin
          .from('bookings')
          .update({ promo_redeemed_at: new Date().toISOString() })
          .eq('booking_id', bookingId)
          .eq('promo_code', promoCode)
          .is('promo_redeemed_at', null)
          .select('booking_id')
          .maybeSingle()

        if (redeemedBooking) {
          const { data: codeRow } = await admin
            .from('discount_codes')
            .select('used_count,max_uses')
            .eq('code', promoCode)
            .maybeSingle()
          if (codeRow) {
            const currentUsed = Number(codeRow.used_count ?? 0)
            const maxUses = Number(codeRow.max_uses ?? 1)
            if (currentUsed < maxUses) {
              await admin.from('discount_codes')
                .update({ used_count: currentUsed + 1 })
                .eq('code', promoCode)
                .eq('used_count', currentUsed)
            }
          }
        }
      }

      await tryPaymentEmail(paymentId)
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session
      const paymentId = session.metadata?.payment_id

      if (session.metadata?.checkout_type === 'custom_quote') {
        if (!paymentId) return jsonResponse({ received: true, custom_quote: true })
        const { error: customFailure } = await admin.from('custom_booking_payments').update({
          status: event.type === 'checkout.session.expired' ? 'expired' : 'failed',
          updated_at: new Date().toISOString(),
        }).eq('payment_id', paymentId).neq('status', 'succeeded')
        if (customFailure) throw customFailure
        return jsonResponse({ received: true, custom_quote: true })
      }

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
      if (event.type === 'checkout.session.async_payment_failed') await tryPaymentEmail(paymentId)
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id
      if (userId) {
        const status = event.type === 'customer.subscription.deleted'
          ? 'cancelled'
          : ['active','trialing'].includes(subscription.status) ? subscription.status : 'past_due'
        const periodEnd = (subscription as any).current_period_end
          ? new Date(Number((subscription as any).current_period_end) * 1000).toISOString()
          : null
        const trialStart = (subscription as any).trial_start
          ? new Date(Number((subscription as any).trial_start) * 1000).toISOString()
          : null
        const trialEnd = (subscription as any).trial_end
          ? new Date(Number((subscription as any).trial_end) * 1000).toISOString()
          : null
        const { error: membershipError } = await admin.from('vip_memberships').update({
          status,
          trial_started_at: trialStart,
          trial_ends_at: trialEnd,
          paid_through: periodEnd,
          stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
          stripe_subscription_id: subscription.id,
          billing_plan: subscription.metadata?.billing_plan || null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId)
        if (membershipError) throw membershipError
      }
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
        await tryPaymentEmail(paymentId)
      }
    }
  } catch (error) {
    console.error('Unable to process Stripe event', event.id, error instanceof Error ? error.message : 'Unknown error')
    return jsonResponse({ error: 'Webhook processing failed' }, 500)
  }

  return jsonResponse({ received: true })
})
