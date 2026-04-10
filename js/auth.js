import { supabase } from './supabase-client.js'

// ==========================================
// SIGNUP
// ==========================================
export async function handleSignup(formData) {
  const { email, password, firstName, lastName, phone } = formData

  // 1. Create auth user in Supabase Auth
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName }
    }
  })

  if (signUpError) {
    throw new Error(signUpError.message)
  }

  // 2. Create user profile in users table
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('users')
      .insert([{
        user_id: authData.user.id,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null
      }])

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't throw — auth succeeded, profile can be retried
    }
  }

  // 3. Store name for dashboard greeting
  try {
    localStorage.setItem('trv_user_name', firstName)
    localStorage.setItem('trv_user_email', email)
  } catch(e) {}

  return authData.user
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

  // Store name for dashboard
  try {
    const firstName = data.user.user_metadata?.first_name || ''
    localStorage.setItem('trv_user_name', firstName)
    localStorage.setItem('trv_user_email', email)
  } catch(e) {}

  return data.user
}

// ==========================================
// GOOGLE LOGIN
// ==========================================
export async function handleGoogleLogin() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/dashboard'
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
      redirectTo: window.location.origin + '/dashboard'
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
  try {
    localStorage.removeItem('trv_user_name')
    localStorage.removeItem('trv_user_email')
  } catch(e) {}
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
    redirectTo: window.location.origin + '/update-password'
  })
  if (error) throw new Error(error.message)
  return data
}
