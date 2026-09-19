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

function truthy(value) {
  return ['yes','true','1','on'].includes(clean(value).toLowerCase());
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
    const serviceType = clean(body.service_type) || 'website-service-request';
    const bookingFlow = ['travel-request', 'custom-trip'].includes(serviceType);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let authenticatedUser = null;
    let savedMethod = null;

    if (bookingFlow) {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Sign in to your TRV account before securing this booking request.' });

      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      authenticatedUser = authData?.user || null;
      if (authError || !authenticatedUser?.email) {
        return res.status(401).json({ error: 'Your TRV sign-in expired. Please sign in again.' });
      }

      const { data: method, error: methodError } = await supabase
        .from('user_payment_methods')
        .select('method_id,stripe_payment_method_id,stripe_customer_id,last4,brand,exp_month,exp_year')
        .eq('user_id', authenticatedUser.id)
        .eq('is_default', true)
        .not('stripe_payment_method_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (methodError || !method?.stripe_payment_method_id) {
        return res.status(422).json({ error: 'Add a secure payment method to your TRV account before securing this booking request.' });
      }
      savedMethod = method;

      if (!truthy(body.supplier_confirmation_acknowledged) ||
          !truthy(body.payment_authorization_acknowledged)) {
        return res.status(422).json({ error: 'Please accept the supplier-confirmation and payment authorization terms.' });
      }
      if (clean(body.authorization_signer_name).length < 2) {
        return res.status(422).json({ error: 'Type your full legal name as your electronic signature.' });
      }
      if (/within-72-hours|within-5-days/i.test(clean(body.urgency)) &&
          !truthy(body.expedited_fee_acknowledged)) {
        return res.status(422).json({ error: 'Please acknowledge the expedited-service fee policy for last-minute travel.' });
      }
    }

    const submittedEmail = clean(body.email).toLowerCase();
    const email = bookingFlow ? clean(authenticatedUser.email).toLowerCase() : submittedEmail;
    const fullName = clean(body.full_name);
    const { first, last } = splitName(fullName);
    const requestTypes = serviceType === 'travel-request' && body.services_needed.length
      ? body.services_needed.map((value) => clean(value)).filter(Boolean)
      : [serviceType];

    if (!email || !email.includes('@') || !fullName) {
      return res.status(422).json({ error: 'Name and email are required.' });
    }

    const submissionId = `website-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const serviceDetails = {
      flight: {
        origin: clean(body.flight_origin) || null,
        destination: clean(body.flight_destination) || null,
        depart_date: clean(body.flight_depart_date) || null,
        return_date: clean(body.flight_return_date) || null,
        preferred_times: clean(body.flight_times) || null,
        airline_preferences: clean(body.flight_airline) || null,
        cabin: clean(body.flight_cabin) || null,
        traveler_notes: clean(body.traveler_details) || null,
      },
      hotel: {
        destination: clean(body.hotel_destination) || null,
        check_in: clean(body.hotel_check_in) || null,
        check_out: clean(body.hotel_check_out) || null,
        rooms_or_suites: clean(body.hotel_rooms) || null,
        preferences: clean(body.hotel_preferences) || null,
      },
      rental_car: {
        pickup_location: clean(body.car_pickup_location) || null,
        return_location: clean(body.car_return_location) || null,
        pickup_date: clean(body.car_pickup_date) || null,
        pickup_time: clean(body.car_pickup_time) || null,
        return_date: clean(body.car_return_date) || null,
        return_time: clean(body.car_return_time) || null,
        vehicle_type: clean(body.car_type) || null,
      },
      cruise: {
        destination: clean(body.cruise_destination) || null,
        dates: clean(body.cruise_dates) || null,
        departure_port: clean(body.cruise_port) || null,
        cabins: clean(body.cruise_cabins) || null,
        cabin_type: clean(body.cruise_cabin_type) || null,
        preferences: clean(body.cruise_preferences) || null,
      },
      tickets: {
        attraction: clean(body.ticket_attraction) || null,
        dates: clean(body.ticket_dates) || null,
        quantity: clean(body.ticket_quantity) || null,
        details: clean(body.ticket_details) || null,
      },
      custom_trip: {
        destination: clean(body.custom_destination) || clean(body.destination) || null,
        dates: clean(body.custom_dates) || clean(body.preferred_dates) || null,
        trip_type: clean(body.custom_trip_type) || null,
        lodging_type: clean(body.custom_lodging_type) || clean(body.lodging_type) || null,
        hotel_rooms_or_suites: clean(body.custom_hotel_rooms) || clean(body.custom_hotel_rooms_either) || clean(body.hotel_rooms_or_suites) || clean(body.hotel_rooms_or_suites_either) || null,
        bedrooms: clean(body.custom_bedrooms) || clean(body.custom_bedrooms_either) || clean(body.lodging_bedrooms) || clean(body.lodging_bedrooms_either) || null,
        bathrooms: clean(body.custom_bathrooms) || clean(body.custom_bathrooms_either) || clean(body.lodging_bathrooms) || clean(body.lodging_bathrooms_either) || null,
        lodging_preferences: clean(body.custom_lodging_preferences) || clean(body.lodging_preferences) || null,
      },
      lodging: {
        type: clean(body.lodging_type) || null,
        hotel_rooms_or_suites: clean(body.hotel_rooms_or_suites) || clean(body.hotel_rooms_or_suites_either) || null,
        bedrooms: clean(body.lodging_bedrooms) || clean(body.lodging_bedrooms_either) || null,
        bathrooms: clean(body.lodging_bathrooms) || clean(body.lodging_bathrooms_either) || null,
        preferences: clean(body.lodging_preferences) || null,
      },
    };

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
      urgency: clean(body.urgency) || null,
      expedited_request: /within-72-hours|within-5-days/i.test(clean(body.urgency)),
      preferences: clean(body.preferences) || null,
      group_details: clean(body.group_details) || null,
      traveler_details: clean(body.traveler_details) || null,
      company_name: clean(body.company_name) || null,
      artist_or_group: clean(body.artist_or_group) || null,
      supplier_confirmation_acknowledged: clean(body.supplier_confirmation_acknowledged) || null,
      payment_authorization_acknowledged: clean(body.payment_authorization_acknowledged) || null,
      expedited_fee_acknowledged: clean(body.expedited_fee_acknowledged) || null,
      payment_method_summary: savedMethod ? {
        brand: savedMethod.brand || null,
        last4: savedMethod.last4 || null,
        exp_month: savedMethod.exp_month || null,
        exp_year: savedMethod.exp_year || null,
      } : null,
      services_needed: body.services_needed,
      service_details: serviceDetails,
    };

    const groupSizeMatch = clean(body.group_size).match(/\d+/);
    const travelerCount = groupSizeMatch ? Number(groupSizeMatch[0]) : null;

    const { data: inserted, error } = await supabase.from('travel_requests').insert({
      tally_event_id: submissionId,
      tally_submission_id: submissionId,
      tally_form_id: 'website-service-form',
      user_id: authenticatedUser?.id || null,
      requester_email: email,
      requester_phone: clean(body.phone) || null,
      primary_first_name: first,
      primary_last_name: last,
      request_types: requestTypes,
      destination: clean(body.destination) || null,
      traveler_count: travelerCount,
      urgency: clean(body.urgency) || null,
      is_group_request: travelerCount ? travelerCount > 1 : false,
      service_fee_status: truthy(body.expedited_fee_acknowledged) ? 'accepted' : 'not_answered',
      status: 'received',
      answers,
      submitted_at: new Date().toISOString(),
    }).select('request_id').single();

    if (error || !inserted?.request_id) {
      console.error('Service request insert failed', error);
      return res.status(500).json({ error: 'Unable to save request.' });
    }

    if (bookingFlow) {
      const sourceIp = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0,120) || null;
      const { error: acceptanceError } = await supabase.rpc('record_travel_request_authorization', {
        p_request_id: inserted.request_id,
        p_user_id: authenticatedUser.id,
        p_method_id: savedMethod.method_id,
        p_signer_name: clean(body.authorization_signer_name),
        p_supplier_confirmation_authorized: true,
        p_payment_after_confirmation_authorized: true,
        p_expedited_fee_acknowledged: truthy(body.expedited_fee_acknowledged),
        p_terms_version: '2026-09-travel-request-v1',
        p_source_ip: sourceIp,
        p_user_agent: String(req.headers['user-agent'] || '').slice(0,500) || null,
      });
      if (acceptanceError) {
        console.error('Travel request authorization failed', acceptanceError);
        await supabase.from('travel_requests').delete().eq('request_id', inserted.request_id);
        return res.status(500).json({ error: 'Your authorization could not be recorded, so the request was not finalized.' });
      }
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

    if (clean(body.response_mode).toLowerCase() === 'json' ||
        String(req.headers.accept || '').includes('application/json')) {
      return res.status(200).json({
        ok: true,
        request_id: inserted.request_id,
        redirect: '/request-received',
      });
    }

    res.writeHead(303, { Location: '/request-received' });
    return res.end();
  } catch (error) {
    console.error('Service request handler failed', error);
    return res.status(500).json({ error: 'Unable to submit request.' });
  }
}
