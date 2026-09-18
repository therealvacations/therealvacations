import { createClient } from 'npm:@supabase/supabase-js@2'
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const supabaseUrl = Deno.env.get('SUPABASE_URL'), serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500)
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authorized } = await admin.rpc('verify_autopay_cron_secret', { p_secret: request.headers.get('x-cron-secret') ?? '' })
  if (authorized !== true) return json({ error: 'Unauthorized' }, 401)
  const due = new Date(); due.setUTCDate(due.getUTCDate() + 3); const scheduledFor = due.toISOString().slice(0, 10)
  const { data: payments, error } = await admin.from('booking_payments').select('payment_id,scheduled_for').eq('status', 'scheduled').eq('scheduled_for', scheduledFor).limit(100)
  if (error) return json({ error: 'Unable to load upcoming payments' }, 500)
  let sent = 0
  for (const payment of payments ?? []) {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, { method: 'POST', headers: { authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'content-type': 'application/json' }, body: JSON.stringify({ template_type: 'payment_reminder', payment_id: payment.payment_id, event_id: `reminder:${payment.payment_id}:${payment.scheduled_for}` }) })
    if (response.ok) sent += 1
  }
  return json({ scheduled_for: scheduledFor, processed: payments?.length ?? 0, sent })
})
