import { createClient } from 'npm:@supabase/supabase-js@2'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character] ?? character))
}

function money(value: unknown, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(),
  }).format(Number(value ?? 0) / 100)
}

function emailShell(heading: string, content: string, siteUrl: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1f7;font-family:Arial,sans-serif;color:#30243e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#fff;border-radius:16px"><tr><td style="background:#1a0533;color:#fff;padding:24px 30px;border-radius:16px 16px 0 0"><img src="${siteUrl}/logo.jpeg" width="180" alt="The Real Vacations" style="display:block;max-width:100%;height:auto"><strong style="display:block;font-size:18px;margin-top:12px">The Real Vacations</strong></td></tr><tr><td style="padding:30px"><h1 style="font-size:24px;color:#1a0533;margin:0 0 18px">${escapeHtml(heading)}</h1>${content}<p style="margin-top:28px"><a href="${siteUrl}/my-trips" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold">Open My TRV Trips</a></p><p style="color:#777;font-size:12px;margin-top:28px">Questions? Reply to this email or contact The Real Vacations.<br><a href="${siteUrl}/terms-of-service">Booking and refund terms</a> · <a href="${siteUrl}/privacy-policy">Privacy policy</a></p></td></tr></table></td></tr></table></body></html>`
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  const fromName = Deno.env.get('RESEND_FROM_NAME') ?? 'The Real Vacations'
  const replyTo = Deno.env.get('TRV_CONTACT_EMAIL') ?? fromEmail
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://therealvacations.com').replace(/\/$/, '')
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !serviceRoleKey || !resendKey || !fromEmail) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }
  if (!bearer || bearer !== serviceRoleKey) return jsonResponse({ error: 'Forbidden' }, 403)

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return jsonResponse({ error: 'Invalid JSON' }, 400) }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const requestedType = String(body.template_type ?? '')
  const sourceEventId = String(body.event_id ?? '')
  if (!sourceEventId) return jsonResponse({ error: 'Event ID is required' }, 422)

  let templateType = requestedType
  let recipient = ''
  let subject = ''
  let html = ''
  let relatedTable = ''
  let relatedId = ''

  if (requestedType === 'request_received') {
    const submissionId = String(body.tally_submission_id ?? '')
    const { data: travelRequest } = await admin.from('travel_requests')
      .select('request_id,requester_email,primary_first_name,destination')
      .eq('tally_submission_id', submissionId).maybeSingle()
    if (!travelRequest) return jsonResponse({ error: 'Travel request not found' }, 404)
    recipient = travelRequest.requester_email
    subject = 'We received your travel request'
    relatedTable = 'travel_requests'; relatedId = travelRequest.request_id
    html = emailShell('Your request is with our travel team', `<p>Hi ${escapeHtml(travelRequest.primary_first_name || 'Traveler')},</p><p>We received your request${travelRequest.destination ? ` for <strong>${escapeHtml(travelRequest.destination)}</strong>` : ''}. We’ll review the details and follow up with next steps.</p>`, siteUrl)
  } else if (requestedType === 'group_invitation') {
    const invitationId = String(body.invitation_id ?? '')
    const joinUrl = String(body.join_url ?? '')
    if (!joinUrl.startsWith(`${siteUrl}/join-group?code=`)) return jsonResponse({ error: 'Invalid invitation URL' }, 422)
    const { data: invitation } = await admin.from('travel_group_invitations')
      .select('invitation_id,invited_email,expires_at,travel_groups!inner(name)')
      .eq('invitation_id', invitationId).maybeSingle()
    if (!invitation?.invited_email) return jsonResponse({ error: 'Email invitation not found' }, 404)
    recipient = invitation.invited_email
    subject = `You're invited to ${invitation.travel_groups.name}`
    relatedTable = 'travel_group_invitations'; relatedId = invitation.invitation_id
    html = emailShell('Join your travel group', `<p>You’ve been invited to <strong>${escapeHtml(invitation.travel_groups.name)}</strong>.</p><p><a href="${escapeHtml(joinUrl)}">Accept this private invitation</a> before ${escapeHtml(new Date(invitation.expires_at).toLocaleDateString())}. If you weren’t expecting it, you can ignore this email.</p>`, siteUrl)
  } else if (requestedType === 'payment_update' || requestedType === 'payment_reminder') {
    const paymentId = String(body.payment_id ?? '')
    const { data: payment } = await admin.from('booking_payments')
      .select('payment_id,scheduled_amount,scheduled_for,paid_amount,status,kind,currency,bookings!inner(booking_id,user_id,total_amount,amount_paid,balance_due,trips!inner(title,dates_start))')
      .eq('payment_id', paymentId).maybeSingle()
    if (!payment) return jsonResponse({ error: 'Payment not found' }, 404)
    const { data: authUser } = await admin.auth.admin.getUserById(payment.bookings.user_id)
    if (!authUser.user?.email) return jsonResponse({ error: 'Traveler email not found' }, 404)
    recipient = authUser.user.email
    relatedTable = 'booking_payments'; relatedId = payment.payment_id
    const firstName = authUser.user.user_metadata?.first_name || 'Traveler'
    const tripTitle = payment.bookings.trips.title
    if (requestedType === 'payment_reminder') {
      templateType = 'payment_reminder'
      subject = `Payment reminder for ${tripTitle}`
      html = emailShell('A trip payment is coming due', `<p>Hi ${escapeHtml(firstName)},</p><p>Your <strong>${money(payment.scheduled_amount, payment.currency)}</strong> payment for ${escapeHtml(tripTitle)} is due ${escapeHtml(payment.scheduled_for)}.</p><p>Remaining balance: <strong>${money(payment.bookings.balance_due, payment.currency)}</strong>.</p>`, siteUrl)
    } else if (payment.status === 'succeeded') {
      templateType = ['deposit', 'pay_in_full'].includes(payment.kind) ? 'booking_confirmation' : 'payment_receipt'
      subject = templateType === 'booking_confirmation' ? `Booking confirmed: ${tripTitle}` : `Payment received: ${tripTitle}`
      html = emailShell(templateType === 'booking_confirmation' ? 'Your booking is confirmed' : 'Your payment was received', `<p>Hi ${escapeHtml(firstName)},</p><p>We received <strong>${money(payment.paid_amount, payment.currency)}</strong> for ${escapeHtml(tripTitle)}.</p><p>Total paid: <strong>${money(payment.bookings.amount_paid, payment.currency)}</strong><br>Balance remaining: <strong>${money(payment.bookings.balance_due, payment.currency)}</strong></p>`, siteUrl)
    } else if (payment.status === 'refunded') {
      templateType = 'payment_refunded'
      subject = `Refund processed: ${tripTitle}`
      html = emailShell('Your refund was recorded', `<p>Hi ${escapeHtml(firstName)},</p><p>We recorded a refund for your ${money(payment.scheduled_amount, payment.currency)} payment for ${escapeHtml(tripTitle)}.</p><p>Current remaining balance: <strong>${money(payment.bookings.balance_due, payment.currency)}</strong>.</p>`, siteUrl)
    } else {
      templateType = 'payment_failed'
      subject = `Payment needs attention: ${tripTitle}`
      html = emailShell('Your payment needs attention', `<p>Hi ${escapeHtml(firstName)},</p><p>Your ${money(payment.scheduled_amount, payment.currency)} payment for ${escapeHtml(tripTitle)} was not completed. No successful payment was recorded. Please return to My TRV Trips to try again.</p>`, siteUrl)
    }
  } else {
    return jsonResponse({ error: 'Unsupported email template' }, 422)
  }

  const idempotencyKey = `${templateType}:${sourceEventId}:${relatedId}`
  const { data: deliveryId, error: claimError } = await admin.rpc('claim_email_delivery', {
    p_idempotency_key: idempotencyKey,
    p_template_type: templateType,
    p_recipient_email: recipient,
    p_subject: subject,
    p_related_table: relatedTable,
    p_related_id: relatedId,
  })
  if (claimError) return jsonResponse({ error: 'Unable to claim email delivery' }, 500)
  if (!deliveryId) return jsonResponse({ delivered: true, duplicate: true })

  const sendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: [recipient],
      from: `${fromName} <${fromEmail}>`,
      reply_to: replyTo || undefined,
      subject,
      html,
      tags: [{ name: 'category', value: 'trv-transactional' }, { name: 'template', value: templateType.replace(/_/g, '-') }],
    }),
  })

  const providerData = await sendResponse.json().catch(() => ({})) as { id?: string }
  if (!sendResponse.ok) {
    await admin.from('email_deliveries').update({
      status: 'failed', last_error: `resend_http_${sendResponse.status}`,
    }).eq('delivery_id', deliveryId)
    return jsonResponse({ error: 'Email provider rejected the message' }, 502)
  }

  await admin.from('email_deliveries').update({
    status: 'sent',
    provider_message_id: providerData.id ?? null,
    sent_at: new Date().toISOString(),
    last_error: null,
  }).eq('delivery_id', deliveryId)
  return jsonResponse({ delivered: true })
})
