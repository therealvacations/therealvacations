import { createClient } from '@supabase/supabase-js';

function clean(value) {
  return String(value ?? '').trim();
}

function splitName(fullName) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || null,
    last: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

function normalizeBody(req) {
  const raw = req.body || {};
  const services = Array.isArray(raw.services_needed)
    ? raw.services_needed
    : raw.services_needed ? [raw.services_needed] : [];
  return { ...raw, services_needed: services };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).send('Server configuration error');
  }

  try {
    const body = normalizeBody(req);
    const email = clean(body.email).toLowerCase();
    const fullName = clean(body.full_name);
    const { first, last } = splitName(fullName);
    const serviceType = clean(body.service_type) || 'website-service-request';

    if (!email || !email.includes('@') || !fullName) {
      return res.status(422).send('Name and email are required');
    }

    const submissionId = `website-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const answers = {
      source: 'therealvacations.com',
      service_type: serviceType,
      full_name: fullName,
      email,
      phone: clean(body.phone) || null,
      destination: clean(body.destination) || null,
      preferred_dates: clean(body.preferred_dates) || null,
      group_size: clean(body.group_size) || null,
      trip_type: clean(body.trip_type) || null,
      budget_range: clean(body.budget_range) || null,
      preferences: clean(body.preferences) || null,
      group_details: clean(body.group_details) || null,
      services_needed: body.services_needed,
    };

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const groupSizeMatch = clean(body.group_size).match(/\d+/);
    const travelerCount = groupSizeMatch ? Number(groupSizeMatch[0]) : null;

    const { error } = await supabase.from('travel_requests').insert({
      tally_event_id: submissionId,
      tally_submission_id: submissionId,
      tally_form_id: 'website-service-form',
      requester_email: email,
      requester_phone: clean(body.phone) || null,
      primary_first_name: first,
      primary_last_name: last,
      request_types: [serviceType],
      destination: clean(body.destination) || null,
      traveler_count: travelerCount,
      is_group_request: travelerCount ? travelerCount > 1 : false,
      service_fee_status: 'not_answered',
      status: 'received',
      answers,
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Service request insert failed', error);
      return res.status(500).send('Unable to save request');
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          template_type: 'request_received',
          tally_submission_id: submissionId,
          event_id: submissionId,
        }),
      });
    } catch (emailError) {
      console.error('Confirmation email failed', emailError);
    }

    res.writeHead(303, { Location: '/request-received' });
    return res.end();
  } catch (error) {
    console.error('Service request handler failed', error);
    return res.status(500).send('Unable to submit request');
  }
}
