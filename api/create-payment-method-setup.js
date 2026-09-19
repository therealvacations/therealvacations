import { createClient } from '@supabase/supabase-js';

function formEncode(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.append(key, String(value));
  });
  return params;
}

async function stripeRequest(path, secretKey, options = {}) {
  const response = await fetch('https://api.stripe.com/v1' + path, {
    ...options,
    headers: {
      authorization: 'Bearer ' + secretKey,
      ...(options.headers || {}),
    },
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

  const { data: existing } = await admin
    .from('user_payment_methods')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .not('stripe_customer_id', 'is', null)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await stripeRequest('/customers', stripeKey, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formEncode({
        email: user.email,
        'metadata[trv_user_id]': user.id,
      }),
    });
    customerId = customer.id;
  }

  const setupIntent = await stripeRequest('/setup_intents', stripeKey, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formEncode({
      customer: customerId,
      usage: 'off_session',
      'payment_method_types[0]': 'card',
      'metadata[trv_user_id]': user.id,
      'metadata[purpose]': 'travel_request_payment_method',
    }),
  });

  return res.status(200).json({
    client_secret: setupIntent.client_secret,
    setup_intent_id: setupIntent.id,
  });
}
