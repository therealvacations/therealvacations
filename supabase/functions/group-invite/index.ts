import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  })
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://therealvacations.com').replace(/\/$/, '')
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')

  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500)
  if (!token) return jsonResponse({ error: 'Sign in is required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData.user
  if (authError || !user) return jsonResponse({ error: 'Invalid session' }, 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const groupId = String(body.group_id ?? '')
  const invitedEmail = String(body.invited_email ?? '').trim().toLowerCase() || null
  const displayName = String(body.display_name ?? '').trim().slice(0, 120) || null
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(groupId)) {
    return jsonResponse({ error: 'A valid group is required' }, 422)
  }
  if (invitedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
    return jsonResponse({ error: 'Enter a valid traveler email' }, 422)
  }

  const { data: group, error: groupError } = await admin
    .from('travel_groups')
    .select('group_id, leader_user_id')
    .eq('group_id', groupId)
    .maybeSingle()
  if (groupError || !group || group.leader_user_id !== user.id) {
    return jsonResponse({ error: 'Only the group leader can invite travelers' }, 403)
  }

  const code = randomCode()
  const tokenHash = await sha256(code)
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  if (invitedEmail) {
    await admin
      .from('travel_group_invitations')
      .update({ status: 'revoked' })
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .ilike('invited_email', invitedEmail)

    const { data: pendingMember } = await admin
      .from('travel_group_members')
      .select('membership_id')
      .eq('group_id', groupId)
      .is('user_id', null)
      .eq('status', 'invited')
      .ilike('invited_email', invitedEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const memberRow = {
      invited_email: invitedEmail,
      display_name: displayName,
      invited_at: new Date().toISOString(),
      status: 'invited',
    }
    const memberWrite = pendingMember
      ? await admin.from('travel_group_members').update(memberRow).eq('membership_id', pendingMember.membership_id)
      : await admin.from('travel_group_members').insert({ ...memberRow, group_id: groupId })
    if (memberWrite.error) {
      console.error('Unable to record invited group member', memberWrite.error.message)
      return jsonResponse({ error: 'Unable to create invitation' }, 500)
    }
  }

  const { error: invitationError } = await admin.from('travel_group_invitations').insert({
    group_id: groupId,
    invited_by: user.id,
    invited_email: invitedEmail,
    token_hash: tokenHash,
    expires_at: expiresAt,
  })
  if (invitationError) {
    console.error('Unable to store group invitation', invitationError.message)
    return jsonResponse({ error: 'Unable to create invitation' }, 500)
  }

  return jsonResponse({
    join_url: `${siteUrl}/join-group?code=${encodeURIComponent(code)}`,
    expires_at: expiresAt,
  })
})
