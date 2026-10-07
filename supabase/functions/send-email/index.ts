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
  return `<!doctype html><html><body style="margin:0;background:#f4f1f7;font-family:Arial,sans-serif;color:#30243e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:auto;background:#fff;border-radius:16px"><tr><td style="background:#1a0533;color:#fff;padding:24px 30px;border-radius:16px 16px 0 0"><img src="${siteUrl}/newtrv180x180no%20bckgrd%20logo%20favi.jpg" width="180" alt="The Real Vacations" style="display:block;max-width:100%;height:auto"><strong style="display:block;font-size:18px;margin-top:12px">The Real Vacations</strong></td></tr><tr><td style="padding:30px"><h1 style="font-size:24px;color:#1a0533;margin:0 0 18px">${escapeHtml(heading)}</h1>${content}<p style="margin-top:28px"><a href="${siteUrl}/my-trips" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold">Open My TRV Trips</a></p><p style="color:#777;font-size:12px;margin-top:28px">Questions? Reply to this email or contact The Real Vacations.<br><a href="${siteUrl}/terms-of-service">Booking and refund terms</a> · <a href="${siteUrl}/privacy-policy">Privacy policy</a></p></td></tr></table></td></tr></table></body></html>`
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'kc@therealvacations.com'
  const fromName = Deno.env.get('RESEND_FROM_NAME') ?? 'The Real Vacations'
  const replyTo = Deno.env.get('TRV_CONTACT_EMAIL') ?? fromEmail
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://therealvacations.com').replace(/\/$/, '')
  const bearer = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const apiKey = request.headers.get('apikey') ?? ''
  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let authorized = Boolean(bearer && bearer === serviceRoleKey)
  if (!authorized && apiKey) {
    const caller = createClient(supabaseUrl, apiKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: adminCheckError } = await caller.auth.admin.listUsers({ page: 1, perPage: 1 })
    authorized = !adminCheckError
  }
  if (!authorized) return jsonResponse({ error: 'Forbidden' }, 403)

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

  if (requestedType === 'quote_ready') {
    const quoteId = String(body.quote_id ?? '')
    const { data: quote } = await admin.from('travel_quotes')
      .select('quote_id,title,summary,status,valid_until,travel_quote_options(name,total_amount,deposit_amount,sort_order),travel_requests!inner(requester_email,primary_first_name,destination)')
      .eq('quote_id', quoteId).maybeSingle()
    if (!quote || quote.status !== 'ready') return jsonResponse({ error: 'Published quote not found' }, 404)

    const travelRequest = quote.travel_requests
    recipient = travelRequest.requester_email
    subject = `Your TRV quote is ready: ${quote.title}`
    relatedTable = 'travel_quotes'; relatedId = quote.quote_id

    const options = (quote.travel_quote_options ?? []).sort((a: any,b: any) => a.sort_order-b.sort_order)
    const optionHtml = options.map((o: any) => `<div style="padding:14px 0;border-bottom:1px solid #eee"><strong style="color:#1a0533">${escapeHtml(o.name)}</strong><div style="font-size:18px;font-weight:700;color:#7c3aed;margin-top:4px">${money(o.total_amount)}</div>${o.deposit_amount ? '<div style="font-size:13px;color:#6b6270">Deposit: '+money(o.deposit_amount)+'</div>' : ''}</div>`).join('')
    const next = '/proposal?quote='+encodeURIComponent(quoteId)
    const loginUrl = siteUrl+'/login?next='+encodeURIComponent(next)
    const signupUrl = siteUrl+'/signup?next='+encodeURIComponent(next)
    const validText = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}) : ''

    html = emailShell('Your TRV quote is ready', `<p>Hi ${escapeHtml(travelRequest.primary_first_name || 'Traveler')},</p><p>${escapeHtml(quote.summary || ('We created your personalized travel options'+(travelRequest.destination ? ' for '+travelRequest.destination : '')+'.'))}</p><div style="margin:22px 0">${optionHtml}</div>${validText ? '<p style="font-size:13px;color:#6b6270">Quote valid through <strong>'+escapeHtml(validText)+'</strong>.</p>' : ''}<p>Open your secure TRV account to review the full proposal and approve the option you want.</p><p><a href="${loginUrl}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold;display:inline-block">Review My Quote →</a></p><p style="font-size:13px;color:#6b6270">New to TRV? <a href="${signupUrl}" style="color:#7c3aed;font-weight:bold">Create your account using this email address</a>.</p>`, siteUrl)
  } else if (requestedType === 'request_received') {
    const submissionId = String(body.tally_submission_id ?? '')
    const { data: travelRequest } = await admin.from('travel_requests')
      .select('request_id,requester_email,primary_first_name,destination')
      .eq('tally_submission_id', submissionId).maybeSingle()
    if (!travelRequest) return jsonResponse({ error: 'Travel request not found' }, 404)
    recipient = travelRequest.requester_email
    subject = 'Your TRV travel request is secured'
    relatedTable = 'travel_requests'; relatedId = travelRequest.request_id
    html = emailShell('Your travel request is secured with TRV', `<p>Hi ${escapeHtml(travelRequest.primary_first_name || 'Traveler')},</p><p>Your travel request${travelRequest.destination ? ` for <strong>${escapeHtml(travelRequest.destination)}</strong>` : ''} is now with The Real Vacations and is <strong>awaiting live supplier confirmation</strong>.</p><p>We’re confirming availability and final details with the applicable airline, hotel or resort, rental-car company, cruise line, attraction, or other supplier. Once confirmed, we’ll finalize the reservation, arrange the authorized payment, and send your official confirmation numbers and travel credentials.</p><p>For time-sensitive travel, we may also call or text to make sure you received everything you need before departure.</p><p style="color:#777;font-size:12px"><strong>Important:</strong> Your TRV request is secured, but individual supplier reservations are not confirmed until The Real Vacations sends written confirmation.</p>`, siteUrl)
  } else if (requestedType === 'request_payment_ready') {
    const requestId = String(body.request_id ?? '')
    const fulfillmentId = String(body.fulfillment_id ?? '')
    const checkoutUrl = String(body.checkout_url ?? '')
    if (!checkoutUrl.startsWith('https://checkout.stripe.com/')) return jsonResponse({ error: 'Invalid payment URL' }, 422)

    const { data: travelRequest } = await admin.from('travel_requests')
      .select('request_id,requester_email,primary_first_name,destination')
      .eq('request_id', requestId).maybeSingle()
    const { data: fulfillment } = await admin.from('travel_request_fulfillments')
      .select('fulfillment_id,supplier_name,supplier_subtotal,service_fee,total_amount,currency,confirmation_details,status')
      .eq('fulfillment_id', fulfillmentId).eq('request_id', requestId).maybeSingle()
    if (!travelRequest || !fulfillment) return jsonResponse({ error: 'Confirmed request not found' }, 404)

    recipient = travelRequest.requester_email
    subject = 'Your confirmed TRV travel arrangements are ready'
    relatedTable = 'travel_request_fulfillments'; relatedId = fulfillment.fulfillment_id
    html = emailShell('Your travel arrangements are ready to complete', `<p>Hi ${escapeHtml(travelRequest.primary_first_name || 'Traveler')},</p><p>We have completed supplier confirmation for your travel request${travelRequest.destination ? ` to <strong>${escapeHtml(travelRequest.destination)}</strong>` : ''}.</p><p><strong>Confirmed travel:</strong> ${escapeHtml(fulfillment.supplier_name || 'Travel arrangements')}<br><strong>Supplier amount:</strong> ${money(fulfillment.supplier_subtotal, fulfillment.currency)}<br>${Number(fulfillment.service_fee || 0) > 0 ? `<strong>TRV service fee:</strong> ${money(fulfillment.service_fee, fulfillment.currency)}<br>` : ''}<strong>Total due:</strong> ${money(fulfillment.total_amount, fulfillment.currency)}</p><p><a href="${escapeHtml(checkoutUrl)}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold;display:inline-block">Complete Secure Payment →</a></p><p style="color:#777;font-size:12px">Your supplier reservation is not considered fully confirmed until payment is completed and The Real Vacations sends your final confirmation credentials.</p>`, siteUrl)
  } else if (requestedType === 'request_confirmed') {
    const requestId = String(body.request_id ?? '')
    const fulfillmentId = String(body.fulfillment_id ?? '')
    const { data: travelRequest } = await admin.from('travel_requests')
      .select('request_id,requester_email,primary_first_name,destination')
      .eq('request_id', requestId).maybeSingle()
    const { data: fulfillment } = await admin.from('travel_request_fulfillments')
      .select('fulfillment_id,supplier_name,total_amount,currency,confirmation_details,status')
      .eq('fulfillment_id', fulfillmentId).eq('request_id', requestId).maybeSingle()
    if (!travelRequest || !fulfillment || fulfillment.status !== 'paid') return jsonResponse({ error: 'Paid confirmed request not found' }, 404)

    recipient = travelRequest.requester_email
    subject = 'Your TRV reservation is confirmed'
    relatedTable = 'travel_request_fulfillments'; relatedId = fulfillment.fulfillment_id
    html = emailShell('Your reservation is confirmed', `<p>Hi ${escapeHtml(travelRequest.primary_first_name || 'Traveler')},</p><p>Your payment of <strong>${money(fulfillment.total_amount, fulfillment.currency)}</strong> has been received and your confirmed travel arrangements are now recorded with The Real Vacations.</p><p><strong>Confirmed travel:</strong> ${escapeHtml(fulfillment.supplier_name || 'Travel arrangements')}</p>${fulfillment.confirmation_details ? `<p><strong>Confirmation details:</strong><br>${escapeHtml(fulfillment.confirmation_details).replace(/\\n/g,'<br>')}</p>` : ''}<p>Keep this email with your travel documents. Your trip details will also remain available through your TRV account.</p>`, siteUrl)
  } else if (requestedType === 'vip_welcome') {
    const userId = String(body.user_id ?? '')
    const { data: membership } = await admin.from('vip_memberships')
      .select('user_id,status,billing_plan,welcome_gift_status')
      .eq('user_id', userId).maybeSingle()
    if (!membership || !['active','trialing'].includes(membership.status)) return jsonResponse({ error: 'VIP membership not found' }, 404)
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    if (!authUser.user?.email) return jsonResponse({ error: 'VIP member email not found' }, 404)
    recipient = authUser.user.email
    subject = 'Welcome to TRV VIP'
    relatedTable = 'vip_memberships'; relatedId = membership.user_id
    const firstName = authUser.user.user_metadata?.first_name || 'Traveler'
    const planLabel = membership.billing_plan === 'annual' ? '$129.99/year' : membership.billing_plan === 'monthly' ? '$15.99/month' : 'VIP membership'
    html = emailShell('Welcome to TRV VIP', `<p>Hi ${escapeHtml(firstName)},</p><p>Your TRV VIP membership is active.</p><p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p><p>You now have access to private travel offers, member-only perks, and VIP opportunities inside your TRV account.</p><p>As a new paid VIP member, you also receive a TRV welcome travel/lifestyle item. Your item may be a T-shirt, hat, cup/tumbler, or another nice TRV-branded item. The exact item varies.</p><p><a href="${siteUrl}/vip" style="color:#7c3aed;font-weight:bold">Open TRV VIP and add your welcome-item delivery details →</a></p>`, siteUrl)
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
  } else if (requestedType === 'group_deposit_invitation') {
    const invitationId = String(body.invitation_id ?? '')
    const joinUrl = String(body.join_url ?? '')
    if (!joinUrl.startsWith(`${siteUrl}/join-group?code=`)) return jsonResponse({ error: 'Invalid invitation URL' }, 422)

    const { data: invitation } = await admin.from('travel_group_invitations')
      .select('invitation_id,group_id,invited_email,expires_at,travel_groups!inner(name,leader_user_id,trip_id,trips(title,dates_start,dates_end))')
      .eq('invitation_id', invitationId).maybeSingle()
    if (!invitation?.invited_email) return jsonResponse({ error: 'Traveler deposit invitation not found' }, 404)

    const { data: member } = await admin.from('travel_group_members')
      .select('display_name,deposit_required,deposit_due_at')
      .eq('group_id', invitation.group_id)
      .ilike('invited_email', invitation.invited_email)
      .eq('status', 'invited')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!member) return jsonResponse({ error: 'Traveler deposit record not found' }, 404)

    const group = invitation.travel_groups
    const trip = group?.trips
    const tripTitle = trip?.title || group?.name || 'The Real Vacations Group Trip'
    const { data: leaderAuth } = await admin.auth.admin.getUserById(group.leader_user_id)
    const leaderName = leaderAuth.user?.user_metadata?.full_name || leaderAuth.user?.user_metadata?.first_name || leaderAuth.user?.email || 'your group leader'
    const dates = trip?.dates_start
      ? new Date(trip.dates_start + 'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) + (trip?.dates_end ? ' – ' + new Date(trip.dates_end + 'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '')
      : ''
    const dueAt = member.deposit_due_at || invitation.expires_at

    recipient = invitation.invited_email
    subject = `${tripTitle} — your TRV deposit is due`
    relatedTable = 'travel_group_invitations'; relatedId = invitation.invitation_id
    html = emailShell(`Your deposit for ${tripTitle}`, `<p>Hi ${escapeHtml(member.display_name || 'Traveler')},</p><p><strong>${escapeHtml(leaderName)}</strong> included you in a group booking for <strong>${escapeHtml(tripTitle)}</strong>${dates ? ` (${escapeHtml(dates)})` : ''}.</p><p>Your required non-refundable deposit is <strong>${money(member.deposit_required || 0)}</strong>.</p><p><strong>You have 24 hours from this invitation to complete your deposit.</strong> This group reservation is not confirmed until every traveler in the booking has paid the required deposit.</p><p><a href="${escapeHtml(joinUrl)}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:24px;font-weight:bold;display:inline-block">Pay My ${money(member.deposit_required || 0)} Deposit →</a></p><p style="font-size:13px;color:#6b6270">Deposit deadline: <strong>${escapeHtml(new Date(dueAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}))}</strong>.<br>Deposits are non-refundable.</p>`, siteUrl)
  } else if (requestedType === 'custom_quote_payment') {
    const paymentId = String(body.payment_id ?? '')
    const { data: payment } = await admin.from('custom_booking_payments')
      .select('payment_id,amount,kind,status,paid_at,custom_bookings!inner(custom_booking_id,user_id,status,currency,total_amount,amount_paid,balance_due,travel_quotes!inner(title),travel_quote_options!inner(name))')
      .eq('payment_id', paymentId).maybeSingle()
    if (!payment || payment.status !== 'succeeded') return jsonResponse({ error: 'Successful custom quote payment not found' }, 404)

    const booking = payment.custom_bookings
    const { data: authUser } = await admin.auth.admin.getUserById(booking.user_id)
    if (!authUser.user?.email) return jsonResponse({ error: 'Traveler email not found' }, 404)

    recipient = authUser.user.email
    relatedTable = 'custom_booking_payments'; relatedId = payment.payment_id
    const firstName = authUser.user.user_metadata?.first_name || 'Traveler'
    const tripTitle = booking.travel_quotes?.title || 'Your TRV custom trip'
    const optionName = booking.travel_quote_options?.name || ''
    const isPaidInFull = Number(booking.balance_due || 0) <= 0
    templateType = isPaidInFull ? 'custom_booking_confirmation' : 'custom_payment_receipt'
    subject = isPaidInFull ? `Payment received: ${tripTitle}` : `Deposit received: ${tripTitle}`
    html = emailShell(
      isPaidInFull ? 'Your TRV booking payment is complete' : 'Your TRV deposit was received',
      `<p>Hi ${escapeHtml(firstName)},</p><p>We received <strong>${money(payment.amount, booking.currency)}</strong> for <strong>${escapeHtml(tripTitle)}</strong>${optionName ? ` — ${escapeHtml(optionName)}` : ''}.</p><p><strong>Total:</strong> ${money(booking.total_amount, booking.currency)}<br><strong>Paid:</strong> ${money(booking.amount_paid, booking.currency)}<br><strong>Remaining balance:</strong> ${money(booking.balance_due, booking.currency)}</p><p>${isPaidInFull ? 'Your TRV account now shows this custom booking as paid in full.' : 'Your TRV account now shows this payment and the remaining balance. You can return to My TRV Trips anytime to continue payment.'}</p>`,
      siteUrl
    )
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
