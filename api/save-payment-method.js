import { createClient } from '@supabase/supabase-js';

async function stripeGet(path, secretKey) {
  const response = await fetch('https://api.stripe.com/v1' + path, {
    headers: { authorization: 'Bearer ' + secretKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl || !serviceRoleKey || !stripeKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in is required' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user?.email) return res.status(401).json({ error: 'Sign in is required' });

  const setupIntentId = String(req.body?.setup_intent_id || '');
  const cardholderName = String(req.body?.cardholder_name || '').trim();
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) {
    return res.status(422).json({ error: 'Invalid payment setup' });
  }
  if (cardholderName.length < 2 || cardholderName.length > 160) {
    return res.status(422).json({ error: 'Enter the cardholder name' });
  }

  const setupIntent = await stripeGet('/setup_intents/' + encodeURIComponent(setupIntentId), stripeKey);
  if (setupIntent.status !== 'succeeded') {
    return res.status(409).json({ error: 'Card setup is not complete' });
  }
  if (String(setupIntent.metadata?.trv_user_id || '') !== user.id) {
    return res.status(403).json({ error: 'Payment setup does not belong to this account' });
  }

  const paymentMethodId = typeof setupIntent.payment_method === 'string'
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;
  const customerId = typeof setupIntent.customer === 'string'
    ? setupIntent.customer
    : setupIntent.customer?.id;

  if (!paymentMethodId || !customerId) {
    return res.status(409).json({ error: 'Stripe did not return a reusable payment method' });
  }

  const paymentMethod = await stripeGet('/payment_methods/' + encodeURIComponent(paymentMethodId), stripeKey);
  const card = paymentMethod.card;
  if (!card?.last4) return res.status(409).json({ error: 'Saved card details are unavailable' });

  await admin.from('user_payment_methods')
    .update({ is_default: false })
    .eq('user_id', user.id);

  const { data: existing } = await admin.from('user_payment_methods')
    .select('method_id')
    .eq('user_id', user.id)
    .eq('stripe_payment_method_id', paymentMethodId)
    .maybeSingle();

  let method;
  if (existing) {
    const { data, error } = await admin.from('user_payment_methods')
      .update({
        stripe_customer_id: customerId,
        cardholder_name: cardholderName,
        last4: card.last4,
        brand: card.brand || null,
        exp_month: card.exp_month || null,
        exp_year: card.exp_year || null,
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq('method_id', existing.method_id)
      .select('method_id,last4,brand,exp_month,exp_year,is_default')
      .single();
    if (error) return res.status(500).json({ error: 'Unable to save payment method' });
    method = data;
  } else {
    const { data, error } = await admin.from('user_payment_methods')
      .insert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        cardholder_name: cardholderName,
        last4: card.last4,
        brand: card.brand || null,
        exp_month: card.exp_month || null,
        exp_year: card.exp_year || null,
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .select('method_id,last4,brand,exp_month,exp_year,is_default')
      .single();
    if (error) return res.status(500).json({ error: 'Unable to save payment method' });
    method = data;
  }

  return res.status(200).json({ saved: true, method });
}
