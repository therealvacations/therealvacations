import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// BLOG - from blog_posts table
export const blog = {
  list: () => supabase.from('blog_posts').select('*').eq('is_published', true).order('created_at', { ascending: false }),
  single: (slug: string) => supabase.from('blog_posts').select('*').eq('slug', slug).single(),
};

// TRIPS - from trips table
export const trips = {
  list: () => supabase.from('trips').select('*').eq('status', 'active').order('dates_start', { ascending: true }),
  single: (slug: string) => supabase.from('trips').select('*').eq('slug', slug).single(),
};

// REAL STORIES - from testimonials table
export const realStories = {
  list: () => supabase.from('testimonials').select('*').order('created_at', { ascending: false }),
};

// HOW IT WORKS - from faqs table
export const howItWorks = {
  list: () => supabase.from('faqs').select('*').eq('page', 'how-it-works').eq('is_active', true).order('sort_order', { ascending: true }),
};

// DEALS - from deals table
export const deals = {
  list: () => supabase.from('deals').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
};

// RESOURCES - from resources table
export const resources = {
  list: () => supabase.from('resources').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
};

// ABOUT - from about_content table
export const about = {
  get: () => supabase.from('about_content').select('*').eq('id', 1).single(),
};

// CONTACT - submit to contact_submissions table
export const contact = {
  submit: (data: { full_name: string; email: string; phone?: string; trip_interest?: string; num_travelers?: number; message: string }) =>
    supabase.from('contact_submissions').insert([data]),
};

export default supabase;
