import { supabase } from './supabase-client.js'

// ==========================================
// SIGNUP
// ==========================================
export function safePortalPath(value) {
  if (typeof value !== 'string') return '/my-trips'
  if (new Set(['/my-trips', '/dashboard', '/profile', '/settings']).has(value)) return value
  try {
    const parsed = new URL(value, window.location.origin)
    const code = parsed.searchParams.get('code') || ''
    if (parsed.origin === window.location.origin && parsed.pathname === '/join-group' && /^[A-Za-z0-9_-]{20,100}$/.test(code)) {
      return parsed.pathname + '?code=' + encodeURIComponent(code)
    }
    const trip = parsed.searchParams.get('trip') || ''
    const packageCode = parsed.searchParams.get('package') || ''
    if (parsed.origin === window.location.origin && parsed.pathname === '/book-trip' && /^[a-z0-9-]{3,160}$/.test(trip) && /^(general|vip)$/.test(packageCode)) {
      return parsed.pathname + '?trip=' + encodeURIComponent(trip) + '&package=' + encodeURIComponent(packageCode)
    }
  } catch {}
  return '/my-trips'
}

export async function handleSignup(formData) {
  const { email, password, firstName, lastName, phone, tripInterest, nextPath } = formData
  const safeNext = safePortalPath(nextPath)

  // 1. Create auth user in Supabase Auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + safeNext,
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        trip_interest: tripInterest || null
      }
    }
  })

  if (signUpError) {
    throw new Error(signUpError.message)
  }

  // The database trigger creates public.users atomically with auth.users.
  // This avoids half-created accounts when email confirmation is enabled.
  return authData
}

// ==========================================
// LOGIN
// ==========================================
export async function handleLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    throw new Error(error.message)
  }

  // SECURITY FIX: Do not store sensitive data in localStorage
  // Use Supabase session tokens which are secure and managed by Supabase

  return data.user
}

// ==========================================
// GOOGLE LOGIN
// ==========================================
export async function handleGoogleLogin(nextPath = '/my-trips') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + safePortalPath(nextPath)
    }
  })
  if (error) throw new Error(error.message)
  return data
}

// ==========================================
// FACEBOOK LOGIN
// ==========================================
export async function handleFacebookLogin(nextPath = '/my-trips') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: window.location.origin + safePortalPath(nextPath)
    }
  })
  if (error) throw new Error(error.message)
  return data
}

// ==========================================
// LOGOUT
// ==========================================
export async function handleLogout() {
  await supabase.auth.signOut()
  // No need to remove items - they don't exist anymore
  window.location.href = '/'
}

// ==========================================
// CHECK IF LOGGED IN (guard pages)
// ==========================================
export async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '/login'
    return null
  }
  return session.user
}

// ==========================================
// GET CURRENT USER
// ==========================================
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ==========================================
// PASSWORD RESET
// ==========================================
export async function resetPassword(email, resetPath = '/reset-password') {
  const safeResetPath = resetPath === '/reset-password?admin=1' ? resetPath : '/reset-password'
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + safeResetPath
  })
  if (error) throw new Error(error.message)
  return data
}
