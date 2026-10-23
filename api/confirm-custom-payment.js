import { createClient } from '@supabase/supabase-js';

// Both the customer return page and Stripe webhook must reconcile a payment
// through the same database transaction. Never compute balances in JS.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey || !stripeKey) return res.status(500).json({ error: 'Server configuration error' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const sessionId = String(req.body?.session_id || '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  if (!/^cs_(test_|live_)?[A-Za-z0-9_]+$/.test(sessionId)) {
    return res.status(422).json({ error: 'Invalid payment session' });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

  let stripeResponse;
  try {
    stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
      headers: { authorization: 'Bearer ' + stripeKey }
    });
  } catch {
    return res.status(502).json({ error: 'Unable to verify payment' });
  }
  const session = await stripeResponse.json().catch(() => ({}));
  if (!stripeResponse.ok) return res.status(502).json({ error: 'Unable to verify payment' });
  if (session.id !== sessionId || session.payment_status !== 'paid' || session.status !== 'complete') {
    return res.status(409).json({ error: 'Payment is not complete' });
  }
  if (session.mode !== 'payment' || session.metadata?.checkout_type !== 'custom_quote' ||
      session.metadata?.user_id !== user.id) {
    return res.status(403).json({ error: 'Payment does not belong to this account' });
  }

  const paymentId = String(session.metadata?.payment_id || '');
  const bookingId = String(session.metadata?.custom_booking_id || '');
  if (!paymentId || !bookingId) return res.status(409).json({ error: 'Payment metadata is incomplete' });

  const [{ data: payment, error: paymentError }, { data: booking, error: bookingError }] = await Promise.all([
    admin.from('custom_booking_payments').select('payment_id,custom_booking_id,amount,stripe_checkout_session_id,status')
      .eq('payment_id', paymentId).eq('custom_booking_id', bookingId).maybeSingle(),
    admin.from('custom_bookings').select('custom_booking_id,user_id,currency')
      .eq('custom_booking_id', bookingId).eq('user_id', user.id).maybeSingle()
  ]);
  if (paymentError || bookingError) return res.status(500).json({ error: 'Unable to verify booking records' });
  if (!payment || !booking) return res.status(404).json({ error: 'Payment record not found' });

  if (payment.stripe_checkout_session_id && payment.stripe_checkout_session_id !== session.id) {
    return res.status(409).json({ error: 'Payment session does not match booking record' });
  }
  if (Number(session.amount_total) !== Number(payment.amount) ||
      String(session.currency || '').toLowerCase() !== String(booking.currency || '').toLowerCase()) {
    return res.status(409).json({ error: 'Payment amount or currency mismatch' });
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null;
  const { error: reconcileError } = await admin.rpc('complete_custom_booking_payment', {
    p_payment_id: paymentId,
    p_checkout_session_id: session.id,
    p_payment_intent_id: intentId,
    p_amount_total: session.amount_total,
    p_customer_id: customerId
  });
  if (reconcileError) {
    console.error('Custom payment reconciliation failed', reconcileError.message);
    return res.status(500).json({ error: 'Payment was verified, but the booking update is pending. Please contact support if it does not update.' });
  }

  const { data: finalBooking, error: finalError } = await admin.from('custom_bookings')
    .select('custom_booking_id,status,total_amount,amount_paid,balance_due')
    .eq('custom_booking_id', bookingId).eq('user_id', user.id).single();
  if (finalError) return res.status(500).json({ error: 'Payment verified but unable to display updated booking' });
  return res.status(200).json({ ok: true, booking: finalBooking });
}
