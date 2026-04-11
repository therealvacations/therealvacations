// lib/auth.ts
import { supabase } from './supabase-integration';

export const auth = {
  // Sign up new admin
  signUp: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  // Login admin
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  // Logout
  signOut: () => supabase.auth.signOut(),

  // Get current session
  getSession: () => supabase.auth.getSession(),

  // Get current user
  getUser: () => supabase.auth.getUser(),

  // Password reset
  resetPassword: (email: string) =>
    supabase.auth.resetPasswordForEmail(email),
};

export default auth;
