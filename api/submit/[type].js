import { createClient } from '@supabase/supabase-js';

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const truthy=v=>['true','1','yes','on'].includes(clean(v).toLowerCase());

function cleanValue(value) {
  return String(value ?? '').trim();
}

function splitName(fullName) {
  const parts = cleanValue(fullName).split(/\s+/).filter(Boolean);
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

function truthyCheck(value) {
  return ['yes','true','1','on'].includes(cleanValue(value).toLowerCase());
}

const actions = {
  'contact': submitContact,
  'quote-selection': submitQuoteSelection,
  'service-request': submitServiceRequest,
  'trivia-entry': submitTriviaEntry,
  'report-problem': reportProblem,
};

export default async function handler(req,res){
  const type = req.query.type;
  const fn = actions[type];
  if(!fn) return res.status(404).json({error:'Not found'});
  return fn(req,res);
}

async function submitContact(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const body=req.body||{};
  if(clean(body.website,120)) return res.status(200).json({ok:true});
  const fullName=clean(body.full_name,120);
  const email=clean(body.email,254).toLowerCase();
  const phone=clean(body.phone,50)||null;
  const topic=clean(body.trip_interest,160)||null;
  const message=clean(body.message,5000);
  const travelersRaw=Number(body.num_travelers||0);
  const travelers=Number.isFinite(travelersRaw)&&travelersRaw>0?Math.min(500,Math.trunc(travelersRaw)):null;

  if(fullName.length<2||!emailOk(email)||message.length<5){
    return res.status(422).json({error:'Name, valid email, and message are required.'});
  }

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await admin.from('contact_submissions').insert({
    full_name:fullName,
    email,
    phone,
    trip_interest:topic,
    num_travelers:travelers,
    message,
    status:'new',
    updated_at:new Date().toISOString()
  }).select('submission_id').single();

  if(error||!data?.submission_id){
    console.error('Contact submission insert failed',error?.message);
    return res.status(500).json({error:'Your message could not be saved. Please try again.'});
  }

  const callEmail=async(template_type,suffix)=>{
    try{
      const response=await fetch(supabaseUrl+'/functions/v1/send-email',{
        method:'POST',
        headers:{'content-type':'application/json','authorization':'Bearer '+serviceKey,'apikey':serviceKey},
        body:JSON.stringify({
          template_type,
          submission_id:data.submission_id,
          event_id:'contact-'+data.submission_id+'-'+suffix
        })
      });
      if(!response.ok) console.error('Contact email failed',template_type,response.status);
    }catch(err){console.error('Contact email failed',template_type,err?.message||err);}
  };
  await Promise.all([
    callEmail('contact_received','traveler'),
    callEmail('contact_admin_notification','admin')
  ]);

  return res.status(200).json({ok:true,submission_id:data.submission_id});
}

async function submitQuoteSelection(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Unauthorized'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return res.status(401).json({error:'Unauthorized'});

  const sourceQuoteId=String(req.body?.quote_id||'').trim();
  const selectedIds=Array.isArray(req.body?.selected_item_ids)
    ? [...new Set(req.body.selected_item_ids.map(v=>String(v||'').trim()).filter(Boolean))]
    : [];
  const note=String(req.body?.note||'').trim()||null;

  if(!sourceQuoteId||!selectedIds.length) return res.status(422).json({error:'Choose the trip components you want before submitting.'});

  const {data:quote,error:quoteError}=await admin.from('travel_quotes')
    .select('quote_id,request_id,title,summary,status,currency,deposit_amount,valid_until,travel_requests!inner(user_id),travel_quote_options(option_id,name,sort_order,travel_quote_items(item_id,option_id,category,title,description,amount,quantity,sort_order,details,admin_notes,supplier_id,image_url,selection_group,selection_rule,client_visible,builder_managed,attachments))')
    .eq('quote_id',sourceQuoteId).maybeSingle();

  if(quoteError||!quote) return res.status(404).json({error:'Quote not found'});
  const request=Array.isArray(quote.travel_requests)?quote.travel_requests[0]:quote.travel_requests;
  if(!request?.user_id||request.user_id!==user.id) return res.status(403).json({error:'This quote does not belong to your account.'});
  if(!['ready','viewed'].includes(quote.status)) return res.status(409).json({error:'This quote is not currently open for selections.'});
  if(quote.valid_until&&new Date(quote.valid_until).getTime()<Date.now()) return res.status(409).json({error:'This quote has expired. Ask TRV to refresh pricing.'});

  const allItems=(quote.travel_quote_options||[]).flatMap(o=>(o.travel_quote_items||[]).filter(i=>i.builder_managed===true).map(i=>({...i,option_name:o.name,option_sort:o.sort_order})));
  const itemMap=new Map(allItems.map(i=>[i.item_id,i]));
  const selected=selectedIds.map(id=>itemMap.get(id)).filter(Boolean);
  if(selected.length!==selectedIds.length) return res.status(422).json({error:'One or more selected items are not part of this quote.'});
  if(selected.some(i=>i.client_visible===false)) return res.status(422).json({error:'One or more selected items are not available for client selection.'});

  const grouped=new Map();
  for(const item of allItems.filter(i=>i.client_visible!==false)){
    const rule=item.selection_rule||'fixed';
    const group=(item.selection_group||'').trim();
    if(!group) continue;
    if(!grouped.has(group)) grouped.set(group,{rule,items:[]});
    grouped.get(group).items.push(item);
  }

  for(const [group,info] of grouped){
    const count=selected.filter(i=>(i.selection_group||'').trim()===group).length;
    if(info.rule==='choose_one'&&count!==1) return res.status(422).json({error:'Choose exactly one option for '+group+'.'});
    if(info.rule==='fixed'&&count!==1) return res.status(422).json({error:'The required '+group+' item must remain in your selection.'});
    if(info.rule==='optional'&&count>1) return res.status(422).json({error:'Choose no more than one option for '+group+'.'});
  }

  const ungroupedFixed=allItems.filter(i=>i.client_visible!==false&&(i.selection_rule||'fixed')==='fixed'&&!(i.selection_group||'').trim());
  for(const fixed of ungroupedFixed){
    if(!selectedIds.includes(fixed.item_id)) return res.status(422).json({error:'A required trip item is missing from your selection.'});
  }

  const pricedSelected=selected.filter(i=>String(i.category||'').toLowerCase()!=='processing_fee'&&!/^(fees|processing convenience fee)$/i.test(String(i.title||'')));
  const subtotal=pricedSelected.reduce((sum,i)=>sum+Math.max(0,Number(i.amount)||0),0);
  const processingFee=Math.round(subtotal*0.035);
  const total=subtotal+processingFee;
  if(total<=0) return res.status(422).json({error:'The selected trip does not have a valid total yet.'});

  const now=new Date().toISOString();
  const {data:newQuote,error:newQuoteError}=await admin.from('travel_quotes').insert({
    request_id:quote.request_id,
    title:(quote.title||'TRV Proposal')+' — Client Selection',
    summary:'Client-built selection submitted for TRV price and availability verification.',
    status:'draft',
    currency:quote.currency||'USD',
    total_amount:0,
    deposit_amount:null,
    valid_until:quote.valid_until,
    quote_kind:'custom_selection',
    source_quote_id:quote.quote_id,
    workflow_status:'admin_review',
    created_by:null,
    updated_at:now
  }).select('quote_id').single();
  if(newQuoteError) return res.status(500).json({error:'Your selection could not be prepared for review.'});

  const {data:newOption,error:newOptionError}=await admin.from('travel_quote_options').insert({
    quote_id:newQuote.quote_id,
    name:'Custom Quote — Client Selection',
    description:'Built from the traveler's selected components. Pending TRV verification.',
    sort_order:0,
    total_amount:0,
    deposit_amount:null,
    is_recommended:true,
    allow_mix_and_match:false,
    details:{source_quote_id:quote.quote_id}
  }).select('option_id').single();
  if(newOptionError){
    await admin.from('travel_quotes').delete().eq('quote_id',newQuote.quote_id);
    return res.status(500).json({error:'Your custom quote option could not be created.'});
  }

  const {data:selection,error:selectionError}=await admin.from('travel_quote_client_selections').insert({
    source_quote_id:quote.quote_id,
    generated_quote_id:newQuote.quote_id,
    user_id:user.id,
    selected_item_ids:selectedIds,
    selected_option_ids:[...new Set(selected.map(i=>i.option_id))],
    total_amount:total,
    status:'admin_review',
    note,
    updated_at:now
  }).select('selection_id').single();
  if(selectionError){
    await admin.from('travel_quotes').delete().eq('quote_id',newQuote.quote_id);
    return res.status(500).json({error:'Your selection could not be submitted for review.'});
  }

  await admin.from('travel_quotes').update({workflow_status:'selection_submitted',updated_at:now}).eq('quote_id',quote.quote_id);
  await admin.from('travel_requests').update({status:'quote_in_progress'}).eq('request_id',quote.request_id);

  return res.status(200).json({
    ok:true,
    selection_id:selection.selection_id,
    generated_quote_id:newQuote.quote_id,
    total_amount:total,
    status:'admin_review'
  });
}

async function submitServiceRequest(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }

  const supabaseUrl = (process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).send('Server configuration error');
  }

  try {
    const body = normalizeBody(req);
    const serviceType = cleanValue(body.service_type) || 'website-service-request';
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

      if (!truthyCheck(body.supplier_confirmation_acknowledged) ||
          !truthyCheck(body.payment_authorization_acknowledged)) {
        return res.status(422).json({ error: 'Please accept the supplier-confirmation and payment authorization terms.' });
      }
      if (cleanValue(body.authorization_signer_name).length < 2) {
        return res.status(422).json({ error: 'Type your full legal name as your electronic signature.' });
      }
      const expedited=/within-72-hours|within-5-days/i.test(cleanValue(body.urgency));
      if (serviceType === 'custom-trip' && expedited) {
        return res.status(422).json({
          error: 'Full custom/group planning is not available through the expedited path. For travel within 5 days, choose Flight, Hotel, and/or Rental Car from Request Travel.'
        });
      }
      if (expedited && !truthyCheck(body.expedited_fee_acknowledged)) {
        return res.status(422).json({ error: 'Please acknowledge the expedited-service fee policy for last-minute travel.' });
      }
      if (expedited) {
        const allowed=new Set(['Flight','Hotel','Rental Car']);
        const disallowed=(body.services_needed||[]).map(cleanValue).filter(Boolean).filter(service=>!allowed.has(service));
        if (disallowed.length) {
          return res.status(422).json({
            error: 'Expedited requests are limited to Flight, Hotel, and Rental Car. Choose Standard for cruise, tickets/attractions, or full custom/group planning.'
          });
        }
      }
    }

    const submittedEmail = cleanValue(body.email).toLowerCase();
    const email = bookingFlow ? cleanValue(authenticatedUser.email).toLowerCase() : submittedEmail;
    const fullName = cleanValue(body.full_name);
    const { first, last } = splitName(fullName);
    const requestTypes = serviceType === 'travel-request' && body.services_needed.length
      ? body.services_needed.map((value) => cleanValue(value)).filter(Boolean)
      : [serviceType];

    if (!email || !email.includes('@') || !fullName) {
      return res.status(422).json({ error: 'Name and email are required.' });
    }

    const submissionId = `website-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const serviceDetails = {
      flight: {
        origin: cleanValue(body.flight_origin) || null,
        destination: cleanValue(body.flight_destination) || null,
        depart_date: cleanValue(body.flight_depart_date) || null,
        return_date: cleanValue(body.flight_return_date) || null,
        preferred_times: cleanValue(body.flight_times) || null,
        airline_preferences: cleanValue(body.flight_airline) || null,
        cabin: cleanValue(body.flight_cabin) || null,
        traveler_notes: cleanValue(body.traveler_details) || null,
      },
      hotel: {
        destination: cleanValue(body.hotel_destination) || null,
        check_in: cleanValue(body.hotel_check_in) || null,
        check_out: cleanValue(body.hotel_check_out) || null,
        rooms_or_suites: cleanValue(body.hotel_rooms) || null,
        preferences: cleanValue(body.hotel_preferences) || null,
      },
      rental_car: {
        pickup_location: cleanValue(body.car_pickup_location) || null,
        return_location: cleanValue(body.car_return_location) || null,
        pickup_date: cleanValue(body.car_pickup_date) || null,
        pickup_time: cleanValue(body.car_pickup_time) || null,
        return_date: cleanValue(body.car_return_date) || null,
        return_time: cleanValue(body.car_return_time) || null,
        vehicle_type: cleanValue(body.car_type) || null,
      },
      cruise: {
        destination: cleanValue(body.cruise_destination) || null,
        dates: cleanValue(body.cruise_dates) || null,
        departure_port: cleanValue(body.cruise_port) || null,
        cabins: cleanValue(body.cruise_cabins) || null,
        cabin_type: cleanValue(body.cruise_cabin_type) || null,
        preferences: cleanValue(body.cruise_preferences) || null,
      },
      tickets: {
        attraction: cleanValue(body.ticket_attraction) || null,
        dates: cleanValue(body.ticket_dates) || null,
        quantity: cleanValue(body.ticket_quantity) || null,
        details: cleanValue(body.ticket_details) || null,
      },
      custom_trip: {
        destination: cleanValue(body.custom_destination) || cleanValue(body.destination) || null,
        dates: cleanValue(body.custom_dates) || cleanValue(body.preferred_dates) || null,
        trip_type: cleanValue(body.custom_trip_type) || null,
        lodging_type: cleanValue(body.custom_lodging_type) || cleanValue(body.lodging_type) || null,
        hotel_rooms_or_suites: cleanValue(body.custom_hotel_rooms) || cleanValue(body.custom_hotel_rooms_either) || cleanValue(body.hotel_rooms_or_suites) || cleanValue(body.hotel_rooms_or_suites_either) || null,
        bedrooms: cleanValue(body.custom_bedrooms) || cleanValue(body.custom_bedrooms_either) || cleanValue(body.lodging_bedrooms) || cleanValue(body.lodging_bedrooms_either) || null,
        bathrooms: cleanValue(body.custom_bathrooms) || cleanValue(body.custom_bathrooms_either) || cleanValue(body.lodging_bathrooms) || cleanValue(body.lodging_bathrooms_either) || null,
        lodging_preferences: cleanValue(body.custom_lodging_preferences) || cleanValue(body.lodging_preferences) || null,
      },
      lodging: {
        type: cleanValue(body.lodging_type) || null,
        hotel_rooms_or_suites: cleanValue(body.hotel_rooms_or_suites) || cleanValue(body.hotel_rooms_or_suites_either) || null,
        bedrooms: cleanValue(body.lodging_bedrooms) || cleanValue(body.lodging_bedrooms_either) || null,
        bathrooms: cleanValue(body.lodging_bathrooms) || cleanValue(body.lodging_bathrooms_either) || null,
        preferences: cleanValue(body.lodging_preferences) || null,
      },
    };

    const answers = {
      source: 'therealvacations.com',
      service_type: serviceType,
      full_name: fullName,
      email,
      phone: cleanValue(body.phone) || null,
      destination: cleanValue(body.destination) || null,
      preferred_dates: cleanValue(body.preferred_dates) || null,
      group_size: cleanValue(body.group_size) || null,
      trip_type: cleanValue(body.trip_type) || null,
      budget_range: cleanValue(body.budget_range) || null,
      urgency: cleanValue(body.urgency) || null,
      expedited_request: /within-72-hours|within-5-days/i.test(cleanValue(body.urgency)),
      preferences: cleanValue(body.preferences) || null,
      group_details: cleanValue(body.group_details) || null,
      traveler_details: cleanValue(body.traveler_details) || null,
      company_name: cleanValue(body.company_name) || null,
      artist_or_group: cleanValue(body.artist_or_group) || null,
      supplier_confirmation_acknowledged: cleanValue(body.supplier_confirmation_acknowledged) || null,
      payment_authorization_acknowledged: cleanValue(body.payment_authorization_acknowledged) || null,
      expedited_fee_acknowledged: cleanValue(body.expedited_fee_acknowledged) || null,
      payment_method_summary: savedMethod ? {
        brand: savedMethod.brand || null,
        last4: savedMethod.last4 || null,
        exp_month: savedMethod.exp_month || null,
        exp_year: savedMethod.exp_year || null,
      } : null,
      services_needed: body.services_needed,
      service_details: serviceDetails,
    };

    const groupSizeMatch = cleanValue(body.group_size).match(/\d+/);
    const travelerCount = groupSizeMatch ? Number(groupSizeMatch[0]) : null;

    const { data: inserted, error } = await supabase.from('travel_requests').insert({
      tally_event_id: submissionId,
      tally_submission_id: submissionId,
      tally_form_id: 'website-service-form',
      user_id: authenticatedUser?.id || null,
      requester_email: email,
      requester_phone: cleanValue(body.phone) || null,
      primary_first_name: first,
      primary_last_name: last,
      request_types: requestTypes,
      destination: cleanValue(body.destination) || null,
      traveler_count: travelerCount,
      urgency: cleanValue(body.urgency) || null,
      is_group_request: travelerCount ? travelerCount > 1 : false,
      service_fee_status: truthyCheck(body.expedited_fee_acknowledged) ? 'accepted' : 'not_answered',
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
        p_signer_name: cleanValue(body.authorization_signer_name),
        p_supplier_confirmation_authorized: true,
        p_payment_after_confirmation_authorized: true,
        p_expedited_fee_acknowledged: truthyCheck(body.expedited_fee_acknowledged),
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

    if (bookingFlow && authenticatedUser?.id) {
      const selectedServices=(body.services_needed||[]).map((value)=>cleanValue(value)).filter(Boolean);
      const note=[
        'Traveler submitted a new TRV travel request.',
        selectedServices.length ? 'Services: '+selectedServices.join(', ')+'.' : null,
        cleanValue(body.destination) ? 'Destination: '+cleanValue(body.destination)+'.' : null,
        cleanValue(body.preferred_dates) ? 'Dates: '+cleanValue(body.preferred_dates)+'.' : null,
        cleanValue(body.urgency) ? 'Urgency: '+cleanValue(body.urgency)+'.' : null
      ].filter(Boolean).join(' ');
      await supabase.from('admin_client_history').insert({
        user_id:authenticatedUser.id,
        request_id:inserted.request_id,
        quote_id:null,
        entry_type:'client_request',
        note,
        metadata:{source:'request_travel',services:selectedServices,urgency:cleanValue(body.urgency)||null},
        occurred_at:new Date().toISOString(),
        created_by:null,
        actor_type:'client',
        actor_user_id:authenticatedUser.id,
        actor_label:fullName||'Traveler'
      });
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
          secured_request: bookingFlow,
          event_id: submissionId,
        }),
      });
    } catch (emailError) {
      console.error('Confirmation email failed', emailError);
    }

    if (cleanValue(body.response_mode).toLowerCase() === 'json' ||
        String(req.headers.accept || '').includes('application/json')) {
      return res.status(200).json({
        ok: true,
        request_id: inserted.request_id,
        redirect: bookingFlow ? '/request-received?mode=secured' : '/request-received?mode=inquiry',
      });
    }

    res.writeHead(303, { Location: bookingFlow ? '/request-received?mode=secured' : '/request-received?mode=inquiry' });
    return res.end();
  } catch (error) {
    console.error('Service request handler failed', error);
    return res.status(500).json({ error: 'Unable to submit request.' });
  }
}

async function submitTriviaEntry(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const now=Date.now();
  const promoStart=Date.parse('2026-10-05T04:00:00Z');
  const promoEnd=Date.parse('2026-11-18T04:59:59Z');
  if(now<promoStart||now>promoEnd){
    return res.status(409).json({error:'The Travel Trivia entry period is not currently open.'});
  }

  const body=req.body||{};
  if(clean(body.website,100)) return res.status(200).json({ok:true});
  const fullName=clean(body.full_name,120);
  const email=clean(body.email,254).toLowerCase();
  const stateOrDc=clean(body.state_or_dc,80);
  const q1=Number(body.quiz_1_score);
  const q2=Number(body.quiz_2_score);
  const q3=Number(body.quiz_3_score);
  const completed=truthy(body.completed_consecutively);
  const ageEligible=truthy(body.age_eligible);
  const residencyEligible=truthy(body.residency_eligible);
  const certified=truthy(body.certification_ack);

  if(fullName.length<2||!emailOk(email)||!stateOrDc){
    return res.status(422).json({error:'Name, valid email, and state/D.C. are required.'});
  }
  if(![q1,q2,q3].every(v=>Number.isFinite(v)&&v>=70&&v<=100)){
    return res.status(422).json({error:'Each official quiz score must be between 70 and 100 to qualify.'});
  }
  if(!completed||!ageEligible||!residencyEligible||!certified){
    return res.status(422).json({error:'Complete all eligibility certifications before submitting.'});
  }

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:existing}=await admin.from('travel_trivia_entries')
    .select('entry_id,status')
    .eq('email_normalized',email)
    .maybeSingle();
  if(existing){
    return res.status(409).json({error:'An official Travel Trivia entry has already been submitted for this email address.'});
  }

  const {data,error}=await admin.from('travel_trivia_entries').insert({
    full_name:fullName,
    email,
    state_or_dc:stateOrDc,
    quiz_1_score:Math.round(q1),
    quiz_2_score:Math.round(q2),
    quiz_3_score:Math.round(q3),
    completed_consecutively:true,
    age_eligible:true,
    residency_eligible:true,
    certification_ack:true,
    status:'submitted'
  }).select('entry_id').single();

  if(error||!data?.entry_id){
    if(error?.code==='23505') return res.status(409).json({error:'An official Travel Trivia entry has already been submitted for this email address.'});
    console.error('Trivia entry insert failed',error?.message);
    return res.status(500).json({error:'Your entry could not be saved. Please try again.'});
  }

  try{
    await fetch(supabaseUrl+'/functions/v1/send-email',{
      method:'POST',
      headers:{
        'content-type':'application/json',
        authorization:'Bearer '+serviceKey,
        apikey:serviceKey
      },
      body:JSON.stringify({
        template_type:'travel_trivia_entry',
        entry_id:data.entry_id,
        event_id:'travel-trivia-'+data.entry_id
      })
    });
  }catch(err){
    console.error('Trivia confirmation email failed',err?.message||err);
  }

  return res.status(200).json({ok:true,entry_id:data.entry_id});
}

async function reportProblem(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'https://lqdflvnkiskzmvvknmmh.supabase.co';
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceKey) return res.status(500).json({error:'Server configuration error'});

  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Sign in required'});

  const admin=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user) return res.status(401).json({error:'Sign in required'});

  const body=req.body||{};
  const title=clean(body.title,180);
  const description=clean(body.description,5000);
  if(title.length<3||description.length<5) return res.status(422).json({error:'Add a short title and describe what happened.'});

  const [{data:adminRow},{data:supplierRow},{data:hostRow}]=await Promise.all([
    admin.from('admin_users').select('id').eq('id',user.id).maybeSingle(),
    admin.from('suppliers').select('supplier_id').eq('auth_user_id',user.id).maybeSingle(),
    admin.from('host_profiles').select('user_id').eq('user_id',user.id).maybeSingle()
  ]);
  const reporterRole=adminRow?'admin':supplierRow?'supplier':hostRow?'host':'member';

  const safeContext=body.related_context&&typeof body.related_context==='object'&&!Array.isArray(body.related_context)
    ? body.related_context : {};
  const browserContext=body.browser_context&&typeof body.browser_context==='object'&&!Array.isArray(body.browser_context)
    ? body.browser_context : {};

  const {data,error}=await admin.from('system_issue_reports').insert({
    reporter_user_id:user.id,
    reporter_email:user.email||null,
    reporter_role:reporterRole,
    title,
    description,
    page_url:clean(body.page_url,1200)||null,
    page_path:clean(body.page_path,300)||null,
    page_title:clean(body.page_title,300)||null,
    browser_context:browserContext,
    related_context:safeContext,
    related_record_id:clean(body.related_record_id,80)||null,
    status:'new',
    priority:'normal',
    updated_at:new Date().toISOString()
  }).select('issue_id,status,created_at').single();

  if(error||!data?.issue_id){
    console.error('Issue report insert failed',error?.message);
    return res.status(500).json({error:'Your report could not be saved. Please try again.'});
  }
  return res.status(200).json({ok:true,issue_id:data.issue_id,status:data.status,created_at:data.created_at});
}   
