import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://lqdflvnkiskzmvvknmmh.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_y1wQNdnUFqj16kNVqKhP-A_qTqdu4fW'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
