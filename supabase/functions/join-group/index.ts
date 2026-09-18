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

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500)
  if (!token) return jsonResponse({ error: 'Sign in is required' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await admin.auth.getUser(token)
  const user = authData.user
  if (authError || !user?.email || !user.email_confirmed_at) {
    return jsonResponse({ error: 'A confirmed account is required' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }
  const code = String(body.code ?? '').trim()
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(code)) {
    return jsonResponse({ error: 'Invitation code is invalid' }, 422)
  }

  const { data: groupId, error: joinError } = await admin.rpc('accept_travel_group_invitation', {
    p_token_hash: await sha256(code),
    p_user_id: user.id,
    p_email: user.email.toLowerCase(),
  })
  if (joinError) {
    console.error('Unable to accept group invitation', joinError.message)
    return jsonResponse({ error: 'Invitation is invalid, expired, or belongs to another email address' }, 409)
  }

  return jsonResponse({ joined: true, group_id: groupId })
})
