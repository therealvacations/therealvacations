import { supabase } from './supabase-client.js'

// ==========================================
// SIGNUP
// ==========================================
export async function handleSignup(formData) {
  const { email, password, firstName, lastName, phone, tripInterest } = formData

  // 1. Create auth user in Supabase Auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
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
export async function handleGoogleLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/my-trips'
    }
  })
  if (error) throw new Error(error.message)
  return data
}

// ==========================================
// FACEBOOK LOGIN
// ==========================================
export async function handleFacebookLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: window.location.origin + '/my-trips'
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
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password'
  })
  if (error) throw new Error(error.message)
  return data
}
