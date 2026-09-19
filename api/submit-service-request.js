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
    const requestTypes = serviceType === 'travel-request' && body.services_needed.length
      ? body.services_needed.map((value) => clean(value)).filter(Boolean)
      : [serviceType];

    if (!email || !email.includes('@') || !fullName) {
      return res.status(422).send('Name and email are required');
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
      preferences: clean(body.preferences) || null,
      group_details: clean(body.group_details) || null,
      traveler_details: clean(body.traveler_details) || null,
      services_needed: body.services_needed,
      service_details: serviceDetails,
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
      request_types: requestTypes,
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
