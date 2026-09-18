const encoder = new TextEncoder()

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return result === 0
}

async function expectedSignature(payload: unknown, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(payload)),
  )
  return bytesToBase64(new Uint8Array(signature))
}

type TallyOption = { id?: string; text?: string }
type TallyField = {
  label?: string
  type?: string
  value?: unknown
  options?: TallyOption[]
}

function readableValue(field: TallyField) {
  if (!Array.isArray(field.value) || !field.options?.length) return field.value
  const options = new Map(field.options.map((option) => [option.id, option.text]))
  return field.value.map((value) => options.get(String(value)) ?? value)
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  const match = String(value ?? '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function toBoolean(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (/^(yes|true|1)/.test(normalized)) return true
  if (/^(no|false|0)/.test(normalized)) return false
  return null
}

function toDate(value: unknown) {
  const normalized = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const signingSecret = Deno.env.get('TALLY_SIGNING_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!signingSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Tally webhook is missing required server secrets')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const receivedSignature = request.headers.get('tally-signature') ?? ''
  const calculatedSignature = await expectedSignature(payload, signingSecret)
  if (!constantTimeEqual(receivedSignature, calculatedSignature)) {
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  if (payload?.eventType !== 'FORM_RESPONSE' || payload?.data?.formId !== 'KYKG48') {
    return jsonResponse({ error: 'Unexpected Tally event' }, 400)
  }

  const fields: TallyField[] = Array.isArray(payload.data.fields) ? payload.data.fields : []
  const answers: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.label) answers[field.label] = readableValue(field)
  }

  const answer = (label: string) => answers[label] ?? null
  const requestTypes = answer('What do you need TRV to help you with?')
  const requestTypeList = Array.isArray(requestTypes)
    ? requestTypes.map(String)
    : requestTypes ? [String(requestTypes)] : []
  const serviceFeeAnswer = String(answer("Before we continue, please confirm that you understand TRV's professional service fee policy.") ?? '')
  const serviceFeeStatus = /question|clarif/i.test(serviceFeeAnswer)
    ? 'question'
    : /understand|agree|accept/i.test(serviceFeeAnswer) ? 'accepted' : 'not_answered'

  const row = {
    tally_event_id: String(payload.eventId ?? ''),
    tally_submission_id: String(payload.data.submissionId ?? payload.data.responseId ?? ''),
    tally_form_id: String(payload.data.formId),
    requester_email: String(answer('What is your email address?') ?? '').trim().toLowerCase(),
    requester_phone: answer('What is the best phone number to reach you?'),
    primary_first_name: answer("Primary traveler’s legal first name"),
    primary_middle_name: answer("Primary traveler’s legal middle name"),
    primary_last_name: answer("Primary traveler’s legal last name"),
    primary_date_of_birth: toDate(answer("Primary traveler’s date of birth")),
    request_types: requestTypeList,
    origin: answer('Where are you traveling from?'),
    destination: answer('Where are you headed?') ?? answer('Where do you need to go?'),
    departure_date: toDate(answer('When would you like to leave?')),
    return_date: toDate(answer('When would you like to return?')),
    dates_flexible: answer('Are your dates flexible?'),
    traveler_count: toNumber(answer('How many people are traveling?') ?? answer('How many travelers are going?')),
    contact_preference: answer('How would you prefer TRV to contact you?'),
    urgency: answer('How soon do you need TRV to begin working on this request?'),
    is_group_request: requestTypeList.some((value) => /group travel/i.test(value)),
    expected_group_travelers: toNumber(answer('Approximately how many travelers are expected?')),
    expected_group_rooms: toNumber(answer('How many rooms or accommodations do you expect to need?')),
    separate_group_payments: toBoolean(answer('Will travelers be paying separately?')),
    service_fee_status: serviceFeeStatus,
    answers,
    submitted_at: payload.data.createdAt ?? payload.createdAt ?? new Date().toISOString(),
  }

  if (!row.tally_submission_id || !row.requester_email) {
    return jsonResponse({ error: 'Submission ID and traveler email are required' }, 422)
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/travel_requests?on_conflict=tally_submission_id`,
    {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    },
  )

  if (!response.ok) {
    const detail = await response.text()
    console.error('Unable to store Tally submission', response.status, detail)
    return jsonResponse({ error: 'Unable to store submission' }, 500)
  }

  return jsonResponse({ received: true }, 200)
})
