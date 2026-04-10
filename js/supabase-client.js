import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://lqdflvnkiskzmvvknmmh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZGZsdm5raXNrem12dmtubW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjY2MjksImV4cCI6MjA5MDk0MjYyOX0.sU1j_bV5bpxJN7dj8Qa-RRc5GWkuYQu5No_WM5Sea4k'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
